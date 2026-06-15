import { 
  JSONEditor, 
  jmespathQueryLanguage, 
  lodashQueryLanguage, 
  javascriptQueryLanguage 
} from 'https://cdn.jsdelivr.net/npm/vanilla-jsoneditor/standalone.js';

// Simplified Chinese Translation Dictionary (populated dynamically from data directory)
const simplifiedChinese = {};
const menuTranslations = {};
const domTranslations = {};
const domTooltipTranslations = {};

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
      translateDOM(node);
    });
    if (mutation.type === 'characterData') {
      translateDOM(mutation.target);
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

const { createApp, ref, onMounted, nextTick, watch } = window.Vue;

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

    const extractRootJSON = (silent = false) => {
      const text = rawInput.value;
      if (!text || !text.trim()) {
        if (!silent) {
          showToast('提取失败', '输入框为空，无法提取 JSON。', 'warning');
        }
        return;
      }

      const opening = [];
      const closing = [];
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        if (char === '{' || char === '[') opening.push({ char, index: i });
        if (char === '}' || char === ']') closing.push({ char, index: i });
      }

      let matchedRootObj = null;

      // Search longest match
      for (let o = 0; o < opening.length; o++) {
        const op = opening[o];
        for (let c = closing.length - 1; c >= 0; c--) {
          const cl = closing[c];
          if (cl.index > op.index) {
            if ((op.char === '{' && cl.char === '}') || (op.char === '[' && cl.char === ']')) {
              const substring = text.substring(op.index, cl.index + 1);
              try {
                matchedRootObj = JSON.parse(substring);
                break;
              } catch (e) {}
            }
          }
        }
        if (matchedRootObj) break;
      }

      if (matchedRootObj) {
        const content = { json: matchedRootObj };
        if (editorLeft && editorRight) {
          editorLeft.set(content);
          editorRight.set(content);
          setTimeout(() => {
            editorRight.expand([], () => true);
          }, 50);
        }
        if (!silent) {
          showToast('提取成功', '成功提取 JSON 数据并载入双侧编辑器。', 'success');
        }
        addToHistory(text);
      } else {
        if (!silent) {
          showToast('提取失败', '未在文本中检测到合法的 JSON 结构。', 'error');
        }
      }
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

      editorLeft = new JSONEditor({
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

      editorRight = new JSONEditor({
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
        extractRootJSON(true);
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
      copyToLeft
    };
  }
}).mount('#app');
