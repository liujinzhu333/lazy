/**
 * 加密工具模块 — 个人助手
 *
 * 加密方案：AES-256-GCM（认证加密，防篡改）
 * 密钥派生：PBKDF2-SHA256（主密码 → 32 字节密钥）
 * 主密码验证：PBKDF2-SHA256 哈希存入数据库（不存明文、不可逆）
 *
 * 存储格式：iv(24 hex) + ":" + authTag(32 hex) + ":" + ciphertext(hex)
 *
 * 重要：派生密钥仅在主进程内存中持有，渲染进程不可见。
 */

const crypto = require('crypto')

// ─── 常量 ─────────────────────────────────────────────────────
const PBKDF2_ITERATIONS = 200_000  // 迭代次数（越大越安全，影响解锁速度）
const PBKDF2_KEY_LEN    = 32       // AES-256 密钥长度（字节）
const PBKDF2_DIGEST     = 'sha256'
const GCM_IV_LEN        = 12       // GCM 推荐 IV 长度（字节）
const SALT_LEN          = 32       // 盐长度（字节）

// ─── 主密码哈希（用于验证主密码正确性）────────────────────────

/**
 * 生成随机盐（hex 字符串，存入数据库）
 * @returns {string}
 */
function generateSalt() {
  return crypto.randomBytes(SALT_LEN).toString('hex')
}

/**
 * 从主密码 + 盐 派生验证哈希（存入数据库，不可逆）
 * @param {string} masterPassword
 * @param {string} saltHex
 * @returns {string} hashHex
 */
function deriveMasterHash(masterPassword, saltHex) {
  const salt = Buffer.from(saltHex, 'hex')
  return crypto.pbkdf2Sync(masterPassword, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST).toString('hex')
}

/**
 * 验证主密码是否正确
 * @param {string} masterPassword  用户输入
 * @param {string} saltHex         数据库中存储的盐
 * @param {string} storedHashHex   数据库中存储的哈希
 * @returns {boolean}
 */
function verifyMasterPassword(masterPassword, saltHex, storedHashHex) {
  const hash = deriveMasterHash(masterPassword, saltHex)
  // 使用 timingSafeEqual 防止时序攻击
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHashHex, 'hex'))
}

// ─── AES-256-GCM 加解密（使用派生密钥）────────────────────────

/**
 * 从主密码 + 盐 派生 AES 密钥（用于加解密，不存储，仅保存在内存）
 * @param {string} masterPassword
 * @param {string} saltHex
 * @returns {Buffer} 32 字节密钥
 */
function deriveEncryptionKey(masterPassword, saltHex) {
  const salt = Buffer.from(saltHex, 'hex')
  // 在盐基础上加后缀，与验证哈希使用不同的派生路径，确保独立性
  const keySalt = Buffer.concat([salt, Buffer.from('encryption-key')])
  return crypto.pbkdf2Sync(masterPassword, keySalt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST)
}

/**
 * 加密明文密码
 * @param {string} plaintext   明文密码
 * @param {Buffer} key         32 字节加密密钥
 * @returns {string}           "ivHex:authTagHex:ciphertextHex"
 */
function encrypt(plaintext, key) {
  if (!plaintext) return ''
  const iv = crypto.randomBytes(GCM_IV_LEN)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * 解密密文密码
 * @param {string} ciphertext  "ivHex:authTagHex:ciphertextHex"
 * @param {Buffer} key         32 字节加密密钥
 * @returns {string}           明文密码
 */
function decrypt(ciphertext, key) {
  if (!ciphertext) return ''
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    // 兼容旧的明文数据（升级前存储的数据）
    return ciphertext
  }
  const [ivHex, authTagHex, dataHex] = parts
  const iv       = Buffer.from(ivHex,      'hex')
  const authTag  = Buffer.from(authTagHex, 'hex')
  const data     = Buffer.from(dataHex,    'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/**
 * 判断一个字符串是否为加密格式（iv:authTag:data 三段式）
 * 用于兼容存量明文数据
 * @param {string} str
 * @returns {boolean}
 */
function isEncrypted(str) {
  if (!str) return false
  const parts = str.split(':')
  return parts.length === 3 && /^[0-9a-f]+$/i.test(parts[0]) && parts[0].length === GCM_IV_LEN * 2
}

module.exports = {
  generateSalt,
  deriveMasterHash,
  verifyMasterPassword,
  deriveEncryptionKey,
  encrypt,
  decrypt,
  isEncrypted
}
