(function (global) {
  const MB = 1024 * 1024;
  const LARGE_TEXT_BYTES = MB;
  const ULTRA_TEXT_BYTES = 10 * MB;
  const DEFAULT_ADVANCED_OPTIONS = {
    parseStringifiedJson: true,
    scanStringJsonSubstrings: true,
    mergeLines: false,
    previewLimit: 1048576
  };

  function estimateTextBytes(text) {
    if (!text) return 0;
    try {
      return new Blob([text]).size;
    } catch (e) {
      return text.length * 2;
    }
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  function getModeBySize(sizeBytes) {
    if (sizeBytes > ULTRA_TEXT_BYTES) return 'ultra';
    if (sizeBytes > LARGE_TEXT_BYTES) return 'large';
    return 'normal';
  }

  function createInputModeController({ inputMode, advancedOptions, defaultAdvancedOptions = DEFAULT_ADVANCED_OPTIONS }) {
    let optionSnapshotBeforeUltra = null;

    function applyInputMode(sizeBytes) {
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
        advancedOptions.value = { ...defaultAdvancedOptions, ...optionSnapshotBeforeUltra };
        optionSnapshotBeforeUltra = null;
      }
    }

    function reset() {
      optionSnapshotBeforeUltra = null;
      inputMode.value = 'normal';
      advancedOptions.value = { ...defaultAdvancedOptions };
    }

    return { applyInputMode, reset, getModeBySize };
  }

  function createProgressController(parseProgress) {
    function set(status, percent = 0, indeterminate = false) {
      parseProgress.value = {
        active: true,
        indeterminate,
        percent: Math.max(0, Math.min(100, percent || 0)),
        status
      };
    }

    function finish(status = '完成') {
      parseProgress.value = {
        active: true,
        indeterminate: false,
        percent: 100,
        status
      };
    }

    function reset() {
      parseProgress.value = {
        active: false,
        indeterminate: false,
        percent: 0,
        status: '空闲'
      };
    }

    function text(inputMode) {
      const progress = parseProgress.value;
      const modeSuffix = inputMode.value === 'ultra' ? ' · 超大文本模式' : inputMode.value === 'large' ? ' · 大文本模式' : '';
      if (!progress.active) return `进度：空闲${modeSuffix}`;
      if (progress.indeterminate) return `进度：${progress.status || '处理中'}`;
      return `进度：${progress.status || '处理中'} ${Math.round(progress.percent || 0)}%${modeSuffix}`;
    }

    return { set, finish, reset, text };
  }

  function createWorkerParser({
    workerUrl = './json-worker.js',
    parseProgress,
    isParsing,
    applyInputMode,
    getOptions,
    onBeforeParse,
    onResult,
    onError,
    showToast
  }) {
    let worker = null;
    let requestId = 0;
    const progress = createProgressController(parseProgress);

    function stop() {
      if (worker) {
        worker.terminate();
        worker = null;
      }
    }

    function parse({ text = '', file = null, silent = false, sourceName = '' } = {}) {
      stop();
      const currentRequestId = ++requestId;
      const sizeBytes = file ? (file.size || 0) : estimateTextBytes(text);
      applyInputMode(sizeBytes);
      const options = getOptions(sizeBytes);

      isParsing.value = true;
      if (onBeforeParse) onBeforeParse({ text, file, silent, sourceName, sizeBytes, options });
      progress.set(file ? '读取文件' : '定位主 JSON', 0, false);

      try {
        worker = new Worker(workerUrl);
      } catch (err) {
        isParsing.value = false;
        parseProgress.value = { active: true, indeterminate: false, percent: 0, status: 'Worker 启动失败' };
        if (!silent && showToast) showToast('解析失败', '当前环境无法启动 Worker，无法进行大文本解析。', 'error');
        return;
      }

      worker.onmessage = (event) => {
        if (currentRequestId !== requestId) return;
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
          if (onError) onError(message, { text, file, silent, sourceName, sizeBytes });
          if (!silent && showToast) showToast('解析失败', message.message || '未检测到合法 JSON。', 'error');
          stop();
          return;
        }

        if (message.type !== 'result') return;
        isParsing.value = false;
        onResult(message.payload || {}, { text, file, silent, sourceName, sizeBytes });
      };

      worker.onerror = (error) => {
        if (currentRequestId !== requestId) return;
        isParsing.value = false;
        parseProgress.value = {
          active: true,
          indeterminate: false,
          percent: 0,
          status: '解析失败'
        };
        if (onError) onError(error, { text, file, silent, sourceName, sizeBytes });
        if (!silent && showToast) showToast('解析失败', error.message || 'Worker 执行失败。', 'error');
        stop();
      };

      if (file) {
        worker.postMessage({ type: 'parse-file', file, options, sourceName });
      } else {
        worker.postMessage({ type: 'parse-text', text, options, sourceName });
      }
    }

    return { parse, stop, isActive: () => !!worker };
  }

  async function loadDemoList(path = './data/data.json') {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load demo list: ${response.status}`);
    return response.json();
  }

  function addToHistory({ text, historyItems, loadedDemoText, saveHistory, skipHistoryRecord }) {
    if (skipHistoryRecord && skipHistoryRecord()) return;
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    if (estimateTextBytes(trimmed) > LARGE_TEXT_BYTES) return;
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
  }

  function loadLocalList(key, targetRef) {
    try {
      const stored = localStorage.getItem(key);
      if (stored) targetRef.value = JSON.parse(stored);
    } catch (e) {}
  }

  function saveLocalList(key, itemsRef) {
    try {
      localStorage.setItem(key, JSON.stringify(itemsRef.value));
    } catch (e) {}
  }

  function saveCurrentData({ rawInput, savedItems, saveSavedItems, showToast, blockLargeText = true }) {
    const text = rawInput.value;
    if (!text || !text.trim()) {
      showToast('保存失败', '当前工作区无数据，请输入或提取后再保存。', 'warning');
      return;
    }
    if (blockLargeText && estimateTextBytes(text) > LARGE_TEXT_BYTES) {
      showToast('保存失败', '大文本不会写入浏览器本地保存区，请使用下载功能保存到文件。', 'warning');
      return;
    }

    const now = new Date();
    const timeStr = `${now.toLocaleDateString()} ${now.toTimeString().split(' ')[0].substring(0, 5)}`;
    const defaultName = `保存于 ${timeStr}`;
    const name = prompt('请输入保存数据的名称：', defaultName);
    if (name === null) return;

    const finalName = name.trim() || defaultName;
    savedItems.value.unshift({ name: finalName, text: text.trim() });
    saveSavedItems();
    showToast('保存成功', `数据“${finalName}”已成功保存到本地。`, 'success');
  }

  function generateLargeJsonFile(targetBytes = 100 * MB) {
    const generateNested = (depth) => {
      if (depth <= 0) return `value_${Math.random()}`;
      return {
        id: Math.random().toString(36).substring(2),
        level: depth,
        timestamp: Date.now(),
        metadata: { type: 'test', active: true },
        tags: ['dynamic', 'test', 'performance'],
        children: [
          { sub: generateNested(depth - 1) },
          { sub: generateNested(depth - 1) }
        ]
      };
    };
    const itemStr = JSON.stringify(generateNested(7));
    const itemSizeBytes = estimateTextBytes(itemStr);
    const count = Math.ceil(targetBytes / itemSizeBytes);
    const arrayStr = `[${new Array(count).fill(itemStr).join(',')}]`;
    return new File([arrayStr], 'dynamic-100m.json', { type: 'application/json' });
  }

  async function handleFileDrop(event, options) {
    const {
      rawInput,
      setDragging,
      setSelectedFile,
      setSkipHistoryRecord,
      applyInputMode,
      startWorkerParse,
      showToast,
      nextTick
    } = options;

    setDragging(false);
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setSelectedFile(file);
    applyInputMode(file.size || 0);

    if ((file.size || 0) <= LARGE_TEXT_BYTES) {
      try {
        setSkipHistoryRecord(true);
        rawInput.value = await file.text();
        showToast('文件已载入', `成功读取文件：${file.name} (${formatSize(file.size)})`, 'success');
        nextTick(() => setSkipHistoryRecord(false));
      } catch (err) {
        setSkipHistoryRecord(false);
        showToast('载入失败', '读取文件时发生错误，请检查文件格式。', 'error');
      }
      return;
    }

    rawInput.value = '';
    showToast('文件解析中', `已进入${getModeBySize(file.size) === 'ultra' ? '超大文本' : '大文本'}模式：${file.name} (${formatSize(file.size)})`, 'info', 4500);
    startWorkerParse({ file, silent: false, sourceName: file.name });
  }

  async function handleDataSelect(event, options) {
    const val = event.target.value;
    if (!val) return;

    const {
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
      saveCurrent,
      startWorkerParse,
      applyInputMode,
      showToast,
      nextTick
    } = options;

    try {
      if (val === 'clear') {
        resetWorkspace();
        showToast('已清空', '工作区和解析记录已成功复位。', 'info');
        return;
      }

      if (val === 'clear-history') {
        historyItems.value = [];
        saveHistory();
        showToast('历史已清空', '已成功清空所有本地历史输入记录。', 'info');
        return;
      }

      if (val === 'generate-100m') {
        showToast('生成中', '正在动态生成 100M 多层次 JSON 数据，请稍候...', 'info');
        setTimeout(() => {
          try {
            const file = generateLargeJsonFile();
            setSelectedFile(file);
            applyInputMode(file.size);
            rawInput.value = '';
            showToast('生成完毕', '100M 数据生成完毕，开始解析...', 'success', 3000);
            startWorkerParse({ file, silent: false, sourceName: file.name });
          } catch (e) {
            showToast('生成失败', `生成 100M 数据时发生错误：${e.message}`, 'error');
          }
        }, 50);
        return;
      }

      if (val === 'save-current') {
        saveCurrent();
        return;
      }

      if (val === 'clear-saved') {
        if (confirm('确定要清空所有已保存的数据吗？')) {
          savedItems.value = [];
          saveSavedItems();
          showToast('已清空', '已成功清空所有手动保存的数据。', 'info');
        }
        return;
      }

      if (val.startsWith('saved-')) {
        const savedItem = savedItems.value[parseInt(val.replace('saved-', ''), 10)];
        if (savedItem) {
          setSkipHistoryRecord(true);
          setSelectedFile(null);
          resetForLoadedText();
          rawInput.value = savedItem.text;
          showToast('已加载保存数据', `已成功加载“${savedItem.name}”。`, 'info');
          nextTick(() => setSkipHistoryRecord(false));
        }
        return;
      }

      if (val.startsWith('hist-')) {
        const historyItem = historyItems.value[parseInt(val.replace('hist-', ''), 10)];
        if (historyItem) {
          setSkipHistoryRecord(true);
          setSelectedFile(null);
          resetForLoadedText();
          rawInput.value = historyItem.text;
          showToast('已加载历史数据', '已从历史记录中加载输入数据。', 'info');
          nextTick(() => setSkipHistoryRecord(false));
        }
        return;
      }

      if (val.startsWith('demo-')) {
        const key = val.replace('demo-', '');
        const fileInfo = demoFiles.value.find(f => f.key === key);
        if (!fileInfo) {
          showToast('加载失败', '未找到对应的测试数据配置。', 'error');
          return;
        }
        const response = await fetch(fileInfo.path);
        if (!response.ok) {
          showToast('加载失败', `无法获取测试数据文件 (${response.status})。`, 'error');
          return;
        }
        const text = await response.text();
        setSkipHistoryRecord(true);
        setSelectedFile(null);
        resetForLoadedText();
        loadedDemoText.value = text;
        rawInput.value = text;
        showToast('示例数据已加载', `已加载：${fileInfo.name}。已自动解析。`, 'info');
        nextTick(() => setSkipHistoryRecord(false));
      }
    } catch (e) {
      showToast('加载失败', '读取数据时发生错误，请稍后再试。', 'error');
      console.error(e);
    } finally {
      event.target.value = '';
    }
  }

  global.JsonToolCore = {
    constants: { LARGE_TEXT_BYTES, ULTRA_TEXT_BYTES, DEFAULT_ADVANCED_OPTIONS },
    estimateTextBytes,
    formatSize,
    getModeBySize,
    createInputModeController,
    createProgressController,
    createWorkerParser,
    loadDemoList,
    addToHistory,
    loadLocalList,
    saveLocalList,
    saveCurrentData,
    generateLargeJsonFile,
    handleFileDrop,
    handleDataSelect
  };
})(window);
