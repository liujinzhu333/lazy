/**
 * Vue3 应用入口
 * 职责：创建 Vue 应用实例、注册全局插件、挂载到 DOM
 */

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { browserApiShim } from './utils/browserApiShim'
import { staticApiShim }  from './utils/staticApiShim'

// ─── Element Plus 完整引入 ──────────────────────────────────────
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// Element Plus 暗色主题变量（必须在 index.css 之后引入）
import 'element-plus/theme-chalk/dark/css-vars.css'
// Element Plus 中文语言包
import zhCn from 'element-plus/es/locale/lang/zh-cn'

// ─── 全局样式 ────────────────────────────────────────────────────
import './styles/global.css'

// ─── 创建 Vue 应用 ───────────────────────────────────────────────
const app = createApp(App)

// 注册路由
app.use(router)

// 注册 Element Plus（中文语言包）
app.use(ElementPlus, {
  locale: zhCn,
  // 全局尺寸配置：default | large | small
  size: 'default'
})

// ─── 统一 API 接口 ───────────────────────────────────────────────
// Electron 环境        → electronAPI（IPC 通信）
// 静态导出模式         → staticApiShim（读取嵌入的 JSON 快照）
// 浏览器 HTTP 访问模式 → browserApiShim（fetch 调用 REST API）
if (window.electronAPI) {
  window.appAPI = window.electronAPI
  console.info('[appAPI] Electron 模式')
} else if (window.__APP_STATIC_DATA__) {
  window.appAPI = staticApiShim
  console.info('[appAPI] 静态预览模式：数据来自嵌入快照，导出于', window.__APP_STATIC_DATA__.exportTime)
} else {
  window.appAPI = browserApiShim
  console.info('[appAPI] 浏览器模式：使用 HTTP REST API shim')
}

// ─── 全局错误处理 ────────────────────────────────────────────────
app.config.errorHandler = (err, vm, info) => {
  console.error('[Vue 全局错误]', err, info)
}

// ─── 挂载应用 ────────────────────────────────────────────────────
app.mount('#app')
