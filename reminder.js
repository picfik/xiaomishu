// ============================
// 提醒引擎 - reminder.js
// 基于 Notification API + 定时轮询
// ============================
const Reminder = (() => {
    let timer = null;
    const FIRED_KEY = 'reminder_fired'; // 避免重复触发

    function init() {
        // 每分钟检查一次
        check();
        timer = setInterval(check, 60 * 1000);
    }

    function requestPermission() {
        if (!('Notification' in window)) {
            showToast('当前浏览器不支持通知');
            return;
        }
        Notification.requestPermission().then(perm => {
            const btn = document.getElementById('btn-notif');
            if (perm === 'granted') {
                btn.textContent = '已授权 ✓';
                btn.disabled = true;
                showToast('通知权限已开启');
            } else {
                btn.textContent = '已拒绝';
                showToast('通知权限被拒绝，请在浏览器设置中开启');
            }
        });
        // 更新按钮状态
        updateNotifButton();
    }

    function updateNotifButton() {
        const btn = document.getElementById('btn-notif');
        if (!btn) return;
        if (!('Notification' in window)) {
            btn.textContent = '不支持'; btn.disabled = true; return;
        }
        const perm = Notification.permission;
        if (perm === 'granted') { btn.textContent = '已授权 ✓'; btn.disabled = true; }
        else if (perm === 'denied') { btn.textContent = '已拒绝'; btn.disabled = false; }
        else { btn.textContent = '授权通知'; btn.disabled = false; }
    }

    function check() {
        const now = new Date();
        const nowMinute = formatYMDHM(now);
        const fired = getFired();

        // 检查待办提醒
        const todos = JSON.parse(localStorage.getItem('todos') || '[]');
        todos.forEach(todo => {
            if (todo.done || !todo.reminderEnabled || !todo.reminderTime) return;
            const key = `todo_${todo.id}_${todo.reminderTime}`;
            if (fired[key]) return;
            if (formatYMDHM(new Date(todo.reminderTime)) === nowMinute) {
                sendNotification('📋 待办提醒', `${todo.text}`, `task-${todo.id}`);
                fired[key] = true;
                saveFired(fired);
            }
        });

        // 检查习惯打卡提醒（每日重复）
        const habits = JSON.parse(localStorage.getItem('habits') || '[]');
        const today = formatDate(now);
        habits.forEach(habit => {
            if (!habit.reminderEnabled || !habit.reminderTime) return;
            // 今天已打卡则不提醒
            if (habit.checkins && habit.checkins[today]) return;
            const key = `habit_${habit.id}_${today}`;
            if (fired[key]) return;
            const [hh, mm] = habit.reminderTime.split(':');
            if (parseInt(hh) === now.getHours() && parseInt(mm) === now.getMinutes()) {
                sendNotification(`${habit.icon} 习惯打卡`, `该${habit.name}了！`, `habit-${habit.id}`);
                fired[key] = true;
                saveFired(fired);
            }
        });

        // 清理 3 天前的已触发记录，避免无限增长
        cleanupFired(fired, now);
    }

    function sendNotification(title, body, tag) {
        // 如果页面可见，优先用页面内 toast
        if (document.visibilityState === 'visible') {
            showToast(`${title}: ${body}`);
        }
        // 始终发送系统通知（即使页面可见也发，便于用户看到）
        if ('Notification' in window && Notification.permission === 'granted') {
            const n = new Notification(title, {
                body,
                tag: tag || 'life-pwa-pro',
                icon: './icon-192.png',
                badge: './icon-192.png',
                silent: false
            });
            // 5秒后自动关闭
            setTimeout(() => n.close(), 8000);
        }
        // 同时尝试通过 Service Worker 发送（后台也能发）
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'notification',
                title, body, tag
            });
        }
    }

    // ---- 辅助 ----
    function formatYMDHM(d) {
        return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
    }
    function formatDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    function getFired() {
        try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}'); } catch(e) { return {}; }
    }
    function saveFired(f) { localStorage.setItem(FIRED_KEY, JSON.stringify(f)); }
    function cleanupFired(fired, now) {
        const cutoff = now.getTime() - 3 * 86400000;
        for (const key in fired) {
            const ts = fired[key];
            if (typeof ts === 'number' && ts < cutoff) delete fired[key];
            else if (typeof ts === 'string' && new Date(ts).getTime() < cutoff) delete fired[key];
            // 旧格式（无时间戳）：保留，手动清理
        }
        saveFired(fired);
    }

    return { init, requestPermission, updateNotifButton, sendNotification, check };
})();
