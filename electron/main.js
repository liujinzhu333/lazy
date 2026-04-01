/**
 * Electron 主进程 — 个人助手
 * 职责：窗口管理、IPC 事件处理（todo / note / account / auth）、数据库调度
 * 安全规范：nodeIntegration:false / contextIsolation:true / preload 白名单通信
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path           = require('path')
const os             = require('os')
const http           = require('http')
const fs             = require('fs')
const { execFile }   = require('child_process')
const { promisify }  = require('util')
const log            = require('electron-log')

const execFileAsync = promisify(execFile)

// ─── 日志配置 ─────────────────────────────────────────────────────
log.transports.file.level = 'info'
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('userData'), 'logs', 'main.log')

const isDev = !app.isPackaged

// ─── 引入数据库模块 ────────────────────────────────────────────────
const db = require('./database')

// ─── 引入加密模块 ─────────────────────────────────────────────────
const crypto = require('./crypto')

// ─── 主密码状态（仅主进程内存，进程退出自动清除）────────────────
// encryptionKey: Buffer | null  — 派生的 AES-256 密钥，解锁后持有
let encryptionKey = null

// ─── 内置 HTTP 服务 ───────────────────────────────────────────────
const DEFAULT_HTTP_PORT = 8899
let httpServer = null
let currentHttpPort = DEFAULT_HTTP_PORT

/**
 * 获取当前 HTTP 服务端口（优先从数据库读取，回退到默认值）
 */
function getHttpPort() {
  try {
    const saved = db.getSetting('http_port')
    const port = saved ? parseInt(saved, 10) : DEFAULT_HTTP_PORT
    return (port > 0 && port < 65536) ? port : DEFAULT_HTTP_PORT
  } catch {
    return DEFAULT_HTTP_PORT
  }
}

// ─── REST API 处理器 ─────────────────────────────────────────────

/**
 * 解析请求体（JSON）
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) }
      catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

/**
 * 处理 /api/* 路由，返回 JSON
 */
