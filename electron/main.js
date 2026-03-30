/**
 * Electron 主进程 — 个人助手
 * 职责：窗口管理、IPC 事件处理（todo / note）、数据库调度
 * 安全规范：nodeIntegration:false / contextIsolation:true / preload 白名单通信
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const log = require('electron-log')

// ─── 日志配置 ─────────────────────────────────────────────────────
log.transports.file.level = 'info'
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('userData'), 'logs', 'main.log')

const isDev = !app.isPackaged

// ─── 引入数据库模块 ────────────────────────────────────────────────
const db = require('./database')

// ─── 创建主窗口 ───────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: '个人助手',
    icon: path.join(__dirname, '../resources/icon.ico'),
    webPreferences: {
      nodeIntegration: false,       // 安全：关闭 Node 直接访问
      contextIsolation: true,       // 安全：上下文隔离
      enableRemoteModule: false,    // 安全：禁用 remote
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc'
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 外部链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('did-finish-load', () => log.info('窗口加载完成'))

  return win
}

// ─── 应用就绪 ─────────────────────────────────────────────────────
app.whenReady().then(() => {
  try {
    db.initDatabase()
    log.info('数据库初始化成功')
  } catch (err) {
    log.error('数据库初始化失败:', err)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.closeDatabase()
    app.quit()
  }
})

// ═══════════════════════════════════════════════════════════════
// IPC 事件：待办任务（todo）
// ═══════════════════════════════════════════════════════════════

/** 分页查询待办列表 */
ipcMain.handle('todo:list', async (e, params) => {
  try {
    return { success: true, data: db.getTodoList(params) }
  } catch (err) {
    log.error('todo:list', err)
    return { success: false, message: err.message }
  }
})

/** 获取待办统计（用于 Dashboard 卡片）*/
ipcMain.handle('todo:stats', async () => {
  try {
    return { success: true, data: db.getTodoStats() }
  } catch (err) {
    log.error('todo:stats', err)
    return { success: false, message: err.message }
  }
})

/** 新增待办 */
ipcMain.handle('todo:create', async (e, data) => {
  try {
    const id = db.createTodo(data)
    return { success: true, data: { id } }
  } catch (err) {
    log.error('todo:create', err)
    return { success: false, message: err.message }
  }
})

/** 编辑待办 */
ipcMain.handle('todo:update', async (e, data) => {
  try {
    db.updateTodo(data)
    return { success: true }
  } catch (err) {
    log.error('todo:update', err)
    return { success: false, message: err.message }
  }
})

/** 快速切换待办状态 */
ipcMain.handle('todo:toggleStatus', async (e, id) => {
  try {
    const nextStatus = db.toggleTodoStatus(id)
    return { success: true, data: { status: nextStatus } }
  } catch (err) {
    log.error('todo:toggleStatus', err)
    return { success: false, message: err.message }
  }
})

/** 删除单条待办 */
ipcMain.handle('todo:delete', async (e, id) => {
  try {
    db.deleteTodo(id)
    return { success: true }
  } catch (err) {
    log.error('todo:delete', err)
    return { success: false, message: err.message }
  }
})

/** 批量删除待办 */
ipcMain.handle('todo:batchDelete', async (e, ids) => {
  try {
    db.batchDeleteTodos(ids)
    return { success: true }
  } catch (err) {
    log.error('todo:batchDelete', err)
    return { success: false, message: err.message }
  }
})

/** 获取待办分类列表 */
ipcMain.handle('todo:categories', async () => {
  try {
    return { success: true, data: db.getTodoCategories() }
  } catch (err) {
    return { success: false, message: err.message }
  }
})

// ═══════════════════════════════════════════════════════════════
// IPC 事件：笔记（note）
// ═══════════════════════════════════════════════════════════════

/** 分页查询笔记列表 */
ipcMain.handle('note:list', async (e, params) => {
  try {
    return { success: true, data: db.getNoteList(params) }
  } catch (err) {
    log.error('note:list', err)
    return { success: false, message: err.message }
  }
})

/** 获取笔记详情（含完整 content）*/
ipcMain.handle('note:detail', async (e, id) => {
  try {
    return { success: true, data: db.getNoteById(id) }
  } catch (err) {
    log.error('note:detail', err)
    return { success: false, message: err.message }
  }
})

/** 新增笔记 */
ipcMain.handle('note:create', async (e, data) => {
  try {
    const id = db.createNote(data)
    return { success: true, data: { id } }
  } catch (err) {
    log.error('note:create', err)
    return { success: false, message: err.message }
  }
})

/** 编辑笔记 */
ipcMain.handle('note:update', async (e, data) => {
  try {
    db.updateNote(data)
    return { success: true }
  } catch (err) {
    log.error('note:update', err)
    return { success: false, message: err.message }
  }
})

/** 删除单条笔记 */
ipcMain.handle('note:delete', async (e, id) => {
  try {
    db.deleteNote(id)
    return { success: true }
  } catch (err) {
    log.error('note:delete', err)
    return { success: false, message: err.message }
  }
})

/** 批量删除笔记 */
ipcMain.handle('note:batchDelete', async (e, ids) => {
  try {
    db.batchDeleteNotes(ids)
    return { success: true }
  } catch (err) {
    log.error('note:batchDelete', err)
    return { success: false, message: err.message }
  }
})

/** 获取笔记分类列表 */
ipcMain.handle('note:categories', async () => {
  try {
    return { success: true, data: db.getNoteCategories() }
  } catch (err) {
    return { success: false, message: err.message }
  }
})

// ═══════════════════════════════════════════════════════════════
// IPC 事件：应用信息
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('app:getVersion', () => ({
  success: true, data: app.getVersion()
}))

ipcMain.handle('app:getDbPath', () => ({
  success: true, data: db.getDbPath()
}))

log.info('主进程启动完成, isDev:', isDev)
