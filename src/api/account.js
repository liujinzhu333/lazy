/**
 * 账号管理 API 封装
 * 注意：列表查询不返回密码字段，查看/编辑时通过 fetchAccountDetail 单独获取
 */

const api = () => {
  if (!window.electronAPI) throw new Error('electronAPI 未就绪，请在 Electron 环境中运行')
  return window.electronAPI
}

/** 分页查询账号列表（不含密码） */
export async function fetchAccountList(params) {
  const res = await api().getAccountList(params)
  if (!res.success) throw new Error(res.message || '查询失败')
  return res.data
}

/** 获取单条账号详情（含密码，按需调用）*/
export async function fetchAccountDetail(id) {
  const res = await api().getAccountDetail(id)
  if (!res.success) throw new Error(res.message || '获取详情失败')
  return res.data
}

/** 新增账号 */
export async function addAccount(data) {
  const res = await api().createAccount(data)
  if (!res.success) throw new Error(res.message || '新增失败')
  return res.data
}

/** 编辑账号 */
export async function editAccount(data) {
  const res = await api().updateAccount(data)
  if (!res.success) throw new Error(res.message || '编辑失败')
}

/** 切换标星 */
export async function toggleAccountStar(id) {
  const res = await api().toggleAccountStar(id)
  if (!res.success) throw new Error(res.message || '切换失败')
  return res.data
}

/** 删除单条 */
export async function removeAccount(id) {
  const res = await api().deleteAccount(id)
  if (!res.success) throw new Error(res.message || '删除失败')
}

/** 批量删除 */
export async function batchRemoveAccounts(ids) {
  const res = await api().batchDeleteAccounts(ids)
  if (!res.success) throw new Error(res.message || '批量删除失败')
}

/** 获取分类列表 */
export async function fetchAccountCategories() {
  const res = await api().getAccountCategories()
  if (!res.success) throw new Error(res.message || '获取分类失败')
  return res.data
}