async function handleApiRequest(req, res, urlObj) {
  const pathname = urlObj.pathname
  const query    = Object.fromEntries(urlObj.searchParams)
  let   body     = {}

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = await parseBody(req)
  }

  const ok  = (data)    => { res.writeHead(200); res.end(JSON.stringify({ success: true,  data })) }
  const err = (msg, code = 500) => { res.writeHead(code); res.end(JSON.stringify({ success: false, message: msg })) }

  // 数值转换辅助
  const int = (v, fallback = undefined) => (v !== undefined && v !== '') ? parseInt(v, 10) : fallback

  try {
    // ── 健康检查 ─────────────────────────────────────────────────
    if (pathname === '/api/ping') {
      return ok({ app: '个人助手', time: new Date().toISOString() })
    }

    // ── 应用信息 ─────────────────────────────────────────────────
    if (pathname === '/api/app/version') return ok(app.getVersion())

    // ── 待办 (todo) ───────────────────────────────────────────────
    if (pathname === '/api/todo/list') {
      const p = {
        page:     int(query.page, 1),
        pageSize: int(query.pageSize, 10),
        keyword:  query.keyword  || '',
        category: query.category || '',
        status:   query.status   !== undefined ? int(query.status)   : '',
        priority: query.priority !== undefined ? int(query.priority) : ''
      }
      return ok(db.getTodoList(p))
    }
    if (pathname === '/api/todo/stats')       return ok(db.getTodoStats())
    if (pathname === '/api/todo/categories')  return ok(db.getTodoCategories())
    if (pathname === '/api/todo/create')      return ok({ id: db.createTodo(body) })
    if (pathname === '/api/todo/update')      { db.updateTodo(body);             return ok(null) }
    if (pathname === '/api/todo/toggleStatus'){ const s = db.toggleTodoStatus(body.id); return ok({ status: s }) }
    if (pathname === '/api/todo/delete')      { db.deleteTodo(body.id);          return ok(null) }
    if (pathname === '/api/todo/batchDelete') { db.batchDeleteTodos(body.ids);   return ok(null) }

    // ── 笔记 (note) ───────────────────────────────────────────────
    if (pathname === '/api/note/list') {
      const p = {
        page:     int(query.page, 1),
        pageSize: int(query.pageSize, 10),
        keyword:  query.keyword  || '',
        category: query.category || ''
      }
      return ok(db.getNoteList(p))
    }
    if (pathname === '/api/note/detail')      return ok(db.getNoteById(int(query.id)))
    if (pathname === '/api/note/categories')  return ok(db.getNoteCategories())
    if (pathname === '/api/note/create')      return ok({ id: db.createNote(body) })
    if (pathname === '/api/note/update')      { db.updateNote(body);             return ok(null) }
    if (pathname === '/api/note/delete')      { db.deleteNote(body.id);          return ok(null) }
    if (pathname === '/api/note/batchDelete') { db.batchDeleteNotes(body.ids);   return ok(null) }

    // ── 账号 (account) ───────────────────────────────────────────
    if (pathname === '/api/account/list') {
      const p = {
        page:       int(query.page, 1),
        pageSize:   int(query.pageSize, 20),
        keyword:    query.keyword    || '',
        category:   query.category   || '',
        is_starred: query.is_starred !== undefined ? int(query.is_starred) : ''
      }
      return ok(db.getAccountList(p))
    }
    if (pathname === '/api/account/categories') return ok(db.getAccountCategories())
    if (pathname === '/api/account/toggleStar') {
      const next = db.toggleAccountStar(body.id)
      return ok({ is_starred: next })
    }
    if (pathname === '/api/account/delete')      { db.deleteAccount(body.id);        return ok(null) }
    if (pathname === '/api/account/batchDelete') { db.batchDeleteAccounts(body.ids); return ok(null) }

    // 账号详情（含密码解密，需要先解锁）
    if (pathname === '/api/account/detail') {
      if (!encryptionKey) {
        res.writeHead(200)
        res.end(JSON.stringify({ success: false, message: '账号金库已锁定，请先解锁', locked: true }))
        return
      }
      const row = db.getAccountById(int(query.id))
      const plainPwd = crypto.isEncrypted(row.password)
        ? crypto.decrypt(row.password, encryptionKey)
        : row.password
      return ok({ ...row, password: plainPwd })
    }

    // 新增账号（密码加密存储，需要先解锁）
    if (pathname === '/api/account/create') {
      if (!encryptionKey) return err('账号金库已锁定，请先解锁', 403)
      const encData = { ...body, password: crypto.encrypt(body.password || '', encryptionKey) }
      return ok({ id: db.createAccount(encData) })
    }

    // 编辑账号（密码重新加密存储，需要先解锁）
    if (pathname === '/api/account/update') {
      if (!encryptionKey) return err('账号金库已锁定，请先解锁', 403)
      const encData = { ...body, password: crypto.encrypt(body.password || '', encryptionKey) }
      db.updateAccount(encData)
      return ok(null)
    }

    // ── 主密码认证 (auth) ─────────────────────────────────────────

    // 检查是否已设置主密码
    if (pathname === '/api/auth/hasMasterPassword') {
      const hash = db.getSetting('master_password_hash')
      return ok({ hasPassword: !!hash })
    }

    // 检查是否已解锁
    if (pathname === '/api/auth/isUnlocked') {
      return ok({ unlocked: encryptionKey !== null })
    }

    // 设置 / 修改主密码
    if (pathname === '/api/auth/setMasterPassword') {
      const { password, oldPassword } = body
      if (!password || password.length < 6) throw new Error('主密码不能少于 6 位')

      const existingHash = db.getSetting('master_password_hash')
      const existingSalt = db.getSetting('master_password_salt')

      if (existingHash && existingSalt) {
        if (!oldPassword) throw new Error('请输入当前主密码')
        const valid = crypto.verifyMasterPassword(oldPassword, existingSalt, existingHash)
        if (!valid) throw new Error('当前主密码错误')

        const oldKey  = crypto.deriveEncryptionKey(oldPassword, existingSalt)
        const newSalt = crypto.generateSalt()
        const newHash = crypto.deriveMasterHash(password, newSalt)
        const newKey  = crypto.deriveEncryptionKey(password, newSalt)

        // 重新加密所有账号密码
        const all = db.getAccountList({ page: 1, pageSize: 99999 })
        for (const acc of all.list) {
          const row = db.getAccountById(acc.id)
          if (row.password) {
            let plain
            try {
              plain = crypto.isEncrypted(row.password)
                ? crypto.decrypt(row.password, oldKey)
                : row.password
            } catch { plain = row.password }
            db.updateAccount({ ...row, password: crypto.encrypt(plain, newKey) })
          }
        }

        db.setSetting('master_password_hash', newHash)
        db.setSetting('master_password_salt', newSalt)
        encryptionKey = newKey
      } else {
        const salt = crypto.generateSalt()
        const hash = crypto.deriveMasterHash(password, salt)
        const key  = crypto.deriveEncryptionKey(password, salt)
        db.setSetting('master_password_hash', hash)
        db.setSetting('master_password_salt', salt)
        encryptionKey = key
      }
      log.info('主密码已通过 REST API 设置/修改')
      return ok(null)
    }

    // 解锁金库
    if (pathname === '/api/auth/unlock') {
      const { password } = body
      const hash = db.getSetting('master_password_hash')
      const salt = db.getSetting('master_password_salt')
      if (!hash || !salt) throw new Error('尚未设置主密码')
      const valid = crypto.verifyMasterPassword(password, salt, hash)
      if (!valid) throw new Error('主密码错误')
      encryptionKey = crypto.deriveEncryptionKey(password, salt)
      log.info('账号金库已通过 REST API 解锁')
      return ok(null)
    }

    // 锁定金库
    if (pathname === '/api/auth/lock') {
      encryptionKey = null
      log.info('账号金库已通过 REST API 锁定')
      return ok(null)
    }

    return err('API not found', 404)
  } catch (e) {
    log.error('REST API error:', pathname, e.message)
    return err(e.message)
  }
}

