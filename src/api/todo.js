/**
 * 待办任务 API 封装
 * 统一封装 IPC 调用，所有接口返回 Promise，错误直接 throw
 */

const api = () => {
  if (!window.appAPI) throw new Error('appAPI 未就绪，请确保应用已初始化')
  return window.appAPI
}

/** 分页查询待办列表 */
export async function fetchTodoList(params) {
  const res = await api().getTodoList(params)
  if (!res.success) throw new Error(res.message || '查询失败')
  return res.data
}

/** 获取各状态统计 */
export async function fetchTodoStats() {
  const res = await api().getTodoStats()
  if (!res.success) throw new Error(res.message || '统计查询失败')
  return res.data
}

/** 新增待办 */
export async function addTodo(data) {
  const res = await api().createTodo(data)
  if (!res.success) throw new Error(res.message || '新增失败')
  return res.data
}

/** 编辑待办 */
export async function editTodo(data) {
  const res = await api().updateTodo(data)
  if (!res.success) throw new Error(res.message || '编辑失败')
}

/** 快速切换状态 */
export async function toggleTodo(id) {
  const res = await api().toggleTodoStatus(id)
  if (!res.success) throw new Error(res.message || '状态切换失败')
  return res.data
}

/** 删除单条 */
export async function removeTodo(id) {
  const res = await api().deleteTodo(id)
  if (!res.success) throw new Error(res.message || '删除失败')
}

/** 批量删除 */
export async function batchRemoveTodos(ids) {
  const res = await api().batchDeleteTodos(ids)
  if (!res.success) throw new Error(res.message || '批量删除失败')
}

/** 获取分类列表 */
export async function fetchTodoCategories() {
  const res = await api().getTodoCategories()
  if (!res.success) throw new Error(res.message || '获取分类失败')
  return res.data
}
