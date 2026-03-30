/**
 * Vue3 应用入口
 * 职责：创建 Vue 应用实例、注册全局插件、挂载到 DOM
 */

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// ─── Element Plus 完整引入 ──────────────────────────────────────
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
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

// ─── 全局错误处理 ────────────────────────────────────────────────
app.config.errorHandler = (err, vm, info) => {
  console.error('[Vue 全局错误]', err, info)
}

// ─── 挂载应用 ────────────────────────────────────────────────────
app.mount('#app')
