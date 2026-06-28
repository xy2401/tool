import { 
  createJSONEditor, 
  jmespathQueryLanguage, 
  lodashQueryLanguage, 
  javascriptQueryLanguage 
} from 'https://cdn.jsdelivr.net/npm/vanilla-jsoneditor/standalone.js';

// Simplified Chinese Translation Dictionary (populated dynamically from data directory)
const simplifiedChinese = {};
const menuTranslations = {};
const domTranslations = {};
const domTooltipTranslations = {};

const JsonToolCore = window.JsonToolCore;
const { LARGE_TEXT_BYTES, DEFAULT_ADVANCED_OPTIONS } = JsonToolCore.constants;

function translateText(text) {
  if (!text) return text;
  if (menuTranslations[text]) return menuTranslations[text];
  
  let translated = text;
  // Sort keys of menuTranslations by length descending to replace longer phrases first
  const keys = Object.keys(menuTranslations).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (translated.includes(key)) {
      translated = translated.split(key).join(menuTranslations[key]);
    }
  }
  return translated;
}

function translateMenuItem(item) {
  if (!item) return item;
  if (item.text) item.text = translateText(item.text);
  if (item.title) item.title = translateText(item.title);
  if (item.main) translateMenuItem(item.main);
  if (item.items) {
    item.items.forEach(translateMenuItem);
  }
  return item;
}

function onRenderMenu(items) {
  return items.map(translateMenuItem);
}

function onRenderContextMenu(items) {
  return items.map(translateMenuItem);
}

function translateDOM(node) {
  if (!node) return;

  // Skip translating actual JSON content (keys, values, and CodeMirror editor text)
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (element && (
    element.closest('.jse-contents') || 
    element.closest('.cm-editor') || 
    element.closest('.cm-content') ||
    element.closest('.jse-key') || 
    element.closest('.jse-value')
  )) {
    return;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue.trim();
    if (domTranslations[text]) {
      node.nodeValue = domTranslations[text];
    } else if (text.startsWith('loading')) {
      node.nodeValue = '正在加载...';
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.hasAttribute('placeholder')) {
      const placeholder = node.getAttribute('placeholder');
      if (domTranslations[placeholder]) {
        node.setAttribute('placeholder', domTranslations[placeholder]);
      }
    }
    if (node.hasAttribute('title')) {
      const title = node.getAttribute('title');
      if (domTooltipTranslations[title]) {
        node.setAttribute('title', domTooltipTranslations[title]);
      } else if (domTranslations[title]) {
        node.setAttribute('title', domTranslations[title]);
      }
    }
    node.childNodes.forEach(translateDOM);
  }
}

// Set up MutationObserver to translate dynamic popup elements
const i18nObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      setTimeout(() => translateDOM(node), 0);
    });
    if (mutation.type === 'characterData') {
      setTimeout(() => translateDOM(mutation.target), 0);
    }
  });
});
i18nObserver.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

// State & Editors (Global scope inside module script)
let editorLeft = null;
let editorRight = null;
let lastEditorContent = null;

const { createApp, ref, computed, onMounted, nextTick, watch, onUnmounted } = window.Vue;

