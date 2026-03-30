<template>
  <!-- 应用根容器：全屏布局，路由视图出口 -->
  <div id="root-app">
    <router-view />
  </div>
</template>

<script setup>
import { useTheme } from '@/composables/useTheme'

// 应用启动时读取本地存储的主题偏好并立即应用
// 保证刷新或重启后主题不会闪烁为默认值
const { initTheme } = useTheme()
initTheme()
</script>

<style>
#root-app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