/**
 * 启动内置 HTTP 服务
 * 生产模式：静态伺服 dist/ 目录 + REST API
 * 开发模式：仅 REST API（前端由 Vite 5173 端口提供）
 */
function startHttpServer(port) {
  // 先关闭旧实例
  if (httpServer) {
    httpServer.close()
    httpServer = null
  }

  const distDir = path.join(__dirname, '../dist')

  // CORS 响应头（允许浏览器跨域调用）
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }

  httpServer = http.createServer(async (req, res) => {
    // 为所有响应添加 CORS 头
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')

    // OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
      res.writeHead(204); res.end(); return
    }

    const urlObj = new URL(req.url, `http://localhost:${port}`)

    // ── REST API 路由 ──────────────────────────────────────────────
    if (urlObj.pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, urlObj)
      return
    }

    // ── 静态文件伺服（生产模式）───────────────────────────────────
    if (!isDev) {
      res.removeHeader('Content-Type')  // 让 MIME 由文件类型决定
      let filePath = path.join(distDir, urlObj.pathname === '/' ? 'index.html' : urlObj.pathname)
      if (!filePath.startsWith(distDir)) {
        res.writeHead(403); res.end('Forbidden'); return
      }
      if (!path.extname(filePath)) {
        filePath = path.join(distDir, 'index.html')
      }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not Found'); return }
        const mimeMap = {
          '.html': 'text/html; charset=utf-8',
          '.js':   'application/javascript',
          '.css':  'text/css',
          '.png':  'image/png',
          '.jpg':  'image/jpeg',
          '.svg':  'image/svg+xml',
          '.ico':  'image/x-icon',
          '.woff2':'font/woff2',
          '.woff': 'font/woff',
        }
        const ext = path.extname(filePath).toLowerCase()
        res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' })
        res.end(data)
      })
      return
    }

    // 开发模式非 API 请求：返回提示
    res.writeHead(200)
    res.end(JSON.stringify({
      message: '开发模式：请通过 http://localhost:5173 访问界面，本端口仅提供 REST API',
      api_port: port,
      ui_url: 'http://localhost:5173'
    }))
  })

  httpServer.on('error', (err) => {
    log.error(`HTTP 服务启动失败（端口 ${port}）:`, err.message)
  })

  httpServer.listen(port, '0.0.0.0', () => {
    currentHttpPort = port
    log.info(`内置 HTTP 服务已启动，监听端口 ${port}（REST API + 静态文件）`)
  })
}

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

  // 启动内置 HTTP 服务
  try {
    const port = getHttpPort()
    startHttpServer(port)
  } catch (err) {
    log.error('HTTP 服务启动失败:', err)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 关闭 HTTP 服务
    if (httpServer) { httpServer.close(); httpServer = null }
    // 清除内存中的加密密钥
    encryptionKey = null
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

// ═══════════════════════════════════════════════════════════════
// IPC 事件：主密码认证（auth）
// ═══════════════════════════════════════════════════════════════

/** 检查是否已设置主密码 */
ipcMain.handle('auth:hasMasterPassword', () => {
  try {
    const hash = db.getSetting('master_password_hash')
    return { success: true, data: { hasPassword: !!hash } }
  } catch (err) {
    log.error('auth:hasMasterPassword', err)
    return { success: false, message: err.message }
  }
})

/** 检查当前是否已解锁 */
ipcMain.handle('auth:isUnlocked', () => {
  return { success: true, data: { unlocked: encryptionKey !== null } }
})

/**
 * 设置（首次）或修改主密码
 * 修改主密码时需要重新加密所有已有账号密码
 * @param {{ password: string, oldPassword?: string }} data
 */
ipcMain.handle('auth:setMasterPassword', async (e, { password, oldPassword }) => {
  try {
    if (!password || password.length < 6) throw new Error('主密码不能少于 6 位')

    const existingHash = db.getSetting('master_password_hash')
    const existingSalt = db.getSetting('master_password_salt')

    // 若已有主密码，需验证旧密码
    if (existingHash && existingSalt) {
      if (!oldPassword) throw new Error('请输入当前主密码')
      const valid = crypto.verifyMasterPassword(oldPassword, existingSalt, existingHash)
      if (!valid) throw new Error('当前主密码错误')

      // 旧密钥（用于重新加密）
      const oldKey = crypto.deriveEncryptionKey(oldPassword, existingSalt)

      // 生成新盐和新密钥
      const newSalt = crypto.generateSalt()
      const newHash = crypto.deriveMasterHash(password, newSalt)
      const newKey  = crypto.deriveEncryptionKey(password, newSalt)

      // 重新加密所有已有账号密码
      const allAccounts = db.getAccountList({ page: 1, pageSize: 99999 })
      for (const acc of allAccounts.list) {
        const row = db.getAccountById(acc.id)
        if (row.password) {
          let plainPwd
          try {
            plainPwd = crypto.isEncrypted(row.password)
              ? crypto.decrypt(row.password, oldKey)
              : row.password  // 兼容旧明文数据
          } catch {
            plainPwd = row.password  // 解密失败则保留原值
          }
          const newCipher = crypto.encrypt(plainPwd, newKey)
          db.updateAccount({ ...row, password: newCipher })
        }
      }

      // 更新数据库中的哈希和盐
      db.setSetting('master_password_hash', newHash)
      db.setSetting('master_password_salt', newSalt)
      // 更新内存密钥
      encryptionKey = newKey
    } else {
      // 首次设置
      const salt = crypto.generateSalt()
      const hash = crypto.deriveMasterHash(password, salt)
      const key  = crypto.deriveEncryptionKey(password, salt)

      db.setSetting('master_password_hash', hash)
      db.setSetting('master_password_salt', salt)
      encryptionKey = key
    }

    return { success: true }
  } catch (err) {
    log.error('auth:setMasterPassword', err)
    return { success: false, message: err.message }
  }
})

/**
 * 解锁（用主密码派生密钥，存入内存）
 * @param {string} password
 */
ipcMain.handle('auth:unlock', async (e, password) => {
  try {
    const hash = db.getSetting('master_password_hash')
    const salt = db.getSetting('master_password_salt')
    if (!hash || !salt) throw new Error('尚未设置主密码')
    const valid = crypto.verifyMasterPassword(password, salt, hash)
    if (!valid) throw new Error('主密码错误')
    encryptionKey = crypto.deriveEncryptionKey(password, salt)
    log.info('账号金库已解锁')
    return { success: true }
  } catch (err) {
    log.error('auth:unlock', err)
    return { success: false, message: err.message }
  }
})

/** 锁定（清除内存密钥） */
ipcMain.handle('auth:lock', () => {
  encryptionKey = null
  log.info('账号金库已锁定')
  return { success: true }
})

// ═══════════════════════════════════════════════════════════════
// IPC 事件：账号管理（account）
// ═══════════════════════════════════════════════════════════════

/** 分页查询账号列表（密码字段不返回，需要时单独获取）*/
ipcMain.handle('account:list', async (e, params) => {
  try { return { success: true, data: db.getAccountList(params) } }
  catch (err) { log.error('account:list', err); return { success: false, message: err.message } }
})

/** 获取单条账号详情（含密码，自动解密后返回明文）*/
ipcMain.handle('account:detail', async (e, id) => {
  try {
    if (!encryptionKey) return { success: false, message: '账号金库已锁定，请先解锁', locked: true }
    const row = db.getAccountById(id)
    // 解密密码后返回
    const plainPassword = crypto.isEncrypted(row.password)
      ? crypto.decrypt(row.password, encryptionKey)
      : row.password  // 兼容旧明文数据
    return { success: true, data: { ...row, password: plainPassword } }
  } catch (err) {
    log.error('account:detail', err)
    return { success: false, message: err.message }
  }
})

/** 新增账号（密码自动加密后存储）*/
ipcMain.handle('account:create', async (e, data) => {
  try {
    if (!encryptionKey) return { success: false, message: '账号金库已锁定，请先解锁', locked: true }
    const encryptedData = { ...data, password: crypto.encrypt(data.password || '', encryptionKey) }
    const id = db.createAccount(encryptedData)
    return { success: true, data: { id } }
  } catch (err) {
    log.error('account:create', err)
    return { success: false, message: err.message }
  }
})

/** 编辑账号（密码自动加密后存储）*/
ipcMain.handle('account:update', async (e, data) => {
  try {
    if (!encryptionKey) return { success: false, message: '账号金库已锁定，请先解锁', locked: true }
    const encryptedData = { ...data, password: crypto.encrypt(data.password || '', encryptionKey) }
    db.updateAccount(encryptedData)
    return { success: true }
  } catch (err) {
    log.error('account:update', err)
    return { success: false, message: err.message }
  }
})

/** 切换标星 */
ipcMain.handle('account:toggleStar', async (e, id) => {
  try { const next = db.toggleAccountStar(id); return { success: true, data: { is_starred: next } } }
  catch (err) { log.error('account:toggleStar', err); return { success: false, message: err.message } }
})

/** 删除单条 */
ipcMain.handle('account:delete', async (e, id) => {
  try { db.deleteAccount(id); return { success: true } }
  catch (err) { log.error('account:delete', err); return { success: false, message: err.message } }
})

/** 批量删除 */
ipcMain.handle('account:batchDelete', async (e, ids) => {
  try { db.batchDeleteAccounts(ids); return { success: true } }
  catch (err) { log.error('account:batchDelete', err); return { success: false, message: err.message } }
})

/** 获取分类列表 */
ipcMain.handle('account:categories', async () => {
  try { return { success: true, data: db.getAccountCategories() } }
  catch (err) { return { success: false, message: err.message } }
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

/**
 * 获取本机所有内网 IPv4 地址（含当前 HTTP 服务端口）
 * 过滤回环地址（127.x.x.x），返回局域网可用地址列表
 */
ipcMain.handle('app:getLocalAddresses', () => {
  try {
    const interfaces = os.networkInterfaces()
    const addresses = []
    for (const [name, nets] of Object.entries(interfaces)) {
      if (!nets) continue
      for (const net of nets) {
        // 只取 IPv4、非回环、非 169.254.x.x（APIPA）
        if (
          net.family === 'IPv4' &&
          !net.internal &&
          !net.address.startsWith('169.254.')
        ) {
          addresses.push({ name, address: net.address })
        }
      }
    }
    return { success: true, data: { addresses, port: currentHttpPort } }
  } catch (err) {
    log.error('app:getLocalAddresses', err)
    return { success: false, message: err.message }
  }
})

/**
 * 修改 HTTP 服务端口（保存到数据库并重启服务）
 */
ipcMain.handle('app:setHttpPort', (e, port) => {
  try {
    const p = parseInt(port, 10)
    if (!p || p < 1024 || p > 65535) throw new Error('端口号需在 1024 ~ 65535 之间')
    db.setSetting('http_port', String(p))
    startHttpServer(p)
    return { success: true, data: { port: p } }
  } catch (err) {
    log.error('app:setHttpPort', err)
    return { success: false, message: err.message }
  }
})

/**
 * 用系统默认浏览器打开外部链接
 * 仅允许 http/https 协议，防止滥用
 */
ipcMain.handle('app:openExternal', (e, url) => {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('仅允许打开 http/https 链接')
    }
    shell.openExternal(url)
    return { success: true }
  } catch (err) {
    log.error('app:openExternal', err)
    return { success: false, message: err.message }
  }
})

// ═══════════════════════════════════════════════════════════════
// IPC 事件：Git 数据备份
// ═══════════════════════════════════════════════════════════════

/**
 * 在指定 git 仓库目录执行 git 命令
 * @param {string} cwd  git 仓库根目录
 * @param {string[]} args git 子命令参数
 */
async function runGit(cwd, args) {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd,
    timeout: 30_000,
    env: { ...process.env }
  })
  return { stdout: stdout.trim(), stderr: stderr.trim() }
}