createApp({
  setup() {
    const rawInput = ref('');
    const isDragging = ref(false);
    const isRawFullscreen = ref(false);
    const historyItems = ref([]);
    const savedItems = ref([]);
    const demoFiles = ref([]);
    const themePreference = ref('system');
    const loadedDemoText = ref('');
    const toasts = ref([]);
    const renderLeftEditor = ref(true);
    const renderRightEditor = ref(true);
    let toastIdCounter = 0;
    let skipHistoryRecord = false;
    const isParsing = ref(false);
    const inputMode = ref('normal');
    const advancedOptions = ref({ ...DEFAULT_ADVANCED_OPTIONS });
    const parseProgress = ref({ active: false, indeterminate: false, percent: 0, status: '空闲' });
    const currentSourceName = ref('');
    const sourceLoadedFromFile = ref(false);
    
    let autoExtractTimeout = null;
    let historyDebounceTimeout = null;
    let selectedFileForWorker = null;
    let parser = null;
    const modeController = JsonToolCore.createInputModeController({
      inputMode,
      advancedOptions,
      defaultAdvancedOptions: DEFAULT_ADVANCED_OPTIONS
    });
    const progressController = JsonToolCore.createProgressController(parseProgress);

    // Toast
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

    // Theme management
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

      const leftContainer = document.getElementById('editor-left');
      const rightContainer = document.getElementById('editor-right');
      if (leftContainer && rightContainer) {
        if (activeTheme === 'light') {
          leftContainer.classList.remove('jse-theme-dark');
          rightContainer.classList.remove('jse-theme-dark');
        } else {
          leftContainer.classList.add('jse-theme-dark');
          rightContainer.classList.add('jse-theme-dark');
        }
      }
    };

    const applyThemePreference = () => {
      try {
        localStorage.setItem('theme_preference', themePreference.value);
      } catch (e) {}
      applyTheme();
    };

    // Drag and drop
    const handleDragOver = () => { isDragging.value = true; };
    const handleDragLeave = () => { isDragging.value = false; };
    const setSelectedFile = (file) => {
      selectedFileForWorker = file;
      currentSourceName.value = file ? (file.name || '') : '';
      sourceLoadedFromFile.value = !!file;
    };

    const setSkipHistoryRecord = (value) => {
      skipHistoryRecord = value;
    };

    const handleDrop = (e) => {
      JsonToolCore.handleFileDrop(e, {
        rawInput,
        setDragging: (value) => { isDragging.value = value; },
        setSelectedFile,
        setSkipHistoryRecord,
        applyInputMode,
        startWorkerParse,
        showToast,
        nextTick
      });
    };

    const toggleRawFullscreen = () => {
      isRawFullscreen.value = !isRawFullscreen.value;
    };

    // Localstorage lists
    const loadHistory = () => {
      try {
        JsonToolCore.loadLocalList('json_viewer_history', historyItems);
      } catch (e) {}
    };

    const saveHistory = () => {
      try {
        JsonToolCore.saveLocalList('json_viewer_history', historyItems);
      } catch (e) {}
    };

    const addToHistory = (text) => {
      JsonToolCore.addToHistory({
        text,
        historyItems,
        loadedDemoText,
        saveHistory,
        skipHistoryRecord: () => skipHistoryRecord
      });
    };

    const loadSavedItems = () => {
      try {
        JsonToolCore.loadLocalList('json_viewer_saved', savedItems);
      } catch (e) {}
    };

    const saveSavedItems = () => {
      try {
        JsonToolCore.saveLocalList('json_viewer_saved', savedItems);
      } catch (e) {}
    };

    const saveCurrentData = () => {
      JsonToolCore.saveCurrentData({
        rawInput,
        savedItems,
        saveSavedItems,
        showToast,
        blockLargeText: true
      });
    };

    const loadDemoList = async () => {
      try {
        demoFiles.value = await JsonToolCore.loadDemoList();
      } catch (e) {}
    };

    const copyRawInput = async () => {
      if (!rawInput.value) return;
      try {
        await navigator.clipboard.writeText(rawInput.value);
        showToast('复制成功', '已复制原始日志文本至剪切板！', 'success');
      } catch (err) {
        showToast('复制失败', '剪切板写入失败。', 'error');
      }
    };

    const downloadRawInput = () => {
      if (!rawInput.value) return;
      try {
        const blob = new Blob([rawInput.value], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'raw_log.txt');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('下载成功', '日志文件已保存。', 'success');
      } catch (err) {
        showToast('下载失败', '创建文件失败。', 'error');
      }
    };

    const handleDataSelect = async (event) => {
      await JsonToolCore.handleDataSelect(event, {
        rawInput,
        demoFiles,
        historyItems,
        savedItems,
        loadedDemoText,
        setSkipHistoryRecord,
        setSelectedFile,
        resetWorkspace,
        resetForLoadedText,
        saveHistory,
        saveSavedItems,
        saveCurrent: saveCurrentData,
        startWorkerParse,
        applyInputMode,
        showToast,
        nextTick
      });
    };

    const estimateTextBytes = JsonToolCore.estimateTextBytes;

    const getModeBySize = JsonToolCore.getModeBySize;

    const applyInputMode = (sizeBytes) => {
      modeController.applyInputMode(sizeBytes);
      if (getModeBySize(sizeBytes || 0) === 'ultra' && renderRightEditor.value) {
        renderRightEditor.value = false;
      }
    };

    const getEffectiveAdvancedOptions = (sizeBytes) => {
      const mode = getModeBySize(sizeBytes || 0);
      const options = {
        ...advancedOptions.value,
        generateStats: false,
        generatePaths: false,
        inferSchema: false,
        mode,
        sizeBytes
      };
      options.includeRootRaw = sizeBytes <= LARGE_TEXT_BYTES;
      options.includeParsedObj = sizeBytes <= LARGE_TEXT_BYTES || renderRightEditor.value;
      return options;
    };

    const setParseProgress = (status, percent = 0, indeterminate = false) => {
      progressController.set(status, percent, indeterminate);
    };

    const finishParseProgress = (status = '完成') => {
      progressController.finish(status);
    };

    const resetParseProgress = () => {
      progressController.reset();
    };

    const parseProgressText = computed(() => {
      return progressController.text(inputMode);
    });

    const stopParseWorker = () => {
      if (parser) parser.stop();
    };

    const debouncedAddToHistory = (text) => {
      if (historyDebounceTimeout) clearTimeout(historyDebounceTimeout);
      historyDebounceTimeout = setTimeout(() => {
        addToHistory(text);
      }, 1500);
    };

    const resetForLoadedText = () => {
      resetParseProgress();
    };

    const resetWorkspace = () => {
      stopParseWorker();
      isParsing.value = false;
      rawInput.value = '';
      setSelectedFile(null);
      modeController.reset();
      lastEditorContent = null;
      resetParseProgress();
    };

    const handleWorkerResult = (payload, context) => {
      const parsedObj = payload.parsedRoot ? payload.parsedRoot.obj : null;

      if (parsedObj !== null && parsedObj !== undefined) {
        const content = { json: parsedObj };
        lastEditorContent = content;
        if (renderLeftEditor.value && editorLeft) {
          editorLeft.set(content);
        }
        if (renderRightEditor.value && editorRight) {
          editorRight.set(content);
          if (inputMode.value !== 'ultra') {
            setTimeout(() => {
              if (editorRight) editorRight.expand([], () => true);
            }, 50);
          }
        }
      } else {
        const previewText = payload.editText || '// 大文本已由 Worker 完成解析；为避免控件卡顿，此处仅显示截断预览。';
        lastEditorContent = { text: previewText };
        if (renderLeftEditor.value && editorLeft) {
          editorLeft.set({ text: previewText });
        }
      }

      inputMode.value = payload.mode || inputMode.value;
      currentSourceName.value = payload.sourceName || context.sourceName || currentSourceName.value;
      finishParseProgress('解析完成');

      const modeLabel = inputMode.value === 'ultra' ? '超大文本模式' : inputMode.value === 'large' ? '大文本模式' : '普通模式';
      if (!context.silent) {
        const warningText = payload.warnings && payload.warnings.length ? ` ${payload.warnings[0]}` : '';
        showToast('提取成功', `已完成解析（${modeLabel}）。${warningText}`, 'success', 4500);
        if (!context.file && context.text && inputMode.value === 'normal') {
          if (historyDebounceTimeout) clearTimeout(historyDebounceTimeout);
          addToHistory(context.text);
        }
      } else if (!context.file && context.text && inputMode.value === 'normal') {
        debouncedAddToHistory(context.text);
      }
    };

    const startWorkerParse = ({ text = '', file = null, silent = false, sourceName = '' } = {}) => {
      if (!parser) {
        parser = JsonToolCore.createWorkerParser({
          parseProgress,
          isParsing,
          applyInputMode,
          getOptions: getEffectiveAdvancedOptions,
          showToast,
          onResult: handleWorkerResult
        });
      }
      parser.parse({ text, file, silent, sourceName });
    };

    const extractRootJSON = (silent = false) => {
      const text = rawInput.value;
      if (!text || !text.trim()) {
        if (!silent) {
          showToast('提取失败', '输入框为空，无法提取 JSON。', 'warning');
        }
        return;
      }
      startWorkerParse({ text, silent });
    };

    const copyToRight = () => {
      if (!renderLeftEditor.value || !renderRightEditor.value || !editorLeft || !editorRight) {
        showToast('同步失败', '请先启用左右两个编辑器。', 'warning');
        return;
      }
      try {
        const content = editorLeft.get();
        editorRight.set(content);
        setTimeout(() => {
          editorRight.expand([], () => true);
        }, 50);
        showToast('同步成功', '已复制左侧代码到右侧树形。', 'success');
      } catch (e) {
        showToast('同步失败', '左侧编辑器内容格式有误。', 'error');
      }
    };

    const copyToLeft = () => {
      if (!renderLeftEditor.value || !renderRightEditor.value || !editorLeft || !editorRight) {
        showToast('同步失败', '请先启用左右两个编辑器。', 'warning');
        return;
      }
      try {
        const content = editorRight.get();
        editorLeft.set(content);
        showToast('同步成功', '已复制右侧树形到左侧代码。', 'success');
      } catch (e) {
        showToast('同步失败', '右侧编辑器内容格式有误。', 'error');
      }
    };

    const getContentText = (editor) => {
      if (!editor) return '';
      try {
        const content = editor.get();
        if (content.text !== undefined) {
          return content.text;
        }
        if (content.json !== undefined) {
          return JSON.stringify(content.json, null, 2);
        }
      } catch (e) {}
      return '';
    };

    const copyTextToClipboard = async (text) => {
      if (!text) return false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (e) {}
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        return false;
      }
    };

    const copyEditor = async (side) => {
      if ((side === 'left' && !renderLeftEditor.value) || (side === 'right' && !renderRightEditor.value)) {
        showToast('复制失败', '编辑器已禁用。', 'warning');
        return;
      }
      const editor = side === 'left' ? editorLeft : editorRight;
      const label = side === 'left' ? '左侧' : '右侧';
      const text = getContentText(editor);
      if (!text) {
        showToast('复制失败', `${label}内容为空。`, 'warning');
        return;
      }
      const success = await copyTextToClipboard(text);
      if (success) {
        showToast('复制成功', `已复制${label}代码至剪贴板！`, 'success');
      } else {
        showToast('复制失败', '剪切板写入失败。', 'error');
      }
    };

    const downloadEditor = (side) => {
      if ((side === 'left' && !renderLeftEditor.value) || (side === 'right' && !renderRightEditor.value)) {
        showToast('下载失败', '编辑器已禁用。', 'warning');
        return;
      }
      const editor = side === 'left' ? editorLeft : editorRight;
      const label = side === 'left' ? '左侧' : '右侧';
      const filename = side === 'left' ? 'left_editor.json' : 'right_editor.json';
      const text = getContentText(editor);
      if (!text) {
        showToast('下载失败', `${label}内容为空。`, 'warning');
        return;
      }
      try {
        const blob = new Blob([text], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('下载成功', `${label}内容已下载。`, 'success');
      } catch (err) {
        showToast('下载失败', '创建文件失败。', 'error');
      }
    };

    onMounted(async () => {
      // Load translations dynamically from data directory
      try {
        const resLang = await fetch('./data/simplifiedChinese.json');
        if (resLang.ok) {
          const data = await resLang.json();
          Object.assign(simplifiedChinese, data);
        } else {
          console.error('Failed to load simplifiedChinese.json');
        }
      } catch (e) {
        console.error('Error loading simplifiedChinese.json:', e);
      }

      try {
        const resTrans = await fetch('./data/menuTranslations.json');
        if (resTrans.ok) {
          const data = await resTrans.json();
          Object.assign(menuTranslations, data.menuTranslations || {});
          Object.assign(domTranslations, data.domTranslations || {});
          Object.assign(domTooltipTranslations, data.domTooltipTranslations || {});
        } else {
          console.error('Failed to load menuTranslations.json');
        }
      } catch (e) {
        console.error('Error loading menuTranslations.json:', e);
      }

      const initialJson = {
        "Array": [1, 2, 3],
        "Boolean": true,
        "Null": null,
        "Number": 123,
        "Object": { "a": "b", "c": "d" },
        "String": "Hello World"
      };

      const queryLanguages = [
        jmespathQueryLanguage,
        lodashQueryLanguage,
        javascriptQueryLanguage
      ];

      const destroyEditor = (side) => {
        const editor = side === 'left' ? editorLeft : editorRight;
        if (editor && typeof editor.destroy === 'function') {
          editor.destroy();
        }
        if (side === 'left') editorLeft = null;
        else editorRight = null;
      };

      const createEditor = (side) => {
        const isLeft = side === 'left';
        const target = document.getElementById(isLeft ? 'editor-left' : 'editor-right');
        if (!target) return;
        destroyEditor(side);
        const editor = createJSONEditor({
          target,
          props: {
            content: lastEditorContent || { json: initialJson },
            mode: isLeft ? 'text' : 'tree',
            mainMenuBar: true,
            navigationBar: true,
            statusBar: true,
            queryLanguages,
            language: simplifiedChinese,
            onRenderMenu,
            onRenderContextMenu
          }
        });
        if (isLeft) {
          editorLeft = editor;
        } else {
          editorRight = editor;
          if (lastEditorContent && lastEditorContent.json !== undefined && inputMode.value !== 'ultra') {
            setTimeout(() => {
              if (editorRight) editorRight.expand([], () => true);
            }, 50);
          }
        }
      };

      if (renderLeftEditor.value) createEditor('left');
      if (renderRightEditor.value) createEditor('right');

      // Run initial translation scan of DOM once editors are mounted
      setTimeout(() => {
        translateDOM(document.body);
      }, 100);

      // Mount state lists
      loadDemoList();
      loadHistory();
      loadSavedItems();

      // Initialize theme
      try {
        const storedTheme = localStorage.getItem('theme_preference');
        if (storedTheme) themePreference.value = storedTheme;
      } catch (e) {}
      applyTheme();

      // Watch theme change
      watch(themePreference, () => {
        applyThemePreference();
      });

      watch(renderLeftEditor, (enabled) => {
        if (enabled) createEditor('left');
        else destroyEditor('left');
        applyTheme();
      });

      watch(renderRightEditor, (enabled) => {
        if (enabled) createEditor('right');
        else destroyEditor('right');
        applyTheme();
      });

      // Watch rawInput to auto extract
      watch(rawInput, (newVal) => {
        if (sourceLoadedFromFile.value && selectedFileForWorker && !newVal) return;
        if (autoExtractTimeout) clearTimeout(autoExtractTimeout);
        if (parser && parser.isActive()) {
          stopParseWorker();
          isParsing.value = false;
        }

        if (newVal !== loadedDemoText.value) {
          loadedDemoText.value = '';
        }

        const sizeBytes = estimateTextBytes(newVal || '');
        applyInputMode(sizeBytes);
        sourceLoadedFromFile.value = false;
        selectedFileForWorker = null;
        currentSourceName.value = '';

        if (!newVal || !newVal.trim()) {
          resetParseProgress();
          return;
        }

        if (sizeBytes > LARGE_TEXT_BYTES) {
          setParseProgress(inputMode.value === 'ultra' ? '超大文本，等待手动提取' : '大文本，等待手动提取', 0, false);
          return;
        }

        autoExtractTimeout = setTimeout(() => {
          extractRootJSON(true);
        }, 350);
      });
      
      onUnmounted(() => {
        if (historyDebounceTimeout) clearTimeout(historyDebounceTimeout);
        if (autoExtractTimeout) clearTimeout(autoExtractTimeout);
        stopParseWorker();
        destroyEditor('left');
        destroyEditor('right');
      });

      // Handle Escape to exit full screen
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') isRawFullscreen.value = false;
      });

      // Load system theme listener
      const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = () => {
        if (themePreference.value === 'system') applyTheme();
      };
      if (systemThemeMedia.addEventListener) {
        systemThemeMedia.addEventListener('change', handleSystemThemeChange);
      } else if (systemThemeMedia.addListener) {
        systemThemeMedia.addListener(handleSystemThemeChange);
      }
    });

    return {
      rawInput,
      isParsing,
      advancedOptions,
      parseProgress,
      parseProgressText,
      isDragging,
      isRawFullscreen,
      historyItems,
      savedItems,
      demoFiles,
      renderLeftEditor,
      renderRightEditor,
      themePreference,
      toasts,
      removeToast,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      toggleRawFullscreen,
      copyRawInput,
      downloadRawInput,
      handleDataSelect,
      extractRootJSON,
      copyToRight,
      copyToLeft,
      copyEditor,
      downloadEditor
    };
  }
}).mount('#app');
