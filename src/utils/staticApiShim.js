/**
 * 静态导出模式 API Shim
 * 当检测到 window.__APP_STATIC_DATA__ 时使用（无需 Electron / HTTP 服务）
 * 所有数据从嵌入的 JSON 快照中读取，写操作均返回只读提示
 */

const READ_ONLY_ERR = { success: false, message: '静态预览模式，仅支持查看，不支持写入' }

// ─── 辅助函数 ─────────────────────────────────────────────────────
function getData() {
  return window.__APP_STATIC_DATA__ || { todos: [], notes: [], accounts: [] }
}

function paginate(list, page = 1, pageSize = 20) {
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total, page, pageSize }
}

function filterList(list, keyword, fields) {
  if (!keyword) return list
  const kw = keyword.toLowerCase()
  return list.filter(item => fields.some(f => String(item[f] || '').toLowerCase().includes(kw)))
}

// ─── 待办任务 ────────────────────────────────────────────────────
function getTodoList({ page = 1, pageSize = 10, keyword = '', status = '', priority = '', category = '' } = {}) {
  let list = [...getData().todos]
  if (keyword)           list = filterList(list, keyword, ['title', 'description'])
  if (status !== '')     list = list.filter(t => t.status === Number(status))
  if (priority !== '')   list = list.filter(t => t.priority === Number(priority))
  if (category)          list = list.filter(t => t.category === category)
  return { success: true, data: paginate(list, page, pageSize) }
}

function getTodoStats() {
  const todos = getData().todos
  return {
    success: true,
    data: {
      total: todos.length,
      todo:  todos.filter(t => t.status === 0).length,
      doing: todos.filter(t => t.status === 1).length,
      done:  todos.filter(t => t.status === 2).length
    }
  }
}

function getTodoCategories() {
  const cats = [...new Set(getData().todos.map(t => t.category).filter(Boolean))]
  return { success: true, data: cats }
}

// ─── 笔记 ───────────────────────────────────────────────────────
function getNoteList({ page = 1, pageSize = 10, keyword = '', category = '' } = {}) {
  let list = [...getData().notes]
  if (keyword)  list = filterList(list, keyword, ['title', 'content'])
  if (category) list = list.filter(n => n.category === category)
  // 列表不返回完整 content（过大），只返回摘要
  const summaryList = list.map(({ content, ...rest }) => ({
    ...rest,
    summary: (content || '').slice(0, 100)
  }))
  return { success: true, data: paginate(summaryList, page, pageSize) }
}

function getNoteDetail(id) {
  const note = getData().notes.find(n => n.id === id)
  if (!note) return { success: false, message: '笔记不存在' }
  return { success: true, data: note }
}

function getNoteCategories() {
  const cats = [...new Set(getData().notes.map(n => n.category).filter(Boolean))]
  return { success: true, data: cats }
}

// ─── 账号 ───────────────────────────────────────────────────────
function getAccountList({ page = 1, pageSize = 20, keyword = '', category = '', is_starred = '' } = {}) {
  let list = [...getData().accounts]
  if (keyword)       list = filterList(list, keyword, ['platform', 'username', 'url', 'notes'])
  if (category)      list = list.filter(a => a.category === category)
  if (is_starred !== '') list = list.filter(a => a.is_starred === Number(is_starred))
  return { success: true, data: paginate(list, page, pageSize) }
}

function getAccountDetail(id) {
  const acc = getData().accounts.find(a => a.id === id)
  if (!acc) return { success: false, message: '账号不存在' }
  // 静态导出不含密码
  return { success: true, data: { ...acc, password: '（静态模式不导出密码）' } }
}

function getAccountCategories() {
  const cats = [...new Set(getData().accounts.map(a => a.category).filter(Boolean))]
  return { success: true, data: cats }
}

// ─── 应用信息 ───────────────────────────────────────────────────
function getVersion() {
  return { success: true, data: getData().appVersion || '1.0.0' }
}

function getDbPath() {
  return { success: true, data: `静态快照 · 导出于 ${getData().exportTime || '未知时间'}` }
}

function getLocalAddresses() {
  return { success: true, data: { addresses: [], port: 0 } }
}

// ─── 认证（静态模式无锁）──────────────────────────────────────
function hasMasterPassword() { return { success: true, data: { hasPassword: false } } }
function isUnlocked()        { return { success: true, data: { unlocked: true } } }

// ─── 导出 Shim 对象 ──────────────────────────────────────────────
export const staticApiShim = {
  // 待办
  getTodoList:      async (p) => getTodoList(p),
  getTodoStats:     async ()  => getTodoStats(),
  getTodoCategories:async ()  => getTodoCategories(),
  createTodo:       async ()  => READ_ONLY_ERR,
  updateTodo:       async ()  => READ_ONLY_ERR,
  toggleTodoStatus: async ()  => READ_ONLY_ERR,
  deleteTodo:       async ()  => READ_ONLY_ERR,
  batchDeleteTodos: async ()  => READ_ONLY_ERR,

  // 笔记
  getNoteList:      async (p) => getNoteList(p),
  getNoteDetail:    async (id)=> getNoteDetail(id),
  getNoteCategories:async ()  => getNoteCategories(),
  createNote:       async ()  => READ_ONLY_ERR,
  updateNote:       async ()  => READ_ONLY_ERR,
  deleteNote:       async ()  => READ_ONLY_ERR,
  batchDeleteNotes: async ()  => READ_ONLY_ERR,

  // 账号
  getAccountList:      async (p)  => getAccountList(p),
  getAccountDetail:    async (id) => getAccountDetail(id),
  getAccountCategories:async ()   => getAccountCategories(),
  createAccount:       async ()   => READ_ONLY_ERR,
  updateAccount:       async ()   => READ_ONLY_ERR,
  toggleAccountStar:   async ()   => READ_ONLY_ERR,
  deleteAccount:       async ()   => READ_ONLY_ERR,
  batchDeleteAccounts: async ()   => READ_ONLY_ERR,

  // 认证
  hasMasterPassword:  async () => hasMasterPassword(),
  isUnlocked:         async () => isUnlocked(),
  setMasterPassword:  async () => READ_ONLY_ERR,
  unlockVault:        async () => ({ success: true }),
  lockVault:          async () => READ_ONLY_ERR,

  // 应用信息
  getVersion:         async () => getVersion(),
  getDbPath:          async () => getDbPath(),
  getLocalAddresses:  async () => getLocalAddresses(),
  setHttpPort:        async () => READ_ONLY_ERR,
  openExternal:       async (url) => { window.open(url, '_blank', 'noopener,noreferrer'); return { success: true } },

  // Git 备份（静态模式不支持）
  getBackupConfig:    async () => ({ success: true, data: { repoPath: '', remoteUrl: '', lastBackup: '', initialized: false } }),
  initBackupRepo:     async () => READ_ONLY_ERR,
  gitBackup:          async () => READ_ONLY_ERR,

  // 静态导出（无意义）
  showFolderPicker:   async () => READ_ONLY_ERR,
  exportStatic:       async () => READ_ONLY_ERR
}
