// ============================
// GitHub Pages 部署 - github.js
// 通过 GitHub REST API 完成仓库创建和文件推送
// ============================
const GitHub = (() => {
    const API = 'https://api.github.com';

    function getToken() { return document.getElementById('github-token').value.trim(); }
    function getRepoName() { return document.getElementById('github-repo').value.trim() || 'life-pwa-pro'; }
    function isPrivate() { return document.getElementById('github-private').value === 'true'; }

    function headers(token) {
        return {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    function log(msg) {
        const el = document.getElementById('deploy-log');
        if (!el) return;
        el.classList.add('show');
        el.textContent += msg + '\n';
        el.scrollTop = el.scrollHeight;
    }

    // 获取当前用户信息
    async function getUser(token) {
        const res = await fetch(`${API}/user`, { headers: headers(token) });
        if (!res.ok) throw new Error(`获取用户信息失败 (${res.status})`);
        return res.json();
    }

    // 创建仓库
    async function createRepo(token, name, isPrivate) {
        // 先检查仓库是否存在
        const user = await getUser(token);
        const checkRes = await fetch(`${API}/repos/${user.login}/${name}`, {
            headers: headers(token)
        });
        if (checkRes.ok) {
            log(`仓库 ${user.login}/${name} 已存在，将直接推送文件`);
            return { owner: user.login, name, exists: true };
        }
        // 创建新仓库
        const res = await fetch(`${API}/user/repos`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify({
                name,
                private: isPrivate,
                auto_init: true,
                description: '生活小秘书 Pro - PWA 待办与习惯管理'
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`创建仓库失败: ${err.message || res.status}`);
        }
        const repo = await res.json();
        log(`✅ 仓库已创建: ${repo.full_name}`);
        return { owner: user.login, name: repo.name, exists: false };
    }

    // 上传单个文件（通过 Contents API，支持文本和二进制）
    async function uploadFile(token, owner, repo, filePath, content, message, sha) {
        const isBin = /\.(png|jpg|jpeg|gif|ico|woff|woff2)$/.test(filePath);
        const encoded = isBin ? content : btoa(unescape(encodeURIComponent(content)));
        const url = `${API}/repos/${owner}/${repo}/contents/${filePath}`;
        const body = { message, content: encoded };
        if (sha) body.sha = sha;

        const res = await fetch(url, {
            method: 'PUT',
            headers: headers(token),
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (res.status === 422 && sha) {
                log(`⚠️ SHA 冲突，重新获取 ${filePath}...`);
                const latest = await getFileSha(token, owner, repo, filePath);
                if (latest) {
                    body.sha = latest;
                    const res2 = await fetch(url, {
                        method: 'PUT',
                        headers: headers(token),
                        body: JSON.stringify(body)
                    });
                    if (res2.ok) return res2.json();
                    const err2 = await res2.json().catch(() => ({}));
                    throw new Error(`更新 ${filePath} 失败: ${err2.message || res2.status}`);
                }
            }
            throw new Error(`上传 ${filePath} 失败: ${err.message || res.status}`);
        }
        return res.json();
    }

    async function getFileSha(token, owner, repo, filePath) {
        const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${filePath}`, {
            headers: headers(token)
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.sha;
    }

    // 获取远程文件内容（用于对比是否需要更新）
    async function getRemoteContent(token, owner, repo, filePath) {
        const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${filePath}`, {
            headers: headers(token)
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.encoding === 'base64' && data.content) {
            return decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
        }
        return null;
    }

    // 主部署流程
    async function deploy() {
        const token = getToken();
        const repoName = getRepoName();
        if (!token) { showToast('请填写 GitHub Token'); return; }
        if (!repoName) { showToast('请填写仓库名称'); return; }

        log('🚀 开始部署...');

        try {
            // 1. 创建/获取仓库
            log('检查仓库...');
            const repo = await createRepo(token, repoName, isPrivate());

            // 2. 读取本地文件
            const files = await getLocalFiles();
            log(`准备上传 ${files.length} 个文件...`);

            // 3. 逐个上传文件
            for (const file of files) {
                const remote = await getRemoteContent(token, repo.owner, repo.name, file.path);
                let sha = null;
                if (remote !== null) {
                    // 文件已存在，获取 sha 以更新
                    const info = await getFileSha(token, repo.owner, repo.name, file.path);
                    sha = info;
                    // 内容相同则跳过
                    if (remote === file.content) {
                        log(`⏭️ ${file.path} 无变化，跳过`);
                        continue;
                    }
                }
                await uploadFile(token, repo.owner, repo.name, file.path, file.content,
                    `deploy: update ${file.path}`, sha);
                log(`✅ ${file.path}`);
            }

            // 4. 启用 GitHub Pages
            log('启用 GitHub Pages...');
            await enablePages(token, repo.owner, repo.name);

            const pagesUrl = `https://${repo.owner}.github.io/${repo.name}/`;
            log(`\n🎉 部署完成！\n访问地址: ${pagesUrl}`);
            showToast('部署成功！');

            // 显示链接
            log(`<a href="${pagesUrl}" target="_blank" style="color:var(--primary)">${pagesUrl}</a>`);

        } catch(e) {
            log(`❌ 部署失败: ${e.message}`);
            showToast('部署失败: ' + e.message);
        }
    }

    // 启用 GitHub Pages（使用 Pages API）
    async function enablePages(token, owner, repo) {
        // 先检查是否已启用
        const checkRes = await fetch(`${API}/repos/${owner}/${repo}/pages`, {
            headers: { ...headers(token), 'Accept': 'application/vnd.github.v3+json' }
        });
        if (checkRes.ok) {
            log('GitHub Pages 已启用');
            return;
        }
        // 启用 Pages
        const res = await fetch(`${API}/repos/${owner}/${repo}/pages`, {
            method: 'POST',
            headers: { ...headers(token), 'Accept': 'application/vnd.github.v3+json' },
            body: JSON.stringify({
                source: { branch: 'main', path: '/' }
            })
        });
        if (res.ok || res.status === 409) {
            log('✅ GitHub Pages 已启用');
        } else {
            const err = await res.json().catch(() => ({}));
            log(`⚠️ Pages 启用可能未成功: ${err.message || res.status}（请手动在仓库 Settings → Pages 中设置）`);
        }
    }

    // 收集需要部署的文件
    async function getLocalFiles() {
        const fileList = [
            'index.html', 'style.css', 'app.js', 'sync.js',
            'reminder.js', 'github.js', 'sw.js', 'manifest.json'
        ];
        const files = [];
        for (const name of fileList) {
            try {
                const res = await fetch('./' + name);
                if (res.ok) {
                    files.push({ path: name, content: await res.text() });
                }
            } catch(e) {
                log(`⚠️ 无法读取 ${name}: ${e.message}`);
            }
        }

        // 图标文件需要 base64 编码
        for (const icon of ['icon-192.png', 'icon-512.png']) {
            try {
                const res = await fetch('./' + icon);
                if (res.ok) {
                    const blob = await res.blob();
                    const b64 = await blobToBase64(blob);
                    files.push({ path: icon, content: b64, isBinary: true });
                }
            } catch(e) {
                log(`⚠️ 无法读取 ${icon}`);
            }
        }
        return files;
    }

    function blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                // 去掉 data:...;base64, 前缀
                const result = reader.result.toString();
                resolve(result.split(',')[1]);
            };
            reader.readAsDataURL(blob);
        });
    }

    return { deploy };
})();
