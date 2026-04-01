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
           静态 Web 导出
      ══════════════════════════════════════════════════════ -->
      <el-card class="setting-card" shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon class="card-header-icon"><Monitor /></el-icon>
            <span>静态 Web 导出</span>
            <el-tag size="small" type="warning" effect="plain" style="margin-left:8px">只读快照</el-tag>
          </div>
        </template>

        <div class="info-list">
          <!-- 输出目录 -->
          <div class="info-row align-start">
            <span class="info-key" style="padding-top:6px">输出目录</span>
            <div class="backup-path-wrap">
              <el-input
                v-model="staticOutputDir"
                placeholder="点击右侧按钮选择目录"
                size="small"
                readonly
                style="flex:1"
              />
              <el-button size="small" @click="pickOutputDir">选择目录</el-button>
            </div>
          </div>
          <el-divider />

          <!-- 构建选项 -->
          <div class="info-row">
            <span class="info-key">重新构建</span>
            <div style="display:flex;align-items:center;gap:10px">
              <el-switch v-model="buildFirst" />
              <span style="font-size:12px;color:var(--color-text-secondary)">
                {{ buildFirst ? '导出前先执行 vite build（首次或代码有改动时开启）' : '使用现有 dist/ 目录' }}
              </span>
            </div>
          </div>
          <el-divider />

          <!-- 导出按钮 -->
          <div class="info-row">
            <span class="info-key">立即导出</span>
            <el-button
              type="primary"
              size="small"
              :loading="exportLoading"
              :disabled="!staticOutputDir"
              @click="doExportStatic"
            >
              <el-icon v-if="!exportLoading"><Monitor /></el-icon>
              {{ exportLoading ? '导出中…' : '导出静态网站' }}
            </el-button>
          </div>

          <!-- 导出日志 -->
          <template v-if="exportLogs.length">
            <el-divider />
            <div class="backup-log">
              <p
                v-for="(line, i) in exportLogs"
                :key="i"
                :class="line.startsWith('✗') ? 'log-err' : line.startsWith('ℹ') ? 'log-info' : ''"
              >{{ line }}</p>
            </div>
          </template>
        </div>

        <!-- 说明 -->
        <div class="backup-steps" style="margin-top:16px">
          <div class="step">
            <span class="step-num">1</span>
            <span>选择一个空目录作为输出位置（导出后可直接拖到 Nginx / GitHub Pages）</span>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <span>点击"导出静态网站"，应用自动打包 Vue 项目并将所有数据嵌入 <code>app-data.js</code></span>
          </div>
          <div class="step">
            <span class="step-num">3</span>
            <span>用浏览器打开输出目录中的 <code>index.html</code> 即可离线查看（账号密码不在导出范围内）</span>
          </div>
        </div>
      </el-card>

      <!-- ══════════════════════════════════════════════════════
           Git 数据备份
      ══════════════════════════════════════════════════════ -->
      <el-card class="setting-card" shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon class="card-header-icon"><Upload /></el-icon>
            <span>Git 数据备份</span>
          </div>
        </template>

        <div class="info-list">
          <!-- 本地目录（固定，只读展示） -->
          <div class="info-row align-start">
            <span class="info-key" style="padding-top:6px">本地目录</span>
            <div style="display:flex;align-items:flex-start;gap:6px;justify-content:flex-end;flex:1">
              <code class="addr-code" style="font-size:11px;word-break:break-all;text-align:left;max-width:340px">
                {{ backupPath || '加载中…' }}
              </code>
              <el-button
                v-if="backupPath"
                size="small"
                :icon="CopyDocument"
                @click="copyText(backupPath, '目录路径')"
              >复制</el-button>
            </div>
          </div>
          <el-divider />

          <!-- 远程仓库（固定，只读展示） -->
          <div class="info-row align-start">
            <span class="info-key" style="padding-top:6px">远程仓库</span>
            <div style="display:flex;align-items:flex-start;gap:6px;justify-content:flex-end;flex:1">
              <code class="addr-code" style="font-size:11px;word-break:break-all;text-align:left;max-width:340px">
                {{ BACKUP_REMOTE_URL }}
              </code>
              <el-button
                size="small"
                :icon="CopyDocument"
                @click="copyText(BACKUP_REMOTE_URL, '仓库地址')"
              >复制</el-button>
            </div>
          </div>
          <el-divider />

          <!-- 操作按钮行 -->
          <div class="info-row">
            <span class="info-key">操作</span>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
              <!-- 初始化仓库 -->
              <el-tooltip
                content="自动创建目录、git init、git remote add，无需手动执行命令"
                placement="top"
                :show-after="400"
              >
                <el-button
                  size="small"
                  :loading="initLoading"
                  @click="doInitRepo"
                >
                  {{ initLoading ? '初始化中…' : '初始化仓库' }}
                </el-button>
              </el-tooltip>

              <!-- 获取备份 -->
              <el-tooltip
                content="从远程仓库拉取最新备份，与本地数据按修改时间合并"
                placement="top"
                :show-after="400"
              >
                <el-button
                  size="small"
                  type="success"
                  :loading="restoreLoading"
                  :disabled="!repoReady"
                  @click="doRestoreBackup"
                >
                  <el-icon v-if="!restoreLoading"><Download /></el-icon>
                  {{ restoreLoading ? '获取中…' : '获取备份' }}
                </el-button>
              </el-tooltip>

              <!-- 立即备份 -->
              <el-button
                size="small"
                type="primary"
                :loading="backupLoading"
                :disabled="!repoReady"
                @click="doGitBackup"
              >
                <el-icon v-if="!backupLoading"><Upload /></el-icon>
                {{ backupLoading ? '备份中…' : '备份到 Git' }}
              </el-button>
            </div>
          </div>

          <!-- 上次备份 -->
          <template v-if="lastBackupTime">
            <el-divider />
            <div class="info-row">
              <span class="info-key">上次备份</span>
              <span class="info-value secondary">{{ lastBackupText }}</span>
            </div>
          </template>

          <!-- 备份日志 -->
          <template v-if="backupLogs.length">
            <el-divider />
            <div class="backup-log">
              <p
                v-for="(line, i) in backupLogs"
                :key="i"
                :class="line.startsWith('✗') ? 'log-err' : line.startsWith('ℹ') ? 'log-info' : ''"
              >{{ line }}</p>
            </div>
          </template>
        </div>

        <!-- 步骤提示 -->
        <div class="backup-steps">
          <div class="step" :class="{ done: repoReady }">
            <span class="step-num">1</span>
            <span>点击"初始化仓库"，应用自动完成 git init + remote + 首次 push</span>
          </div>
          <div class="step" :class="{ done: !!lastBackupTime }">
            <span class="step-num">2</span>
            <span>点击"备份到 Git"，数据库将自动 commit &amp; push 到远程仓库</span>
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
          <a
            class="github-link"
            href="https://github.com/liujinzhu333/lazy"
            target="_blank"
            @click.prevent="openGithub"
          >
            <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>查看 GitHub 仓库</span>
            <el-icon class="link-arrow"><TopRight /></el-icon>
          </a>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import {
  Sunny, DataAnalysis, InfoFilled, Star,
  CircleCheckFilled, CopyDocument, Grid, TopRight, Upload, Download, Monitor
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useTheme } from '@/composables/useTheme'
import { fetchTodoStats } from '@/api/todo'
import QRCode from 'qrcode'

