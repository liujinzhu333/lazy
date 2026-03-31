<template>
  <!--
    个人助手主布局
    桌面端：左侧固定侧边栏
    移动端：底部 Tab Bar + 汉堡菜单唤起抽屉
  -->
  <el-container class="main-layout">

    <!-- ══════════════════════════════════════════════════════════
         桌面端侧边栏（宽度 ≥ 768px 时显示）
    ══════════════════════════════════════════════════════════ -->
    <el-aside
      v-if="!isMobile"
      :width="isCollapsed ? '64px' : '200px'"
      class="sidebar"
    >
      <!-- Logo 区域 -->
      <div class="logo-wrap" :class="{ collapsed: isCollapsed }">
        <span class="logo-icon">✦</span>
        <span v-if="!isCollapsed" class="logo-text">个人助手</span>
      </div>

      <!-- 主导航菜单 -->
      <el-menu
        :default-active="activeRoute"
        :collapse="isCollapsed"
        :collapse-transition="false"
        router
        class="sidebar-menu"
        background-color="transparent"
        text-color="#94a3b8"
        active-text-color="#60a5fa"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>

      <!-- 底部区域：设置 + 折叠 -->
      <div class="sidebar-bottom">
        <el-menu
          :default-active="activeRoute"
          :collapse="isCollapsed"
          :collapse-transition="false"
          router
          class="bottom-menu"
          background-color="transparent"
          text-color="#94a3b8"
          active-text-color="#60a5fa"
        >
          <el-menu-item index="/setting">
            <el-icon><Setting /></el-icon>
            <template #title>设置</template>
          </el-menu-item>
        </el-menu>

        <div class="collapse-btn" @click="toggleCollapse">
          <el-icon>
            <component :is="isCollapsed ? 'Expand' : 'Fold'" />
          </el-icon>
        </div>
      </div>
    </el-aside>

    <!-- ══════════════════════════════════════════════════════════
         右侧主区域
    ══════════════════════════════════════════════════════════ -->
    <el-container class="main-container">
      <!-- 顶部 Header -->
      <el-header class="top-header">
        <div class="header-left">
          <!-- 移动端汉堡按钮 -->
          <el-button
            v-if="isMobile"
            :icon="Menu"
            circle
            text
            style="margin-right: 8px; font-size: 18px;"
            @click="drawerVisible = true"
          />
          <span class="current-title">{{ currentTitle }}</span>
        </div>
        <div class="header-right">
          <div class="stats-pills" v-if="todoStats.total > 0 && !isMobile">
            <el-tag type="danger"  size="small" effect="light">待办 {{ todoStats.todo }}</el-tag>
            <el-tag type="warning" size="small" effect="light">进行中 {{ todoStats.doing }}</el-tag>
            <el-tag type="success" size="small" effect="light">已完成 {{ todoStats.done }}</el-tag>
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

    <!-- ══════════════════════════════════════════════════════════
         移动端：抽屉式侧边栏（汉堡菜单点击后显示）
    ══════════════════════════════════════════════════════════ -->
    <el-drawer
      v-if="isMobile"
      v-model="drawerVisible"
      direction="ltr"
      size="220px"
      :show-close="false"
      :with-header="false"
      class="mobile-drawer"
    >
      <div class="mobile-sidebar">
        <div class="logo-wrap">
          <span class="logo-icon">✦</span>
          <span class="logo-text">个人助手</span>
        </div>
        <div class="mobile-menu-list">
          <div
            v-for="item in allMenuItems"
            :key="item.path"
            :class="['mobile-menu-item', { active: activeRoute === item.path }]"
            @click="navTo(item.path)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.title }}</span>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- ══════════════════════════════════════════════════════════
         移动端：底部 Tab Bar
    ══════════════════════════════════════════════════════════ -->
    <nav v-if="isMobile" class="mobile-tab-bar">
      <div
        v-for="item in tabItems"
        :key="item.path"
        :class="['tab-item', { active: activeRoute === item.path }]"
        @click="navTo(item.path)"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <span>{{ item.title }}</span>
      </div>
    </nav>

  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchTodoStats } from '@/api/todo'
import { Menu, Setting } from '@element-plus/icons-vue'

// ─── 菜单定义 ─────────────────────────────────────────────────────
const menuItems = [
  { path: '/',        title: '首页',   icon: 'House'    },
  { path: '/todo',    title: '待办任务', icon: 'Checked'  },
  { path: '/note',    title: '我的笔记', icon: 'Notebook' },
  { path: '/account', title: '账号管理', icon: 'Key'      }
]
const allMenuItems = [
  ...menuItems,
  { path: '/setting', title: '设置', icon: 'Setting' }
]
// 底部 Tab Bar（首页 + 待办 + 笔记 + 账号，设置通过汉堡菜单进入）
const tabItems = [
  { path: '/',        title: '首页',   icon: 'House'    },
  { path: '/todo',    title: '待办',   icon: 'Checked'  },
  { path: '/note',    title: '笔记',   icon: 'Notebook' },
  { path: '/account', title: '账号',   icon: 'Key'      }
]

