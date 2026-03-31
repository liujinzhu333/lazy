<template>
  <div class="page-container">
    <h2 class="page-title">设置</h2>

    <!-- 二维码弹窗 -->
    <el-dialog
      v-model="qrDialogVisible"
      :title="qrDialogTitle"
      width="300px"
      align-center
      class="qr-dialog"
      :close-on-click-modal="true"
    >
      <div class="qr-dialog-body">
        <canvas ref="qrCanvasRef" class="qr-canvas" />
        <p class="qr-url-text">{{ qrDialogUrl }}</p>
        <p class="qr-tip">用手机摄像头扫码即可访问</p>
      </div>
    </el-dialog>

    <div class="settings-layout">
      <!-- ══════════════════════════════════════════════════════
           外观设置
      ══════════════════════════════════════════════════════ -->
      <el-card class="setting-card" shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon class="card-header-icon"><Sunny /></el-icon>
            <span>外观</span>
          </div>
        </template>

        <!-- 主题切换 -->
        <div class="setting-row">
          <div class="setting-label">
            <span class="label-title">主题模式</span>
            <span class="label-desc">选择应用的显示风格</span>
          </div>
          <div class="theme-options">
            <div
              v-for="item in THEMES"
              :key="item.value"
              :class="['theme-card', { active: currentTheme === item.value }]"
              @click="handleThemeChange(item.value)"
            >
              <!-- 主题预览缩略图 -->
              <div :class="['theme-preview', `preview-${item.value}`]">
                <div class="preview-sidebar" />
                <div class="preview-main">
                  <div class="preview-header" />
                  <div class="preview-content">
                    <div class="preview-bar" />
                    <div class="preview-bar short" />
                  </div>
                </div>
              </div>
              <div class="theme-info">
                <span class="theme-icon">{{ item.icon }}</span>
                <span class="theme-label">{{ item.label }}</span>
              </div>
              <!-- 选中勾 -->
              <el-icon v-if="currentTheme === item.value" class="theme-check">
                <CircleCheckFilled />
              </el-icon>
            </div>
          </div>
        </div>
      </el-card>

      <!-- ══════════════════════════════════════════════════════
           数据统计
      ══════════════════════════════════════════════════════ -->
      <el-card class="setting-card" shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon class="card-header-icon"><DataAnalysis /></el-icon>
            <span>数据统计</span>
          </div>
        </template>

        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ stats.todoTotal }}</div>
            <div class="stat-label">待办任务总数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-success">{{ stats.todoDone }}</div>
            <div class="stat-label">已完成任务</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-warning">{{ stats.todoPending }}</div>
            <div class="stat-label">未完成任务</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-primary">{{ stats.noteTotal }}</div>
            <div class="stat-label">笔记总数</div>
          </div>
        </div>
      </el-card>

      <!-- ══════════════════════════════════════════════════════
           应用信息
      ══════════════════════════════════════════════════════ -->
      <el-card class="setting-card" shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon class="card-header-icon"><InfoFilled /></el-icon>
            <span>应用信息</span>
          </div>
        </template>

        <div class="info-list">
          <div class="info-row">
            <span class="info-key">应用名称</span>
            <span class="info-value">个人助手</span>
          </div>
          <el-divider />
          <div class="info-row">
            <span class="info-key">当前版本</span>
            <span class="info-value">
              <el-tag type="primary" size="small">v{{ appVersion }}</el-tag>
            </span>
          </div>
          <el-divider />
          <div class="info-row">
            <span class="info-key">技术栈</span>
            <span class="info-value tech-tags">
              <el-tag size="small" effect="plain">Electron</el-tag>
              <el-tag size="small" effect="plain" type="success">Vue 3</el-tag>
              <el-tag size="small" effect="plain" type="warning">Element Plus</el-tag>
              <el-tag size="small" effect="plain" type="info">SQLite</el-tag>
            </span>
          </div>
          <el-divider />
          <div class="info-row align-start">
            <span class="info-key">数据库路径</span>
            <div class="info-value db-path-wrap">
              <code class="db-path">{{ dbPath || '获取中...' }}</code>
              <el-button
                v-if="dbPath"
                size="small"
                :icon="CopyDocument"
                @click="copyDbPath"
                style="margin-left: 8px; flex-shrink: 0"
              >
                复制
              </el-button>
            </div>
          </div>
          <el-divider />
          <div class="info-row align-start">
            <span class="info-key">内网访问地址</span>
            <div class="info-value" style="flex-direction: column; align-items: flex-end; gap: 8px;">
              <!-- 端口编辑行 -->
              <div class="addr-port-row">
                <span style="font-size:12px;color:var(--color-text-secondary)">服务端口</span>
                <el-input-number
                  v-model="httpPort"
                  :min="1024"
                  :max="65535"
                  :step="1"
                  controls-position="right"
                  size="small"
                  style="width: 120px"
                  @change="handlePortChange"
                />
                <el-tag v-if="portSaved" type="success" size="small" effect="plain">已保存并重启</el-tag>
              </div>
              <!-- 地址列表 -->
              <template v-if="localAddresses.length">
                <div
                  v-for="item in localAddresses"
                  :key="item.address"
                  class="addr-row"
                >
                  <span class="addr-label">{{ item.name }}</span>
                  <code class="addr-code">http://{{ item.address }}:{{ httpPort }}</code>
                  <el-tooltip content="显示二维码" placement="top" :show-after="300">
                    <el-button
                      size="small"
                      :icon="Grid"
                      @click="showQrCode(`http://${item.address}:${httpPort}`, item.name)"
                    />
                  </el-tooltip>
                  <el-button
                    size="small"
                    :icon="CopyDocument"
                    @click="copyAddress(`http://${item.address}:${httpPort}`)"
                  >复制</el-button>
                </div>
              </template>
              <span v-else class="info-value secondary">未检测到内网地址</span>
            </div>
          </div>
          <el-divider />
          <div class="info-row">
            <span class="info-key">运行环境</span>
            <span class="info-value">
              <el-tag :type="isDev ? 'warning' : 'success'" size="small">
                {{ isDev ? '开发环境' : '生产环境' }}
              </el-tag>
            </span>
          </div>
          <el-divider />
          <div class="info-row">
            <span class="info-key">数据存储</span>
            <span class="info-value secondary">100% 本地离线，无网络请求</span>
          </div>
        </div>
      </el-card>

      <!-- ══════════════════════════════════════════════════════
           关于
      ══════════════════════════════════════════════════════ -->
      <el-card class="setting-card" shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon class="card-header-icon"><Star /></el-icon>
            <span>关于</span>
          </div>
        </template>

        <div class="about-content">
          <div class="app-logo">✦</div>
          <p class="app-name">个人助手</p>
          <p class="app-slogan">简洁、高效、完全离线的个人效率工具</p>
          <p class="app-desc">
            管理你的待办任务与笔记，数据存储在本地 SQLite 文件中，
            不依赖任何网络服务，隐私完全由你掌控。
          </p>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import {
  Sunny, DataAnalysis, InfoFilled, Star,
  CircleCheckFilled, CopyDocument, Grid
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useTheme } from '@/composables/useTheme'
import { fetchTodoStats } from '@/api/todo'
import QRCode from 'qrcode'

