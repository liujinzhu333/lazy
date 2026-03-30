# AGENTS.md — AI 编码助手指南

本文件为 AI 编码助手（Claude、Codex 等）提供项目上下文、架构约束和编码规范，帮助 AI 快速理解项目并做出符合规范的修改。

---

## 项目概述

**个人助手**是一款纯本地运行的桌面效率工具，无需网络连接，数据 100% 离线存储于本机 SQLite 文件中。

- **技术栈**：Electron 29 + Vue 3（组合式 API）+ Element Plus + better-sqlite3
- **当前功能模块**：待办任务管理、笔记管理
- **入口命令**：`npm run dev`（开发）/ `npm run build:win`（打包）

---

## 项目目录结构

```
├── electron/
│   ├── main.js         # 主进程：窗口生命周期 + 所有 ipcMain.handle 注册
│   ├── preload.js      # 预加载脚本：contextBridge 白名单 API 暴露
│   └── database.js     # SQLite 封装：建表 DDL + 所有业务 CRUD 函数
├── src/
│   ├── api/            # 渲染进程 IPC 调用封装（每个模块一个文件）
│   │   ├── todo.js
│   │   └── note.js
│   ├── layouts/
│   │   └── MainLayout.vue   # 主布局：左侧导航 + 顶部 Header
│   ├── router/
│   │   └── index.js         # Vue Router（必须用 createWebHashHistory）
│   ├── styles/
│   │   └── global.css       # 全局样式 + Element Plus 覆盖变量
│   ├── views/               # 业务页面，每个模块一个子目录
│   │   ├── todo/TodoList.vue
│   │   └── note/NoteList.vue
│   ├── App.vue              # 根组件（仅作路由出口）
│   └── main.js              # Vue 入口：注册 ElementPlus + router
├── resources/               # 应用图标（ico / icns / png）预留目录
├── index.html               # Vite HTML 入口（含 CSP 安全头）
├── vite.config.js
└── package.json
```

---

## 核心架构规则（必须严格遵守）

### 1. Electron 安全规范

- 主进程（[`electron/main.js`](electron/main.js)）中 `webPreferences` 必须保持：
  ```js
  nodeIntegration: false
  contextIsolation: true
  sandbox: false
  preload: path.join(__dirname, 'preload.js')
  ```
- 渲染进程**不能**直接使用任何 Node.js / Electron API，所有系统操作必须通过 `window.electronAPI.*` 调用。
- 新增 IPC 通道时，**三处同步更新**：
  1. `electron/database.js` — 数据操作函数
  2. `electron/main.js` — `ipcMain.handle('xxx:yyy', ...)` 注册
  3. `electron/preload.js` — `ALLOWED_CHANNELS` 数组 + `contextBridge.exposeInMainWorld` 方法

### 2. IPC 通道命名规范

格式：`模块名:动作`，全部小写，用冒号分隔。

```
todo:list / todo:stats / todo:create / todo:update / todo:delete / todo:batchDelete / todo:toggleStatus / todo:categories
note:list / note:detail / note:create / note:update / note:delete / note:batchDelete / note:categories
app:getVersion / app:getDbPath
```

新增模块时遵循同样格式，如 `habit:list`、`habit:create` 等。

### 3. 数据库规范

- 数据库文件路径由 [`electron/database.js`](electron/database.js) 中的 `getDbPath()` 统一管理：
  - 开发环境：`项目根目录/dev-data/app.db`
  - 生产环境：`app.getPath('userData')/db/app.db`
- 所有 CRUD 函数开头必须调用 `ensureDb()` 守卫。
- 建表 DDL 放在 `createTables()` 函数内，使用 `CREATE TABLE IF NOT EXISTS`（幂等）。
- 种子数据放在 `seedInitialData()` 函数内，先 `COUNT(*)` 判断是否已存在再插入。
- 每张业务表必须包含：`id INTEGER PRIMARY KEY AUTOINCREMENT`、`created_at`、`updated_at`。
- 高频查询字段建立索引（在 `createTables()` 末尾）。

### 4. Vue3 编码规范

- **所有组件必须使用 `<script setup>` 组合式 API**，不允许使用 Options API。
- 响应式：基础类型用 `ref()`，对象/数组用 `reactive()`。
- 异步数据加载统一模式：
  ```js
  const loading = ref(false)
  async function loadData() {
    loading.value = true
    try { /* ... */ } catch (err) { ElMessage.error(err.message) }
    finally { loading.value = false }
  }
  onMounted(loadData)
  ```
- 路由必须使用 `createWebHashHistory`（Electron file:// 协议要求）。
- 禁止在页面组件中直接调用 `window.electronAPI`，必须通过 `src/api/` 封装层调用。

### 5. UI 规范

