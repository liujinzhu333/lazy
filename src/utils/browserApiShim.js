/**
 * 浏览器模式 API Shim
 *
 * 提供与 window.electronAPI 完全相同的接口，
 * 但内部通过 HTTP fetch 调用 Electron 主进程的 REST API。
 *
 * 开发模式：Vite 代理将 /api/* 转发到 localhost:8899
 * 生产模式：同源请求（页面和 API 都由 8899 端口提供）
 *
 * 加密密钥由 Electron 主进程统一管理，浏览器无需额外处理加解密。
 */

// ─── 基础请求工具 ────────────────────────────────────────────────

async function get(path, params = {}) {
  const url = new URL(path, location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString())
  return res.json()
}

async function post(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

// ══════════════════════════════════════════════════════════════════
// 浏览器 API Shim 对象（接口与 electronAPI 完全一致）
// ══════════════════════════════════════════════════════════════════

export const browserApiShim = {

  // ── 待办任务 ──────────────────────────────────────────────────

  getTodoList:      (params = {}) => get('/api/todo/list', params),
  getTodoStats:     ()            => get('/api/todo/stats'),
  createTodo:       (data)        => post('/api/todo/create', data),
  updateTodo:       (data)        => post('/api/todo/update', data),
  toggleTodoStatus: (id)          => post('/api/todo/toggleStatus', { id }),
  deleteTodo:       (id)          => post('/api/todo/delete', { id }),
  batchDeleteTodos: (ids)         => post('/api/todo/batchDelete', { ids }),
  getTodoCategories: ()           => get('/api/todo/categories'),

  // ── 笔记 ──────────────────────────────────────────────────────

  getNoteList:      (params = {}) => get('/api/note/list', params),
  getNoteDetail:    (id)          => get('/api/note/detail', { id }),
  createNote:       (data)        => post('/api/note/create', data),
  updateNote:       (data)        => post('/api/note/update', data),
  deleteNote:       (id)          => post('/api/note/delete', { id }),
  batchDeleteNotes: (ids)         => post('/api/note/batchDelete', { ids }),
  getNoteCategories: ()           => get('/api/note/categories'),

  // ── 账号（完整支持，加解密由主进程处理）──────────────────────

  getAccountList:      (params = {}) => get('/api/account/list', params),
  getAccountCategories: ()           => get('/api/account/categories'),
  toggleAccountStar:   (id)          => post('/api/account/toggleStar', { id }),
  deleteAccount:       (id)          => post('/api/account/delete', { id }),
  batchDeleteAccounts: (ids)         => post('/api/account/batchDelete', { ids }),

  /** 获取账号详情（含解密后的密码，需先解锁金库）*/
  getAccountDetail: (id) => get('/api/account/detail', { id }),

  /** 新增账号（密码在主进程加密，需先解锁金库）*/
  createAccount: (data) => post('/api/account/create', data),

  /** 编辑账号（密码在主进程重新加密，需先解锁金库）*/
  updateAccount: (data) => post('/api/account/update', data),

  // ── 主密码认证（完整支持，密钥状态由主进程维护）───────────────

  /** 检查是否已设置主密码 */
  hasMasterPassword: () => get('/api/auth/hasMasterPassword'),

  /** 检查是否已解锁（Electron 和浏览器共享同一把密钥状态）*/
  isUnlocked: () => get('/api/auth/isUnlocked'),

  /**
   * 设置 / 修改主密码
   * @param {{ password: string, oldPassword?: string }} data
   */
  setMasterPassword: (data) => post('/api/auth/setMasterPassword', data),

  /** 解锁金库 @param {string} password */
  unlockVault: (password) => post('/api/auth/unlock', { password }),

  /** 锁定金库 */
  lockVault: () => post('/api/auth/lock'),

  // ── 应用信息 ──────────────────────────────────────────────────

  getVersion: () =>
    get('/api/app/version').then(r => ({ success: true, data: r.data })),

  getDbPath: () =>
    Promise.resolve({ success: true, data: '（浏览器模式，数据由服务端管理）' }),

  getLocalAddresses: () =>
    Promise.resolve({ success: true, data: { addresses: [], port: 8899 } }),

  setHttpPort: () =>
    Promise.resolve({ success: false, message: '浏览器模式不支持修改端口' })
}