/**
 * 判断 git commit 异常是否属于"无变化可提交"（非真正错误）
 * git 在不同版本/场景下可能输出：
 *   "nothing to commit"
 *   "nothing added to commit"
 *   "nothing to commit, working tree clean"
 */
function isNothingToCommit(e) {
  const text = (e.stdout || '') + (e.stderr || '') + (e.message || '')
  return text.includes('nothing to commit') || text.includes('nothing added to commit')
}

// 固定的备份远程仓库地址
const BACKUP_REMOTE_URL = 'https://github.com/liujinzhu333/lazy-data.git'

/**
 * 获取固定的本地备份目录（userData/git-backup）
 */
function getDefaultBackupPath() {
  return path.join(app.getPath('userData'), 'git-backup')
}

/** 获取 Git 备份配置（本地路径 + 上次备份时间 + 是否已初始化） */
ipcMain.handle('app:getBackupConfig', () => {
  try {
    const repoPath    = getDefaultBackupPath()
    const lastBackup  = db.getSetting('git_backup_last') || ''
    // 判断是否已初始化（.git 目录存在）
    const initialized = fs.existsSync(path.join(repoPath, '.git'))
    return { success: true, data: { repoPath, remoteUrl: BACKUP_REMOTE_URL, lastBackup, initialized } }
  } catch (err) {
    return { success: false, message: err.message }
  }
})

