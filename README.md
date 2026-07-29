# 生活小秘书 Pro

一款纯前端 PWA 生活管理应用，支持待办提醒、习惯打卡、GitHub 数据同步，可一键部署到 GitHub Pages。

## 功能模块

### 📋 待办事项
- 添加任务、设置优先级（紧急/普通/低优）
- 为每个任务设置**精确提醒时间**
- 到时间自动弹出浏览器通知
- 支持筛选：全部 / 待完成 / 已完成

### ✅ 习惯打卡
- 添加每日习惯（喝水、运动、阅读等）
- 为每个习惯设置**每日定时提醒**
- 按周视图打卡，自动统计连续天数 🔥
- 已打卡日自动跳过当天提醒

### ☁️ GitHub 同步
- 数据以 JSON 格式同步到 GitHub 仓库中的数据文件
- 支持自动定时同步（1/5/15/30 分钟）
- 智能合并：按 updatedAt 时间戳取最新
- 多设备数据自动同步

### 🚀 GitHub 一键部署
- 填写 GitHub Token 即可自动创建仓库
- 自动推送所有文件到 GitHub Pages
- 支持更新已有仓库（跳过无变化文件）
- 部署后可通过 `https://用户名.github.io/仓库名/` 访问

## 技术特点

- **纯前端零依赖**：HTML + CSS + JS，无需后端服务器
- **PWA 支持**：Service Worker 缓存，离线可用，可安装到桌面
- **浏览器通知**：Notification API + 定时轮询实现自动提醒
- **GitHub 同步**：通过 GitHub Contents API 实现跨设备数据同步
- **响应式设计**：适配手机和桌面端

## 快速开始

### 本地使用
1. 下载整个项目文件夹
2. 用浏览器直接打开 `index.html`
3. 手机浏览器打开后可"添加到主屏幕"获得 App 体验

### 坚果云同步配置
1. 登录 [坚果云](https://www.jianguoyun.com/)
2. 进入 账户信息 → 安全选项 → 第三方应用管理
3. 创建一个应用密码
4. 在应用设置页填入：
   - WebDAV 地址：`https://dav.jianguoyun.com/dav/`
   - 坚果云账号：你的注册邮箱
   - 应用密码：刚才创建的应用密码
   - 同步路径：`life-pwa-pro/data.json`（可自定义）

### 部署到 GitHub Pages
1. 前往 [GitHub Settings](https://github.com/settings/tokens) 创建 Personal Access Token（勾选 repo 权限）
2. 在应用设置页填入 Token 和仓库名称
3. 点击"部署到 GitHub Pages"
4. 等待部署完成后访问生成的链接

## 文件结构

```
life-pwa-pro/
├── index.html      # 主页面（待办 + 习惯 + 设置）
├── style.css       # 样式（移动端优先响应式）
├── app.js          # 主逻辑（Todo、Habit、页面切换）
├── reminder.js     # 提醒引擎（Notification API + 定时轮询）
├── sync.js         # GitHub 数据同步引擎
├── github.js       # GitHub Pages 一键部署
├── sw.js           # Service Worker（离线缓存）
├── manifest.json   # PWA 配置
├── icon-192.png    # 应用图标 192×192
└── icon-512.png    # 应用图标 512×512
```

## 注意事项

- 浏览器通知需要用户授权，首次使用时请点击"授权通知"
- 建议同步间隔不低于 5 分钟，避免频繁刷新造成 API 限流
- GitHub Pages 部署需要有效的 GitHub Personal Access Token
- 数据存储在浏览器 localStorage 中，清除浏览器数据会丢失本地数据
