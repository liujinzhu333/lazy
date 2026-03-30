<template>
  <!--
    个人助手主布局
    结构：左侧导航栏 + 右侧（Header + 内容区）
  -->
  <el-container class="main-layout">
    <!-- ── 左侧导航栏 ──────────────────────────────────────────── -->
    <el-aside :width="isCollapsed ? '64px' : '200px'" class="sidebar">
      <!-- Logo 区域 -->
      <div class="logo-wrap" :class="{ collapsed: isCollapsed }">
        <span class="logo-icon">✦</span>
        <span v-if="!isCollapsed" class="logo-text">个人助手</span>
      </div>

      <!-- 导航菜单 -->
      <el-menu
        :default-active="activeRoute"
        :collapse="isCollapsed"
        :collapse-transition="false"
        router
        class="sidebar-menu"
        background-color="#1e293b"
        text-color="#94a3b8"
        active-text-color="#60a5fa"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>

      <!-- 底部折叠按钮 -->
      <div class="collapse-btn" @click="toggleCollapse">
        <el-icon>
          <component :is="isCollapsed ? 'Expand' : 'Fold'" />
        </el-icon>
      </div>
    </el-aside>

    <!-- ── 右侧主区域 ──────────────────────────────────────────── -->
    <el-container class="main-container">
      <!-- 顶部 Header -->
      <el-header class="top-header">
        <div class="header-left">
          <span class="current-title">{{ currentTitle }}</span>
        </div>
        <div class="header-right">
          <!-- 统计徽标 -->
          <div class="stats-pills" v-if="todoStats.total > 0">
            <el-tag type="danger" size="small" effect="light">
              待办 {{ todoStats.todo }}
            </el-tag>
            <el-tag type="warning" size="small" effect="light">
              进行中 {{ todoStats.doing }}
            </el-tag>
            <el-tag type="success" size="small" effect="light">
              已完成 {{ todoStats.done }}
            </el-tag>
          </div>
          <span class="app-version">v{{ appVersion }}</span>
        </div>
      </el-header>

      <!-- 主体内容：路由出口 -->
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { fetchTodoStats } from '@/api/todo'

// ─── 菜单配置 ────────────────────────────────────────────────────
const menuItems = [
  { path: '/todo', title: '待办任务', icon: 'Checked'  },
  { path: '/note', title: '我的笔记', icon: 'Notebook'  }
]

// ─── 折叠状态 ─────────────────────────────────────────────────────
const isCollapsed = ref(false)
const toggleCollapse = () => { isCollapsed.value = !isCollapsed.value }

// ─── 当前路由 ─────────────────────────────────────────────────────
const route = useRoute()
const activeRoute = computed(() => route.path)
const currentTitle = computed(() => {
  const found = menuItems.find((m) => m.path === route.path)
  return found?.title || '个人助手'
})

// ─── 应用版本 ─────────────────────────────────────────────────────
const appVersion = ref('1.0.0')

// ─── 待办统计 ─────────────────────────────────────────────────────
const todoStats = ref({ todo: 0, doing: 0, done: 0, total: 0 })

async function loadStats() {
  try {
    todoStats.value = await fetchTodoStats()
  } catch {
    // 非 Electron 环境忽略
  }
}

onMounted(async () => {
  try {
    const res = await window.electronAPI?.getVersion()
    if (res?.success) appVersion.value = res.data
  } catch {}
  await loadStats()
})

// 暴露刷新统计方法（子页面操作后调用）
defineExpose({ loadStats })
</script>

<style scoped>
/* ── 整体布局 ─────────────────────────────────────────────── */
.main-layout {
  height: 100vh;
  overflow: hidden;
}

/* ── 侧边栏 ───────────────────────────────────────────────── */
.sidebar {
  background-color: #1e293b;
  display: flex;
  flex-direction: column;
  transition: width 0.25s ease;
  overflow: hidden;
  user-select: none;
  flex-shrink: 0;
}

.logo-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #334155;
  white-space: nowrap;
  overflow: hidden;
}

.logo-wrap.collapsed {
  justify-content: center;
  padding: 20px 0 16px;
}

.logo-icon {
  font-size: 22px;
  color: #60a5fa;
  flex-shrink: 0;
  line-height: 1;
}

.logo-text {
  font-size: 15px;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 2px;
}

.sidebar-menu {
  flex: 1;
  border-right: none !important;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0;
}

:deep(.el-menu-item) {
  border-radius: 8px;
  margin: 3px 10px;
  height: 44px;
  line-height: 44px;
}

:deep(.el-menu--collapse .el-menu-item) {
  margin: 3px 6px;
}

:deep(.el-menu-item.is-active) {
  background-color: rgba(96, 165, 250, 0.15) !important;
  color: #60a5fa !important;
}

:deep(.el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.06) !important;
}

.collapse-btn {
  padding: 14px;
  text-align: center;
  color: #475569;
  cursor: pointer;
  border-top: 1px solid #334155;
  transition: color 0.2s;
  flex-shrink: 0;
}

.collapse-btn:hover { color: #94a3b8; }

/* ── 右侧主区域 ───────────────────────────────────────────── */
.main-container {
  background-color: #f8fafc;
  overflow: hidden;
  flex: 1;
}

.top-header {
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 54px !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.current-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stats-pills {
  display: flex;
  gap: 6px;
}

.app-version {
  font-size: 12px;
  color: #94a3b8;
}

/* ── 主内容区 ─────────────────────────────────────────────── */
.main-content {
  padding: 20px;
  overflow-y: auto;
  height: calc(100vh - 54px);
}

/* ── 路由切换动画 ─────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