/**
 * 一键初始化备份仓库：
 *   1. 创建目录（如不存在）
 *   2. git init
 *   3. git remote add origin（已存在则更新）
 *   4. 写入 README.md
 *   5. git add . && git commit && git push -u origin HEAD
 */
ipcMain.handle('app:initBackupRepo', async () => {
  const repoPath  = getDefaultBackupPath()
  const remoteUrl = BACKUP_REMOTE_URL
  const logs = []
  try {

    // Step 1: 创建目录
    if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, { recursive: true })
      logs.push('✓ 目录已创建：' + repoPath)
    } else {
      logs.push('ℹ 目录已存在：' + repoPath)
    }

    // Step 2: git init（幂等）
    await runGit(repoPath, ['init'])
    logs.push('✓ git init 完成')

    // Step 3: git remote（已有则更新 URL）
    try {
      await runGit(repoPath, ['remote', 'add', 'origin', remoteUrl])
      logs.push('✓ git remote add origin')
    } catch {
      await runGit(repoPath, ['remote', 'set-url', 'origin', remoteUrl])
      logs.push('✓ git remote set-url origin（已更新）')
    }

    // Step 4: 写入 README 和 .gitignore（仅首次）
    const readme = path.join(repoPath, 'README.md')
    if (!fs.existsSync(readme)) {
      fs.writeFileSync(readme, '# 个人助手数据备份\n\n由「个人助手」自动生成，请勿手动修改 `app.db`。\n')
      logs.push('✓ 已创建 README.md')
    }
    const gitignore = path.join(repoPath, '.gitignore')
    if (!fs.existsSync(gitignore)) {
      fs.writeFileSync(gitignore, '# SQLite WAL 临时文件\napp.db-shm\napp.db-wal\n')
      logs.push('✓ 已创建 .gitignore（忽略 SQLite WAL 临时文件）')
    }

    // Step 5: 首次 commit & push
    await runGit(repoPath, ['add', '.'])
    try {
      await runGit(repoPath, ['commit', '-m', 'init: 初始化备份仓库'])
      logs.push('✓ git commit — 初始化提交')
    } catch (e) {
      if (!isNothingToCommit(e)) throw e
      logs.push('ℹ 无新文件，跳过 commit')
    }

    try {
      await runGit(repoPath, ['push', '-u', 'origin', 'HEAD'])
      logs.push('✓ git push 成功')
    } catch (e) {
      // push 失败不阻断初始化（网络或权限问题可后续解决）
      logs.push(`⚠ git push 失败（可稍后重试）：${e.stderr || e.message}`)
    }

    logs.push('✓ 初始化完成')

    log.info('备份仓库初始化成功:', repoPath)
    return { success: true, data: { logs } }
  } catch (err) {
    const msg = err.stderr || err.message
    logs.push(`✗ 失败：${msg}`)
    log.error('app:initBackupRepo', err)
    return { success: false, message: msg, data: { logs } }
  }
})

