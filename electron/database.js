/**
 * SQLite 数据库封装模块 — 个人助手
 * 业务表：todo（待办任务）、note（笔记）、account（账号）、app_settings（应用设置）
 * 使用 better-sqlite3（同步 API，适合 Electron 主进程）
 * 数据库路径：开发 dev-data/app.db，生产 userData/db/app.db
 */

const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const log = require('electron-log')

// ─── 单例连接 ─────────────────────────────────────────────────────
let db = null

/**
 * 获取数据库文件路径
 */
function getDbPath() {
  const isDev = !app.isPackaged
  const dbDir = isDev
    ? path.join(app.getAppPath(), 'dev-data')
    : path.join(app.getPath('userData'), 'db')

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  return path.join(dbDir, 'app.db')
}

/**
 * 初始化数据库：建连接、开 WAL、建表、插入种子
 */
function initDatabase() {
  const dbPath = getDbPath()
  log.info('数据库路径:', dbPath)

  try {
    db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? log.info : null
    })
  } catch (err) {
    log.error('better-sqlite3 加载失败（可能未为 Electron 重新编译）:', err.message)
    log.error('请运行: ./node_modules/.bin/electron-rebuild -f -w better-sqlite3')
    throw err  // 向上抛出，让主进程记录并阻止窗口加载
  }

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  seedInitialData()

  log.info('数据库初始化完成')
}

/**
 * 确保 db 已初始化，否则抛出友好错误
 */
function ensureDb() {
  if (!db) throw new Error('数据库未初始化，请先调用 initDatabase()')
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
  if (db && db.open) {
    db.close()
    log.info('数据库连接已关闭')
  }
}

// ─── 建表 DDL ────────────────────────────────────────────────────

