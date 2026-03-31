/**
 * Electron 主进程 — 个人助手
 * 职责：窗口管理、IPC 事件处理（todo / note / account / auth）、数据库调度
 * 安全规范：nodeIntegration:false / contextIsolation:true / preload 白名单通信
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path  = require('path')
const os    = require('os')
const http  = require('http')
const fs    = require('fs')
const log   = require('electron-log')

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

log.info('主进程启动完成, isDev:', isDev)