// ─── 主题 ─────────────────────────────────────────────────────────
const { currentTheme, setTheme, THEMES } = useTheme()

function handleThemeChange(theme) {
  setTheme(theme)
  ElMessage.success(`已切换至${THEMES.find(t => t.value === theme)?.label}模式`)
}

// ─── 应用信息 ─────────────────────────────────────────────────────
const appVersion     = ref('1.0.0')
const dbPath         = ref('')
const isDev          = ref(false)
/** 本机内网 IPv4 地址列表 [{ name: string, address: string }] */
const localAddresses = ref([])
/** 当前 HTTP 服务端口 */
const httpPort       = ref(8899)
/** 端口保存提示 */
const portSaved      = ref(false)

// ─── 二维码弹窗 ────────────────────────────────────────────────
const qrDialogVisible = ref(false)
const qrDialogUrl     = ref('')
const qrDialogTitle   = ref('')
const qrCanvasRef     = ref(null)

async function showQrCode(url, name) {
  qrDialogUrl.value   = url
  qrDialogTitle.value = `扫码访问 · ${name}`
  qrDialogVisible.value = true
  await nextTick()
  try {
    await QRCode.toCanvas(qrCanvasRef.value, url, {
      width: 220,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    })
  } catch (err) {
    ElMessage.error('二维码生成失败：' + err.message)
  }
}

