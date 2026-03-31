/**
 * 笔记 API 封装
 */

const api = () => {
  if (!window.appAPI) throw new Error('appAPI 未就绪，请确保应用已初始化')
  return window.appAPI
}

/** 分页查询笔记列表 */
export async function fetchNoteList(params) {
  const res = await api().getNoteList(params)
  if (!res.success) throw new Error(res.message || '查询失败')
  return res.data
}

/** 获取笔记详情（含完整 content）*/
export async function fetchNoteDetail(id) {
  const res = await api().getNoteDetail(id)
  if (!res.success) throw new Error(res.message || '获取详情失败')
  return res.data
}

/** 新增笔记 */
export async function addNote(data) {
  const res = await api().createNote(data)
  if (!res.success) throw new Error(res.message || '新增失败')
  return res.data
}

/** 编辑笔记 */
export async function editNote(data) {
  const res = await api().updateNote(data)
  if (!res.success) throw new Error(res.message || '编辑失败')
}

/** 删除单条 */
export async function removeNote(id) {
  const res = await api().deleteNote(id)
  if (!res.success) throw new Error(res.message || '删除失败')
}

/** 批量删除 */
export async function batchRemoveNotes(ids) {
  const res = await api().batchDeleteNotes(ids)
  if (!res.success) throw new Error(res.message || '批量删除失败')
}

/** 获取分类列表 */
export async function fetchNoteCategories() {
  const res = await api().getNoteCategories()
  if (!res.success) throw new Error(res.message || '获取分类失败')
  return res.data
}