/**
 * 执行 Git 备份：
 *   1. 将数据库文件复制到备份仓库
 *   2. git add app.db
 *   3. git commit -m "backup: <timestamp>"
 *   4. git push
 */
ipcMain.handle('app:gitBackup', async () => {
  const logs = []
  try {
    const repoPath = getDefaultBackupPath()
    if (!fs.existsSync(path.join(repoPath, '.git'))) {
      throw new Error('备份仓库尚未初始化，请先点击"初始化仓库"')
    }

    const dbSrc  = db.getDbPath()
    const dbDest = path.join(repoPath, 'app.db')

    // Step 1: WAL checkpoint — 确保最新数据已刷回主 db 文件
    db.checkpointDb()
    logs.push('✓ WAL checkpoint 完成')

    // Step 2: 复制数据库文件
    fs.copyFileSync(dbSrc, dbDest)
    logs.push('✓ 数据库已复制到备份仓库')

    // Step 3: git add
    await runGit(repoPath, ['add', 'app.db'])
    logs.push('✓ git add app.db')

    // Step 4: git commit
    const timestamp = new Date().toLocaleString('zh-CN', { hour12: false })
    let committed = true
    try {
      const r = await runGit(repoPath, ['commit', '-m', `backup: ${timestamp}`])
      logs.push(`✓ git commit — ${r.stdout.split('\n')[0]}`)
    } catch (e) {
      // "nothing to commit" / "nothing added to commit" 均不视为错误
      if (isNothingToCommit(e)) {
        logs.push('ℹ 数据无变化，跳过 commit')
        committed = false
      } else {
        throw e
      }
    }

    // Step 5: git push（只有有新 commit 才 push）
    if (committed) {
      const p = await runGit(repoPath, ['push'])
      logs.push(`✓ git push — ${p.stdout || p.stderr || 'done'}`)
    }

    // 记录最后备份时间
    db.setSetting('git_backup_last', new Date().toISOString())
    logs.push('✓ 备份完成')

    log.info('Git 备份成功:', repoPath)
    return { success: true, data: { logs } }
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message
    logs.push(`✗ 失败：${msg}`)
    log.error('app:gitBackup', err)
    return { success: false, message: msg, data: { logs } }
  }
})

