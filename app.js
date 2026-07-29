// ============================
// 生活小秘书 Pro - 主逻辑
// ============================

const APP_VERSION = '20260729-3';

// ---- 通用工具 ----
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatTime(date) {
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function formatDateTime(date) {
    return formatDate(date) + ' ' + formatTime(date);
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}
function loadData(key, def) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || def; }
    catch(e) { return def; }
}
function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

// ---- 页面切换 ----
const pageTitles = { todo: '待办事项', habit: '习惯打卡', health: '健康监控', settings: '设置' };
function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const nav = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (nav) nav.classList.add('active');
    document.getElementById('page-title').textContent = pageTitles[page] || page;
    if (page === 'health') Health.render();
}

// ---- 日期显示 ----
function updateDate() {
    const now = new Date();
    const w = ['日','一','二','三','四','五','六'];
    document.getElementById('current-date') && (document.getElementById('current-date').textContent =
        `${now.getMonth()+1}月${now.getDate()}日 周${w[now.getDay()]}`);
}

// ============================
// 待办事项模块
// ============================
const Todo = (() => {
    let items = loadData('todos', []);
    let filter = 'all';

    function save() { saveData('todos', items); }

    function add() {
        const input = document.getElementById('todo-input');
        const pri = document.getElementById('todo-priority').value;
        const text = input.value.trim();
        if (!text) { showToast('请输入任务内容'); return; }

        const reminderEnabled = document.getElementById('todo-reminder-enabled').checked;
        const reminderTime = document.getElementById('todo-reminder-time').value;

        items.unshift({
            id: generateId(),
            text,
            priority: pri,
            done: false,
            reminderEnabled,
            reminderTime: reminderEnabled && reminderTime ? new Date(reminderTime).toISOString() : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        save();
        input.value = '';
        document.getElementById('todo-reminder-enabled').checked = false;
        document.getElementById('todo-reminder-time').value = '';
        document.getElementById('todo-reminder-time').disabled = true;
        render();
        showToast('✅ 任务已添加');
    }

    function toggle(id) {
        const t = items.find(x => x.id === id);
        if (t) {
            t.done = !t.done;
            t.updatedAt = new Date().toISOString();
            save();
            render();
        }
    }

    function del(id) {
        items = items.filter(x => x.id !== id);
        save();
        render();
        showToast('已删除');
    }

    function setReminder(id) {
        const t = items.find(x => x.id === id);
        if (!t) return;
        const val = prompt('设置提醒时间（如：2026-07-29 09:00）', t.reminderTime ? formatDate(new Date(t.reminderTime)) + ' ' + formatTime(new Date(t.reminderTime)) : '');
        if (val === null) return;
        if (val.trim() === '') {
            t.reminderEnabled = false;
            t.reminderTime = null;
        } else {
            const d = new Date(val);
            if (isNaN(d.getTime())) { showToast('时间格式不正确'); return; }
            t.reminderEnabled = true;
            t.reminderTime = d.toISOString();
        }
        t.updatedAt = new Date().toISOString();
        save();
        render();
    }

    function filterBy(f) {
        filter = f;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
        render();
    }

    function render() {
        const list = document.getElementById('todo-list');
        const empty = document.getElementById('todo-empty');
        let filtered = items;
        if (filter === 'active') filtered = items.filter(x => !x.done);
        if (filter === 'done') filtered = items.filter(x => x.done);

        if (filtered.length === 0) {
            list.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        list.innerHTML = filtered.map(t => {
            const priClass = `priority-${t.priority}`;
            const priLabel = t.priority === 'high' ? '紧急' : t.priority === 'low' ? '低优' : '普通';
            const reminderInfo = t.reminderEnabled && t.reminderTime
                ? `<span class="todo-reminder-icon" title="提醒: ${formatDateTime(new Date(t.reminderTime))}">🔔</span>`
                : '';
            return `
            <li class="todo-item">
                <div class="todo-checkbox ${t.done ? 'checked' : ''}" onclick="Todo.toggle('${t.id}')"></div>
                <span class="todo-text ${t.done ? 'done' : ''}">${escapeHtml(t.text)}</span>
                ${reminderInfo}
                <span class="todo-priority ${priClass}">${priLabel}</span>
                <button class="todo-delete" onclick="Todo.del('${t.id}')">✕</button>
            </li>`;
        }).join('');
    }

    function toggleReminderUI() {
        const cb = document.getElementById('todo-reminder-enabled');
        const ti = document.getElementById('todo-reminder-time');
        ti.disabled = !cb.checked;
        if (cb.checked && !ti.value) {
            // 默认设置为 1 小时后
            const d = new Date();
            d.setHours(d.getHours() + 1);
            const pad = n => String(n).padStart(2, '0');
            ti.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
    }

    // 初始化时刷新 updatedAt
    function refresh() { items = loadData('todos', []); render(); }

    return { add, toggle, del, setReminder, filter: filterBy, render, toggleReminder: toggleReminderUI, refresh };
})();

// ============================
// 习惯打卡模块
// ============================
const Habit = (() => {
    let items = loadData('habits', []);

    function save() { saveData('habits', items); }

    function add() {
        const input = document.getElementById('habit-input');
        const icon = document.getElementById('habit-icon').value;
        const name = input.value.trim();
        if (!name) { showToast('请输入习惯名称'); return; }

        const reminderEnabled = document.getElementById('habit-reminder-enabled').checked;
        const reminderTime = document.getElementById('habit-reminder-time').value;

        items.push({
            id: generateId(),
            name,
            icon,
            reminderEnabled,
            reminderTime: reminderEnabled && reminderTime ? reminderTime : null, // "HH:MM"
            checkins: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        save();
        input.value = '';
        document.getElementById('habit-reminder-enabled').checked = false;
        document.getElementById('habit-reminder-time').value = '';
        document.getElementById('habit-reminder-time').disabled = true;
        render();
        showToast('🌟 习惯已添加');
    }

    function toggleDay(id, dateStr) {
        const h = items.find(x => x.id === id);
        if (!h) return;
        if (!h.checkins) h.checkins = {};
        if (h.checkins[dateStr]) delete h.checkins[dateStr];
        else h.checkins[dateStr] = true;
        h.updatedAt = new Date().toISOString();
        save();
        render();
    }

    function del(id) {
        items = items.filter(x => x.id !== id);
        save();
        render();
        showToast('已删除');
    }

    function setReminder(id) {
        const h = items.find(x => x.id === id);
        if (!h) return;
        const val = prompt('设置每日提醒时间（如 08:30）', h.reminderTime || '');
        if (val === null) return;
        if (val.trim() === '') {
            h.reminderEnabled = false;
            h.reminderTime = null;
        } else {
            const m = val.trim().match(/^(\d{1,2}):(\d{2})$/);
            if (!m) { showToast('格式不正确，请输入 HH:MM'); return; }
            h.reminderEnabled = true;
            h.reminderTime = `${m[1].padStart(2,'0')}:${m[2]}`;
        }
        h.updatedAt = new Date().toISOString();
        save();
        render();
    }

    function getWeekDays() {
        const days = [];
        const today = new Date();
        const dow = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((dow + 6) % 7));
        const labels = ['一','二','三','四','五','六','日'];
        const todayStr = formatDate(today);
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const ds = formatDate(d);
            days.push({ date: ds, label: labels[i], isToday: ds === todayStr });
        }
        return days;
    }

    function getStreak(h) {
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            if (h.checkins && h.checkins[formatDate(d)]) streak++;
            else if (i > 0) break;
        }
        return streak;
    }

    function render() {
        const list = document.getElementById('habit-list');
        const empty = document.getElementById('habit-empty');
        const weekDays = getWeekDays();

        if (items.length === 0) {
            list.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        list.innerHTML = items.map(h => {
            const streak = getStreak(h);
            const reminderBadge = h.reminderEnabled && h.reminderTime
                ? `<div class="habit-reminder-badge">🔔 每日提醒 ${h.reminderTime}</div>` : '';
            return `
            <div class="habit-card">
                <div class="habit-header">
                    <div class="habit-name">
                        <span class="icon">${h.icon}</span>
                        ${escapeHtml(h.name)}
                    </div>
                    ${streak > 0 ? `<span class="habit-streak">🔥 连续${streak}天</span>` : ''}
                </div>
                <div class="habit-week">
                    ${weekDays.map(day => `
                        <div class="habit-day">
                            <span class="day-label">${day.label}</span>
                            <div class="day-dot ${(h.checkins && h.checkins[day.date]) ? 'checked' : ''} ${day.isToday ? 'today' : ''}"
                                 onclick="Habit.toggleDay('${h.id}','${day.date}')">
                                ${(h.checkins && h.checkins[day.date]) ? '✓' : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${reminderBadge}
                <div class="habit-actions">
                    <button class="habit-delete" onclick="Habit.setReminder('${h.id}')">⏰ 提醒</button>
                    <button class="habit-delete" onclick="Habit.del('${h.id}')" style="margin-left:12px">删除</button>
                </div>
            </div>`;
        }).join('');
    }

    function toggleReminderUI() {
        const cb = document.getElementById('habit-reminder-enabled');
        const ti = document.getElementById('habit-reminder-time');
        ti.disabled = !cb.checked;
        if (cb.checked && !ti.value) ti.value = '09:00';
    }

    function refresh() { items = loadData('habits', []); render(); }

    return { add, toggleDay, del, setReminder, render, toggleReminder: toggleReminderUI, refresh };
})();

// ============================
// 健康监控模块
// ============================
const Health = (() => {
    let records = loadData('health_records', []);

    function save() { saveData('health_records', records); }
    function today() { return formatDate(new Date()); }

    function getTodayRecord() {
        return records.find(r => r.date === today());
    }

    function getLast7Days() {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(formatDate(d));
        }
        return days;
    }

    function getWaterFromHabits() {
        const habits = loadData('habits', []);
        const todayStr = today();
        let count = 0;
        habits.forEach(h => {
            const isWater = (h.name && h.name.includes('喝水')) || h.icon === '💧';
            if (isWater && h.checkins && h.checkins[todayStr]) {
                count++;
            }
        });
        return count;
    }

    function saveRecord() {
        const systolic = parseFloat(document.getElementById('health-systolic').value);
        const diastolic = parseFloat(document.getElementById('health-diastolic').value);
        const heartRate = parseFloat(document.getElementById('health-heartrate').value);
        const weight = parseFloat(document.getElementById('health-weight').value);
        const waist = parseFloat(document.getElementById('health-waist').value);
        const waterIntake = parseFloat(document.getElementById('health-water').value);

        if (isNaN(systolic) && isNaN(diastolic) && isNaN(heartRate) && isNaN(weight) && isNaN(waist) && isNaN(waterIntake)) {
            showToast('请至少填写一项数据');
            return;
        }

        const todayStr = today();
        const existing = records.findIndex(r => r.date === todayStr);

        const record = {
            id: existing >= 0 ? records[existing].id : generateId(),
            date: todayStr,
            systolic: isNaN(systolic) ? null : systolic,
            diastolic: isNaN(diastolic) ? null : diastolic,
            heartRate: isNaN(heartRate) ? null : heartRate,
            weight: isNaN(weight) ? null : weight,
            waist: isNaN(waist) ? null : waist,
            waterIntake: isNaN(waterIntake) ? null : waterIntake,
            createdAt: existing >= 0 ? records[existing].createdAt : new Date().toISOString()
        };

        if (existing >= 0) {
            records[existing] = record;
        } else {
            records.push(record);
        }
        save();
        render();
        showToast('✅ 健康数据已保存');
    }

    function renderTodayCard() {
        const card = document.getElementById('health-today-card');
        const valuesEl = document.getElementById('health-today-values');
        const hintEl = document.getElementById('health-habit-hint');
        const rec = getTodayRecord();

        if (!rec) {
            card.style.display = 'none';
            return;
        }
        card.style.display = 'block';

        const items = [];
        if (rec.systolic != null || rec.diastolic != null) {
            items.push('<span class="health-tag">🩸 血压 ' + (rec.systolic ?? '-') + '/' + (rec.diastolic ?? '-') + ' mmHg</span>');
        }
        if (rec.heartRate != null) items.push('<span class="health-tag">💓 心率 ' + rec.heartRate + ' 次/分</span>');
        if (rec.weight != null) items.push('<span class="health-tag">⚖️ 体重 ' + rec.weight + ' kg</span>');
        if (rec.waist != null) items.push('<span class="health-tag">📏 腰围 ' + rec.waist + ' cm</span>');
        if (rec.waterIntake != null) items.push('<span class="health-tag">💧 喝水 ' + rec.waterIntake + ' ml</span>');
        valuesEl.innerHTML = items.join('');

        const habitCount = getWaterFromHabits();
        if (habitCount > 0) {
            hintEl.style.display = 'block';
            hintEl.innerHTML = '💧 喝水习惯打卡: +' + habitCount + '次（约' + (habitCount * 250) + 'ml）';
        } else {
            hintEl.style.display = 'none';
        }
    }

    function renderCharts() {
        const container = document.getElementById('health-charts');
        const days = getLast7Days();
        const dayRecords = days.map(d => records.find(r => r.date === d) || null);

        const charts = [
            {
                title: '🩸 血压趋势',
                lines: [
                    { key: 'systolic', label: '收缩压', color: '#EF4444' },
                    { key: 'diastolic', label: '舒张压', color: '#3B82F6' }
                ],
                unit: 'mmHg'
            },
            { title: '💓 心率趋势', lines: [{ key: 'heartRate', label: '心率', color: '#EC4899' }], unit: '次/分' },
            { title: '⚖️ 体重趋势', lines: [{ key: 'weight', label: '体重', color: '#8B5CF6' }], unit: 'kg' },
            { title: '📏 腰围趋势', lines: [{ key: 'waist', label: '腰围', color: '#F59E0B' }], unit: 'cm' },
            { title: '💧 喝水量趋势', lines: [{ key: 'waterIntake', label: '喝水量', color: '#06B6D4' }], unit: 'ml' }
        ];

        container.innerHTML = charts.map((c, ci) => {
            const canvasId = 'health-chart-' + ci;
            const statId = 'health-stat-' + ci;
            return '<div class="health-chart-card">' +
                '<h4 class="health-chart-title">' + c.title + '</h4>' +
                '<canvas id="' + canvasId + '" class="health-canvas"></canvas>' +
                '<div id="' + statId + '" class="health-chart-stat"></div>' +
                '</div>';
        }).join('');

        charts.forEach((c, ci) => {
            drawChart(c, days, dayRecords, ci);
        });
    }

    function drawChart(chartConfig, days, dayRecords, idx) {
        const canvas = document.getElementById('health-chart-' + idx);
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const parentEl = canvas.parentElement;
        const W = parentEl.clientWidth - 32;
        const H = 180;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const padL = 44, padR = 16, padT = 16, padB = 36;
        const plotW = W - padL - padR;
        const plotH = H - padT - padB;

        let allVals = [];
        chartConfig.lines.forEach(line => {
            dayRecords.forEach(r => {
                if (r && r[line.key] != null) allVals.push(r[line.key]);
            });
        });

        if (allVals.length === 0) {
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无数据', W / 2, H / 2);
            document.getElementById('health-stat-' + idx).innerHTML = '';
            return;
        }

        let yMin = Math.min(...allVals);
        let yMax = Math.max(...allVals);
        if (yMin === yMax) { yMin -= 5; yMax += 5; }
        const yRange = yMax - yMin;
        yMin -= yRange * 0.1;
        yMax += yRange * 0.1;

        // Grid lines
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 0.5;
        const gridLines = 4;
        for (let i = 0; i <= gridLines; i++) {
            const y = padT + (plotH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(W - padR, y);
            ctx.stroke();

            const val = yMax - ((yMax - yMin) / gridLines) * i;
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(val.toFixed(val >= 100 ? 0 : 1), padL - 6, y + 3);
        }

        // X labels
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        days.forEach((d, i) => {
            const x = padL + (plotW / (days.length - 1)) * i;
            const label = d.slice(5).replace('-', '/');
            ctx.fillText(label, x, H - padB + 16);
        });

        const dataPoints = [];

        chartConfig.lines.forEach(line => {
            const points = [];
            dayRecords.forEach((r, i) => {
                if (r && r[line.key] != null) {
                    const x = padL + (plotW / (days.length - 1)) * i;
                    const y = padT + plotH - ((r[line.key] - yMin) / (yMax - yMin)) * plotH;
                    points.push({ x, y, val: r[line.key], label: line.label });
                    dataPoints.push({ x, y, val: r[line.key], label: line.label, color: line.color });
                }
            });

            if (points.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = line.color;
                ctx.lineWidth = 2;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                points.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
                ctx.stroke();

                // Area fill
                ctx.beginPath();
                points.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
                ctx.lineTo(points[points.length - 1].x, padT + plotH);
                ctx.lineTo(points[0].x, padT + plotH);
                ctx.closePath();
                ctx.fillStyle = line.color + '18';
                ctx.fill();
            }

            // Dots
            points.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();
                ctx.strokeStyle = line.color;
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        });

        // Tooltip on touch/click
        let tooltipDiv = document.getElementById('health-tooltip');
        if (!tooltipDiv) {
            tooltipDiv = document.createElement('div');
            tooltipDiv.id = 'health-tooltip';
            tooltipDiv.className = 'health-tooltip';
            document.body.appendChild(tooltipDiv);
        }

        function showTooltip(e) {
            e.preventDefault();
            const cr = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const mx = clientX - cr.left;
            let closest = null, minDist = Infinity;
            dataPoints.forEach(p => {
                const dist = Math.abs(p.x - mx);
                if (dist < minDist) { minDist = dist; closest = p; }
            });
            if (closest && minDist < 30) {
                tooltipDiv.textContent = closest.label + ': ' + closest.val + ' ' + chartConfig.unit;
                tooltipDiv.style.display = 'block';
                tooltipDiv.style.left = (clientX - 40) + 'px';
                tooltipDiv.style.top = (clientY - 36) + 'px';
            } else {
                tooltipDiv.style.display = 'none';
            }
        }

        canvas.onmousemove = showTooltip;
        canvas.ontouchstart = showTooltip;
        canvas.onmouseleave = function() { tooltipDiv.style.display = 'none'; };

        // Stats
        const statEl = document.getElementById('health-stat-' + idx);
        let statsHtml = '';
        chartConfig.lines.forEach(line => {
            const vals = dayRecords.filter(r => r && r[line.key] != null).map(r => r[line.key]);
            if (vals.length === 0) return;
            const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
            const max = Math.max(...vals);
            const min = Math.min(...vals);
            const todayRec = dayRecords[dayRecords.length - 1];
            const todayVal = (todayRec && todayRec[line.key] != null) ? todayRec[line.key] : '-';
            statsHtml += '<div class="health-stat-row">' +
                '<span style="color:' + line.color + '">● ' + line.label + '</span>' +
                '<span>今日: ' + todayVal + '</span>' +
                '<span>均值: ' + avg + '</span>' +
                '<span>最高: ' + max + '</span>' +
                '<span>最低: ' + min + '</span>' +
                '</div>';
        });
        statEl.innerHTML = statsHtml;
    }

    function render() {
        records = loadData('health_records', []);
        renderTodayCard();
        renderCharts();
        const rec = getTodayRecord();
        if (rec) {
            if (rec.systolic != null) document.getElementById('health-systolic').value = rec.systolic;
            if (rec.diastolic != null) document.getElementById('health-diastolic').value = rec.diastolic;
            if (rec.heartRate != null) document.getElementById('health-heartrate').value = rec.heartRate;
            if (rec.weight != null) document.getElementById('health-weight').value = rec.weight;
            if (rec.waist != null) document.getElementById('health-waist').value = rec.waist;
            if (rec.waterIntake != null) document.getElementById('health-water').value = rec.waterIntake;
        }
    }

    function refresh() { records = loadData('health_records', []); }

    return { saveRecord, render, refresh };
})();

// ============================
// 数据管理
// ============================
const Data = (() => {
    function exportJSON() {
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            todos: loadData('todos', []),
            habits: loadData('habits', []),
            health_records: loadData('health_records', [])
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `life-pwa-data-${formatDate(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('数据已导出');
    }

    function importJSON() {
        const input = document.getElementById('file-import');
        input.click();
    }

    function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.version) throw new Error('格式无效');
                if (data.todos) saveData('todos', data.todos);
                if (data.habits) saveData('habits', data.habits);
                if (data.health_records) saveData('health_records', data.health_records);
                Todo.refresh();
                Habit.refresh();
                Health.refresh();
                showToast('数据已导入');
            } catch(err) {
                showToast('导入失败: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function clearAll() {
        if (!confirm('确定清空所有数据？此操作不可撤销。')) return;
        localStorage.removeItem('todos');
        localStorage.removeItem('habits');
        localStorage.removeItem('health_records');
        Todo.refresh();
        Habit.refresh();
        Health.refresh();
        showToast('数据已清空');
    }

    return { exportJSON, importJSON, handleImport, clearAll };
})();

// ============================
// 初始化
// ============================
function init() {
    updateDate();
    Todo.render();
    Habit.render();
    Health.render();
    Reminder.init();
    Reminder.updateNotifButton();
    Sync.init();

    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`)
            .then(reg => {
                console.log('SW registered');

                const applyUpdate = () => {
                    if (reg.waiting) {
                        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                        return true;
                    }
                    return false;
                };

                if (applyUpdate()) {
                    showToast('发现新版本，正在更新页面...');
                }

                reg.addEventListener('updatefound', () => {
                    const installing = reg.installing;
                    if (!installing) return;
                    installing.addEventListener('statechange', () => {
                        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('新版本已就绪，正在刷新...');
                            window.location.reload();
                        }
                    });
                });

                setTimeout(() => {
                    reg.update().catch(() => {});
                }, 1000);
            })
            .catch(e => console.log('SW error:', e));
    }

    if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });

        navigator.serviceWorker.addEventListener('message', e => {
            if (e.data && e.data.type === 'show-notification') {
                showToast(e.data.title + ': ' + e.body);
            }
        });
    }
}

init();