// ─── Git 备份 ────────────────────────────────────────────────────
const BACKUP_REMOTE_URL = 'https://github.com/liujinzhu333/lazy-data.git'

const backupPath     = ref('')
const initLoading    = ref(false)
const backupLoading  = ref(false)
const restoreLoading = ref(false)
const lastBackupTime = ref('')   // ISO 字符串
const backupLogs     = ref([])
const repoReady      = ref(false) // 仓库已初始化可备份

const lastBackupText = computed(() => {
  if (!lastBackupTime.value) return '从未备份'
  return new Date(lastBackupTime.value).toLocaleString('zh-CN', { hour12: false })
})

/** 一键初始化：创建目录 + git init + git remote add + 首次 push */
async function doInitRepo() {
  initLoading.value = true
  backupLogs.value  = []
  try {
    const res = await window.appAPI?.initBackupRepo()
    backupLogs.value = res?.data?.logs || []
    if (res?.success) {
      repoReady.value = true
      ElMessage.success('仓库初始化成功，可以开始备份了')
    } else {
      ElMessage.error(res?.message || '初始化失败')
    }
  } catch (err) {
    backupLogs.value = [`✗ ${err.message}`]
    ElMessage.error(err.message)
  } finally {
    initLoading.value = false
  }
}

async function doGitBackup() {
  backupLoading.value = true
  backupLogs.value = []
  try {
    const res = await window.appAPI?.gitBackup()
    backupLogs.value = res?.data?.logs || []
    if (res?.success) {
      lastBackupTime.value = new Date().toISOString()
      ElMessage.success('备份成功')
    } else {
      ElMessage.error(res?.message || '备份失败')
    }
  } catch (err) {
    backupLogs.value = [`✗ ${err.message}`]
    ElMessage.error(err.message)
  } finally {
    backupLoading.value = false
  }
}