function createTables() {
  // 待办任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS todo (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,                    -- 任务标题
      description TEXT    DEFAULT '',                  -- 任务描述
      priority    INTEGER DEFAULT 2                    -- 优先级 1高 2中 3低
                  CHECK(priority IN (1, 2, 3)),
      status      INTEGER DEFAULT 0                    -- 状态 0待办 1进行中 2已完成
                  CHECK(status IN (0, 1, 2)),
      category    TEXT    DEFAULT '其他',              -- 分类标签
      due_date    TEXT    DEFAULT '',                  -- 截止日期 YYYY-MM-DD
      finished_at TEXT    DEFAULT '',                  -- 完成时间
      created_at  TEXT    DEFAULT (datetime('now', 'localtime')),
      updated_at  TEXT    DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 笔记表
  db.exec(`
    CREATE TABLE IF NOT EXISTS note (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,                    -- 笔记标题
      content     TEXT    DEFAULT '',                  -- 笔记正文
      category    TEXT    DEFAULT '默认',              -- 分类
      is_pinned   INTEGER DEFAULT 0                    -- 是否置顶 1是 0否
                  CHECK(is_pinned IN (0, 1)),
      created_at  TEXT    DEFAULT (datetime('now', 'localtime')),
      updated_at  TEXT    DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 账号密码表
  db.exec(`
    CREATE TABLE IF NOT EXISTS account (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      platform    TEXT    NOT NULL,                    -- 平台名称，如"微信"
      url         TEXT    DEFAULT '',                  -- 平台网址
      username    TEXT    DEFAULT '',                  -- 账号/用户名/手机号/邮箱
      password    TEXT    DEFAULT '',                  -- 密码（AES-256-GCM 加密存储）
      category    TEXT    DEFAULT '其他',              -- 分类
      notes       TEXT    DEFAULT '',                  -- 备注
      is_starred  INTEGER DEFAULT 0                    -- 是否标星收藏 1是 0否
                  CHECK(is_starred IN (0, 1)),
      created_at  TEXT    DEFAULT (datetime('now', 'localtime')),
      updated_at  TEXT    DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 应用设置表（单行 KV，用于存储主密码验证哈希和盐）
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key         TEXT    PRIMARY KEY,
      value       TEXT    NOT NULL,
      updated_at  TEXT    DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_todo_status   ON todo(status);
    CREATE INDEX IF NOT EXISTS idx_todo_priority ON todo(priority);
    CREATE INDEX IF NOT EXISTS idx_todo_category ON todo(category);
    CREATE INDEX IF NOT EXISTS idx_note_category ON note(category);
    CREATE INDEX IF NOT EXISTS idx_note_pinned   ON note(is_pinned);
    CREATE INDEX IF NOT EXISTS idx_account_platform ON account(platform);
    CREATE INDEX IF NOT EXISTS idx_account_category ON account(category);
    CREATE INDEX IF NOT EXISTS idx_account_starred  ON account(is_starred);
  `)

  log.info('数据表创建完成')
}

/**
 * 插入初始演示数据
 */
function seedInitialData() {
  // 待办种子数据
  const todoCount = db.prepare('SELECT COUNT(*) as cnt FROM todo').get()
  if (todoCount.cnt === 0) {
    const ins = db.prepare(`
      INSERT INTO todo (title, description, priority, status, category, due_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const rows = [
      ['完成周报撰写', '总结本周工作进展与下周计划', 1, 0, '工作', ''],
      ['整理读书笔记', '《深度工作》第三章摘录', 2, 1, '学习', ''],
      ['健身打卡', '跑步 5km', 2, 0, '生活', ''],
      ['购买生日礼物', '给朋友准备惊喜', 1, 0, '生活', ''],
      ['学习 Vue3 组合式 API', '完成官方文档学习', 2, 2, '学习', '']
    ]
    const many = db.transaction((items) => {
      for (const r of items) ins.run(...r)
    })
    many(rows)
    log.info('待办种子数据插入完成')
  }

  // 笔记种子数据
  const noteCount = db.prepare('SELECT COUNT(*) as cnt FROM note').get()
  if (noteCount.cnt === 0) {
    const ins = db.prepare(`
      INSERT INTO note (title, content, category, is_pinned)
      VALUES (?, ?, ?, ?)
    `)
    const rows = [
      ['每日晨间回顾', '今天精力充沛，计划专注两个小时深度工作，处理最重要的任务。', '日记', 1],
      ['Vue3 学习笔记', 'setup() 语法糖可以让组件代码更简洁。ref() 用于基础类型响应式，reactive() 用于对象。', '学习', 0],
      ['读书摘录：原子习惯', '习惯的形成需要四个步骤：提示 → 渴求 → 反应 → 奖励。关键是降低好习惯的阻力，提高坏习惯的阻力。', '读书', 0]
    ]
    const many = db.transaction((items) => {
      for (const r of items) ins.run(...r)
    })
    many(rows)
    log.info('笔记种子数据插入完成')
  }
}

// ─── 待办任务 CRUD ────────────────────────────────────────────────

/**
 * 分页查询待办列表
 * @param {{ page, pageSize, keyword, status, priority, category }} params
 */
function getTodoList({ page = 1, pageSize = 10, keyword = '', status = '', priority = '', category = '' } = {}) {
  ensureDb()
  const offset = (page - 1) * pageSize
  const conditions = []
  const params = []

  if (keyword && keyword.trim()) {
    conditions.push('(title LIKE ? OR description LIKE ?)')
    const kw = `%${keyword.trim()}%`
    params.push(kw, kw)
  }
  if (status !== '' && status !== null && status !== undefined) {
    conditions.push('status = ?')
    params.push(status)
  }
  if (priority !== '' && priority !== null && priority !== undefined) {
    conditions.push('priority = ?')
    params.push(priority)
  }
  if (category && category.trim()) {
    conditions.push('category = ?')
    params.push(category.trim())
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM todo ${where}`).get(...params)
  const list = db.prepare(`
    SELECT * FROM todo ${where}
    ORDER BY
      CASE WHEN status = 2 THEN 1 ELSE 0 END ASC,  -- 已完成排后
      priority ASC,                                  -- 高优先级在前
      id DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  return { list, total, page, pageSize }
}

/**
 * 获取各状态统计（用于 Dashboard）
 */
function getTodoStats() {
  ensureDb()
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count FROM todo GROUP BY status
  `).all()
  const stats = { todo: 0, doing: 0, done: 0, total: 0 }
  for (const r of rows) {
    if (r.status === 0) stats.todo = r.count
    else if (r.status === 1) stats.doing = r.count
    else if (r.status === 2) stats.done = r.count
    stats.total += r.count
  }
  return stats
}

/**
 * 新增待办
 */
function createTodo({ title, description = '', priority = 2, status = 0, category = '其他', due_date = '' }) {
  ensureDb()
  if (!title || !title.trim()) throw new Error('任务标题不能为空')
  const stmt = db.prepare(`
    INSERT INTO todo (title, description, priority, status, category, due_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const res = stmt.run(title.trim(), description.trim(), priority, status, category.trim(), due_date)
  return res.lastInsertRowid
}

/**
 * 编辑待办
 */
function updateTodo({ id, title, description = '', priority = 2, status, category = '其他', due_date = '' }) {
  ensureDb()
  if (!id) throw new Error('任务 id 不能为空')
  if (!title || !title.trim()) throw new Error('任务标题不能为空')

  // 若状态改为已完成，记录完成时间
  const finished_at = status === 2 ? "datetime('now', 'localtime')" : "''"

  db.prepare(`
    UPDATE todo
    SET title = ?, description = ?, priority = ?, status = ?,
        category = ?, due_date = ?,
        finished_at = ${finished_at},
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(title.trim(), description.trim(), priority, status, category.trim(), due_date, id)
}

/**
 * 快速切换待办状态（0→1→2→0 循环）
 */
function toggleTodoStatus(id) {
  ensureDb()
  if (!id) throw new Error('id 不能为空')
  const row = db.prepare('SELECT status FROM todo WHERE id = ?').get(id)
  if (!row) throw new Error('任务不存在')
  const nextStatus = (row.status + 1) % 3
  const finished_at = nextStatus === 2 ? "datetime('now', 'localtime')" : "''"
  db.prepare(`
    UPDATE todo
    SET status = ?, finished_at = ${finished_at}, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(nextStatus, id)
  return nextStatus
}

/**
 * 删除单条待办
 */
function deleteTodo(id) {
  ensureDb()
  if (!id) throw new Error('id 不能为空')
  db.prepare('DELETE FROM todo WHERE id = ?').run(id)
}

/**
 * 批量删除待办
 */
function batchDeleteTodos(ids) {
  ensureDb()
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('请选择要删除的任务')
  const ph = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM todo WHERE id IN (${ph})`).run(...ids)
}

/**
 * 获取所有待办分类（用于下拉）
 */
function getTodoCategories() {
  ensureDb()
  const rows = db.prepare(`
    SELECT DISTINCT category FROM todo WHERE category != '' ORDER BY category ASC
  `).all()
  const defaults = ['工作', '学习', '生活', '健康', '其他']
  const existing = rows.map((r) => r.category)
  const merged = [...new Set([...defaults, ...existing])]
  return merged
}

// ─── 笔记 CRUD ────────────────────────────────────────────────────

/**
 * 分页查询笔记列表
 * @param {{ page, pageSize, keyword, category }} params
 */
function getNoteList({ page = 1, pageSize = 10, keyword = '', category = '' } = {}) {
  ensureDb()
  const offset = (page - 1) * pageSize
  const conditions = []
  const params = []

  if (keyword && keyword.trim()) {
    conditions.push('(title LIKE ? OR content LIKE ?)')
    const kw = `%${keyword.trim()}%`
    params.push(kw, kw)
  }
  if (category && category.trim()) {
    conditions.push('category = ?')
    params.push(category.trim())
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM note ${where}`).get(...params)
  const list = db.prepare(`
    SELECT id, title, substr(content, 1, 100) as preview, category, is_pinned, created_at, updated_at
    FROM note ${where}
    ORDER BY is_pinned DESC, updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  return { list, total, page, pageSize }
}

/**
 * 获取笔记详情（含完整 content）
 */
function getNoteById(id) {
  ensureDb()
  if (!id) throw new Error('id 不能为空')
  const row = db.prepare('SELECT * FROM note WHERE id = ?').get(id)
  if (!row) throw new Error('笔记不存在')
  return row
}

/**
 * 新增笔记
 */
function createNote({ title, content = '', category = '默认', is_pinned = 0 }) {
  ensureDb()
  if (!title || !title.trim()) throw new Error('笔记标题不能为空')
  const stmt = db.prepare(`
    INSERT INTO note (title, content, category, is_pinned)
    VALUES (?, ?, ?, ?)
  `)
  const res = stmt.run(title.trim(), content, category.trim(), is_pinned)
  return res.lastInsertRowid
}

/**
 * 编辑笔记
 */
function updateNote({ id, title, content = '', category = '默认', is_pinned = 0 }) {
  ensureDb()
  if (!id) throw new Error('笔记 id 不能为空')
  if (!title || !title.trim()) throw new Error('笔记标题不能为空')
  db.prepare(`
    UPDATE note
    SET title = ?, content = ?, category = ?, is_pinned = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(title.trim(), content, category.trim(), is_pinned, id)
}

/**
 * 删除单条笔记
 */
function deleteNote(id) {
  ensureDb()
  if (!id) throw new Error('id 不能为空')
  db.prepare('DELETE FROM note WHERE id = ?').run(id)
}

/**
 * 批量删除笔记
 */
function batchDeleteNotes(ids) {
  ensureDb()
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('请选择要删除的笔记')
  const ph = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM note WHERE id IN (${ph})`).run(...ids)
}

/**
 * 获取所有笔记分类（用于下拉）
 */
function getNoteCategories() {
  ensureDb()
  const rows = db.prepare(`
    SELECT DISTINCT category FROM note WHERE category != '' ORDER BY category ASC
  `).all()
  const defaults = ['默认', '日记', '学习', '读书', '灵感', '工作']
  const existing = rows.map((r) => r.category)
  return [...new Set([...defaults, ...existing])]
}

// ─── 账号 CRUD ────────────────────────────────────────────────────

/**
 * 分页查询账号列表
 * @param {{ page, pageSize, keyword, category, is_starred }} params
 */
function getAccountList({ page = 1, pageSize = 20, keyword = '', category = '', is_starred = '' } = {}) {
  ensureDb()
  const offset = (page - 1) * pageSize
  const conditions = []
  const params = []

  if (keyword && keyword.trim()) {
    conditions.push('(platform LIKE ? OR username LIKE ? OR notes LIKE ?)')
    const kw = `%${keyword.trim()}%`
    params.push(kw, kw, kw)
  }
  if (category && category.trim()) {
    conditions.push('category = ?')
    params.push(category.trim())
  }
  if (is_starred !== '' && is_starred !== null && is_starred !== undefined) {
    conditions.push('is_starred = ?')
    params.push(is_starred)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM account ${where}`).get(...params)
  const list = db.prepare(`
    SELECT id, platform, url, username, category, notes, is_starred, created_at, updated_at
    FROM account ${where}
    ORDER BY is_starred DESC, platform ASC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  return { list, total, page, pageSize }
}

/**
 * 获取单条账号详情（含密码，按需调用）
 * @param {number} id
 */
function getAccountById(id) {
  ensureDb()
  if (!id) throw new Error('id 不能为空')
  const row = db.prepare('SELECT * FROM account WHERE id = ?').get(id)
  if (!row) throw new Error('账号不存在')
  return row
}

/**
 * 新增账号
 */
function createAccount({ platform, url = '', username = '', password = '', category = '其他', notes = '', is_starred = 0 }) {
  ensureDb()
  if (!platform || !platform.trim()) throw new Error('平台名称不能为空')
  const stmt = db.prepare(`
    INSERT INTO account (platform, url, username, password, category, notes, is_starred)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const res = stmt.run(platform.trim(), url.trim(), username.trim(), password, category.trim(), notes.trim(), is_starred)
  return res.lastInsertRowid
}

/**
 * 编辑账号
 */
function updateAccount({ id, platform, url = '', username = '', password = '', category = '其他', notes = '', is_starred = 0 }) {
  ensureDb()
  if (!id) throw new Error('账号 id 不能为空')
  if (!platform || !platform.trim()) throw new Error('平台名称不能为空')
  db.prepare(`
    UPDATE account
    SET platform = ?, url = ?, username = ?, password = ?,
        category = ?, notes = ?, is_starred = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(platform.trim(), url.trim(), username.trim(), password, category.trim(), notes.trim(), is_starred, id)
}

/**
 * 切换标星状态
 */
function toggleAccountStar(id) {
  ensureDb()
  if (!id) throw new Error('id 不能为空')
  const row = db.prepare('SELECT is_starred FROM account WHERE id = ?').get(id)
  if (!row) throw new Error('账号不存在')
  const next = row.is_starred === 1 ? 0 : 1
  db.prepare(`UPDATE account SET is_starred = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(next, id)
  return next
}

/**
 * 删除单条账号
 */
function deleteAccount(id) {
  ensureDb()
  if (!id) throw new Error('id 不能为空')
  db.prepare('DELETE FROM account WHERE id = ?').run(id)
}

/**
 * 批量删除账号
 */
function batchDeleteAccounts(ids) {
  ensureDb()
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('请选择要删除的账号')
  const ph = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM account WHERE id IN (${ph})`).run(...ids)
}

/**
 * 获取所有账号分类
 */
function getAccountCategories() {
  ensureDb()
  const rows = db.prepare(`SELECT DISTINCT category FROM account WHERE category != '' ORDER BY category ASC`).all()
  const defaults = ['社交', '工作', '金融', '购物', '娱乐', '学习', '其他']
  const existing = rows.map((r) => r.category)
  return [...new Set([...defaults, ...existing])]
}

// ─── 应用设置（KV 存储）─────────────────────────────────────────

/**
 * 读取设置项
 * @param {string} key
 * @returns {string|null}
 */
function getSetting(key) {
  ensureDb()
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)
  return row ? row.value : null
}

/**
 * 写入设置项（upsert）
 * @param {string} key
 * @param {string} value
 */
function setSetting(key, value) {
  ensureDb()
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET
      value      = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value)
}

/**
 * 删除设置项
 * @param {string} key
 */
function deleteSetting(key) {
  ensureDb()
  db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
}

// ─── 导出 ─────────────────────────────────────────────────────────
module.exports = {
  initDatabase,
  closeDatabase,
  getDbPath,
  // 待办
  getTodoList,
  getTodoStats,
  createTodo,
  updateTodo,
  toggleTodoStatus,
  deleteTodo,
  batchDeleteTodos,
  getTodoCategories,
  // 笔记
  getNoteList,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  batchDeleteNotes,
  getNoteCategories,
  // 账号
  getAccountList,
  getAccountById,
  createAccount,
  updateAccount,
  toggleAccountStar,
  deleteAccount,
  batchDeleteAccounts,
  getAccountCategories,
  // 设置
  getSetting,
  setSetting,
  deleteSetting
}
