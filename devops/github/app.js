document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const btnSettings = document.getElementById('btnSettings');
    const btnTheme = document.getElementById('btnTheme');
    const settingsModal = document.getElementById('settingsModal');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const inputPat = document.getElementById('inputPat');
    
    const btnAdvancedToggle = document.getElementById('btnAdvancedToggle');
    const advancedPanel = document.getElementById('advancedPanel');
    const inputQuery = document.getElementById('inputQuery');
    const advOwner = document.getElementById('advOwner');
    const advLanguage = document.getElementById('advLanguage');
    const advMinStars = document.getElementById('advMinStars');
    const advTopic = document.getElementById('advTopic');
    
    const btnSearch = document.getElementById('btnSearch');
    const selectSort = document.getElementById('selectSort');
    const selectPerPage = document.getElementById('selectPerPage');
    const inputFilter = document.getElementById('inputFilter');
    const repoList = document.getElementById('repoList');
    const repoStats = document.getElementById('repoStats');
    const inputTemplate = document.getElementById('inputTemplate');
    const inputTemplateName = document.getElementById('inputTemplateName');
    const selectTemplateHidden = document.getElementById('selectTemplateHidden');
    const btnDeleteTemplate = document.getElementById('btnDeleteTemplate');
    const templateSavedIndicator = document.getElementById('templateSavedIndicator');
    
    const outputPreview = document.getElementById('outputPreview');
    const outputJson = document.getElementById('outputJson');
    const btnCopy = document.getElementById('btnCopy');
    
    // Default Templates
    const defaultTemplates = {
        "Markdown List": "- [${name}](${html_url})\n  > ${description}\n  > ⭐ ${stargazers_count} | 🕒 ${updated_at}",
        "Markdown Table": "| Name | Description | Stars |\n|---|---|---|\n| [${name}](${html_url}) | ${description} | ⭐ ${stargazers_count} |",
        "CSV Format": "${name},${html_url},${stargazers_count},${language}"
    };

    let userTemplates = {};
    let currentTemplateKey = "Markdown List";

    const paginationControls = document.getElementById('paginationControls');
    const btnPrevPage = document.getElementById('btnPrevPage');
    const btnNextPage = document.getElementById('btnNextPage');
    const pageIndicator = document.getElementById('pageIndicator');
    
    // Tabs Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => {
                p.classList.remove('active');
                p.style.display = 'none';
            });
            btn.classList.add('active');
            const target = document.getElementById(btn.getAttribute('data-target'));
            target.classList.add('active');
            target.style.display = 'flex';
        });
    });

    // State
    let currentRepos = [];
    let displayedRepos = [];
    let currentPage = 1;
    let hasNextPage = false;

    // Initialize Settings & Theme
    const loadSettings = () => {
        const pat = localStorage.getItem('gh_explorer_pat') || '';
        inputPat.value = pat;
        
        const theme = localStorage.getItem('gh_explorer_theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);

        // Load Templates
        try {
            const savedTemplates = JSON.parse(localStorage.getItem('gh_explorer_templates'));
            userTemplates = savedTemplates && Object.keys(savedTemplates).length > 0 ? savedTemplates : { ...defaultTemplates };
        } catch(e) {
            userTemplates = { ...defaultTemplates };
        }
        
        currentTemplateKey = localStorage.getItem('gh_explorer_current_template') || "Markdown List";
        if (!userTemplates[currentTemplateKey]) currentTemplateKey = Object.keys(userTemplates)[0];
        
        renderTemplatePresets();
        updateTemplateEditor();
    };

    const renderTemplatePresets = () => {
        selectTemplateHidden.innerHTML = '';
        Object.keys(userTemplates).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = key;
            selectTemplateHidden.appendChild(opt);
        });
        inputTemplateName.value = currentTemplateKey;
        selectTemplateHidden.value = currentTemplateKey;
    };

    const updateTemplateEditor = () => {
        inputTemplateName.value = currentTemplateKey;
        selectTemplateHidden.value = currentTemplateKey;
        inputTemplate.value = userTemplates[currentTemplateKey] || "";
        btnDeleteTemplate.style.visibility = defaultTemplates[currentTemplateKey] ? 'hidden' : 'visible';
        generateOutput();
    };

    // Template UI Listeners
    selectTemplateHidden.addEventListener('change', (e) => {
        inputTemplateName.value = e.target.value;
        inputTemplateName.dispatchEvent(new Event('change'));
    });

    inputTemplateName.addEventListener('change', (e) => {
        let newName = e.target.value.trim();
        if (!newName) {
            newName = currentTemplateKey; // Revert if empty
            inputTemplateName.value = newName;
            return;
        }
        
        if (userTemplates[newName] !== undefined) {
            // Exists: Switch to it
            currentTemplateKey = newName;
            updateTemplateEditor();
        } else {
            // Does not exist: Create new based on current textarea
            currentTemplateKey = newName;
            userTemplates[newName] = inputTemplate.value;
            saveTemplates();
            renderTemplatePresets();
            updateTemplateEditor();
        }
    });

    btnDeleteTemplate.addEventListener('click', () => {
        if (!defaultTemplates[currentTemplateKey]) {
            if (confirm(`Delete template "${currentTemplateKey}"?`)) {
                delete userTemplates[currentTemplateKey];
                currentTemplateKey = Object.keys(userTemplates)[0];
                saveTemplates();
                renderTemplatePresets();
                updateTemplateEditor();
            }
        }
    });

    const saveTemplates = () => {
        localStorage.setItem('gh_explorer_templates', JSON.stringify(userTemplates));
        localStorage.setItem('gh_explorer_current_template', currentTemplateKey);
    };

    // Advanced Toggle
    btnAdvancedToggle.addEventListener('click', () => {
        if (advancedPanel.style.display === 'none') {
            advancedPanel.style.display = 'grid';
            btnAdvancedToggle.classList.add('active');
        } else {
            advancedPanel.style.display = 'none';
            btnAdvancedToggle.classList.remove('active');
        }
    });

    const buildQuery = () => {
        let parts = [];
        const raw = inputQuery.value.trim();
        if (raw) parts.push(raw);
        
        const owner = advOwner.value.trim();
        if (owner) parts.push(`user:${owner}`);
        
        const lang = advLanguage.value.trim();
        if (lang) parts.push(`language:${lang}`);
        
        const stars = advMinStars.value.trim();
        if (stars) parts.push(`stars:>=${stars}`);
        
        const topic = advTopic.value.trim();
        if (topic) parts.push(`topic:${topic}`);
        
        return parts.join(' ');
    };

    btnTheme.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('gh_explorer_theme', newTheme);
    });
    
    const saveSettings = () => {
        const pat = inputPat.value.trim();
        if (pat) {
            localStorage.setItem('gh_explorer_pat', pat);
        } else {
            localStorage.removeItem('gh_explorer_pat');
        }
        settingsModal.classList.remove('active');
    };

    btnSettings.addEventListener('click', () => {
        loadSettings();
        settingsModal.classList.add('active');
    });
    
    btnCloseSettings.addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });
    
    btnSaveSettings.addEventListener('click', saveSettings);

    // Fetch Repos
    const fetchRepos = async (page = 1) => {
        const query = buildQuery();
        if (!query) {
            repoList.innerHTML = '<div class="empty-state">Please enter a search query or advanced filter.</div>';
            repoStats.textContent = '0 repos found';
            return;
        }

        repoList.innerHTML = '<div class="empty-state">Loading repositories...</div>';
        repoStats.textContent = 'Searching...';
        paginationControls.style.display = 'none';
        
        const pat = localStorage.getItem('gh_explorer_pat');
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        
        if (pat) {
            headers['Authorization'] = `token ${pat}`;
        }
        
        try {
            const perPage = selectPerPage.value;
            const sort = selectSort.value;
            let url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=${perPage}&page=${page}`;
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                if (response.status === 403) throw new Error('API Rate limit exceeded. Please configure PAT in settings.');
                if (response.status === 422) throw new Error('Invalid search query. Check your syntax.');
                throw new Error(`API Error: ${response.status}`);
            }
            
            // Handle Pagination Link Header
            const linkHeader = response.headers.get('Link');
            hasNextPage = linkHeader && linkHeader.includes('rel="next"');
            currentPage = page;
            
            const data = await response.json();
            currentRepos = data.items || [];
            repoStats.textContent = `Total: ${data.total_count.toLocaleString()} repos`;
            applySortAndFilter();
            
            // Update Pagination UI
            if (currentPage > 1 || hasNextPage) {
                paginationControls.style.display = 'flex';
                pageIndicator.textContent = `Page ${currentPage}`;
                btnPrevPage.disabled = currentPage === 1;
                btnNextPage.disabled = !hasNextPage;
            }
            
        } catch (err) {
            repoList.innerHTML = `<div class="empty-state" style="color: #ff7b72;">Error: ${err.message}</div>`;
            repoStats.textContent = 'Error';
            currentRepos = [];
            displayedRepos = [];
            generateOutput();
        }
    };

    btnSearch.addEventListener('click', () => fetchRepos(1));

    inputQuery.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchRepos(1);
        }
    });

    [advOwner, advLanguage, advMinStars, advTopic].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fetchRepos(1);
        });
    });

    btnPrevPage.addEventListener('click', () => {
        if (currentPage > 1) {
            fetchRepos(currentPage - 1);
        }
    });

    btnNextPage.addEventListener('click', () => {
        if (hasNextPage) {
            fetchRepos(currentPage + 1);
        }
    });

    selectPerPage.addEventListener('change', () => {
        fetchRepos(1);
    });
    
    selectSort.addEventListener('change', () => {
        fetchRepos(1); // API driven sort requires refetch
    });

    // Render Data
    const renderRepos = () => {
        if (displayedRepos.length === 0) {
            repoList.innerHTML = '<div class="empty-state">No repositories match your criteria.</div>';
            return;
        }

        const html = displayedRepos.map(repo => {
            const date = new Date(repo.pushed_at || repo.updated_at).toISOString().split('T')[0];
            const licenseHtml = repo.license ? `<span title="License">⚖️ ${repo.license.spdx_id || repo.license.name}</span>` : '';
            const langHtml = repo.language ? `<span>📦 ${repo.language}</span>` : '';
            const topicsHtml = (repo.topics && repo.topics.length > 0) 
                ? `<div class="repo-topics" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">` +
                  repo.topics.map(t => `<span class="topic-tag">${escapeHtml(t)}</span>`).join('') +
                  `</div>`
                : '';
            
            return `
                <div class="repo-card">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
                        <img src="${repo.owner.avatar_url}" alt="${repo.owner.login}" style="width: 24px; height: 24px; border-radius: 50%;">
                        <a href="${repo.html_url}" target="_blank" class="repo-name" style="margin: 0; font-size: 1.1rem;">${repo.full_name}</a>
                    </div>
                    
                    <div class="repo-desc">${escapeHtml(repo.description || 'No description provided')}</div>
                    ${topicsHtml}
                    
                    <div class="clone-url-group" style="display: flex; gap: 0; align-items: center; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; margin: 8px 0;">
                        <select class="clone-type-select" data-https="${repo.clone_url}" data-ssh="${repo.ssh_url}" data-gh="gh repo clone ${repo.full_name}" style="border: none; background: var(--bg-surface); border-right: 1px solid var(--border-color); padding: 4px 8px; font-size: 0.75rem; border-radius: 0; outline: none; cursor: pointer;">
                            <option value="https">HTTPS</option>
                            <option value="ssh">SSH</option>
                            <option value="gh">GitHub CLI</option>
                        </select>
                        <input type="text" readonly value="${repo.clone_url}" class="clone-url-input" style="flex: 1; border: none; padding: 4px 8px; font-size: 0.75rem; background: var(--bg-base); color: var(--text-secondary); border-radius: 0; outline: none;">
                        <button class="btn copy-clone-btn" title="Copy to clipboard" style="border: none; border-left: 1px solid var(--border-color); background: var(--bg-surface); padding: 4px 8px; border-radius: 0; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; min-width: 32px;">
                            <svg class="copy-icon" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor"><path fill-rule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"></path><path fill-rule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"></path></svg>
                            <svg class="check-icon" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="var(--success-color)" style="display: none;"><path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg>
                        </button>
                    </div>

                    <div class="repo-meta" style="flex-wrap: wrap;">
                        <span title="Stars">⭐ ${repo.stargazers_count}</span>
                        <span title="Forks">🍴 ${repo.forks_count}</span>
                        <span title="Open Issues">🚨 ${repo.open_issues_count}</span>
                        ${langHtml}
                        ${licenseHtml}
                        <span title="Last Updated">🕒 Updated: ${date}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        repoList.innerHTML = html;
    };

    // Global event delegation for repo list
    repoList.addEventListener('change', (e) => {
        if (e.target.classList.contains('clone-type-select')) {
            const select = e.target;
            const input = select.parentElement.querySelector('.clone-url-input');
            const type = select.value;
            input.value = select.getAttribute(`data-${type}`);
        }
    });

    repoList.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-clone-btn');
        if (btn) {
            const input = btn.parentElement.querySelector('.clone-url-input');
            if (input && input.value) {
                navigator.clipboard.writeText(input.value).then(() => {
                    const copyIcon = btn.querySelector('.copy-icon');
                    const checkIcon = btn.querySelector('.check-icon');
                    copyIcon.style.display = 'none';
                    checkIcon.style.display = 'block';
                    setTimeout(() => {
                        copyIcon.style.display = 'block';
                        checkIcon.style.display = 'none';
                    }, 2000);
                });
            }
        }
    });

    // Local Filter (Sort is now global via API)
    const applySortAndFilter = () => {
        let result = [...currentRepos];
        
        // Filter
        const filterText = inputFilter.value.toLowerCase().trim();
        if (filterText) {
            result = result.filter(repo => 
                (repo.full_name && repo.full_name.toLowerCase().includes(filterText)) ||
                (repo.description && repo.description.toLowerCase().includes(filterText))
            );
        }
        
        displayedRepos = result;
        
        renderRepos();
        outputJson.value = JSON.stringify(displayedRepos, null, 2);
        generateOutput();
    };

    inputFilter.addEventListener('input', applySortAndFilter);

    // Template Generator
    const generateOutput = () => {
        const template = inputTemplate.value;
        if (!template.trim() || displayedRepos.length === 0) {
            outputPreview.value = '';
            return;
        }

        // Gather all possible keys to inject them as JS variables
        const allKeysSet = new Set();
        displayedRepos.forEach(r => Object.keys(r).forEach(k => allKeysSet.add(k)));
        const keys = Array.from(allKeysSet);
        
        let compiledFunc;
        try {
            // Compile template string into a real JS function
            compiledFunc = new Function(...keys, "return `" + template.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + "`;");
        } catch(e) {
            outputPreview.value = `Template Compile Error:\n${e.message}\nMake sure your \${...} expressions are valid JavaScript.`;
            return;
        }

        const output = displayedRepos.map((repo, index) => {
            try {
                const values = keys.map(k => {
                    let val = repo[k];
                    // Retain date formatting backward compatibility
                    if ((k === 'updated_at' || k === 'pushed_at') && val) {
                        return new Date(val).toISOString().split('T')[0];
                    }
                    if (val === null || val === undefined) return '';
                    return val;
                });
                return compiledFunc(...values);
            } catch(e) {
                return `[Error rendering repo ${repo.name || index}: ${e.message}]`;
            }
        }).join('\n\n');
        
        outputPreview.value = output;
    };

    let templateSaveTimeout;
    inputTemplate.addEventListener('input', () => {
        generateOutput();
        
        // Auto-fork if modifying a default template
        if (defaultTemplates[currentTemplateKey]) {
            let copyName = `${currentTemplateKey} (副本)`;
            let counter = 1;
            while (userTemplates[copyName]) {
                copyName = `${currentTemplateKey} (副本 ${counter})`;
                counter++;
            }
            currentTemplateKey = copyName;
            inputTemplateName.value = currentTemplateKey;
            btnDeleteTemplate.style.visibility = 'visible';
            renderTemplatePresets();
        }
        
        userTemplates[currentTemplateKey] = inputTemplate.value;
        
        clearTimeout(templateSaveTimeout);
        templateSaveTimeout = setTimeout(() => {
            saveTemplates();
            if (templateSavedIndicator) {
                templateSavedIndicator.style.display = 'inline';
                setTimeout(() => {
                    templateSavedIndicator.style.display = 'none';
                }, 2000);
            }
        }, 500);
    });

    btnCopy.addEventListener('click', () => {
        if (!outputPreview.value) return;
        navigator.clipboard.writeText(outputPreview.value).then(() => {
            const originalText = btnCopy.textContent;
            btnCopy.textContent = 'Copied!';
            setTimeout(() => {
                btnCopy.textContent = originalText;
            }, 2000);
        });
    });

    // Helper
    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    // Init
    loadSettings();
});
