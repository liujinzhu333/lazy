<template>
  <div class="home-wrap">
    <div class="home-card">
      <div class="home-logo">✦</div>
      <h1 class="home-title">欢迎访问</h1>
      <p class="home-sub">个人助手 · 简洁、高效、完全离线</p>

      <!-- 访问地址 -->
      <div class="addr-block">
        <div v-if="loading" class="addr-loading">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>获取地址中…</span>
        </div>

        <template v-else>
          <!-- 开发环境地址（仅开发模式显示） -->
          <template v-if="isDev && devAddresses.length">
            <div class="addr-section-label">
              <el-tag type="warning" size="small" effect="plain">开发环境</el-tag>
              <span>Vite 开发服务器</span>
            </div>
            <div class="addr-list">
              <div
                v-for="item in devAddresses"
                :key="'dev-' + item.address"
                class="addr-item dev"
              >
                <span class="addr-name">{{ item.name }}</span>
                <code class="addr-code" @click="copyAddress(item.url)">{{ item.url }}</code>
                <div class="addr-actions">
                  <el-tooltip content="复制地址" placement="top" :show-after="300">
                    <el-button size="small" :icon="CopyDocument" circle text @click="copyAddress(item.url)" />
                  </el-tooltip>
                  <el-tooltip content="显示二维码" placement="top" :show-after="300">
                    <el-button size="small" :icon="Grid" circle text @click="showQr(item)" />
                  </el-tooltip>
                </div>
              </div>
            </div>
          </template>

          <!-- HTTP 服务地址 -->
          <template v-if="addresses.length">
            <div class="addr-section-label" v-if="isDev">
              <el-tag type="success" size="small" effect="plain">HTTP 服务</el-tag>
              <span>内置服务（端口 {{ httpPort }}）</span>
            </div>
            <div class="addr-list">
              <div
                v-for="item in addresses"
                :key="item.address"
                class="addr-item"
              >
                <span class="addr-name">{{ item.name }}</span>
                <code class="addr-code" @click="copyAddress(item.url)">{{ item.url }}</code>
                <div class="addr-actions">
                  <el-tooltip content="复制地址" placement="top" :show-after="300">
                    <el-button size="small" :icon="CopyDocument" circle text @click="copyAddress(item.url)" />
                  </el-tooltip>
                  <el-tooltip content="显示二维码" placement="top" :show-after="300">
                    <el-button size="small" :icon="Grid" circle text @click="showQr(item)" />
                  </el-tooltip>
                </div>
              </div>
            </div>
          </template>

          <p v-if="!addresses.length && !devAddresses.length" class="addr-empty">未检测到内网地址</p>
        </template>
      </div>
    </div>

    <!-- 二维码弹窗 -->
    <el-dialog
      v-model="qrVisible"
      :title="qrTitle"
      width="300px"
      align-center
      :close-on-click-modal="true"
    >
      <div class="qr-body">
        <canvas ref="qrCanvas" />
        <p class="qr-url">{{ qrUrl }}</p>
        <p class="qr-tip">用手机摄像头扫码即可访问</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Grid, Loading } from '@element-plus/icons-vue'
import QRCode from 'qrcode'

// ─── 环境检测 ────────────────────────────────────────────────────
const isDev = import.meta.env.DEV
const DEV_PORT = 5173   // Vite 开发服务器固定端口

// ─── 地址数据 ────────────────────────────────────────────────────
const loading      = ref(true)
const addresses    = ref([])   // HTTP 服务地址（生产/开发均显示）
const devAddresses = ref([])   // Vite dev server 地址（仅开发模式）
const httpPort     = ref(8899)

onMounted(async () => {
  try {
    const res = await window.appAPI?.getLocalAddresses()
    if (res?.success) {
      const { addresses: list, port } = res.data
      httpPort.value = port
      addresses.value = list.map((item) => ({
        ...item,
        url: `http://${item.address}:${port}`
      }))
      // 开发模式下额外生成 Vite 开发服务器地址
      if (isDev) {
        devAddresses.value = list.map((item) => ({
          ...item,
          url: `http://${item.address}:${DEV_PORT}`
        }))
      }
    }
  } catch {}
  loading.value = false
})

// ─── 复制 ────────────────────────────────────────────────────────
function copyAddress(url) {
  navigator.clipboard.writeText(url)
    .then(() => ElMessage.success('地址已复制'))
    .catch(() => ElMessage.error('复制失败'))
}

// ─── 二维码 ──────────────────────────────────────────────────────
const qrVisible = ref(false)
const qrTitle   = ref('')
const qrUrl     = ref('')
const qrCanvas  = ref(null)

async function showQr(item) {
  qrTitle.value   = `扫码访问 · ${item.name}`
  qrUrl.value     = item.url
  qrVisible.value = true
  await nextTick()
  try {
    await QRCode.toCanvas(qrCanvas.value, item.url, {
      width: 220,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' }
    })
  } catch (err) {
    ElMessage.error('二维码生成失败：' + err.message)
  }
}
</script>

<style scoped>
/* ── 整体居中 ─────────────────────────────────────────────── */
.home-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
}

/* ── 主卡片 ───────────────────────────────────────────────── */
.home-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 48px 56px;
  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  text-align: center;
  transition: background-color 0.2s ease, border-color 0.2s ease;
  min-width: 360px;
  max-width: 520px;
  width: 100%;
}

.home-logo {
  font-size: 52px;
  color: var(--color-primary);
  line-height: 1;
}

.home-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: 4px;
}

.home-sub {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  letter-spacing: 1px;
}

/* ── 地址区块 ─────────────────────────────────────────────── */
.addr-block {
  width: 100%;
  border-top: 1px dashed var(--color-border);
  padding-top: 18px;
  margin-top: 4px;
}

.addr-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.addr-section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
  text-align: left;
}

.addr-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.addr-list:last-child { margin-bottom: 0; }

.addr-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.addr-item.dev {
  border-color: rgba(245, 158, 11, 0.35);
  background: rgba(245, 158, 11, 0.04);
}

.addr-name {
  font-size: 11px;
  color: var(--color-text-secondary);
  min-width: 52px;
  flex-shrink: 0;
  text-align: left;
}

.addr-code {
  flex: 1;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  color: var(--color-primary);
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.addr-code:hover { text-decoration: underline; }

.addr-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.addr-empty {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

/* ── 二维码弹窗 ─────────────────────────────────────────────── */
.qr-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
}

.qr-body canvas {
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  display: block;
}

.qr-url {
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
  margin: 0;
}

.qr-tip {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0;
}

/* ── 移动端适配 ───────────────────────────────────────────── */
@media (max-width: 480px) {
  .home-card {
    min-width: unset;
    padding: 36px 24px;
  }
}
</style>