// ═══════════════════════════════════════════════════════════════
// IPC 事件：获取 Git 备份并合并
// ═══════════════════════════════════════════════════════════════

/**
 * 从远程 Git 仓库拉取最新备份，然后将备份数据库合并入本地数据库
 * 流程：
 *   1. 校验本地备份仓库已初始化
 *   2. git pull（拉取最新 app.db）
 *   3. 调用 db.mergeFromBackup() 做 updated_at 策略合并
 */
ipcMain.handle('app:restoreBackup', async () => {
  const logs = []
  try {
    const repoPath = getDefaultBackupPath()

    // Step 1: 校验仓库已初始化
    if (!fs.existsSync(path.join(repoPath, '.git'))) {
      throw new Error('备份仓库尚未初始化，请先点击"初始化仓库"')
    }

    const backupDbPath = path.join(repoPath, 'app.db')
    if (!fs.existsSync(backupDbPath)) {
      throw new Error('远程仓库中暂无备份文件（app.db），请先在其他设备执行一次备份')
    }

    // Step 2: git pull
    logs.push('⏳ 正在从远程仓库拉取最新备份…')
    try {
      const r = await runGit(repoPath, ['pull', '--rebase=false'])
      logs.push(`✓ git pull — ${r.stdout || r.stderr || 'done'}`)
    } catch (e) {
      // Already up to date 不算错误
      const msg = e.stdout || e.stderr || ''
      if (msg.includes('Already up to date') || msg.includes('Already up-to-date')) {
        logs.push('ℹ 远程已是最新，无需拉取')
      } else {
        throw e
      }
    }

    // Step 3: 再次确认 app.db 存在（pull 之后）
    if (!fs.existsSync(backupDbPath)) {
      throw new Error('拉取后仍未找到 app.db，请确认远程仓库中存在备份文件')
    }

    // Step 4: 合并备份数据库
    logs.push('⏳ 正在合并备份数据…')
    const merged = db.mergeFromBackup(backupDbPath)
    logs.push(`✓ 待办任务：合并 ${merged.todo} 条`)
    logs.push(`✓ 笔记：合并 ${merged.note} 篇`)
    logs.push(`✓ 账号：合并 ${merged.account} 个`)
    logs.push('✓ 合并完成，数据已同步到本地')

    log.info('Git 备份恢复合并成功:', merged)
    return { success: true, data: { logs, merged } }
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message
    logs.push(`✗ 失败：${msg}`)
    log.error('app:restoreBackup', err)
    return { success: false, message: msg, data: { logs } }
  }
})

// ═══════════════════════════════════════════════════════════════
// IPC 事件：静态 Web 导出
// ═══════════════════════════════════════════════════════════════

/**
 * 递归复制目录
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src,  entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDirSync(srcPath, destPath)
    else fs.copyFileSync(srcPath, destPath)
  }
}

/**
 * 弹出文件夹选择对话框，让用户选择导出目录
 */
