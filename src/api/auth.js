/**
 * 主密码认证 API 封装
 * 所有账号密码的加解密在主进程完成，渲染进程只做状态查询和密码传递
 */

const api = () => {
  if (!window.appAPI) throw new Error('appAPI 未就绪，请确保应用已初始化')
  return window.appAPI
}

/** 检查是否已设置主密码 */
export async function checkHasMasterPassword() {
  const res = await api().hasMasterPassword()
  if (!res.success) throw new Error(res.message || '检查失败')
  return res.data.hasPassword
}

/** 检查当前是否已解锁 */
export async function checkIsUnlocked() {
  const res = await api().isUnlocked()
  if (!res.success) throw new Error(res.message || '检查失败')
  return res.data.unlocked
}

/**
 * 设置主密码（首次）或修改主密码
 * @param {{ password: string, oldPassword?: string }} data
 */
export async function setupMasterPassword(data) {
  const res = await api().setMasterPassword(data)
  if (!res.success) throw new Error(res.message || '设置失败')
}

/**
 * 解锁金库
 * @param {string} password
 */
export async function unlockVault(password) {
  const res = await api().unlockVault(password)
  if (!res.success) throw new Error(res.message || '解锁失败')
}

/** 锁定金库 */
export async function lockVault() {
  const res = await api().lockVault()
  if (!res.success) throw new Error(res.message || '锁定失败')
}