// ─── 数据统计 ─────────────────────────────────────────────────────
const stats = ref({
  todoTotal: 0,
  todoDone: 0,
  todoPending: 0,
  noteTotal: 0
})

async function loadStats() {
  try {
    const todoStats = await fetchTodoStats()
    stats.value.todoTotal  = todoStats.total
    stats.value.todoDone   = todoStats.done
    stats.value.todoPending = todoStats.todo + todoStats.doing
  } catch {}
}

// ─── 复制数据库路径 ───────────────────────────────────────────────
function copyDbPath() {
  if (!dbPath.value) return
  navigator.clipboard.writeText(dbPath.value)
    .then(() => ElMessage.success('路径已复制到剪贴板'))
    .catch(() => ElMessage.error('复制失败'))
}

// ─── 复制内网地址 ────────────────────────────────────────────────
function copyAddress(url) {
  navigator.clipboard.writeText(url)
    .then(() => ElMessage.success('地址已复制到剪贴板'))
    .catch(() => ElMessage.error('复制失败'))
}

// ─── 修改 HTTP 服务端口 ──────────────────────────────────────────
let portSaveTimer = null
async function handlePortChange(val) {
  if (!val || val < 1024 || val > 65535) return
  clearTimeout(portSaveTimer)
  portSaveTimer = setTimeout(async () => {
    try {
      const res = await window.appAPI?.setHttpPort(val)
      if (res?.success) {
        portSaved.value = true
        setTimeout(() => { portSaved.value = false }, 3000)
      } else {
        ElMessage.error(res?.message || '端口设置失败')
      }
    } catch (err) {
      ElMessage.error('端口设置失败：' + err.message)
    }
  }, 600)
}

// ─── 初始化 ───────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const vRes = await window.appAPI?.getVersion()
    if (vRes?.success) appVersion.value = vRes.data

    const dRes = await window.appAPI?.getDbPath()
    if (dRes?.success) dbPath.value = dRes.data

    // 判断是否开发环境（开发库路径含 dev-data）
    isDev.value = dbPath.value.includes('dev-data')

    // 获取本机内网 IP 和 HTTP 端口
    const aRes = await window.appAPI?.getLocalAddresses()
    if (aRes?.success) {
      localAddresses.value = aRes.data.addresses
      httpPort.value        = aRes.data.port
    }
  } catch {}

  await loadStats()
})
</script>

<style scoped>
/* ── 页面容器 ─────────────────────────────────────────────── */
.page-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 10px;
}

/* ── 卡片布局 ─────────────────────────────────────────────── */
.settings-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-card :deep(.el-card__header) {
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border);
}

.setting-card :deep(.el-card__body) {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.card-header-icon {
  color: var(--color-primary);
  font-size: 16px;
}

/* ── 设置行 ───────────────────────────────────────────────── */
.setting-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 100px;
}

.label-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.label-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* ── 主题卡片选择器 ───────────────────────────────────────── */
.theme-options {
  display: flex;
  gap: 14px;
  flex: 1;
  justify-content: flex-end;
}

.theme-card {
  position: relative;
  width: 100px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
  background-color: var(--color-bg-page);
}

.theme-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.theme-card.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

/* 主题预览缩略图 */
.theme-preview {
  display: flex;
  height: 52px;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 8px;
  border: 1px solid var(--color-border);
}