- 全程使用 Element Plus 组件，禁止自行引入其他 UI 库。
- 所有表单必须配置 `rules` 校验，必填字段校验 `required: true`。
- 操作结果反馈：成功用 `ElMessage.success()`，失败用 `ElMessage.error()`。
- 危险操作（删除）必须使用 `<el-popconfirm>` 或 `ElMessageBox.confirm()` 二次确认。
- 表格必须有 `v-loading` 加载状态。
- 弹窗关闭时必须调用 `formRef.value?.clearValidate()` 重置校验状态。

---

## 新增业务模块的标准流程

以新增"习惯打卡"模块为例：

### Step 1 — 数据库层 `electron/database.js`

```js
// 1. 在 createTables() 中添加建表 DDL
db.exec(`
  CREATE TABLE IF NOT EXISTS habit (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    ...
    created_at TEXT    DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT    DEFAULT (datetime('now', 'localtime'))
  )
`)

// 2. 实现 CRUD 函数（开头必须调用 ensureDb()）
function getHabitList(params) { ensureDb(); ... }
function createHabit(data)    { ensureDb(); ... }
// ...

// 3. 在 module.exports 中导出
```

### Step 2 — 主进程 `electron/main.js`

```js
ipcMain.handle('habit:list',   async (e, params) => { try { return { success: true, data: db.getHabitList(params) } } catch(err) { return { success: false, message: err.message } } })
ipcMain.handle('habit:create', async (e, data)   => { ... })
// 其余同理
```

### Step 3 — 预加载 `electron/preload.js`

```js
// 1. 白名单追加
const ALLOWED_CHANNELS = [
  // ... 已有通道 ...
  'habit:list', 'habit:create', 'habit:update', 'habit:delete'
]

// 2. contextBridge 追加方法
getHabitList:   (params) => invoke('habit:list', params),
createHabit:    (data)   => invoke('habit:create', data),
```

### Step 4 — API 封装 `src/api/habit.js`

```js
export async function fetchHabitList(params) {
  const res = await window.electronAPI.getHabitList(params)
  if (!res.success) throw new Error(res.message)
  return res.data
}
// ...
```

### Step 5 — 路由 `src/router/index.js`

```js
{
  path: 'habit',
  name: 'Habit',
  component: () => import('@/views/habit/HabitList.vue'),
  meta: { title: '习惯打卡', icon: 'Calendar' }
}
```

### Step 6 — 布局菜单 `src/layouts/MainLayout.vue`

```js
const menuItems = [
  { path: '/todo',  title: '待办任务', icon: 'Checked'       },
  { path: '/note',  title: '我的笔记', icon: 'Notebook'      },
  { path: '/habit', title: '习惯打卡', icon: 'Calendar'      }  // 新增
]
```

### Step 7 — 页面 `src/views/habit/HabitList.vue`

参照 [`src/views/todo/TodoList.vue`](src/views/todo/TodoList.vue) 的结构实现。

---

## 开发调试说明

```bash
# 安装依赖（自动触发 better-sqlite3 为 Electron 重编译）
npm install

# 开发调试（并行启动 Vite + Electron，含 DevTools）
npm run dev

# 手动重编译原生模块（better-sqlite3 版本变更后需要）
./node_modules/.bin/electron-rebuild -f -w better-sqlite3

# 打包
npm run build:win   # Windows NSIS 安装包
npm run build:mac   # macOS DMG
```

**开发环境数据库文件**：`dev-data/app.db`（已加入 `.gitignore`）
可用 [DB Browser for SQLite](https://sqlitebrowser.org/) 可视化查看和调试。

---

## 常见错误与处理

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `Cannot read properties of null (reading 'prepare')` | `better-sqlite3` 未为 Electron 重编译 | 运行 `./node_modules/.bin/electron-rebuild -f -w better-sqlite3` |
| `electronAPI is not defined` | 渲染进程直接调用，或 preload 未加载 | 检查 `preload.js` 路径配置，确认通过 `window.electronAPI` 调用 |
| `IPC 通道 "xxx" 未授权` | 通道未加入白名单 | 在 `preload.js` 的 `ALLOWED_CHANNELS` 数组中追加该通道名 |
| `Port 5173 is already in use` | 旧进程未退出 | 运行 `pkill -f "vite"` 后重试 |
| 打包后数据库路径错误 | 使用了相对路径 | 数据库路径必须通过 `app.getPath('userData')` 获取，已在 `getDbPath()` 中处理 |

---

## 不应修改的文件

| 文件 | 原因 |
|------|------|
| [`electron/preload.js`](electron/preload.js) 中 `ALLOWED_CHANNELS` 以外的结构 | 安全架构，不可绕过白名单机制 |
| [`index.html`](index.html) 中的 `Content-Security-Policy` meta | XSS 防护，不可放宽 |
| [`src/router/index.js`](src/router/index.js) 中的 `createWebHashHistory` | 必须使用 Hash 路由，改为 History 模式打包后无法运行 |
| [`vite.config.js`](vite.config.js) 中 `build.outDir: 'dist'` | electron-builder 打包配置依赖此路径 |
