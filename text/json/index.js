    // Redirect to ensure trailing slash if accessed via /text/json (important for relative path resolution)
    if (!window.location.pathname.endsWith('/') && !window.location.pathname.split('/').pop().includes('.')) {
      window.location.replace(window.location.pathname + '/' + window.location.search + window.location.hash);
    }

    const { createApp, ref, computed, watch, nextTick, onMounted, onUnmounted } = Vue;
    const LARGE_TEXT_BYTES = 1024 * 1024;
    const ULTRA_TEXT_BYTES = 10 * 1024 * 1024;
    const DEFAULT_ADVANCED_OPTIONS = {
      parseStringifiedJson: true,
      scanStringJsonSubstrings: true,
      mergeLines: false,
      previewLimit: 1048576
    };

    createApp({
      setup() {
        // State
        const rawInput = ref('');
        const parsedRoot = ref(null); // { raw: '', obj: null, startIndex: 0, endIndex: 0 }
        const nodes = ref([]); // Array of nodes: { id, path: [], name, val, isStringifiedInParent, type }
        const selectedNodeId = ref('');
        const indentSpaces = ref('4');
        const isTextareaDirty = ref(false);
        const excludedProperties = ref([]);
        const excludedNodes = ref([]);
        const propertyBulkMode = ref('selected');
        const nodeBulkMode = ref('selected');
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
        const activeTab = ref('preview'); // IDE Tab state
        const jsonStats = ref({});
        const jsonSchemaText = ref('');
        const jsonPathsList = ref([]);
        const advancedOptions = ref({ ...DEFAULT_ADVANCED_OPTIONS });
        const parseProgress = ref({
          active: false,
          indeterminate: false,
          percent: 0,
          status: '空闲'
        });
        const inputMode = ref('normal');
        const currentSourceName = ref('');
        const isParsing = ref(false);
        const isPreviewTruncated = ref(false);
        const sourceLoadedFromFile = ref(false);
        let toastIdCounter = 0;
        let skipHistoryRecord = false;
        let historyDebounceTimeout = null;
        let autoExtractTimeout = null;
        let parseWorker = null;
        let parseRequestId = 0;
        let selectedFileForWorker = null;
        let optionSnapshotBeforeUltra = null;
        let previewCache = new Map();

        const estimateTextBytes = (text) => {
          if (!text) return 0;
          try {
            return new Blob([text]).size;
          } catch (e) {
            return text.length * 2;
          }
        };

        const getModeBySize = (sizeBytes) => {
          if (sizeBytes > ULTRA_TEXT_BYTES) return 'ultra';
          if (sizeBytes > LARGE_TEXT_BYTES) return 'large';
          return 'normal';
        };

        const applyInputMode = (sizeBytes) => {
          const nextMode = getModeBySize(sizeBytes || 0);
          if (inputMode.value === nextMode) return;
          inputMode.value = nextMode;

          if (nextMode === 'ultra') {
            if (!optionSnapshotBeforeUltra) {
              optionSnapshotBeforeUltra = { ...advancedOptions.value };
            }
            advancedOptions.value = {
              ...advancedOptions.value,
              parseStringifiedJson: false,
              scanStringJsonSubstrings: false
            };
          } else if (optionSnapshotBeforeUltra) {
            advancedOptions.value = { ...DEFAULT_ADVANCED_OPTIONS, ...optionSnapshotBeforeUltra };
            optionSnapshotBeforeUltra = null;
          }
        };

        const getEffectiveAdvancedOptions = (sizeBytes) => {
          const mode = getModeBySize(sizeBytes || 0);
          const options = {
            ...advancedOptions.value,
            generateStats: true,
            generatePaths: true,
            inferSchema: true,
            mode,
            sizeBytes
          };
          options.includeRootRaw = sizeBytes <= LARGE_TEXT_BYTES;
          return options;
        };

        const setParseProgress = (status, percent = 0, indeterminate = false) => {
          parseProgress.value = {
            active: true,
            indeterminate,
            percent: Math.max(0, Math.min(100, percent || 0)),
            status
          };
        };

        const finishParseProgress = (status = '完成') => {
          parseProgress.value = {
            active: true,
            indeterminate: false,
            percent: 100,
            status
          };
        };

        const resetParseProgress = () => {
          parseProgress.value = {
            active: false,
            indeterminate: false,
            percent: 0,
            status: '空闲'
          };
        };

        const formatSchemaText = (schemaObj, fallbackText = '') => {
          if (!schemaObj) return fallbackText || '';
          try {
            if (window.jsyaml) {
              return window.jsyaml.dump(schemaObj, { indent: 2, lineWidth: -1 });
            }
          } catch (e) {}
          try {
            return JSON.stringify(schemaObj, null, 2);
          } catch (e) {
            return fallbackText || '';
          }
        };

        const handleDragOver = () => {
          isDragging.value = true;
        };

        const handleDragLeave = () => {
          isDragging.value = false;
        };

        const handleDrop = async (e) => {
          isDragging.value = false;
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            const file = files[0];
            selectedFileForWorker = file;
            currentSourceName.value = file.name || '';
            sourceLoadedFromFile.value = true;
            applyInputMode(file.size || 0);

            if ((file.size || 0) <= LARGE_TEXT_BYTES) {
              try {
                skipHistoryRecord = true;
                rawInput.value = await file.text();
                showToast('文件已载入', `成功读取文件：${file.name} (${formatSize(file.size)})`, 'success');
                nextTick(() => {
                  skipHistoryRecord = false;
                });
              } catch (err) {
                skipHistoryRecord = false;
                showToast('载入失败', '读取文件时发生错误，请检查文件格式。', 'error');
              }
              return;
            }

            rawInput.value = '';
            showToast('文件解析中', `已进入${inputMode.value === 'ultra' ? '超大文本' : '大文本'}模式：${file.name} (${formatSize(file.size)})`, 'info', 4500);
            startWorkerParse({ file, silent: false, sourceName: file.name });
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
          if (estimateTextBytes(text) > LARGE_TEXT_BYTES) {
            showToast('保存失败', '大文本不会写入浏览器本地保存区，请使用下载功能保存到文件。', 'warning');
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
          if (estimateTextBytes(trimmed) > LARGE_TEXT_BYTES) return;

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

        const stopParseWorker = () => {
          if (parseWorker) {
            parseWorker.terminate();
            parseWorker = null;
          }
        };

        const startWorkerParse = ({ text = '', file = null, silent = false, sourceName = '' } = {}) => {
          stopParseWorker();
          const requestId = ++parseRequestId;
          const sizeBytes = file ? (file.size || 0) : estimateTextBytes(text);
          applyInputMode(sizeBytes);
          const options = getEffectiveAdvancedOptions(sizeBytes);

          isParsing.value = true;
          isPreviewTruncated.value = false;
          previewCache = new Map();
          setParseProgress(file ? '读取文件' : '定位主 JSON', 0, false);

          try {
            parseWorker = new Worker('./json-worker.js');
          } catch (err) {
            isParsing.value = false;
            parseProgress.value = { active: true, indeterminate: false, percent: 0, status: 'Worker 启动失败' };
            if (!silent) showToast('解析失败', '当前环境无法启动 Worker，无法进行大文本解析。', 'error');
            return;
          }

          parseWorker.onmessage = (event) => {
            if (requestId !== parseRequestId) return;
            const message = event.data || {};
            if (message.type === 'progress') {
              parseProgress.value = {
                active: true,
                indeterminate: !!message.indeterminate,
                percent: message.percent || 0,
                status: message.status || '处理中'
              };
              return;
            }

            if (message.type === 'error') {
              isParsing.value = false;
              parseProgress.value = {
                active: true,
                indeterminate: false,
                percent: 0,
                status: '解析失败'
              };
              if (!silent) showToast('解析失败', message.message || '未检测到合法 JSON。', 'error');
              stopParseWorker();
              return;
            }

            if (message.type !== 'result') return;
            const payload = message.payload || {};

            isParsing.value = false;
            parsedRoot.value = payload.parsedRoot || null;
            nodes.value = Array.isArray(payload.nodes) ? payload.nodes : [];
            selectedNodeId.value = payload.selectedNodeId || (nodes.value[0] ? nodes.value[0].id : '');
            editText.value = payload.editText || '';
            isPreviewTruncated.value = !!payload.isPreviewTruncated;
            if (selectedNodeId.value && editText.value) {
              previewCache.set(selectedNodeId.value, {
                text: editText.value,
                truncated: isPreviewTruncated.value
              });
            }
            jsonStats.value = payload.jsonStats || {};
            jsonPathsList.value = payload.jsonPathsList || [];
            jsonPathsList.value.isTruncated = payload.pathsTruncated || false;
            jsonPathsList.value.isTruncated = payload.pathsTruncated || false;
            jsonSchemaText.value = formatSchemaText(payload.jsonSchemaObject, payload.jsonSchemaText || '');
            inputMode.value = payload.mode || inputMode.value;
            currentSourceName.value = payload.sourceName || sourceName || currentSourceName.value;
            isTextareaDirty.value = false;
            excludedProperties.value = [];
            excludedNodes.value = [];
            propertyBulkMode.value = 'selected';
            nodeBulkMode.value = 'selected';
            collapsedNodes.value = [];
            activeTab.value = 'preview';
            finishParseProgress('解析完成');

            const modeLabel = inputMode.value === 'ultra' ? '超大文本模式' : inputMode.value === 'large' ? '大文本模式' : '普通模式';
            if (!silent) {
              const warningText = payload.warnings && payload.warnings.length ? ` ${payload.warnings[0]}` : '';
              showToast('提取成功', `已完成解析（${modeLabel}），生成 ${nodes.value.length} 个节点。${warningText}`, 'success', 4500);
              if (!file && text && inputMode.value === 'normal') {
                if (historyDebounceTimeout) clearTimeout(historyDebounceTimeout);
                addToHistory(text);
              }
            } else if (!file && text && inputMode.value === 'normal') {
              debouncedAddToHistory(text);
            }
          };

          parseWorker.onerror = (error) => {
            if (requestId !== parseRequestId) return;
            isParsing.value = false;
            parseProgress.value = {
              active: true,
              indeterminate: false,
              percent: 0,
              status: '解析失败'
            };
            if (!silent) showToast('解析失败', error.message || 'Worker 执行失败。', 'error');
            stopParseWorker();
          };

          if (file) {
            parseWorker.postMessage({ type: 'parse-file', file, options, sourceName });
          } else {
            parseWorker.postMessage({ type: 'parse-text', text, options, sourceName });
          }
        };

        // Auto-extract JSON when rawInput text changes
        watch(rawInput, (newVal) => {
          if (isSyncing.value) return;
          if (sourceLoadedFromFile.value && selectedFileForWorker && !newVal) return;
          if (autoExtractTimeout) clearTimeout(autoExtractTimeout);
          if (parseWorker) {
            stopParseWorker();
            isParsing.value = false;
          }

          // If raw text changes and no longer matches the loaded demo text, reset it
          if (newVal !== loadedDemoText.value) {
            loadedDemoText.value = '';
          }

          const sizeBytes = estimateTextBytes(newVal || '');
          applyInputMode(sizeBytes);
          sourceLoadedFromFile.value = false;
          selectedFileForWorker = null;
          currentSourceName.value = '';

          if (!newVal || !newVal.trim()) {
            parsedRoot.value = null;
            nodes.value = [];
            selectedNodeId.value = '';
            editText.value = '';
            jsonStats.value = {};
            jsonPathsList.value = [];
            jsonSchemaText.value = '';
            isPreviewTruncated.value = false;
            resetParseProgress();
            return;
          }

          if (sizeBytes > LARGE_TEXT_BYTES) {
            parsedRoot.value = null;
            nodes.value = [];
            selectedNodeId.value = '';
            editText.value = '';
            jsonStats.value = {};
            jsonPathsList.value = [];
            jsonSchemaText.value = '';
            isPreviewTruncated.value = false;
            previewCache = new Map();
            setParseProgress(inputMode.value === 'ultra' ? '超大文本，等待手动提取' : '大文本，等待手动提取', 0, false);
            return;
          }

          autoExtractTimeout = setTimeout(() => {
            extractRootJSON(true);
          }, 350);
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
          if (autoExtractTimeout) clearTimeout(autoExtractTimeout);
          stopParseWorker();

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
            if (nodeBulkMode.value === 'hidden' && node.id !== 'main') {
              return false;
            }
            // Hide descendants of collapsed nodes
            for (const collapsedId of collapsedNodes.value) {
              if (node.id !== collapsedId && node.id.startsWith(collapsedId + '.')) {
                return false;
              }
            }
            return true;
          });
        });

        const statsText = computed(() => {
          if (!jsonStats.value || Object.keys(jsonStats.value).length === 0) return '无节点统计数据';
          const s = jsonStats.value;
          return `=== 节点基础信息 ===
当前节点路径: ${s.path || 'Root'}
根节点类型:   ${s.type}
总键值/元素数: ${s.keyCount}
最大层级深度: ${s.maxDepth}
估算大小:     ${s.estimatedSize}

=== 子项统计 ===
子对象数量:   ${s.objectCount}
子数组数量:   ${s.arrayCount}
字符串数量:   ${s.stringCount}
数字数量:     ${s.numberCount}
布尔值数量:   ${s.booleanCount}
Null数量:    ${s.nullCount}${s.skipped && s.skipped.length ? `\n\n已跳过: ${s.skipped.join('、')}` : ''}`;
        });

        const pathsText = computed(() => {
          if (!jsonPathsList.value || jsonPathsList.value.length === 0) return '暂无路径';
          const isTrunc = jsonPathsList.value.isTruncated;
          const warning = isTrunc ? '⚠️ 数据超大，为保证浏览器不卡顿，已提前停止深度扫描。以下仅为部分已扫描数据的统计：\n\n' : '';
          return warning + jsonPathsList.value.map(item => `${item.path}  (数量: ${item.count}${isTrunc ? '+' : ''}  估算大小: ${item.size !== undefined ? formatSize(item.size) : '0 B'}${isTrunc ? '+' : ''})`).join('\n');
        });

        const parseProgressText = computed(() => {
          const progress = parseProgress.value;
          const modeSuffix = inputMode.value === 'ultra' ? ' · 超大文本模式' : inputMode.value === 'large' ? ' · 大文本模式' : '';
          if (!progress.active) return `进度：空闲${modeSuffix}`;
          if (progress.indeterminate) return `进度：${progress.status || '处理中'}`;
          return `进度：${progress.status || '处理中'} ${Math.round(progress.percent || 0)}%${modeSuffix}`;
        });

        const isPreviewReadonly = computed(() => activeTab.value !== 'preview' || isPreviewTruncated.value);

        const displayValue = computed(() => {
          if (activeTab.value === 'preview') return editText.value;
          if (activeTab.value === 'stats') return statsText.value;
          if (activeTab.value === 'paths') return pathsText.value;
          if (activeTab.value === 'schema') return jsonSchemaText.value;
          return '';
        });

        const handleInput = (e) => {
          if (activeTab.value === 'preview') {
            editText.value = e.target.value;
            isTextareaDirty.value = true;
          }
        };

        const lineNumbersText = computed(() => {
          const text = displayValue.value || '';
          if (!text) return '1';
          
          let skipped = 0;
          let markerStartLine = -1;
          const match = text.match(/\/\* 预览已截断，仅显示前 .*?。隐藏了 (\d+) 行。 .*?\*\//);
          if (match) {
            skipped = parseInt(match[1], 10);
            let linesBeforeMarker = 1;
            let nIdx = text.indexOf('\n');
            while (nIdx !== -1 && nIdx < match.index) {
              linesBeforeMarker++;
              nIdx = text.indexOf('\n', nIdx + 1);
            }
            markerStartLine = linesBeforeMarker;
          }

          let count = 1;
          let idx = text.indexOf('\n');
          while (idx !== -1) {
            count++;
            idx = text.indexOf('\n', idx + 1);
          }
          
          if (count === 1 && skipped === 0) return '1';
          
          const nums = new Array(count);
          let currentNum = 1;
          for (let i = 0; i < count; i++) {
            const lineIdx = i + 1;
            if (markerStartLine !== -1 && lineIdx >= markerStartLine - 1 && lineIdx <= markerStartLine + 1) {
              nums[i] = '·';
              if (lineIdx === markerStartLine + 1) {
                currentNum += skipped;
              }
            } else {
              nums[i] = currentNum;
              currentNum++;
            }
          }
          return nums.join('\n');
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

        const breadcrumbChildOptions = computed(() => {
          if (!selectedNode.value) return [];
          const currentPath = selectedNode.value.path;
          const nextDepth = currentPath.length + 1;
          const parentIsArray = Array.isArray(selectedNode.value.val);

          return nodes.value
            .filter(node => {
              if (node.path.length !== nextDepth) return false;
              for (let i = 0; i < currentPath.length; i++) {
                if (node.path[i] !== currentPath[i]) return false;
              }
              return true;
            })
            .map(node => {
              const segment = node.path[node.path.length - 1];
              return {
                label: parentIsArray ? '[' + segment + ']' : segment,
                nodeId: node.id,
                type: node.type
              };
            });
        });

        const hasChildren = (nodeId) => {
          return nodes.value.some(n => n.id !== nodeId && n.id.startsWith(nodeId + '.'));
        };

        const handleBreadcrumbChildSelect = (event) => {
          const nodeId = event.target.value;
          if (nodeId) {
            selectNode(nodeId);
            event.target.value = '';
          }
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

        const bulkModeText = (mode) => {
          if (mode === 'unselected') return '不选中';
          if (mode === 'hidden') return '不显示';
          return '选中';
        };

        const nextBulkMode = (mode) => {
          if (mode === 'selected') return 'unselected';
          if (mode === 'unselected') return 'hidden';
          return 'selected';
        };

        const applyPropertyBulkMode = (mode) => {
          if (!selectedNode.value) return;
          propertyBulkMode.value = mode;
          const keys = selectedNodeProperties.value.map(prop => prop.key);

          if (mode === 'selected') {
            keys.forEach(key => {
              const index = excludedProperties.value.indexOf(key);
              if (index !== -1) {
                excludedProperties.value.splice(index, 1);
              }
            });
          } else {
            keys.forEach(key => {
              if (!excludedProperties.value.includes(key)) {
                excludedProperties.value.push(key);
              }
            });
          }

          applyFormatting();
        };

        const applyNodeBulkMode = (mode) => {
          if (nodes.value.length <= 1) return;
          nodeBulkMode.value = mode;
          const nodeIds = nodes.value
            .filter(node => node.id !== 'main')
            .map(node => node.id);

          if (mode === 'selected') {
            excludedNodes.value = excludedNodes.value.filter(id => !nodeIds.includes(id));
          } else {
            excludedNodes.value = [...nodeIds];
          }

          applyFormatting();
        };

        const toggleProperty = (key) => {
          const index = excludedProperties.value.indexOf(key);
          if (index === -1) {
            excludedProperties.value.push(key);
          } else {
            excludedProperties.value.splice(index, 1);
          }
          if (propertyBulkMode.value !== 'hidden') {
            propertyBulkMode.value = allPropertiesSelected.value ? 'selected' : 'unselected';
          }
          applyFormatting();
        };

        const toggleAllProperties = () => {
          applyPropertyBulkMode(nextBulkMode(propertyBulkMode.value));
        };

        const toggleAllNodes = () => {
          applyNodeBulkMode(nextBulkMode(nodeBulkMode.value));
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
          if (nodeBulkMode.value !== 'hidden') {
            nodeBulkMode.value = allNodesSelected.value ? 'selected' : 'unselected';
          }
          applyFormatting();
        };

        watch(excludedNodes, () => {
          applyFormatting();
        }, { deep: true });

        watch(advancedOptions, () => {
          if (selectedNode.value) {
            updateNodeInfo();
          }
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

        // Extraction of the initial root JSON in a messy string.
        const extractRootJSON = (silent = false) => {
          if (isParsing.value) {
            stopParseWorker();
            isParsing.value = false;
          }

          if (sourceLoadedFromFile.value && selectedFileForWorker && !rawInput.value.trim()) {
            startWorkerParse({
              file: selectedFileForWorker,
              silent,
              sourceName: selectedFileForWorker.name || currentSourceName.value
            });
            return;
          }

          const text = rawInput.value || '';
          if (!text.trim()) {
            if (!silent) {
              showToast('未输入数据', '请输入文本，或直接拖入 JSON/日志文件。', 'error');
            }
            return;
          }

          const sizeBytes = estimateTextBytes(text);
          applyInputMode(sizeBytes);
          startWorkerParse({
            text,
            silent,
            sourceName: currentSourceName.value
          });
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


        
        const analyzeNodeAsync = () => {
           return new Promise(resolve => {
               const reqId = Date.now() + Math.random();
               const handler = (e) => {
                   if ((e.data.type === 'analyze_result' || e.data.action === 'analyze_result') && e.data.reqId === reqId) {
                       parseWorker.removeEventListener('message', handler);
                       resolve(e.data.payload);
                   }
               };
               parseWorker.addEventListener('message', handler);
               parseWorker.postMessage({
                   action: 'analyze_node',
                   reqId,
                   path: JSON.parse(JSON.stringify(selectedNode.value.path)),
                   advancedOptions: JSON.parse(JSON.stringify(advancedOptions.value)),
                   options: {
                       excludedNodes: JSON.parse(JSON.stringify(excludedNodes.value)),
                       excludedProperties: JSON.parse(JSON.stringify(excludedProperties.value)),
                       basePath: JSON.parse(JSON.stringify(selectedNode.value.path))
                   },
                   mode: inputMode.value
               });
           });
        };

        const applyFormatting = () => {
          if (!selectedNode.value) return;
          if (isPreviewTruncated.value && previewCache.has(selectedNode.value.id)) {
            editText.value = previewCache.get(selectedNode.value.id).text;
            updateNodeInfo();
            return;
          }

          if (isTextareaDirty.value && excludedProperties.value.length === 0 && excludedNodes.value.length === 0 && editText.value && editText.value.trim()) {
            try {
              const parsed = JSON.parse(editText.value);
            } catch (e) {
              return;
            }
          }
          
          updateNodeInfo(isTextareaDirty.value ? JSON.parse(editText.value) : undefined);
        };

        const updateNodeInfo = async (customVal = undefined) => {
          if (!selectedNode.value) return;
          const shouldReuseWorkerRootInfo = inputMode.value !== 'normal' && selectedNode.value.id === 'main' && jsonStats.value && jsonStats.value.mode;
          if (shouldReuseWorkerRootInfo && customVal === undefined) {
            return;
          }
          
          const reqId = Date.now() + Math.random();
          const res = await new Promise(resolve => {
               const handler = (e) => {
                   if ((e.data.type === 'analyze_result' || e.data.action === 'analyze_result') && e.data.reqId === reqId) {
                       parseWorker.removeEventListener('message', handler);
                       resolve(e.data.payload);
                   }
               };
               parseWorker.addEventListener('message', handler);
               parseWorker.postMessage({
                   action: 'analyze_node',
                   reqId,
                   path: customVal !== undefined ? null : JSON.parse(JSON.stringify(selectedNode.value.path)),
                   val: customVal,
                   advancedOptions: JSON.parse(JSON.stringify(advancedOptions.value)),
                   options: {
                       excludedNodes: JSON.parse(JSON.stringify(excludedNodes.value)),
                       excludedProperties: JSON.parse(JSON.stringify(excludedProperties.value)),
                       basePath: JSON.parse(JSON.stringify(selectedNode.value.path))
                   },
                   mode: inputMode.value
               });
          });

          editText.value = res.editText;
          isPreviewTruncated.value = res.isPreviewTruncated;
          
          if (!isPreviewTruncated.value && inputMode.value !== 'normal') {
            previewCache.set(selectedNode.value.id, { text: res.editText, truncated: false });
          } else if (isPreviewTruncated.value) {
            previewCache.set(selectedNode.value.id, { text: res.editText, truncated: true });
          }

          let sizeStr = '0 B';
          try {
            const bytes = new Blob([res.editText]).size;
            sizeStr = formatSize(bytes);
          } catch(e) {}

          jsonStats.value = res.jsonStats;
          if (jsonStats.value) jsonStats.value.estimatedSize = sizeStr;
          
          jsonPathsList.value = res.jsonPathsList || [];
          jsonPathsList.value.isTruncated = res.pathsTruncated || false;
          jsonSchemaText.value = formatSchemaText(res.jsonSchemaObject);
        };

        const selectNode = (nodeId) => {
          selectedNodeId.value = nodeId;
          editText.value = ''; // Clear current editText to force load from selectedNode.value.val
          isTextareaDirty.value = false; // Reset dirty state
          isPreviewTruncated.value = false;
          excludedProperties.value = []; // Reset excluded properties when switching nodes
          propertyBulkMode.value = 'selected';
          applyFormatting();
        };

        // Copy JSON content to clipboard
        const copyFormattedJSON = async () => {
          if (!editText.value) return;
          if (isPreviewTruncated.value) {
            showToast('仅复制预览', '当前源码视图已截断，复制内容不是完整 JSON。', 'warning');
          }
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
          if (isPreviewTruncated.value) {
            showToast('暂不下载', '当前节点预览已截断，请选择更小节点后再下载。', 'warning');
            return;
          }
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

          if (isPreviewTruncated.value) {
            showToast('无法保存', '当前源码视图是截断预览，不是完整 JSON。请选择更小节点后再编辑保存。', 'warning');
            return;
          }

          if (sourceLoadedFromFile.value && selectedFileForWorker && !rawInput.value.trim()) {
            showToast('无法回写', '大文件拖入模式未把完整原文放入输入框，暂不支持反向合并到原始日志。', 'warning');
            return;
          }

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
            propertyBulkMode.value = 'selected';
            nodeBulkMode.value = 'selected';
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
          if (isPreviewTruncated.value) {
            showToast('无法排序', '当前源码视图是截断预览，请选择更小节点后再排序。', 'warning');
            return;
          }
          
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
            stopParseWorker();
            isParsing.value = false;
            rawInput.value = '';
            parsedRoot.value = null;
            nodes.value = [];
            selectedNodeId.value = '';
            editText.value = '';
            currentSourceName.value = '';
            selectedFileForWorker = null;
            sourceLoadedFromFile.value = false;
            inputMode.value = 'normal';
            advancedOptions.value = { ...DEFAULT_ADVANCED_OPTIONS };
            optionSnapshotBeforeUltra = null;
            previewCache = new Map();
            resetParseProgress();
            isTextareaDirty.value = false; // Reset dirty state
            isPreviewTruncated.value = false;
            excludedProperties.value = []; // Reset excluded properties
            excludedNodes.value = []; // Reset excluded nodes
            propertyBulkMode.value = 'selected';
            nodeBulkMode.value = 'selected';
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

          if (val === 'generate-100m') {
            event.target.value = '';
            showToast('生成中', '正在动态生成 100M 多层次 JSON 数据，请稍候...', 'info');
            setTimeout(() => {
              try {
                const generateNested = (depth) => {
                  if (depth <= 0) return "value_" + Math.random();
                  return {
                    id: Math.random().toString(36).substring(2),
                    level: depth,
                    timestamp: Date.now(),
                    metadata: { type: "test", active: true },
                    tags: ["dynamic", "test", "performance"],
                    children: [
                      { sub: generateNested(depth - 1) },
                      { sub: generateNested(depth - 1) }
                    ]
                  };
                };
                const itemStr = JSON.stringify(generateNested(7));
                const itemSizeBytes = new Blob([itemStr]).size;
                const targetSize = 100 * 1024 * 1024; // 100MB
                const count = Math.ceil(targetSize / itemSizeBytes);
                
                const arrayStr = '[' + new Array(count).fill(itemStr).join(',') + ']';
                const file = new File([arrayStr], "dynamic-100m.json", { type: "application/json" });
                
                selectedFileForWorker = file;
                currentSourceName.value = file.name;
                sourceLoadedFromFile.value = true;
                applyInputMode(file.size);
                rawInput.value = ''; 
                
                showToast('生成完毕', `100M 数据生成完毕，开始解析...`, 'success', 3000);
                startWorkerParse({ file, silent: false, sourceName: file.name });
              } catch (e) {
                showToast('生成失败', '生成 100M 数据时发生错误：' + e.message, 'error');
              }
            }, 50);
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
              sourceLoadedFromFile.value = false;
              selectedFileForWorker = null;
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
              sourceLoadedFromFile.value = false;
              selectedFileForWorker = null;
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
                sourceLoadedFromFile.value = false;
                selectedFileForWorker = null;
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

        const formatSize = (bytes) => {
          if (bytes === 0) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const getValueTypeLabel = (val) => {
          if (val === null) return 'Null';
          if (Array.isArray(val)) return 'Array';
          const type = typeof val;
          return type.charAt(0).toUpperCase() + type.slice(1);
        };

        const copySchema = () => {
          if (!jsonSchemaText.value) return;
          navigator.clipboard.writeText(jsonSchemaText.value).then(() => {
            showToast('已复制', 'JSON Schema 已复制到剪贴板', 'success');
          }).catch(err => {
            showToast('复制失败', '请手动复制文本框中的内容', 'error');
          });
        };

        const copyPaths = () => {
          if (!jsonPathsList.value.length) return;
          const isTrunc = jsonPathsList.value.isTruncated;
          const warning = isTrunc ? '⚠️ 数据超大，为保证浏览器不卡顿，已提前停止深度扫描。以下仅为部分已扫描数据的统计：\n\n' : '';
          const textToCopy = warning + jsonPathsList.value.map(p => `${p.path} (数量: ${p.count}${isTrunc ? '+' : ''}  估算大小: ${p.size !== undefined ? formatSize(p.size) : '0 B'}${isTrunc ? '+' : ''})`).join('\n');
          navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('已复制', 'JSONPaths 已复制到剪贴板', 'success');
          }).catch(err => {
            showToast('复制失败', '请手动复制内容', 'error');
          });
        };

        const onPreviewLimitChange = () => {
          previewCache.clear();
          applyFormatting();
        };

        const getTypeIcon = (type) => {
          if (!type) return '';
          const t = type.toLowerCase();
          if (t.includes('object')) return '{}';
          if (t.includes('array')) return '[]';
          if (t.includes('string')) return '""';
          if (t.includes('number')) return '12';
          if (t.includes('boolean')) return '☑';
          if (t.includes('null')) return '∅';
          return '·';
        };

        const getTypeClass = (type) => {
          if (!type) return 'unknown';
          const t = type.toLowerCase();
          if (t.includes('object')) return 'object';
          if (t.includes('array')) return 'array';
          if (t.includes('string')) return 'string';
          if (t.includes('number')) return 'number';
          if (t.includes('boolean')) return 'boolean';
          if (t.includes('null')) return 'null';
          return 'unknown';
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
          excludedProperties,
          propertyBulkMode,
          nodeBulkMode,
          bulkModeText,
          selectedNodeProperties,
          toggleProperty,
          allPropertiesSelected,
          toggleAllProperties,
          allNodesSelected,
          toggleAllNodes,
          excludedNodes,
          toggleNodeCheckbox,
          onPreviewLimitChange,
          
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
          breadcrumbChildOptions,
          handleBreadcrumbChildSelect,
          collapsedNodes,
          hasChildren,
          toggleCollapse,
          toggleCollapseAll,
          activeTab,
          jsonStats,
          jsonSchemaText,
          jsonPathsList,
          advancedOptions,
          parseProgress,
          parseProgressText,
          inputMode,
          isParsing,
          isPreviewTruncated,
          isPreviewReadonly,
          currentSourceName,
          copySchema,
          copyPaths,
          displayValue,
          handleInput,
          getTypeIcon,
          getTypeClass
        };
      }
    }).mount('#app');
