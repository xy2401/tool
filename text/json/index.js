    // Redirect to ensure trailing slash if accessed via /text/json (important for relative path resolution)
    if (!window.location.pathname.endsWith('/') && !window.location.pathname.split('/').pop().includes('.')) {
      window.location.replace(window.location.pathname + '/' + window.location.search + window.location.hash);
    }

    const { createApp, ref, computed, watch, nextTick, onMounted, onUnmounted } = Vue;

    createApp({
      setup() {
        // State
        const rawInput = ref('');
        const parsedRoot = ref(null); // { raw: '', obj: null, startIndex: 0, endIndex: 0 }
        const nodes = ref([]); // Array of nodes: { id, path: [], name, val, isStringifiedInParent, type }
        const selectedNodeId = ref('');
        const indentSpaces = ref('4');
        const isTextareaDirty = ref(false);
        const showPropertiesInTree = ref(true);
        const excludedProperties = ref([]);
        const excludedNodes = ref([]);
        const wordWrap = ref(true);
        const editText = ref('');
        const toasts = ref([]);
        const demoFiles = ref([]);
        const isSyncing = ref(false);
        const isRawFullscreen = ref(false);
        const isEditFullscreen = ref(false);
        const historyItems = ref([]);
        const savedItems = ref([]);
        const loadedDemoText = ref('');
        const isDragging = ref(false);
        const themePreference = ref('system');
        const lineNumbersRef = ref(null);
        const collapsedNodes = ref([]);
        let toastIdCounter = 0;
        let skipHistoryRecord = false;
        let historyDebounceTimeout = null;

        const handleDragOver = () => {
          isDragging.value = true;
        };

        const handleDragLeave = () => {
          isDragging.value = false;
        };

        const handleDrop = (e) => {
          isDragging.value = false;
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
              rawInput.value = event.target.result;
              showToast('文件已载入', `成功读取文件：${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success');
            };
            reader.onerror = () => {
              showToast('载入失败', '读取文件时发生错误，请检查文件格式。', 'error');
            };
            reader.readAsText(file);
          }
        };

        const toggleRawFullscreen = () => {
          isRawFullscreen.value = !isRawFullscreen.value;
        };

        const toggleEditFullscreen = () => {
          isEditFullscreen.value = !isEditFullscreen.value;
        };

        // Load history from localStorage
        const loadHistory = () => {
          try {
            const stored = localStorage.getItem('json_viewer_history');
            if (stored) {
              historyItems.value = JSON.parse(stored);
            }
          } catch (e) {
            console.error('Failed to load history:', e);
          }
        };

        // Save history to localStorage
        const saveHistory = () => {
          try {
            localStorage.setItem('json_viewer_history', JSON.stringify(historyItems.value));
          } catch (e) {
            console.error('Failed to save history:', e);
          }
        };

        // Load saved items from localStorage
        const loadSavedItems = () => {
          try {
            const stored = localStorage.getItem('json_viewer_saved');
            if (stored) {
              savedItems.value = JSON.parse(stored);
            }
          } catch (e) {
            console.error('Failed to load saved items:', e);
          }
        };

        // Save saved items to localStorage
        const saveSavedItems = () => {
          try {
            localStorage.setItem('json_viewer_saved', JSON.stringify(savedItems.value));
          } catch (e) {
            console.error('Failed to save saved items:', e);
          }
        };

        // Save current data manually
        const saveCurrentData = () => {
          const text = rawInput.value;
          if (!text || !text.trim()) {
            showToast('保存失败', '当前工作区无数据，请输入或提取后再保存。', 'warning');
            return;
          }

          const now = new Date();
          const timeStr = now.toLocaleDateString() + ' ' + now.toTimeString().split(' ')[0].substring(0, 5);
          const defaultName = `保存于 ${timeStr}`;
          
          const name = prompt('请输入保存数据的名称：', defaultName);
          if (name === null) return; // Cancelled
          
          const finalName = name.trim() || defaultName;

          savedItems.value.unshift({
            name: finalName,
            text: text.trim()
          });

          saveSavedItems();
          showToast('保存成功', `数据“${finalName}”已成功保存到本地。`, 'success');
        };

        // Add item to history
        const addToHistory = (text) => {
          if (skipHistoryRecord) return;
          if (!text || !text.trim()) return;
          const trimmed = text.trim();

          // Do NOT save if the text is exactly the loaded demo text
          if (trimmed === loadedDemoText.value?.trim()) return;

          // Check if already exists in history to avoid duplication
          const exists = historyItems.value.some(item => item.text.trim() === trimmed);
          if (exists) return;

          const now = new Date();
          const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // "HH:mm"
          
          // Generate title: "HH:mm: prefix of text"
          const displayPrefix = trimmed.substring(0, 45).replace(/\s+/g, ' ');
          const name = `${timeStr}: ${displayPrefix}${trimmed.length > 45 ? '...' : ''}`;

          // Add to beginning of array
          historyItems.value.unshift({
            name,
            text: trimmed
          });

          // Limit to 10 items
          if (historyItems.value.length > 10) {
            historyItems.value = historyItems.value.slice(0, 10);
          }

          saveHistory();
        };

        const debouncedAddToHistory = (text) => {
          if (historyDebounceTimeout) clearTimeout(historyDebounceTimeout);
          historyDebounceTimeout = setTimeout(() => {
            addToHistory(text);
          }, 1500);
        };

        // Auto-extract JSON when rawInput text changes
        watch(rawInput, (newVal) => {
          if (isSyncing.value) return;

          // If raw text changes and no longer matches the loaded demo text, reset it
          if (newVal !== loadedDemoText.value) {
            loadedDemoText.value = '';
          }

          // Silently trigger extraction so it does not spam toasts on keypresses
          extractRootJSON(true);
        });

        // Auto-reformat when formatting options change
        watch(indentSpaces, () => {
          applyFormatting();
        });

        // Load self-describing list of demo files
        const loadDemoList = async () => {
          try {
            const response = await fetch('./data/data.json');
            if (response.ok) {
              demoFiles.value = await response.json();
            } else {
              console.warn('Failed to load demo list:', response.status);
            }
          } catch (e) {
            console.warn('Failed to load demo list:', e);
          }
        };

        const applyTheme = () => {
          let activeTheme = 'dark';
          if (themePreference.value === 'light') {
            activeTheme = 'light';
          } else if (themePreference.value === 'dark') {
            activeTheme = 'dark';
          } else {
            const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            activeTheme = isSystemDark ? 'dark' : 'light';
          }

          const body = document.body;
          if (activeTheme === 'light') {
            body.classList.remove('theme-dark');
            body.classList.add('theme-light');
          } else {
            body.classList.remove('theme-light');
            body.classList.add('theme-dark');
          }
        };

        const applyThemePreference = () => {
          try {
            localStorage.setItem('theme_preference', themePreference.value);
          } catch (e) {}
          applyTheme();
        };

        let systemThemeMedia = null;
        const onSystemThemeChange = () => {
          if (themePreference.value === 'system') {
            applyTheme();
          }
        };

        // Handle Escape key to exit fullscreen
        const handleKeyDown = (e) => {
          if (e.key === 'Escape') {
            isRawFullscreen.value = false;
            isEditFullscreen.value = false;
          }
        };

        onMounted(() => {
          loadDemoList();
          loadHistory();
          loadSavedItems();
          window.addEventListener('keydown', handleKeyDown);

          // Initialize theme
          try {
            const storedTheme = localStorage.getItem('theme_preference');
            if (storedTheme) {
              themePreference.value = storedTheme;
            }
          } catch (e) {}
          applyTheme();

          systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
          if (systemThemeMedia.addEventListener) {
            systemThemeMedia.addEventListener('change', onSystemThemeChange);
          } else if (systemThemeMedia.addListener) {
            systemThemeMedia.addListener(onSystemThemeChange);
          }
        });

        onUnmounted(() => {
          window.removeEventListener('keydown', handleKeyDown);
          if (historyDebounceTimeout) clearTimeout(historyDebounceTimeout);

          if (systemThemeMedia) {
            if (systemThemeMedia.removeEventListener) {
              systemThemeMedia.removeEventListener('change', onSystemThemeChange);
            } else if (systemThemeMedia.removeListener) {
              systemThemeMedia.removeListener(onSystemThemeChange);
            }
          }
        });

        // Computeds
        const selectedNode = computed(() => {
          return nodes.value.find(n => n.id === selectedNodeId.value) || null;
        });

        const filteredNodes = computed(() => {
          return nodes.value.filter(node => {
            // Hide descendants of collapsed nodes
            for (const collapsedId of collapsedNodes.value) {
              if (node.id !== collapsedId && node.id.startsWith(collapsedId + '.')) {
                return false;
              }
            }
            return true;
          });
        });

        const lineNumbersText = computed(() => {
          const text = editText.value || '';
          const count = text.split('\n').length;
          let result = '';
          for (let i = 1; i <= count; i++) {
            if (i > 1) result += '\n';
            result += i;
          }
          return result;
        });

        const syncLineNumberScroll = (e) => {
          if (lineNumbersRef.value) {
            lineNumbersRef.value.scrollTop = e.target.scrollTop;
          }
        };

        const breadcrumbSegments = computed(() => {
          if (!selectedNode.value) return [];
          const path = selectedNode.value.path;
          const segments = [];

          for (let i = 0; i < path.length; i++) {
            const segmentName = path[i];
            const parentPath = path.slice(0, i);

            // Find sibling nodes at this depth with same parent prefix
            const siblings = nodes.value.filter(n => {
              if (n.path.length !== i + 1) return false;
              for (let j = 0; j < i; j++) {
                if (n.path[j] !== parentPath[j]) return false;
              }
              return true;
            });

            // Check if parent value is an array (for [index] label formatting)
            let parentIsArray = false;
            if (i > 0) {
              const parentId = parentPath.join('.');
              const parentNode = nodes.value.find(n => n.id === parentId);
              if (parentNode && Array.isArray(parentNode.val)) {
                parentIsArray = true;
              }
            }

            const nodeId = path.slice(0, i + 1).join('.');

            segments.push({
              label: parentIsArray ? '[' + segmentName + ']' : segmentName,
              nodeId,
              siblings: siblings.map(s => ({
                label: parentIsArray ? '[' + s.path[i] + ']' : s.path[i],
                nodeId: s.id,
                type: s.type,
                isSelected: s.path[i] === segmentName
              }))
            });
          }

          return segments;
        });

        const hasChildren = (nodeId) => {
          return nodes.value.some(n => n.id !== nodeId && n.id.startsWith(nodeId + '.'));
        };

        const toggleCollapse = (nodeId) => {
          const index = collapsedNodes.value.indexOf(nodeId);
          if (index === -1) {
            collapsedNodes.value.push(nodeId);
          } else {
            collapsedNodes.value.splice(index, 1);
          }
        };

        const toggleCollapseAll = () => {
          if (collapsedNodes.value.length > 0) {
            collapsedNodes.value = [];
          } else {
            collapsedNodes.value = nodes.value
              .filter(n => hasChildren(n.id))
              .map(n => n.id);
          }
        };

        const selectedNodeProperties = computed(() => {
          if (!selectedNode.value || !selectedNode.value.val || typeof selectedNode.value.val !== 'object' || Array.isArray(selectedNode.value.val)) {
            return [];
          }
          const val = selectedNode.value.val;
          return Object.keys(val).filter(key => {
            const type = typeof val[key];
            return val[key] === null || type === 'string' || type === 'number' || type === 'boolean';
          }).map(key => {
            const valItem = val[key];
            let displayType = 'Null';
            if (valItem !== null) {
              displayType = typeof valItem;
              displayType = displayType.charAt(0).toUpperCase() + displayType.slice(1);
            }
            return {
              key,
              type: displayType,
              path: [...selectedNode.value.path, key]
            };
          });
        });

        const allPropertiesSelected = computed(() => {
          if (!selectedNode.value || selectedNodeProperties.value.length === 0) return false;
          return selectedNodeProperties.value.every(prop => !excludedProperties.value.includes(prop.key));
        });

        const allNodesSelected = computed(() => {
          if (nodes.value.length <= 1) return false;
          return nodes.value.every(node => node.id === 'main' || !excludedNodes.value.includes(node.id));
        });

        const toggleProperty = (key) => {
          const index = excludedProperties.value.indexOf(key);
          if (index === -1) {
            excludedProperties.value.push(key);
          } else {
            excludedProperties.value.splice(index, 1);
          }
          applyFormatting();
        };

        const toggleAllProperties = () => {
          if (!selectedNode.value) return;
          if (allPropertiesSelected.value) {
            selectedNodeProperties.value.forEach(prop => {
              if (!excludedProperties.value.includes(prop.key)) {
                excludedProperties.value.push(prop.key);
              }
            });
          } else {
            selectedNodeProperties.value.forEach(prop => {
              const index = excludedProperties.value.indexOf(prop.key);
              if (index !== -1) {
                excludedProperties.value.splice(index, 1);
              }
            });
          }
          applyFormatting();
        };

        const toggleAllNodes = () => {
          if (nodes.value.length <= 1) return;
          if (allNodesSelected.value) {
            nodes.value.forEach(node => {
              if (node.id !== 'main' && !excludedNodes.value.includes(node.id)) {
                excludedNodes.value.push(node.id);
              }
            });
          } else {
            nodes.value.forEach(node => {
              if (node.id !== 'main') {
                const index = excludedNodes.value.indexOf(node.id);
                if (index !== -1) {
                  excludedNodes.value.splice(index, 1);
                }
              }
            });
          }
          applyFormatting();
        };

        watch(excludedProperties, () => {
          applyFormatting();
        }, { deep: true });

        const toggleNodeCheckbox = (nodeId) => {
          const index = excludedNodes.value.indexOf(nodeId);
          if (index === -1) {
            excludedNodes.value.push(nodeId);
          } else {
            excludedNodes.value.splice(index, 1);
          }
          applyFormatting();
        };

        watch(excludedNodes, () => {
          applyFormatting();
        }, { deep: true });

        // Add Toast Notification
        const showToast = (title, message, type = 'info', duration = 3000) => {
          const id = toastIdCounter++;
          toasts.value.push({ id, title, message, type });
          setTimeout(() => {
            removeToast(id);
          }, duration);
        };

        const removeToast = (id) => {
          const index = toasts.value.findIndex(t => t.id === id);
          if (index !== -1) {
            toasts.value.splice(index, 1);
          }
        };

        // Try to parse string as JSON safely (Standard JSON parse, unescaped fallback)
        const tryParseJSONString = (str) => {
          if (typeof str !== 'string') return null;
          str = str.trim();
          
          // Must begin with { or [ and end with } or ] to be a JSON object/array candidates
          if (!((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']')))) {
            return null;
          }

          // 1. Direct JSON parse
          try {
            return JSON.parse(str);
          } catch (e) {}

          // 2. Safe JSON-specific double-escaping unescaper
          try {
            let unescaped = str
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .replace(/\\\//g, '/')
              .replace(/\\b/g, '\b')
              .replace(/\\f/g, '\f')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t');
            return JSON.parse(unescaped);
          } catch (e) {}

          // 3. More aggressive character-by-character unescaper mimicking safe template unescaping
          try {
            let unescaped = str.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (match, p1) => {
              if (p1.startsWith('u')) {
                return String.fromCharCode(parseInt(p1.slice(1), 16));
              }
              if (p1.startsWith('x')) {
                return String.fromCharCode(parseInt(p1.slice(1), 16));
              }
              switch (p1) {
                case 'n': return '\n';
                case 'r': return '\r';
                case 't': return '\t';
                case 'b': return '\b';
                case 'f': return '\f';
                case '"': return '"';
                case "'": return "'";
                case '\\': return '\\';
                case '/': return '/';
                default: return p1;
              }
            });
            return JSON.parse(unescaped);
          } catch (e) {}

          return null;
        };

        // Extraction of the initial root JSON in a messy string (Only run once on main input)
        const extractRootJSON = (silent = false) => {
          if (!rawInput.value) {
            if (!silent) {
              showToast('未输入数据', '请输入一些包含 JSON 数据的日志或文本。', 'error');
            }
            return;
          }

          const text = rawInput.value;
          const opening = [];
          const closing = [];

          for (let i = 0; i < text.length; i++) {
            const char = text.charAt(i);
            if (char === '{' || char === '[') opening.push({ char, index: i });
            if (char === '}' || char === ']') closing.push({ char, index: i });
          }

          let matchedRoot = null;

          // Search from the longest substring combinations
          for (let o = 0; o < opening.length; o++) {
            const op = opening[o];
            for (let c = closing.length - 1; c >= 0; c--) {
              const cl = closing[c];
              if (cl.index > op.index) {
                // Bracket check matching
                if ((op.char === '{' && cl.char === '}') || (op.char === '[' && cl.char === ']')) {
                  const substring = text.substring(op.index, cl.index + 1);
                  const parsed = tryParseJSONString(substring);
                  if (parsed !== null) {
                    matchedRoot = {
                      raw: substring,
                      obj: parsed,
                      startIndex: op.index,
                      endIndex: cl.index + 1
                    };
                    break; // Break inner loop, we found a match for this start index
                  }
                }
              }
            }
            if (matchedRoot) break; // Break outer loop, we take the largest match found first
          }

          if (matchedRoot) {
            parsedRoot.value = matchedRoot;
            nodes.value = [];
            
            // Start recursive node extraction
            extractJSONTree(matchedRoot.obj, ['main'], false);
            
            // Set selection
            selectedNodeId.value = 'main';
            editText.value = ''; // Clear current editText to force load from the new root value
            isTextareaDirty.value = false; // Reset dirty state
            excludedProperties.value = []; // Reset excluded properties
            excludedNodes.value = []; // Reset excluded nodes
            collapsedNodes.value = []; // Reset collapsed nodes
            applyFormatting();
            if (!silent) {
              showToast('提取成功', '成功从文本中提取出主 JSON 结构，已生成节点树。', 'success');
              if (historyDebounceTimeout) clearTimeout(historyDebounceTimeout);
              addToHistory(text);
            } else {
              debouncedAddToHistory(text);
            }
          } else {
            parsedRoot.value = null;
            nodes.value = [];
            selectedNodeId.value = '';
            if (!silent) {
              showToast('提取失败', '未在文本中检测到合法的 JSON 结构。请检查格式。', 'error');
            }
          }
        };

        const extractJSONSubstrings = (str) => {
          const results = [];
          let index = 0;
          while (index < str.length) {
            const nextBrace = str.indexOf('{', index);
            const nextBracket = str.indexOf('[', index);
            let startIdx = -1;
            let openChar = '';
            let closeChar = '';
            
            if (nextBrace !== -1 && (nextBracket === -1 || nextBrace < nextBracket)) {
              startIdx = nextBrace;
              openChar = '{';
              closeChar = '}';
            } else if (nextBracket !== -1) {
              startIdx = nextBracket;
              openChar = '[';
              closeChar = ']';
            } else {
              break;
            }

            let foundJSON = null;
            let searchStart = startIdx + 1;
            let closingIndices = [];
            let cIdx = str.indexOf(closeChar, searchStart);
            while (cIdx !== -1) {
              closingIndices.push(cIdx);
              cIdx = str.indexOf(closeChar, cIdx + 1);
            }

            for (let i = closingIndices.length - 1; i >= 0; i--) {
              const endIdx = closingIndices[i];
              const substring = str.substring(startIdx, endIdx + 1);
              const parsed = tryParseJSONString(substring);
              if (parsed !== null) {
                foundJSON = {
                  obj: parsed,
                  start: startIdx,
                  end: endIdx + 1
                };
                break;
              }
            }

            if (foundJSON) {
              results.push(foundJSON);
              index = foundJSON.end;
            } else {
              index = startIdx + 1;
            }
          }
          return results;
        };

        // Recursive tree node extractor
        // Checks direct string values, and also extracts nested JSON substrings from plain string values.
        const extractJSONTree = (val, path, isStringifiedInParent) => {
          const id = path.join('.');
          const name = path[path.length - 1];
          const type = isStringifiedInParent ? 'String(JSON)' : (Array.isArray(val) ? 'Array' : 'Object');

          // Add current node
          nodes.value.push({
            id,
            path,
            name,
            val,
            isStringifiedInParent,
            type
          });

          // Scan children
          if (val && typeof val === 'object') {
            for (const key in val) {
              if (Object.prototype.hasOwnProperty.call(val, key)) {
                const childVal = val[key];
                
                if (typeof childVal === 'string') {
                  const parsedChild = tryParseJSONString(childVal);
                  if (parsedChild !== null) {
                    // Stringified JSON node found. Recurse into it.
                    extractJSONTree(parsedChild, [...path, key], true);
                  } else {
                    // Plain string. Check for nested JSON substrings.
                    const substrings = extractJSONSubstrings(childVal);
                    if (substrings.length > 0) {
                      // 1. Add the log string itself to the nodes list
                      const stringNodeId = [...path, key].join('.');
                      nodes.value.push({
                        id: stringNodeId,
                        path: [...path, key],
                        name: key,
                        val: childVal,
                        isStringifiedInParent: false,
                        type: 'String(Log)'
                      });

                      // 2. Recurse into each JSON substring found inside the string
                      substrings.forEach((sub, subIdx) => {
                        const subName = `json_${subIdx}`;
                        extractJSONTree(sub.obj, [...path, key, subName], true);
                      });
                    }
                  }
                } else if (childVal && typeof childVal === 'object') {
                  // Direct object/array child. Recurse.
                  extractJSONTree(childVal, [...path, key], false);
                }
              }
            }
          }
        };

        // Formatter implementation (JSON.stringify with selected parameters)
        const formatJSON = (val) => {
          let targetVal = val;
          const pathMap = new Map();
          
          if (Array.isArray(val)) {
            targetVal = [];
            val.forEach((item, idx) => {
              const itemPath = [...selectedNode.value.path, String(idx)];
              const itemId = itemPath.join('.');
              if (!excludedNodes.value.includes(itemId)) {
                targetVal.push(item);
                if (item && typeof item === 'object') {
                  pathMap.set(item, itemPath);
                }
              }
            });
          }
          
          pathMap.set(targetVal, selectedNode.value.path);

          const replacer = function(key, value) {
            if (key === '') return value;

            const parentPath = pathMap.get(this);
            if (!parentPath) return value;

            let currentPath;
            if (value && typeof value === 'object' && pathMap.has(value)) {
              currentPath = pathMap.get(value);
            } else {
              currentPath = [...parentPath, key];
            }
            
            const currentId = currentPath.join('.');

            if (value && typeof value === 'object') {
              pathMap.set(value, currentPath);
            }

            // 1. Check if excluded by node tree checkbox (bypass if parent is an array)
            if (!Array.isArray(this) && excludedNodes.value.includes(currentId)) {
              return undefined;
            }

            // 2. Check if excluded by properties checklist under selected node
            const isDirectChild = parentPath.join('.') === selectedNode.value.id;
            if (!Array.isArray(this) && isDirectChild && excludedProperties.value.includes(key)) {
              return undefined;
            }

            // If the value is a nested array, pre-filter it to completely omit excluded items instead of turning them to null
            if (Array.isArray(value)) {
              const filteredArray = [];
              value.forEach((item, idx) => {
                const itemPath = [...currentPath, String(idx)];
                const itemId = itemPath.join('.');
                if (!excludedNodes.value.includes(itemId)) {
                  filteredArray.push(item);
                  if (item && typeof item === 'object') {
                    pathMap.set(item, itemPath);
                  }
                }
              });
              pathMap.set(filteredArray, currentPath);
              return filteredArray;
            }

            return value;
          };

          let space = '';
          if (indentSpaces.value === '2') {
            space = '  ';
          } else if (indentSpaces.value === '4') {
            space = '    ';
          } else if (indentSpaces.value === 'tabs') {
            space = '\t';
          } else if (indentSpaces.value === 'compact') {
            space = '';
          }

          return JSON.stringify(targetVal, replacer, space);
        };

        const applyFormatting = () => {
          if (!selectedNode.value) return;

          // If the user has edited the text AND no filter is active (no excludedProperties or excludedNodes), reformat the current edited text
          if (isTextareaDirty.value && excludedProperties.value.length === 0 && excludedNodes.value.length === 0 && editText.value && editText.value.trim()) {
            try {
              const parsed = JSON.parse(editText.value);
              editText.value = formatJSON(parsed);
              return;
            } catch (e) {
              // Ignore invalid JSON to prevent losing user edits
              return;
            }
          }

          editText.value = formatJSON(selectedNode.value.val);
        };

        // Handle Node Selection
        const selectNode = (nodeId) => {
          selectedNodeId.value = nodeId;
          editText.value = ''; // Clear current editText to force load from selectedNode.value.val
          isTextareaDirty.value = false; // Reset dirty state
          excludedProperties.value = []; // Reset excluded properties when switching nodes
          excludedNodes.value = []; // Reset excluded nodes when switching nodes
          applyFormatting();
        };

        // Copy JSON content to clipboard
        const copyFormattedJSON = async () => {
          if (!editText.value) return;
          try {
            await navigator.clipboard.writeText(editText.value);
            showToast('复制成功', '已复制当前节点格式化 JSON 至剪切板！', 'success');
          } catch (err) {
            showToast('复制失败', '剪切板写入失败，请手动选择复制。', 'error');
          }
        };

        // Download current node JSON as a file
        const downloadNodeJSON = () => {
          if (!editText.value) return;
          try {
            const blob = new Blob([editText.value], { type: 'application/json;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = `${selectedNode.value.id || 'node'}.json`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast('下载成功', `文件已保存为 ${filename}`, 'success');
          } catch (err) {
            showToast('下载失败', '创建下载文件失败，请重试。', 'error');
            console.error(err);
          }
        };

        // Copy raw log content to clipboard
        const copyRawInput = async () => {
          if (!rawInput.value) return;
          try {
            await navigator.clipboard.writeText(rawInput.value);
            showToast('复制成功', '已复制原始日志文本至剪切板！', 'success');
          } catch (err) {
            showToast('复制失败', '剪切板写入失败，请手动选择复制。', 'error');
          }
        };

        // Download raw log content as a file
        const downloadRawInput = () => {
          if (!rawInput.value) return;
          try {
            const blob = new Blob([rawInput.value], { type: 'text/plain;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = `raw_log.txt`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast('下载成功', `原始日志文件已保存为 ${filename}`, 'success');
          } catch (err) {
            showToast('下载失败', '创建下载文件失败，请重试。', 'error');
            console.error(err);
          }
        };

        // Save modifications to current node and bubble up to the root log string
        const saveNodeChanges = () => {
          if (!selectedNode.value) return;

          if (excludedProperties.value.length > 0 || excludedNodes.value.length > 0) {
            showToast('无法保存', '当前隐藏了节点或属性，请先在左侧勾选所有节点与属性再保存，以防止数据丢失。', 'warning');
            return;
          }

          let newObjValue = null;
          try {
            newObjValue = JSON.parse(editText.value);
          } catch (e) {
            showToast('格式错误', 'JSON 格式解析失败，请检查语法错误后再试。', 'error');
            return;
          }

          // Deep merge or update current node value
          selectedNode.value.val = newObjValue;

          // Bubble updates from the selected node up to the root
          let currentVal = newObjValue;
          let currentPath = [...selectedNode.value.path];

          while (currentPath.length > 1) {
            const propName = currentPath[currentPath.length - 1];
            const parentPath = currentPath.slice(0, -1);
            const parentId = parentPath.join('.');

            const parentNode = nodes.value.find(n => n.id === parentId);
            if (!parentNode) break;

            const currentId = currentPath.join('.');
            const currentNodeObj = nodes.value.find(n => n.id === currentId);

            if (currentNodeObj && currentNodeObj.isStringifiedInParent) {
              if (typeof parentNode.val === 'string') {
                // Parent is a string (e.g. String(Log) containing JSON substrings)
                const parentStr = parentNode.val;
                const substrings = extractJSONSubstrings(parentStr);
                let targetSubIndex = -1;
                substrings.forEach((sub, idx) => {
                  const subName = `json_${idx}`;
                  if (subName === propName) {
                    targetSubIndex = idx;
                  }
                });

                if (targetSubIndex !== -1) {
                  const sub = substrings[targetSubIndex];
                  const newParentStr = parentStr.substring(0, sub.start) + JSON.stringify(currentVal) + parentStr.substring(sub.end);
                  parentNode.val = newParentStr;
                }
              } else {
                parentNode.value = parentNode.val; // Reference helper
                parentNode.val[propName] = JSON.stringify(currentVal);
              }
            } else {
              parentNode.val[propName] = currentVal;
            }

            currentVal = parentNode.val;
            currentPath = parentPath;
          }

          // Root node is at nodes.value[0] which represents 'main'
          const rootNode = nodes.value.find(n => n.id === 'main');
          if (rootNode && parsedRoot.value) {
            // Update the main source input text by replacing the extracted substring
            const newRootJSONString = JSON.stringify(rootNode.val);
            const originalText = rawInput.value;
            const updatedRawText = 
              originalText.substring(0, parsedRoot.value.startIndex) + 
              newRootJSONString + 
              originalText.substring(parsedRoot.value.endIndex);

            // Re-apply rawInput value and prevent watch extraction
            isSyncing.value = true;
            rawInput.value = updatedRawText;
            addToHistory(updatedRawText);

            // Shift indices in parsedRoot reference
            parsedRoot.value.endIndex = parsedRoot.value.startIndex + newRootJSONString.length;
            parsedRoot.value.raw = newRootJSONString;

            // Regenerate the node tree structure from the newly parsed root values to keep tree references aligned
            const savedSelectedId = selectedNodeId.value;
            nodes.value = [];
            extractJSONTree(rootNode.val, ['main'], false);
            selectedNodeId.value = savedSelectedId;

            // Reset syncing flag on next DOM update tick
            nextTick(() => {
              isSyncing.value = false;
            });

            // Update text area view
            editText.value = ''; // Clear current editText to force load the newly saved value
            isTextareaDirty.value = false; // Reset dirty state after saving
            excludedProperties.value = []; // Reset excluded properties after saving
            excludedNodes.value = []; // Reset excluded nodes after saving
            applyFormatting();
            showToast('同步成功', '修改已顺利保存并反向合并更新了原始日志文本！', 'success');
          }
        };

        const sortObjectKeys = (val) => {
          if (val === null || typeof val !== 'object') {
            return val;
          }
          if (Array.isArray(val)) {
            return val.map(sortObjectKeys);
          }
          
          const sortedKeys = Object.keys(val).sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
          });

          const sortedObj = {};
          sortedKeys.forEach(key => {
            sortedObj[key] = sortObjectKeys(val[key]);
          });
          return sortedObj;
        };

        const reorderKeys = () => {
          if (!selectedNode.value) return;
          
          let currentJsonText = editText.value;
          if (!currentJsonText || !currentJsonText.trim()) {
            currentJsonText = formatJSON(selectedNode.value.val);
          }
          
          let parsed = null;
          try {
            parsed = JSON.parse(currentJsonText);
          } catch (e) {
            showToast('解析失败', '无法解析当前编辑区中的 JSON，请检查语法后再排序。', 'error');
            return;
          }
          
          const sorted = sortObjectKeys(parsed);
          editText.value = formatJSON(sorted);
          isTextareaDirty.value = true;
          showToast('排序成功', '所有属性名已递归自然排序（尚未保存同步）。', 'success');
        };

        // Load Data dynamically from select (Demo datasets or User history)
        const handleDataSelect = async (event) => {
          const val = event.target.value;
          if (!val) return;
          
          if (val === 'clear') {
            rawInput.value = '';
            parsedRoot.value = null;
            nodes.value = [];
            selectedNodeId.value = '';
            editText.value = '';
            isTextareaDirty.value = false; // Reset dirty state
            excludedProperties.value = []; // Reset excluded properties
            excludedNodes.value = []; // Reset excluded nodes
            showToast('已清空', '工作区和解析记录已成功复位。', 'info');
            event.target.value = '';
            return;
          }

          if (val === 'clear-history') {
            historyItems.value = [];
            saveHistory();
            showToast('历史已清空', '已成功清空所有本地历史输入记录。', 'info');
            event.target.value = '';
            return;
          }

          if (val === 'save-current') {
            saveCurrentData();
            event.target.value = '';
            return;
          }

          if (val === 'clear-saved') {
            if (confirm('确定要清空所有已保存的数据吗？')) {
              savedItems.value = [];
              saveSavedItems();
              showToast('已清空', '已成功清空所有手动保存的数据。', 'info');
            }
            event.target.value = '';
            return;
          }

          // User Saved data loading
          if (val.startsWith('saved-')) {
            const idx = parseInt(val.replace('saved-', ''), 10);
            const savedItem = savedItems.value[idx];
            if (savedItem) {
              skipHistoryRecord = true;
              rawInput.value = savedItem.text;
              parsedRoot.value = null;
              nodes.value = [];
              selectedNodeId.value = '';
              editText.value = '';
              showToast('已加载保存数据', `已成功加载“${savedItem.name}”。`, 'info');
              
              nextTick(() => {
                skipHistoryRecord = false;
              });
            }
            event.target.value = '';
            return;
          }

          // User History data loading
          if (val.startsWith('hist-')) {
            const idx = parseInt(val.replace('hist-', ''), 10);
            const historyItem = historyItems.value[idx];
            if (historyItem) {
              skipHistoryRecord = true;
              rawInput.value = historyItem.text;
              parsedRoot.value = null;
              nodes.value = [];
              selectedNodeId.value = '';
              editText.value = '';
              showToast('已加载历史数据', '已从历史记录中加载输入数据。', 'info');
              
              nextTick(() => {
                skipHistoryRecord = false;
              });
            }
            event.target.value = '';
            return;
          }

          // Demo data loading
          if (val.startsWith('demo-')) {
            const key = val.replace('demo-', '');
            const fileInfo = demoFiles.value.find(f => f.key === key);
            if (!fileInfo) {
              showToast('加载失败', '未找到对应的测试数据配置。', 'error');
              event.target.value = '';
              return;
            }

            try {
              const response = await fetch(fileInfo.path);
              if (response.ok) {
                const text = await response.text();
                skipHistoryRecord = true;
                loadedDemoText.value = text;
                rawInput.value = text;
                parsedRoot.value = null;
                nodes.value = [];
                selectedNodeId.value = '';
                editText.value = '';
                showToast('示例数据已加载', `已加载：${fileInfo.name}。已自动解析。`, 'info');
                
                nextTick(() => {
                  skipHistoryRecord = false;
                });
              } else {
                showToast('加载失败', `无法获取测试数据文件 (${response.status})。`, 'error');
              }
            } catch (e) {
              showToast('加载失败', '网络请求失败，请稍后再试。', 'error');
              console.error(e);
            }
            event.target.value = ''; // Reset select state
            return;
          }
        };

        return {
          rawInput,
          nodes,
          selectedNodeId,
          selectedNode,
          filteredNodes,
          indentSpaces,
          wordWrap,
          editText,
          toasts,
          demoFiles,
          isRawFullscreen,
          isEditFullscreen,
          historyItems,
          savedItems,
          isDragging,
          isTextareaDirty,
          showPropertiesInTree,
          excludedProperties,
          selectedNodeProperties,
          toggleProperty,
          allPropertiesSelected,
          toggleAllProperties,
          allNodesSelected,
          toggleAllNodes,
          excludedNodes,
          toggleNodeCheckbox,
          
          toggleRawFullscreen,
          toggleEditFullscreen,
          handleDragOver,
          handleDragLeave,
          handleDrop,
          extractRootJSON,
          selectNode,
          copyFormattedJSON,
          downloadNodeJSON,
          copyRawInput,
          downloadRawInput,
          themePreference,
          applyThemePreference,
          saveNodeChanges,
          handleDataSelect,
          reorderKeys,
          removeToast,
          lineNumbersRef,
          lineNumbersText,
          syncLineNumberScroll,
          breadcrumbSegments,
          collapsedNodes,
          hasChildren,
          toggleCollapse,
          toggleCollapseAll
        };
      }
    }).mount('#app');
