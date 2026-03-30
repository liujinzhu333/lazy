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

  // ── 应用信息 ──────────────────────────────────────────────────

  getVersion: () => invoke('app:getVersion'),
  getDbPath:  () => invoke('app:getDbPath')
})

console.log('[preload] 个人助手 API 已就绪')
