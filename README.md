# 个人助手 — Electron + Vue3 + Element Plus + SQLite

一款完全本地运行的个人效率桌面客户端，无需网络，数据100%离线存储。

## 功能模块

| 模块 | 功能 |
|------|------|
| 待办任务 | 新增/编辑/删除任务、优先级标记（高/中/低）、状态一键切换（待办→进行中→已完成）、分类筛选、截止日期、批量删除 |
| 我的笔记 | 新建/编辑/查看笔记、内容预览、分类管理、置顶功能、批量删除 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Electron 29（安全规范：contextIsolation + preload 白名单）|
| 前端框架 | Vue 3 组合式 API（setup 语法糖）|
| UI 组件库 | Element Plus + @element-plus/icons-vue |
| 数据库 | better-sqlite3（纯本地 SQLite，无后端）|
| 构建 | Vite 5 + electron-builder（NSIS/DMG 安装包）|

## 目录结构

```
├── electron/
│   ├── main.js        # 主进程：窗口管理 + IPC 事件处理
│   ├── preload.js     # 预加载：白名单 contextBridge 安全 API
│   └── database.js    # SQLite：建表 + todo/note CRUD
├── src/
│   ├── api/
│   │   ├── todo.js    # 待办 IPC 调用封装
│   │   └── note.js    # 笔记 IPC 调用封装
│   ├── layouts/
│   │   └── MainLayout.vue  # 主布局（侧栏 + Header + 内容）
│   ├── router/index.js     # Hash 路由配置
│   ├── styles/global.css   # 全局样式 + Element Plus 覆盖
│   ├── views/
│   │   ├── todo/TodoList.vue  # 待办管理完整页
│   │   └── note/NoteList.vue  # 笔记管理完整页
│   ├── App.vue
│   └── main.js
├── resources/         # 应用图标（ico/icns/png）
├── index.html
├── vite.config.js
└── package.json
```

## 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 开发调试（自动启动 Vite + Electron）
npm run dev

# 3. 打包
npm run build:win   # Windows NSIS 安装包
npm run build:mac   # macOS DMG
```

> **首次启动**自动建表并插入演示数据（5 条待办 + 3 条笔记）

## 数据库路径

| 环境 | 路径 |
|------|------|
| 开发 | `项目根目录/dev-data/app.db` |
| 生产（Windows）| `%APPDATA%\personal-assistant\db\app.db` |
| 生产（macOS）| `~/Library/Application Support/personal-assistant/db/app.db` |

升级应用不会丢失数据。
