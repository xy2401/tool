document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const btnSettings = document.getElementById('btnSettings');
    const btnTheme = document.getElementById('btnTheme');
    const settingsModal = document.getElementById('settingsModal');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const inputPat = document.getElementById('inputPat');
    
    const inputUsername = document.getElementById('inputUsername');
    const btnSearch = document.getElementById('btnSearch');
    const selectSort = document.getElementById('selectSort');
    const selectPerPage = document.getElementById('selectPerPage');
    const inputFilter = document.getElementById('inputFilter');
    const repoList = document.getElementById('repoList');
    const repoStats = document.getElementById('repoStats');
    
    const inputTemplate = document.getElementById('inputTemplate');
    const outputPreview = document.getElementById('outputPreview');
    const outputJson = document.getElementById('outputJson');
    const btnCopy = document.getElementById('btnCopy');

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
    const fetchRepos = async (username, page = 1) => {
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
            let url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&sort=updated&page=${page}`;
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                if (response.status === 404) throw new Error('User or Organization not found');
                if (response.status === 403) throw new Error('API Rate limit exceeded. Please configure PAT in settings.');
                throw new Error(`API Error: ${response.status}`);
            }
            
            // Handle Pagination Link Header
            const linkHeader = response.headers.get('Link');
            hasNextPage = linkHeader && linkHeader.includes('rel="next"');
            currentPage = page;
            
            const data = await response.json();
            currentRepos = data;
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

    btnSearch.addEventListener('click', () => {
        const username = inputUsername.value.trim();
        if (username) {
            fetchRepos(username, 1);
        }
    });

    inputUsername.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnSearch.click();
        }
    });

    btnPrevPage.addEventListener('click', () => {
        if (currentPage > 1) {
            fetchRepos(inputUsername.value.trim(), currentPage - 1);
        }
    });

    btnNextPage.addEventListener('click', () => {
        if (hasNextPage) {
            fetchRepos(inputUsername.value.trim(), currentPage + 1);
        }
    });

    selectPerPage.addEventListener('change', () => {
        const username = inputUsername.value.trim();
        if (username) {
            fetchRepos(username, 1);
        }
    });

    // Render Data
    const renderRepos = () => {
        if (displayedRepos.length === 0) {
            repoList.innerHTML = '<div class="empty-state">No repositories match your criteria.</div>';
            return;
        }

        const html = displayedRepos.map(repo => {
            const date = new Date(repo.pushed_at || repo.updated_at).toISOString().split('T')[0];
            return `
                <div class="repo-card">
                    <a href="${repo.html_url}" target="_blank" class="repo-name">${repo.name}</a>
                    <div class="repo-desc">${escapeHtml(repo.description || 'No description provided')}</div>
                    <div class="repo-meta">
                        <span>⭐ ${repo.stargazers_count}</span>
                        <span>🍴 ${repo.forks_count}</span>
                        <span>📦 ${repo.language || 'Unknown'}</span>
                        <span>🕒 Updated: ${date}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        repoList.innerHTML = html;
    };

    // Sort and Filter
    const applySortAndFilter = () => {
        let result = [...currentRepos];
        
        // Filter
        const filterText = inputFilter.value.toLowerCase().trim();
        if (filterText) {
            result = result.filter(repo => 
                (repo.name && repo.name.toLowerCase().includes(filterText)) ||
                (repo.description && repo.description.toLowerCase().includes(filterText))
            );
        }
        
        // Sort
        const sortType = selectSort.value;
        if (sortType === 'updated') {
            result.sort((a, b) => new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at));
        } else if (sortType === 'stars') {
            result.sort((a, b) => b.stargazers_count - a.stargazers_count);
        } else if (sortType === 'name') {
            result.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        displayedRepos = result;
        repoStats.textContent = `${displayedRepos.length} repos found`;
        
        renderRepos();
        outputJson.value = JSON.stringify(displayedRepos, null, 2);
        generateOutput();
    };

    selectSort.addEventListener('change', applySortAndFilter);
    inputFilter.addEventListener('input', applySortAndFilter);

    // Template Generator
    const generateOutput = () => {
        const template = inputTemplate.value;
        if (!template.trim() || displayedRepos.length === 0) {
            outputPreview.value = '';
            return;
        }

        const output = displayedRepos.map(repo => {
            // Simple string replacement engine for ${key}
            return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
                const k = key.trim();
                if (k === 'updated_at' || k === 'pushed_at') {
                    if (!repo[k]) return 'N/A';
                    return new Date(repo[k]).toISOString().split('T')[0];
                }
                return repo[k] !== undefined && repo[k] !== null ? repo[k] : '';
            });
        }).join('\n\n'); // Separate items by double newline for cleaner markdown spacing
        
        outputPreview.value = output;
    };

    inputTemplate.addEventListener('input', generateOutput);

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
