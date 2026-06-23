import { createApp, ref, reactive, onMounted, nextTick } from 'vue';
import mermaid from 'mermaid';

import { diagramData } from 'mermaid-examples';

const DEFAULT_CONFIG = `{\n  "theme": "default"\n}`;

// Base64 URL 编解码
const encodeBase64Url = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decodeBase64Url = (str) => atob(str.replace(/-/g, '+').replace(/_/g, '/'));

createApp({
    setup() {
        const activeTab = ref('code');
        const selectedTemplate = ref('');
        const selectedLocalTemplate = ref('');
        const isDarkTheme = ref(false);
        const errorMessage = ref('');
        const isRendering = ref(false);
        const previewContainer = ref(null);
        const toastMessage = ref('');
        
        const state = reactive({
            code: diagramData[0]?.examples[0]?.code || '',
            mermaid: DEFAULT_CONFIG,
            autoSync: true,
            updateDiagram: true
        });

        let codeEditor = null;
        let configEditor = null;
        let panZoomInstance = null;
        let renderTimeout = null;
        let currentSvgCode = '';
        let initialLoad = true;

        const localDiagrams = ref([]);
        const currentContext = reactive({
            isLocal: false,
            id: null,
            title: diagramData[0]?.examples[0]?.title || 'Custom Diagram'
        });

        try {
            const stored = localStorage.getItem('mermaid_local_diagrams');
            if (stored) localDiagrams.value = JSON.parse(stored);
        } catch(e) {}

        const syncLocal = () => {
            localStorage.setItem('mermaid_local_diagrams', JSON.stringify(localDiagrams.value));
        };

        const showToast = (msg) => {
            toastMessage.value = msg;
            setTimeout(() => toastMessage.value = '', 3000);
        };

        // 从 URL 恢复状态
        const loadStateFromUrl = () => {
            const hash = window.location.hash.slice(1);
            if (!hash) return false;
            try {
                // 官方格式：#p=... 或者直接 hash
                const encoded = hash.startsWith('p=') ? hash.slice(2) : hash;
                const compressedStr = decodeBase64Url(encoded);
                const compressedBytes = Uint8Array.from(compressedStr, c => c.charCodeAt(0));
                const jsonStr = new TextDecoder().decode(pako.inflate(compressedBytes));
                const parsed = JSON.parse(jsonStr);
                
                if (parsed.code) state.code = parsed.code;
                if (parsed.mermaid) state.mermaid = typeof parsed.mermaid === 'string' ? parsed.mermaid : JSON.stringify(parsed.mermaid, null, 2);
                if (parsed.autoSync !== undefined) state.autoSync = parsed.autoSync;
                
                return true;
            } catch (e) {
                console.warn('Failed to parse state from URL', e);
                return false;
            }
        };

        // 保存状态到 URL
        const saveStateToUrl = () => {
            try {
                const jsonStr = JSON.stringify({
                    code: state.code,
                    mermaid: state.mermaid,
                    autoSync: state.autoSync,
                    updateDiagram: true
                });
                const bytes = new TextEncoder().encode(jsonStr);
                const compressed = pako.deflate(bytes, { level: 9 });
                const str = String.fromCharCode.apply(null, compressed);
                const base64 = encodeBase64Url(str);
                window.history.replaceState(null, '', '#p=' + base64);
            } catch (e) {
                console.error('Failed to save state to URL', e);
            }
        };

        const triggerRender = () => {
            if (renderTimeout) clearTimeout(renderTimeout);
            isRendering.value = true;
            renderTimeout = setTimeout(() => {
                renderMermaid();
            }, 500);
        };

        const onAutoSyncChange = () => {
            if (state.autoSync) {
                triggerRender();
            } else {
                saveStateToUrl();
            }
        };

        const renderMermaid = async () => {
            if (codeEditor) state.code = codeEditor.getValue();
            if (configEditor) state.mermaid = configEditor.getValue();

            if (!state.code.trim()) {
                document.getElementById('mermaid-output').innerHTML = '';
                errorMessage.value = '';
                isRendering.value = false;
                return;
            }

            try {
                // 解析 Config
                let configObj = { theme: 'default' };
                try {
                    if (state.mermaid.trim()) {
                        configObj = JSON.parse(state.mermaid);
                    }
                } catch (e) {
                    throw new Error("Config JSON 解析错误: " + e.message);
                }

                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: 'loose',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    ...configObj
                });

                const id = 'mermaid-svg-' + Date.now();
                const { svg } = await mermaid.render(id, state.code);
                
                errorMessage.value = '';
                currentSvgCode = svg;
                document.getElementById('mermaid-output').innerHTML = svg;
                initPanZoom();
                saveStateToUrl();

            } catch (err) {
                console.error("Mermaid Render Error:", err);
                errorMessage.value = err.message || err.str || String(err);
                const errorNodes = document.querySelectorAll('[id^="dmermaid-svg-"]');
                errorNodes.forEach(node => node.remove());
            } finally {
                isRendering.value = false;
            }
        };

        const initPanZoom = () => {
            if (panZoomInstance) {
                panZoomInstance.destroy();
                panZoomInstance = null;
            }
            const svgElement = document.querySelector('#mermaid-output svg');
            if (svgElement) {
                svgElement.style.width = '100%';
                svgElement.style.height = '100%';
                panZoomInstance = svgPanZoom(svgElement, {
                    zoomEnabled: true,
                    controlIconsEnabled: false,
                    fit: true,
                    center: true,
                    minZoom: 0.1,
                    maxZoom: 10,
                    zoomScaleSensitivity: 0.2
                });
            }
        };

        const loadTemplate = () => {
            const val = selectedTemplate.value;
            if (!val) return;
            
            if (val.startsWith('official:')) {
                const title = val.substring(9);
                let found = null;
                for (const group of diagramData) {
                    found = group.examples.find(e => e.title === title);
                    if (found) break;
                }
                if (found) {
                    if (codeEditor) codeEditor.setValue(found.code);
                    if (configEditor) configEditor.setValue(DEFAULT_CONFIG);
                    currentContext.isLocal = false;
                    currentContext.id = null;
                    currentContext.title = title;
                }
            }
            selectedTemplate.value = '';
        };

        const loadLocalTemplate = () => {
            const val = selectedLocalTemplate.value;
            if (!val) return;
            
            if (val.startsWith('local:')) {
                const id = parseInt(val.substring(6));
                const found = localDiagrams.value.find(d => d.id === id);
                if (found) {
                    if (codeEditor) codeEditor.setValue(found.code);
                    if (configEditor) configEditor.setValue(found.config || DEFAULT_CONFIG);
                    currentContext.isLocal = true;
                    currentContext.id = id;
                    currentContext.title = found.title;
                }
            }
            selectedLocalTemplate.value = '';
        };

        const saveLocal = () => {
            if (currentContext.isLocal) {
                const idx = localDiagrams.value.findIndex(d => d.id === currentContext.id);
                if (idx !== -1) {
                    localDiagrams.value[idx].title = currentContext.title;
                    localDiagrams.value[idx].code = state.code;
                    localDiagrams.value[idx].config = state.mermaid;
                    syncLocal();
                    showToast('💾 已覆盖保存至: ' + currentContext.title);
                    return;
                }
            }
            
            let newName = currentContext.title;
            
            const isOfficialName = diagramData.some(g => g.examples.some(e => e.title === newName));
            if (isOfficialName || localDiagrams.value.some(d => d.title === newName)) {
                let baseName = newName.replace(/ copy(\s\d+)?$/, '');
                newName = baseName + ' copy';
                let counter = 2;
                while (localDiagrams.value.some(d => d.title === newName)) {
                    newName = baseName + ' copy ' + counter;
                    counter++;
                }
            }
            
            currentContext.title = newName;
            
            const newLocal = {
                id: Date.now(),
                title: newName,
                code: state.code,
                config: state.mermaid
            };
            
            localDiagrams.value.unshift(newLocal);
            syncLocal();
            
            currentContext.isLocal = true;
            currentContext.id = newLocal.id;
            
            showToast('💾 已新建保存: ' + newName);
        };

        const deleteLocal = () => {
            if (!currentContext.isLocal) return;
            localDiagrams.value = localDiagrams.value.filter(d => d.id !== currentContext.id);
            syncLocal();
            
            showToast('🗑️ 已删除: ' + currentContext.title);
            currentContext.isLocal = false;
            currentContext.id = null;
        };

        const resetZoom = () => {
            if (panZoomInstance) {
                panZoomInstance.resetZoom();
                panZoomInstance.center();
            }
        };

        const toggleTheme = () => {
            isDarkTheme.value = !isDarkTheme.value;
            try {
                let cfg = JSON.parse(configEditor.getValue() || '{}');
                cfg.theme = isDarkTheme.value ? 'dark' : 'default';
                configEditor.setValue(JSON.stringify(cfg, null, 2));
            } catch(e) {}
        };

        const copyLink = () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                showToast('🔗 分享链接已复制到剪贴板！');
            });
        };

        const copyMarkdown = () => {
            const md = `[Mermaid chart](${window.location.href})\n\n\`\`\`mermaid\n${state.code}\n\`\`\``;
            navigator.clipboard.writeText(md).then(() => {
                showToast('📋 Markdown 源码已复制！');
            });
        };

        const downloadSvg = () => {
            if (!currentSvgCode) return;
            const blob = new Blob([currentSvgCode], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mermaid-diagram.svg';
            a.click();
            URL.revokeObjectURL(url);
        };

        const generatePngCanvas = () => {
            return new Promise((resolve) => {
                if (!currentSvgCode) return resolve(null);
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = currentSvgCode;
                const cloneSvg = tempDiv.querySelector('svg');
                if (!cloneSvg) return resolve(null);

                const viewBox = cloneSvg.getAttribute('viewBox');
                let width = cloneSvg.getAttribute('width');
                let height = cloneSvg.getAttribute('height');
                
                if (viewBox) {
                    const parts = viewBox.split(/\s+|,/);
                    width = parseFloat(parts[2]);
                    height = parseFloat(parts[3]);
                } else {
                    width = parseFloat(width || 800);
                    height = parseFloat(height || 600);
                }

                cloneSvg.setAttribute('width', width);
                cloneSvg.setAttribute('height', height);
                // Ensure background is applied
                cloneSvg.style.backgroundColor = isDarkTheme.value ? '#1e293b' : '#ffffff';

                const svgData = new XMLSerializer().serializeToString(cloneSvg);
                const canvas = document.createElement('canvas');
                canvas.width = width * 2; 
                canvas.height = height * 2;
                
                const ctx = canvas.getContext('2d');
                ctx.scale(2, 2);
                ctx.fillStyle = isDarkTheme.value ? '#1e293b' : '#ffffff';
                ctx.fillRect(0, 0, width, height);

                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas);
                };
                img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
            });
        };

        const downloadPng = async () => {
            if (!currentSvgCode) return;
            const canvas = await generatePngCanvas();
            if (canvas) {
                const a = document.createElement('a');
                a.download = 'mermaid-diagram.png';
                a.href = canvas.toDataURL('image/png');
                a.click();
            }
        };

        const copyPng = async () => {
            if (!currentSvgCode) return;
            try {
                const canvas = await generatePngCanvas();
                if (canvas) {
                    canvas.toBlob(blob => {
                        navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]).then(() => {
                            showToast('🖼️ 图片已复制到剪贴板！');
                        }).catch(e => {
                            showToast('复制图片失败: ' + e);
                        });
                    });
                }
            } catch(e) {
                showToast('当前环境不支持直接复制图片');
            }
        };

        onMounted(() => {
            loadStateFromUrl();

            const initMonaco = () => {
                if (window.require) {
                    require(['vs/editor/editor.main'], () => {
                        // Code Editor
                        codeEditor = monaco.editor.create(document.getElementById('code-editor-container'), {
                            value: state.code,
                            language: 'markdown', 
                            theme: 'vs-dark',
                            automaticLayout: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: 'on'
                        });

                        // Config Editor
                        configEditor = monaco.editor.create(document.getElementById('config-editor-container'), {
                            value: state.mermaid,
                            language: 'json', 
                            theme: 'vs-dark',
                            automaticLayout: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: 'on'
                        });

                        const handleContentChange = () => {
                            if (initialLoad) return;
                            if (state.autoSync) {
                                triggerRender();
                            }
                        };

                        codeEditor.onDidChangeModelContent(handleContentChange);
                        configEditor.onDidChangeModelContent(handleContentChange);

                        initialLoad = false;
                        triggerRender();
                    });
                } else {
                    setTimeout(initMonaco, 100);
                }
            };
            
            initMonaco();
            
            // 监听前进后退 URL 改变
            window.addEventListener('hashchange', () => {
                if (loadStateFromUrl()) {
                    if (codeEditor) codeEditor.setValue(state.code);
                    if (configEditor) configEditor.setValue(state.mermaid);
                    if (state.autoSync) triggerRender();
                }
            });
        });

        return {
            activeTab,
            selectedTemplate,
            selectedLocalTemplate,
            diagramData,
            localDiagrams,
            currentContext,
            isDarkTheme,
            errorMessage,
            isRendering,
            previewContainer,
            toastMessage,
            state,
            loadTemplate,
            loadLocalTemplate,
            resetZoom,
            toggleTheme,
            downloadSvg,
            downloadPng,
            copyLink,
            copyMarkdown,
            copyPng,
            triggerRender,
            onAutoSyncChange,
            saveLocal,
            deleteLocal
        };
    }
}).mount('#app');