/* 浅色预览 */
.preview-light .preview-sidebar { background: #1e293b; width: 22%; }
.preview-light .preview-main    { flex: 1; background: #f1f5f9; }
.preview-light .preview-header  { height: 30%; background: #ffffff; border-bottom: 1px solid #e2e8f0; }
.preview-light .preview-content { padding: 4px 5px; display: flex; flex-direction: column; gap: 3px; }
.preview-light .preview-bar     { height: 5px; background: #e2e8f0; border-radius: 2px; }
.preview-light .preview-bar.short { width: 65%; }

/* 深色预览 */
.preview-dark .preview-sidebar { background: #0f172a; width: 22%; }
.preview-dark .preview-main    { flex: 1; background: #0f172a; }
.preview-dark .preview-header  { height: 30%; background: #1e293b; border-bottom: 1px solid #334155; }
.preview-dark .preview-content { padding: 4px 5px; display: flex; flex-direction: column; gap: 3px; }
.preview-dark .preview-bar     { height: 5px; background: #334155; border-radius: 2px; }
.preview-dark .preview-bar.short { width: 65%; }

/* 跟随系统预览：左半浅色右半深色 */
.preview-system {
  position: relative;
  overflow: hidden;
}
.preview-system .preview-sidebar {
  width: 22%;
  background: linear-gradient(to bottom, #1e293b 50%, #0f172a 50%);
}
.preview-system .preview-main { flex: 1; background: linear-gradient(to right, #f1f5f9 50%, #0f172a 50%); }
.preview-system .preview-header {
  height: 30%;
  background: linear-gradient(to right, #ffffff 50%, #1e293b 50%);
  border-bottom: 1px solid #e2e8f0;
}
.preview-system .preview-content { padding: 4px 5px; display: flex; flex-direction: column; gap: 3px; }
.preview-system .preview-bar     { height: 5px; background: linear-gradient(to right, #e2e8f0 50%, #334155 50%); border-radius: 2px; }
.preview-system .preview-bar.short { width: 65%; }

.theme-info {
  display: flex;
  align-items: center;
  gap: 5px;
  justify-content: center;
}

.theme-icon { font-size: 13px; }
.theme-label { font-size: 12px; color: var(--color-text-regular); font-weight: 500; }

.theme-check {
  position: absolute;
  top: 6px;
  right: 6px;
  color: var(--color-primary);
  font-size: 16px;
}

/* ── 数据统计网格 ─────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
  padding: 16px 8px;
  background-color: var(--color-bg-page);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 6px;
}

.text-success { color: #22c55e; }
.text-warning { color: #f59e0b; }
.text-primary { color: var(--color-primary); }

/* ── 信息列表 ─────────────────────────────────────────────── */
.info-list { display: flex; flex-direction: column; }

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
}

.info-row.align-start { align-items: flex-start; padding: 4px 0; }

.info-key {
  font-size: 13px;
  color: var(--color-text-secondary);
  min-width: 90px;
  flex-shrink: 0;
}

.info-value {
  font-size: 13px;
  color: var(--color-text-primary);
  text-align: right;
  display: flex;
  align-items: center;
  gap: 6px;
}

.info-value.secondary { color: var(--color-text-secondary); }

.tech-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.db-path-wrap {
  display: flex;
  align-items: flex-start;
  gap: 0;
  flex: 1;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.db-path {
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-bg-page);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  word-break: break-all;
  text-align: left;
  max-width: 340px;
  line-height: 1.6;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

/* ── 内网地址行 ───────────────────────────────────────────────── */
.addr-port-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 4px;
  border-bottom: 1px dashed var(--color-border);
  width: 100%;
  justify-content: flex-end;
}

.addr-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.addr-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  min-width: 60px;
  text-align: right;
  flex-shrink: 0;
}

.addr-code {
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  color: var(--color-primary);
  background: var(--color-bg-page);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  letter-spacing: 0.5px;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

/* ── 关于区块 ─────────────────────────────────────────────── */
.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0 4px;
  text-align: center;
  gap: 8px;
}

.app-logo {
  font-size: 40px;
  color: var(--color-primary);
  line-height: 1;
}

.app-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.app-slogan {
  font-size: 13px;
  color: var(--color-primary);
  font-weight: 500;
}

.app-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  max-width: 460px;
  line-height: 1.7;
}

/* ── 二维码弹窗 ─────────────────────────────────────────────── */
:global(.qr-dialog .el-dialog__body) {
  padding: 0 24px 24px !important;
}

.qr-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr-canvas {
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  display: block;
}

.qr-url-text {
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  color: var(--color-primary);
  background: var(--color-bg-page);
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  word-break: break-all;
  text-align: center;
  max-width: 240px;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.qr-tip {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
