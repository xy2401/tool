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
    const inputFilter = document.getElementById('inputFilter');
    const repoList = document.getElementById('repoList');
    const repoStats = document.getElementById('repoStats');
    
    const inputTemplate = document.getElementById('inputTemplate');
    const outputPreview = document.getElementById('outputPreview');
    const btnCopy = document.getElementById('btnCopy');

    // State
    let currentRepos = [];
    let displayedRepos = [];

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
    const fetchRepos = async (username) => {
        repoList.innerHTML = '<div class="empty-state">Loading repositories...</div>';
        repoStats.textContent = 'Searching...';
        
        const pat = localStorage.getItem('gh_explorer_pat');
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        
        if (pat) {
            headers['Authorization'] = `token ${pat}`;
        }
        
        try {
            // Fetch multiple pages if user has many repos. For simplicity, we just fetch per_page=100.
            // If we wanted all, we would need to handle pagination via Link headers.
            let url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`;
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                if (response.status === 404) throw new Error('User or Organization not found');
                if (response.status === 403) throw new Error('API Rate limit exceeded. Please configure PAT in settings.');
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            currentRepos = data;
            applySortAndFilter();
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
            fetchRepos(username);
        }
    });

    inputUsername.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnSearch.click();
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
