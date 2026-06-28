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

const LARGE_TEXT_BYTES = 1024 * 1024;
const ULTRA_TEXT_BYTES = 10 * 1024 * 1024;
const DEFAULT_ADVANCED_OPTIONS = {
  parseStringifiedJson: true,
  scanStringJsonSubstrings: true,
  mergeLines: false,
  previewLimit: 1048576
};

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
    let parseWorker = null;
    let parseRequestId = 0;
    let selectedFileForWorker = null;
    let optionSnapshotBeforeUltra = null;

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
    const handleDrop = (e) => {
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
            const reader = new FileReader();
            reader.onload = (event) => {
              rawInput.value = event.target.result;
              showToast('文件已载入', `成功读取文件：${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success');
              nextTick(() => { skipHistoryRecord = false; });
            };
            reader.onerror = () => {
              skipHistoryRecord = false;
              showToast('载入失败', '读取文件时发生错误，请检查文件格式。', 'error');
            };
            reader.readAsText(file);
          } catch (err) {
            skipHistoryRecord = false;
            showToast('载入失败', '读取文件时发生错误，请检查文件格式。', 'error');
          }
          return;
        }

        rawInput.value = '';
        showToast('文件解析中', `已进入${inputMode.value === 'ultra' ? '超大文本' : '大文本'}模式：${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'info', 4500);
        startWorkerParse({ file, silent: false, sourceName: file.name });
      }
    };

    const toggleRawFullscreen = () => {
      isRawFullscreen.value = !isRawFullscreen.value;
    };

    // Localstorage lists
    const loadHistory = () => {
      try {
        const stored = localStorage.getItem('json_viewer_history');
        if (stored) historyItems.value = JSON.parse(stored);
      } catch (e) {}
    };

    const saveHistory = () => {
      try {
        localStorage.setItem('json_viewer_history', JSON.stringify(historyItems.value));
      } catch (e) {}
    };

    const addToHistory = (text) => {
      if (skipHistoryRecord) return;
      if (!text || !text.trim()) return;
      const trimmed = text.trim();
      if (trimmed === loadedDemoText.value?.trim()) return;
      const exists = historyItems.value.some(item => item.text.trim() === trimmed);
      if (exists) return;

      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
      const displayPrefix = trimmed.substring(0, 45).replace(/\s+/g, ' ');
      const name = `${timeStr}: ${displayPrefix}${trimmed.length > 45 ? '...' : ''}`;

      historyItems.value.unshift({ name, text: trimmed });
      if (historyItems.value.length > 10) {
        historyItems.value = historyItems.value.slice(0, 10);
      }
      saveHistory();
    };

    const loadSavedItems = () => {
      try {
        const stored = localStorage.getItem('json_viewer_saved');
        if (stored) savedItems.value = JSON.parse(stored);
      } catch (e) {}
    };

    const saveSavedItems = () => {
      try {
        localStorage.setItem('json_viewer_saved', JSON.stringify(savedItems.value));
      } catch (e) {}
    };

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
      if (name === null) return;
      
      const finalName = name.trim() || defaultName;

      savedItems.value.unshift({ name: finalName, text: text.trim() });
      saveSavedItems();
      showToast('保存成功', `数据“${finalName}”已成功保存到本地。`, 'success');
    };

    const loadDemoList = async () => {
      try {
        const response = await fetch('./data/data.json');
        if (response.ok) {
          demoFiles.value = await response.json();
        }
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
      const val = event.target.value;
      if (!val) return;

      if (val === 'clear') {
        rawInput.value = '';
        showToast('已清空', '工作区内容已复位。', 'info');
        event.target.value = '';
        return;
      }

      if (val === 'clear-history') {
        historyItems.value = [];
        saveHistory();
        showToast('已清空', '历史数据已清空。', 'info');
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
          showToast('已清空', '已保存的数据已清空。', 'info');
        }
        event.target.value = '';
        return;
      }

      if (val.startsWith('saved-')) {
        const idx = parseInt(val.replace('saved-', ''), 10);
        const savedItem = savedItems.value[idx];
        if (savedItem) {
          skipHistoryRecord = true;
          rawInput.value = savedItem.text;
          showToast('已加载', `已加载保存的数据“${savedItem.name}”`, 'info');
          nextTick(() => { skipHistoryRecord = false; });
        }
        event.target.value = '';
        return;
      }

      if (val.startsWith('hist-')) {
        const idx = parseInt(val.replace('hist-', ''), 10);
        const historyItem = historyItems.value[idx];
        if (historyItem) {
          skipHistoryRecord = true;
          rawInput.value = historyItem.text;
          showToast('已加载', '已从历史记录中加载输入数据。', 'info');
          nextTick(() => { skipHistoryRecord = false; });
        }
        event.target.value = '';
        return;
      }

      if (val.startsWith('demo-')) {
        const key = val.replace('demo-', '');
        const fileInfo = demoFiles.value.find(f => f.key === key);
        if (!fileInfo) return;

        try {
          const response = await fetch(fileInfo.path);
          if (response.ok) {
            const text = await response.text();
            skipHistoryRecord = true;
            loadedDemoText.value = text;
            rawInput.value = text;
            showToast('已加载', `已加载示例：${fileInfo.name}`, 'info');
            nextTick(() => { skipHistoryRecord = false; });
          }
        } catch (e) {
          showToast('加载失败', '无法获取数据。', 'error');
        }
        event.target.value = '';
        return;
      }
    };

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
        generateStats: false,
        generatePaths: false,
        inferSchema: false,
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

    const parseProgressText = computed(() => {
      const progress = parseProgress.value;
      const modeSuffix = inputMode.value === 'ultra' ? ' · 超大文本模式' : inputMode.value === 'large' ? ' · 大文本模式' : '';
      if (!progress.active) return `进度：空闲${modeSuffix}`;
      if (progress.indeterminate) return `进度：${progress.status || '处理中'}`;
      return `进度：${progress.status || '处理中'} ${Math.round(progress.percent || 0)}%${modeSuffix}`;
    });

    const stopParseWorker = () => {
      if (parseWorker) {
        parseWorker.terminate();
        parseWorker = null;
      }
    };

    const debouncedAddToHistory = (text) => {
      if (historyDebounceTimeout) clearTimeout(historyDebounceTimeout);
      historyDebounceTimeout = setTimeout(() => {
        addToHistory(text);
      }, 1500);
    };

    const startWorkerParse = ({ text = '', file = null, silent = false, sourceName = '' } = {}) => {
      stopParseWorker();
      const requestId = ++parseRequestId;
      const sizeBytes = file ? (file.size || 0) : estimateTextBytes(text);
      applyInputMode(sizeBytes);
      const options = getEffectiveAdvancedOptions(sizeBytes);

      isParsing.value = true;
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
        const parsedObj = payload.parsedRoot ? payload.parsedRoot.obj : null;
        
        if (parsedObj !== null && parsedObj !== undefined) {
          const content = { json: parsedObj };
          if (editorLeft && editorRight) {
            editorLeft.set(content);
            editorRight.set(content);
            setTimeout(() => {
              editorRight.expand([], () => true);
            }, 50);
          }
        }
        
        inputMode.value = payload.mode || inputMode.value;
        currentSourceName.value = payload.sourceName || sourceName || currentSourceName.value;
        finishParseProgress('解析完成');

        const modeLabel = inputMode.value === 'ultra' ? '超大文本模式' : inputMode.value === 'large' ? '大文本模式' : '普通模式';
        if (!silent) {
          const warningText = payload.warnings && payload.warnings.length ? ` ${payload.warnings[0]}` : '';
          showToast('提取成功', `已完成解析（${modeLabel}）。${warningText}`, 'success', 4500);
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

      // Initialize Editors
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

      editorLeft = createJSONEditor({
        target: document.getElementById('editor-left'),
        props: {
          content: { json: initialJson },
          mode: 'text',
          mainMenuBar: true,
          navigationBar: true,
          statusBar: true,
          queryLanguages,
          language: simplifiedChinese,
          onRenderMenu,
          onRenderContextMenu
        }
      });

      editorRight = createJSONEditor({
        target: document.getElementById('editor-right'),
        props: {
          content: { json: initialJson },
          mode: 'tree',
          mainMenuBar: true,
          navigationBar: true,
          statusBar: true,
          queryLanguages,
          language: simplifiedChinese,
          onRenderMenu,
          onRenderContextMenu
        }
      });

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

      // Watch rawInput to auto extract
      watch(rawInput, (newVal) => {
        if (sourceLoadedFromFile.value && selectedFileForWorker && !newVal) return;
        if (autoExtractTimeout) clearTimeout(autoExtractTimeout);
        if (parseWorker) {
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