// ─── 响应式断点（移动端判断）─────────────────────────────────────
const isMobile = ref(window.innerWidth < 768)
const drawerVisible = ref(false)

function handleResize() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) drawerVisible.value = false
}

onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

// ─── 折叠（桌面端）─────────────────────────────────────────────
const isCollapsed = ref(false)
const toggleCollapse = () => { isCollapsed.value = !isCollapsed.value }

// ─── 路由 ──────────────────────────────────────────────────────
const route  = useRoute()
const router = useRouter()

const activeRoute = computed(() => route.path)
const currentTitle = computed(() => {
  const found = allMenuItems.find((m) =>
    m.path === '/' ? route.path === '/' : route.path.startsWith(m.path)
  )
  return found?.title || '个人助手'
})

function navTo(path) {
  router.push(path)
  drawerVisible.value = false
}

// ─── 应用版本 ──────────────────────────────────────────────────
const appVersion = ref('1.0.0')

// ─── 待办统计 ──────────────────────────────────────────────────
const todoStats = ref({ todo: 0, doing: 0, done: 0, total: 0 })

async function loadStats() {
  try { todoStats.value = await fetchTodoStats() } catch {}
}

onMounted(async () => {
  try {
    const res = await window.appAPI?.getVersion()
    if (res?.success) appVersion.value = res.data
  } catch {}
  await loadStats()
})

defineExpose({ loadStats })
</script>

<style scoped>
/* ── 整体布局 ─────────────────────────────────────────────── */
.main-layout {
  height: 100vh;
  overflow: hidden;
}

/* ══════════════════════════════════════════════════════════
   桌面端侧边栏
══════════════════════════════════════════════════════════ */
.sidebar {
  background-color: var(--color-bg-sidebar);
  display: flex;
  flex-direction: column;
  transition: width 0.25s ease, background-color 0.2s ease;
  overflow: hidden;
  user-select: none;
  flex-shrink: 0;
}

.logo-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
  overflow: hidden;
}

.logo-wrap.collapsed {
  justify-content: center;
  padding: 20px 0 16px;
}

.logo-icon { font-size: 22px; color: #60a5fa; flex-shrink: 0; line-height: 1; }
.logo-text  { font-size: 15px; font-weight: 700; color: #e2e8f0; letter-spacing: 2px; }

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
:deep(.el-menu--collapse .el-menu-item) { margin: 3px 6px; }
:deep(.el-menu-item.is-active) { background-color: rgba(96, 165, 250, 0.15) !important; color: #60a5fa !important; }
:deep(.el-menu-item:hover)     { background-color: rgba(255, 255, 255, 0.06) !important; }

.sidebar-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
.bottom-menu { border-right: none !important; padding: 4px 0; }
.collapse-btn {
  padding: 12px;
  text-align: center;
  color: #475569;
  cursor: pointer;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  transition: color 0.2s;
}
.collapse-btn:hover { color: #94a3b8; }

/* ══════════════════════════════════════════════════════════
   右侧主区域
══════════════════════════════════════════════════════════ */
.main-container {
  background-color: var(--color-bg-page);
  overflow: hidden;
  flex: 1;
  transition: background-color 0.2s ease;
}

.top-header {
  background-color: var(--color-bg-header);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 16px;
  height: 54px !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.header-left  { display: flex; align-items: center; }
.current-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
.header-right  { display: flex; align-items: center; gap: 12px; }
.stats-pills   { display: flex; gap: 6px; }
.app-version   { font-size: 12px; color: var(--color-text-placeholder); }

.main-content {
  padding: 16px;
  overflow-y: auto;
  /* 移动端底部留出 Tab Bar 的空间 */
  height: calc(100vh - 54px);
  padding-bottom: env(safe-area-inset-bottom, 0);
  transition: background-color 0.2s ease;
}

/* ══════════════════════════════════════════════════════════
   移动端：抽屉侧边栏
══════════════════════════════════════════════════════════ */
:deep(.mobile-drawer .el-drawer__body) { padding: 0; }

.mobile-sidebar {
  background-color: var(--color-bg-sidebar);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mobile-menu-list {
  flex: 1;
  padding: 8px 0;
  overflow-y: auto;
}

.mobile-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 20px;
  font-size: 14px;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 8px;
  margin: 2px 10px;
  transition: background-color 0.15s, color 0.15s;
}

.mobile-menu-item:active,
.mobile-menu-item:hover { background-color: rgba(255, 255, 255, 0.06); }

.mobile-menu-item.active {
  background-color: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

/* ══════════════════════════════════════════════════════════
   移动端：底部 Tab Bar
══════════════════════════════════════════════════════════ */
.mobile-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(56px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background-color: var(--color-bg-header);
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: stretch;
  z-index: 999;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.tab-item .el-icon { font-size: 20px; }
.tab-item.active   { color: var(--color-primary); }

/* 移动端内容区留出底部 Tab Bar 空间 */
@media (max-width: 767px) {
  .main-content {
    height: calc(100vh - 54px - 56px - env(safe-area-inset-bottom, 0px));
    padding: 12px 12px 0;
  }
}

/* ── 路由切换动画 ─────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
