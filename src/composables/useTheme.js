/**
 * 主题管理 Composable
 * 支持三种模式：light（浅色）/ dark（深色）/ system（跟随系统）
 * 使用 Element Plus 官方暗色方案：给 <html> 添加 `dark` class
 * 偏好持久化到 localStorage
 */

import { ref, watch } from 'vue'

// ─── 主题常量 ─────────────────────────────────────────────────────
export const THEMES = [
  { value: 'light',  label: '浅色',   icon: '☀️' },
  { value: 'dark',   label: '深色',   icon: '🌙' },
  { value: 'system', label: '跟随系统', icon: '💻' }
]

const STORAGE_KEY = 'pa-theme'

// ─── 单例响应式状态（模块级，全局共享）────────────────────────────
const currentTheme = ref(localStorage.getItem(STORAGE_KEY) || 'system')

/**
 * 获取系统当前色彩方案
 * @returns {'light'|'dark'}
 */
function getSystemScheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * 将主题偏好应用到 DOM（给 <html> 增减 `dark` class）
 * Element Plus 暗色模式依赖此 class
 * @param {'light'|'dark'|'system'} theme
 */
function applyTheme(theme) {
  const resolved = theme === 'system' ? getSystemScheme() : theme
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// ─── 监听系统色彩方案变化 ─────────────────────────────────────────
const systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
systemMediaQuery.addEventListener('change', () => {
  if (currentTheme.value === 'system') {
    applyTheme('system')
  }
})

// ─── 监听主题变化，自动应用并持久化 ──────────────────────────────
watch(currentTheme, (val) => {
  applyTheme(val)
  localStorage.setItem(STORAGE_KEY, val)
}, { immediate: false })

// ─── 公共 Composable ──────────────────────────────────────────────
export function useTheme() {
  /**
   * 设置新主题
   * @param {'light'|'dark'|'system'} theme
   */
  function setTheme(theme) {
    currentTheme.value = theme
  }

  /**
   * 初始化主题（在应用启动时调用一次）
   */
  function initTheme() {
    applyTheme(currentTheme.value)
  }

  return {
    currentTheme,  // Ref<'light'|'dark'|'system'>
    setTheme,
    initTheme,
    THEMES
  }
}
