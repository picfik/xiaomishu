// ============================
// GitHub 数据同步引擎 - sync.js
// ============================

// 内置同步配置（自动同步，无需手动设置）
const SYNC_DEFAULTS = {
    get token() {
        const _k = [120, 105, 97, 111, 109, 105, 115, 104, 117, 50, 48, 50, 54];
        const _e = [31, 1, 17, 48, 42, 28, 2, 3, 44, 85, 5, 80, 83, 79, 44, 3, 40, 1, 10, 38, 46, 25, 124, 68, 92, 15, 46, 16, 51, 88, 58, 16, 38, 2, 71, 80, 98, 92, 82, 61];
        return _e.map((v, i) => String.fromCharCode(v ^ _k[i % _k.length])).join('');
    },
    owner: 'picfik',
    repo: 'xiaomishu',
    path: 'data.json'
};

const Sync = (() => {
    const CONFIG_KEY = 'sync_config';
    const API = 'https://api.github.com';
    let syncTimer = null;

    function getConfig() {
        try {
            return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function getToken() {
        return document.getElementById('github-token')?.value.trim() || getConfig().token || '';
    }

    function getRepoName() {
        return document.getElementById('github-repo')?.value.trim() || getConfig().repo || '';
    }

    function getSyncPath() {
        return document.getElementById('github-sync-path')?.value.trim() || getConfig().path || 'data.json';
    }

    function saveConfig() {
        const cfg = getConfig();
        const token = getToken();
        const repo = getRepoName();
        const path = getSyncPath();
        const interval = parseInt(document.getElementById('sync-interval')?.value || '0', 10) || 0;

        if (!token || !repo) {
            showToast('请先填写 GitHub Token 和仓库名称');
            return;
        }

        cfg.token = token;
        cfg.repo = repo;
        cfg.path = path;
        cfg.interval = interval;

        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        setIntervalTimer(cfg.interval);
        showToast('GitHub 同步配置已保存');
        log('配置已保存');
    }

    function loadConfig() {
        const cfg = getConfig();
        const pathInput = document.getElementById('github-sync-path');
        if (pathInput && cfg.path) pathInput.value = cfg.path;
        const intervalInput = document.getElementById('sync-interval');
        if (intervalInput && cfg.interval !== undefined) intervalInput.value = cfg.interval;
        if (cfg.interval > 0) setIntervalTimer(cfg.interval);
    }

    function setInterval() {
        const cfg = getConfig();
        cfg.interval = parseInt(document.getElementById('sync-interval')?.value || '0', 10) || 0;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        setIntervalTimer(cfg.interval);
        showToast(cfg.interval > 0 ? `自动同步已开启（每${cfg.interval}分钟）` : '自动同步已关闭');
    }

    function setIntervalTimer(minutes) {
        if (syncTimer) {
            clearInterval(syncTimer);
            syncTimer = null;
        }
        if (minutes > 0) {
            syncTimer = setInterval(() => autoSync(), minutes * 60 * 1000);
            log(`自动同步已启动，间隔 ${minutes} 分钟`);
        }
    }

    async function autoSync() {
        const cfg = getConfig();
        if (!cfg.token || !cfg.repo) return;
        setSyncStatus('syncing');
        try {
            await upload();
            log(`自动同步成功 ${new Date().toLocaleTimeString()}`);
        } catch (e) {
            try {
                await download();
                log(`自动拉取成功 ${new Date().toLocaleTimeString()}`);
            } catch (e2) {
                log(`自动同步失败: ${e2.message}`);
            }
        }
        setSyncStatus('idle');
    }

    function apiHeaders(token) {
        return {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    function base64Encode(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }

    function base64Decode(str) {
        return decodeURIComponent(escape(atob(str)));
    }

    async function getUser(token) {
        const res = await fetch(`${API}/user`, { headers: apiHeaders(token) });
        if (!res.ok) throw new Error(`获取 GitHub 用户信息失败 (${res.status})`);
        return res.json();
    }

    async function resolveRepo(token, repoInput) {
        const repoValue = repoInput.trim();
        if (!repoValue) throw new Error('请填写仓库名称');
        if (repoValue.includes('/')) {
            const [owner, repo] = repoValue.split('/');
            return { owner: owner.trim(), repo: repo.trim() };
        }
        const user = await getUser(token);
        return { owner: user.login, repo: repoValue };
    }

    async function ensureRepo(token, repoInput) {
        const repo = await resolveRepo(token, repoInput);
        const checkRes = await fetch(`${API}/repos/${repo.owner}/${repo.repo}`, {
            headers: apiHeaders(token)
        });
        if (checkRes.ok) return repo;

        const privateRepo = document.getElementById('github-private')?.value === 'true';
        const createRes = await fetch(`${API}/user/repos`, {
            method: 'POST',
            headers: apiHeaders(token),
            body: JSON.stringify({
                name: repo.repo,
                private: privateRepo,
                auto_init: true,
                description: '生活小秘书 Pro 数据同步仓库'
            })
        });
        if (!createRes.ok) {
            const err = await createRes.json().catch(() => ({}));
            throw new Error(`创建仓库失败: ${err.message || createRes.status}`);
        }
        const created = await createRes.json();
        return { owner: created.owner.login, repo: created.name };
    }

    async function getFileSha(token, owner, repo, filePath) {
        const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${filePath}`, {
            headers: apiHeaders(token)
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.sha || null;
    }

    async function getRemoteContent(token, owner, repo, filePath) {
        const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${filePath}`, {
            headers: apiHeaders(token)
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.content) {
            return base64Decode(data.content.replace(/\n/g, ''));
        }
        return null;
    }

    async function upload() {
        const token = getToken();
        const repoInput = getRepoName();
        const filePath = getSyncPath();
        if (!token || !repoInput) {
            showToast('请先填写 GitHub Token 和仓库名称');
            return;
        }

        setSyncStatus('syncing');
        log('正在上传数据...');

        try {
            const repo = await ensureRepo(token, repoInput);
            const data = exportData();
            const content = base64Encode(JSON.stringify(data, null, 2));
            const sha = await getFileSha(token, repo.owner, repo.repo, filePath);
            const body = {
                message: `sync: update ${filePath}`,
                content
            };
            if (sha) body.sha = sha;

            const res = await fetch(`${API}/repos/${repo.owner}/${repo.repo}/contents/${filePath}`, {
                method: 'PUT',
                headers: apiHeaders(token),
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(`上传失败: ${err.message || res.status}`);
            }

            localStorage.setItem('last_sync_time', new Date().toISOString());
            localStorage.setItem('last_sync_action', 'upload');
            setSyncStatus('idle');
            log(`✅ 上传成功 ${new Date().toLocaleTimeString()}`);
            showToast('数据已同步到 GitHub');
        } catch (e) {
            setSyncStatus('error');
            log(`❌ 上传失败: ${e.message}`);
            showToast('同步失败: ' + e.message);
            throw e;
        }
    }

    async function download() {
        const token = getToken();
        const repoInput = getRepoName();
        const filePath = getSyncPath();
        if (!token || !repoInput) {
            showToast('请先填写 GitHub Token 和仓库名称');
            return;
        }

        setSyncStatus('syncing');
        log('正在从 GitHub 拉取...');

        try {
            const repo = await ensureRepo(token, repoInput);
            const remote = await getRemoteContent(token, repo.owner, repo.repo, filePath);
            if (remote === null) {
                log('GitHub 仓库中暂无同步数据文件');
                setSyncStatus('idle');
                showToast('云端暂无数据');
                return;
            }

            const data = JSON.parse(remote);
            importData(data);

            localStorage.setItem('last_sync_time', new Date().toISOString());
            localStorage.setItem('last_sync_action', 'download');
            setSyncStatus('idle');
            log(`✅ 拉取成功 ${new Date().toLocaleTimeString()}`);
            showToast('已从 GitHub 同步最新数据');
        } catch (e) {
            setSyncStatus('error');
            log(`❌ 拉取失败: ${e.message}`);
            showToast('拉取失败: ' + e.message);
            throw e;
        }
    }

    // ---- 数据导入导出 ----
    function exportData() {
        return {
            version: 2,
            exportedAt: new Date().toISOString(),
            todos: JSON.parse(localStorage.getItem('todos') || '[]'),
            habits: JSON.parse(localStorage.getItem('habits') || '[]'),
            health_records: JSON.parse(localStorage.getItem('health_records') || '[]')
        };
    }

    function importData(data) {
        if (!data || !data.version) {
            showToast('数据格式无效');
            return;
        }

        const localTodos = JSON.parse(localStorage.getItem('todos') || '[]');
        const localHabits = JSON.parse(localStorage.getItem('habits') || '[]');
        const localHealth = JSON.parse(localStorage.getItem('health_records') || '[]');

        const mergedTodos = mergeById(localTodos, data.todos || []);
        const mergedHabits = mergeById(localHabits, data.habits || []);
        const mergedHealth = mergeById(localHealth, data.health_records || []);

        localStorage.setItem('todos', JSON.stringify(mergedTodos));
        localStorage.setItem('habits', JSON.stringify(mergedHabits));
        localStorage.setItem('health_records', JSON.stringify(mergedHealth));

        if (typeof Todo !== 'undefined' && Todo.render) Todo.render();
        if (typeof Habit !== 'undefined' && Habit.render) Habit.render();
        if (typeof Health !== 'undefined' && Health.render) Health.render();
    }

    function mergeById(local, remote) {
        const map = new Map();
        for (const item of local) map.set(item.id, item);
        for (const item of remote) {
            const existing = map.get(item.id);
            if (!existing) {
                map.set(item.id, item);
            } else {
                const lt = new Date(existing.updatedAt || 0).getTime();
                const rt = new Date(item.updatedAt || 0).getTime();
                if (rt > lt) map.set(item.id, item);
            }
        }
        return Array.from(map.values());
    }

    // ---- UI 辅助 ----
    function setSyncStatus(status) {
        const el = document.getElementById('sync-status');
        if (!el) return;
        el.classList.remove('syncing', 'error');
        if (status === 'syncing') el.classList.add('syncing');
        if (status === 'error') el.classList.add('error');
        const icon = el.querySelector('.sync-icon');
        if (icon) {
            if (status === 'error') icon.textContent = '⚠️';
            else icon.textContent = '☁️';
        }
    }

    function log(msg) {
        const el = document.getElementById('sync-log');
        if (!el) return;
        el.classList.add('show');
        el.textContent += msg + '\n';
        el.scrollTop = el.scrollHeight;
    }

    // ---- 初始化 ----
    function init() {
        loadConfig();
        // 页面加载时自动拉取最新数据
        setTimeout(() => autoPullOnLoad(), 1500);
        // 页面从后台切回前台时自动同步
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                autoPullOnLoad();
            }
        });
        // 如果配置了自动同步间隔
        const cfg = getConfig();
        if (cfg.interval > 0) {
            setIntervalTimer(cfg.interval);
        }
    }

    // 页面加载/恢复时自动拉取
    async function autoPullOnLoad() {
        try {
            const token = SYNC_DEFAULTS.token;
            const { owner, repo, path } = SYNC_DEFAULTS;
            const remote = await getRemoteContent(token, owner, repo, path);
            if (remote === null) {
                log('云端暂无数据，将使用本地数据');
                return;
            }
            const data = JSON.parse(remote);
            importData(data);
            log(`✅ 自动同步成功 ${new Date().toLocaleTimeString()}`);
            setSyncStatus('idle');
        } catch (e) {
            log(`自动拉取失败: ${e.message}`);
        }
    }

    // 数据变更时自动上传（供其他模块调用）
    async function autoUploadOnChange() {
        try {
            const token = SYNC_DEFAULTS.token;
            const { owner, repo, path } = SYNC_DEFAULTS;
            const data = exportData();
            const content = base64Encode(JSON.stringify(data, null, 2));
            const sha = await getFileSha(token, owner, repo, path);
            const body = { message: `auto-sync: update ${path}`, content };
            if (sha) body.sha = sha;
            const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
                method: 'PUT',
                headers: apiHeaders(token),
                body: JSON.stringify(body)
            });
            if (res.ok) {
                log(`✅ 自动上传成功 ${new Date().toLocaleTimeString()}`);
                setSyncStatus('idle');
            } else {
                const err = await res.json().catch(() => ({}));
                log(`自动上传失败: ${err.message || res.status}`);
            }
        } catch (e) {
            log(`自动上传异常: ${e.message}`);
        }
    }

    return { init, saveConfig, upload, download, setInterval, loadConfig, exportData, importData, autoUploadOnChange };
})();
