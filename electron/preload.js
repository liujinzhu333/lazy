/**
 * Electron 预加载脚本 — 个人助手
 * 通过 contextBridge 向渲染进程安全暴露受限 API
 * 白名单机制：仅允许调用已声明的 IPC 通道
 */

const { contextBridge, ipcRenderer } = require('electron')

// ─── IPC 白名单 ───────────────────────────────────────────────────
const ALLOWED_CHANNELS = [
  // 待办
  'todo:list', 'todo:stats', 'todo:create', 'todo:update',
  'todo:toggleStatus', 'todo:delete', 'todo:batchDelete', 'todo:categories',
  // 笔记
  'note:list', 'note:detail', 'note:create', 'note:update',
  'note:delete', 'note:batchDelete', 'note:categories',
  // 账号
  'account:list', 'account:detail', 'account:create', 'account:update',
  'account:toggleStar', 'account:delete', 'account:batchDelete', 'account:categories',
  // 主密码认证
  'auth:hasMasterPassword', 'auth:isUnlocked', 'auth:setMasterPassword',
  'auth:unlock', 'auth:lock',
  // 应用
  'app:getVersion', 'app:getDbPath'
]

/**
 * 安全的 IPC invoke 封装（白名单校验）
 */
function invoke(channel, ...args) {
  if (!ALLOWED_CHANNELS.includes(channel)) {
    return Promise.reject(new Error(`IPC 通道 "${channel}" 未授权，拒绝调用`))
  }
  return ipcRenderer.invoke(channel, ...args)
}

// ─── 向渲染进程暴露 API（window.electronAPI）────────────────────
contextBridge.exposeInMainWorld('electronAPI', {

  // ── 待办任务接口 ───────────────────────────────────────────────

  /** 分页查询 @param {{ page, pageSize, keyword, status, priority, category }} */
  getTodoList:      (params) => invoke('todo:list', params),

  /** 统计数据（各状态数量） */
  getTodoStats:     ()       => invoke('todo:stats'),

  /** 新增 @param {{ title, description, priority, status, category, due_date }} */
  createTodo:       (data)   => invoke('todo:create', data),

  /** 编辑 @param {{ id, title, ... }} */
  updateTodo:       (data)   => invoke('todo:update', data),

  /** 快速切换状态（0→1→2→0）@param {number} id */
  toggleTodoStatus: (id)     => invoke('todo:toggleStatus', id),

  /** 删除单条 @param {number} id */
  deleteTodo:       (id)     => invoke('todo:delete', id),

  /** 批量删除 @param {number[]} ids */
  batchDeleteTodos: (ids)    => invoke('todo:batchDelete', ids),

  /** 获取分类列表 */
  getTodoCategories: ()      => invoke('todo:categories'),

  // ── 笔记接口 ──────────────────────────────────────────────────

  /** 分页查询 @param {{ page, pageSize, keyword, category }} */
  getNoteList:      (params) => invoke('note:list', params),

  /** 获取详情（含完整 content）@param {number} id */
  getNoteDetail:    (id)     => invoke('note:detail', id),

  /** 新增 @param {{ title, content, category, is_pinned }} */
  createNote:       (data)   => invoke('note:create', data),

  /** 编辑 @param {{ id, title, content, category, is_pinned }} */
  updateNote:       (data)   => invoke('note:update', data),

  /** 删除单条 @param {number} id */
  deleteNote:       (id)     => invoke('note:delete', id),

  /** 批量删除 @param {number[]} ids */
  batchDeleteNotes: (ids)    => invoke('note:batchDelete', ids),

  /** 获取分类列表 */
  getNoteCategories: ()      => invoke('note:categories'),

  // ── 账号管理接口 ──────────────────────────────────────────────

  /** 分页查询账号列表（密码不在列表中返回）*/
  getAccountList:      (params) => invoke('account:list', params),

  /** 获取单条详情（含密码）@param {number} id */
  getAccountDetail:    (id)     => invoke('account:detail', id),

  /** 新增 @param {{ platform, url, username, password, category, notes, is_starred }} */
  createAccount:       (data)   => invoke('account:create', data),

  /** 编辑 @param {{ id, platform, ... }} */
  updateAccount:       (data)   => invoke('account:update', data),

  /** 切换标星 @param {number} id */
  toggleAccountStar:   (id)     => invoke('account:toggleStar', id),

  /** 删除单条 @param {number} id */
  deleteAccount:       (id)     => invoke('account:delete', id),

  /** 批量删除 @param {number[]} ids */
  batchDeleteAccounts: (ids)    => invoke('account:batchDelete', ids),

  /** 获取分类列表 */
  getAccountCategories: ()      => invoke('account:categories'),

  // ── 主密码认证接口 ────────────────────────────────────────────

  /** 检查是否已设置主密码 */
  hasMasterPassword:   ()           => invoke('auth:hasMasterPassword'),

  /** 检查是否已解锁 */
  isUnlocked:          ()           => invoke('auth:isUnlocked'),

  /**
   * 设置/修改主密码
   * @param {{ password: string, oldPassword?: string }}
   */
  setMasterPassword:   (data)       => invoke('auth:setMasterPassword', data),

  /** 解锁金库 @param {string} password */
  unlockVault:         (password)   => invoke('auth:unlock', password),

  /** 锁定金库 */
  lockVault:           ()           => invoke('auth:lock'),

  // ── 应用信息 ──────────────────────────────────────────────────

  getVersion: () => invoke('app:getVersion'),
  getDbPath:  () => invoke('app:getDbPath')
})

console.log('[preload] 个人助手 API 已就绪')