/** 从远程拉取最新备份并与本地数据合并 */
async function doRestoreBackup() {
  restoreLoading.value = true
  backupLogs.value = []
  try {
    const res = await window.appAPI?.restoreBackup()
    backupLogs.value = res?.data?.logs || []
    if (res?.success) {
      ElMessage.success('获取备份成功，数据已合并到本地')
    } else {
      ElMessage.error(res?.message || '获取备份失败')
    }
  } catch (err) {
    backupLogs.value = [`✗ ${err.message}`]
    ElMessage.error(err.message)
  } finally {
    restoreLoading.value = false
  }
}

// ─── 静态 Web 导出 ────────────────────────────────────────────────
const staticOutputDir = ref('')
const buildFirst      = ref(false)
const exportLoading   = ref(false)
const exportLogs      = ref([])

async function pickOutputDir() {
  const res = await window.appAPI?.showFolderPicker()
  if (res?.success && res.data?.path) {
    staticOutputDir.value = res.data.path
    exportLogs.value = []
  }
}

async function doExportStatic() {
  if (!staticOutputDir.value) return ElMessage.warning('请先选择输出目录')
  exportLoading.value = true
  exportLogs.value    = []
  try {
    const res = await window.appAPI?.exportStatic({
      outputDir:  staticOutputDir.value,
      buildFirst: buildFirst.value
    })
    exportLogs.value = res?.data?.logs || []
    if (res?.success) {
      ElMessage.success('静态网站导出成功！')
    } else {
      ElMessage.error(res?.message || '导出失败')
    }
  } catch (err) {
    exportLogs.value = [`✗ ${err.message}`]
    ElMessage.error(err.message)
  } finally {
    exportLoading.value = false
  }
}

// ─── GitHub 仓库链接 ──────────────────────────────────────────────
const GITHUB_URL = 'https://github.com/liujinzhu333/lazy'

function openGithub() {
  // Electron 环境：用系统浏览器打开；浏览器环境：直接跳转
  if (window.electronAPI) {
    window.electronAPI.openExternal?.(GITHUB_URL)
  } else {
    window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')
  }
}

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

// ─── 通用复制 ────────────────────────────────────────────────────
function copyText(text, label = '内容') {
  navigator.clipboard.writeText(text)
    .then(() => ElMessage.success(`${label}已复制到剪贴板`))
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

    // 获取 Git 备份配置
    const bRes = await window.appAPI?.getBackupConfig()
    if (bRes?.success) {
      backupPath.value     = bRes.data.repoPath
      lastBackupTime.value = bRes.data.lastBackup
      repoReady.value      = bRes.data.initialized
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

/* ── Git 备份 ────────────────────────────────────────────────── */
.backup-path-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.backup-log {
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.9;
  color: var(--color-text-secondary);
  max-height: 180px;
  overflow-y: auto;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.backup-log .log-err  { color: #ef4444; }
.backup-log .log-info { color: var(--color-text-placeholder); }

/* ── 步骤引导 ───────────────────────────────────────────────── */
.backup-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
  padding: 14px 16px;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-border);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.step.done .step-num {
  background: var(--color-primary);
  color: #fff;
}

.step.done {
  color: var(--color-text-primary);
}

/* ── GitHub 链接 ─────────────────────────────────────────────── */
.github-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-page);
  color: var(--color-text-secondary);
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background-color 0.2s;
  user-select: none;
}

.github-link:hover {
  color: var(--color-text-primary);
  border-color: var(--color-text-secondary);
  background: var(--color-bg-hover);
}

.github-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.link-arrow {
  font-size: 12px;
  opacity: 0.6;
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