ipcMain.handle('app:showFolderPicker', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择静态导出目录',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: '选择此目录'
  })
  if (result.canceled) return { success: false, message: 'canceled' }
  return { success: true, data: { path: result.filePaths[0] } }
})

/**
 * 静态 Web 导出
 *  1. 复制 dist/ 到输出目录
 *  2. 导出所有数据库数据为 app-data.js
 *  3. 将 <script src="./app-data.js"> 注入 index.html
 *  4. 打开输出目录
 */
ipcMain.handle('app:exportStatic', async (e, { outputDir, buildFirst }) => {
  const logs = []
  try {
    if (!outputDir) throw new Error('请先选择导出目录')

    // ── Step 1: 可选重新构建 ──────────────────────────────────────
    if (buildFirst) {
      logs.push('⏳ 正在执行 vite build，请稍候（约 10~30 秒）…')
      const projectRoot = path.join(__dirname, '..')
      try {
        const buildResult = await execFileAsync(
          process.platform === 'win32' ? 'npm.cmd' : 'npm',
          ['run', 'build'],
          { cwd: projectRoot, timeout: 120_000, env: { ...process.env } }
        )
        logs.push('✓ vite build 完成')
        if (buildResult.stderr) log.warn('build stderr:', buildResult.stderr)
      } catch (buildErr) {
        throw new Error('构建失败：' + (buildErr.stderr || buildErr.message))
      }
    }

    // ── Step 2: 检查 dist/ ────────────────────────────────────────
    const distDir = path.join(__dirname, '../dist')
    if (!fs.existsSync(path.join(distDir, 'index.html'))) {
      throw new Error('未找到 dist/index.html，请先执行"重新构建"或手动运行 npm run build')
    }

    // ── Step 3: 复制 dist → 输出目录 ─────────────────────────────
    copyDirSync(distDir, outputDir)
    logs.push(`✓ 已复制构建产物到 ${outputDir}`)

    // ── Step 4: 导出数据库数据 ───────────────────────────────────
    const todos    = db.getTodoList({ page: 1, pageSize: 99999 }).list
    const noteList = db.getNoteList({ page: 1, pageSize: 99999 }).list
    // 获取每篇笔记的完整内容
    const notes    = noteList.map(n => { try { return db.getNoteById(n.id) } catch { return n } })
    const accs     = db.getAccountList({ page: 1, pageSize: 99999 }).list
    // 账号数据去除密码字段
    const accounts = accs.map(({ password: _pw, ...rest }) => rest)

    const staticData = {
      appVersion:  app.getVersion(),
      exportTime:  new Date().toISOString(),
      todos,
      notes,
      accounts
    }

    const dataJs = [
      '// 个人助手 · 静态数据快照',
      `// 导出时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
      `// 待办 ${todos.length} 条 · 笔记 ${notes.length} 篇 · 账号 ${accounts.length} 个（不含密码）`,
      'window.__APP_STATIC_DATA__ = ' + JSON.stringify(staticData, null, 2) + ';'
    ].join('\n')

    fs.writeFileSync(path.join(outputDir, 'app-data.js'), dataJs, 'utf-8')
    logs.push(`✓ 已导出数据：待办 ${todos.length} 条 · 笔记 ${notes.length} 篇 · 账号 ${accounts.length} 个`)

    // ── Step 5: 注入 <script> 到 index.html ──────────────────────
    const htmlPath = path.join(outputDir, 'index.html')
    let html = fs.readFileSync(htmlPath, 'utf-8')
    if (!html.includes('app-data.js')) {
      // 插到 <head> 末尾，在 Vite 模块脚本之前
      html = html.replace('</head>', '  <script src="./app-data.js"></script>\n  </head>')
      fs.writeFileSync(htmlPath, html, 'utf-8')
      logs.push('✓ 已注入数据脚本到 index.html')
    } else {
      logs.push('ℹ index.html 已含数据脚本，已跳过注入')
    }

    // ── Step 6: 打开输出目录 ─────────────────────────────────────
    shell.openPath(outputDir)
    logs.push('✓ 导出完成，已打开输出目录')

    log.info(`静态 Web 导出成功：${outputDir}`)
    return { success: true, data: { logs, outputDir } }
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message
    logs.push(`✗ 导出失败：${msg}`)
    log.error('app:exportStatic', err)
    return { success: false, message: msg, data: { logs } }
  }
})

log.info('主进程启动完成, isDev:', isDev)
