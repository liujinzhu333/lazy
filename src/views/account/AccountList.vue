<template>
  <div class="page-container">

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- 锁屏遮罩（金库未解锁时显示）                               -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <div v-if="!isUnlocked" class="vault-lock-screen">
      <div class="vault-lock-card">
        <el-icon class="vault-lock-icon"><Lock /></el-icon>
        <h2 class="vault-lock-title">账号金库已锁定</h2>
        <p class="vault-lock-desc">
          {{ hasMasterPassword ? '输入主密码以解锁并查看账号信息' : '首次使用请先设置主密码' }}
        </p>

        <!-- 首次设置主密码 -->
        <template v-if="!hasMasterPassword">
          <el-form
            ref="setupFormRef"
            :model="setupForm"
            :rules="setupRules"
            label-position="top"
            class="vault-form"
          >
            <el-form-item label="设置主密码" prop="password">
              <el-input
                v-model="setupForm.password"
                type="password"
                placeholder="至少 6 位，建议包含字母和数字"
                show-password
                @keyup.enter="handleSetupMasterPassword"
              />
            </el-form-item>
            <el-form-item label="确认主密码" prop="confirmPassword">
              <el-input
                v-model="setupForm.confirmPassword"
                type="password"
                placeholder="再次输入主密码"
                show-password
                @keyup.enter="handleSetupMasterPassword"
              />
            </el-form-item>
            <!-- 密码强度 -->
            <div v-if="setupForm.password" class="pwd-strength" style="margin-bottom:12px">
              <div
                v-for="(_, i) in 4" :key="i"
                :class="['pwd-bar', { active: setupPwdStrength > i }]"
                :style="{ backgroundColor: setupPwdStrength > i ? setupPwdStrengthColor : undefined }"
              />
              <span class="pwd-strength-label" :style="{ color: setupPwdStrengthColor }">
                {{ setupPwdStrengthLabel }}
              </span>
            </div>
            <el-alert
              type="warning"
              show-icon
              :closable="false"
              style="margin-bottom:16px;text-align:left"
            >
              <template #default>
                <b>主密码无法找回</b>，请务必牢记。忘记主密码将导致所有已保存的账号密码永久无法解密。
              </template>
            </el-alert>
            <el-button
              type="primary"
              style="width:100%"
              size="large"
              :loading="authLoading"
              @click="handleSetupMasterPassword"
            >
              设置主密码并解锁
            </el-button>
          </el-form>
        </template>

        <!-- 输入主密码解锁 -->
        <template v-else>
          <el-form
            ref="unlockFormRef"
            :model="unlockForm"
            :rules="unlockRules"
            label-position="top"
            class="vault-form"
          >
            <el-form-item label="主密码" prop="password">
              <el-input
                v-model="unlockForm.password"
                type="password"
                placeholder="请输入主密码"
                show-password
                autofocus
                @keyup.enter="handleUnlock"
              />
            </el-form-item>
            <el-button
              type="primary"
              style="width:100%"
              size="large"
              :loading="authLoading"
              @click="handleUnlock"
            >
              <el-icon><Unlock /></el-icon>&nbsp;解锁金库
            </el-button>
          </el-form>
        </template>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- 正常内容区（解锁后显示）                                   -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <template v-if="isUnlocked">

      <!-- ── 页面头部 ─────────────────────────────────────────── -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">账号管理</h2>
          <el-tag type="success" size="small" effect="plain" class="security-badge">
            <el-icon style="margin-right:3px"><Unlock /></el-icon>已解锁 · AES-256 加密
          </el-tag>
        </div>
        <div class="header-actions">
          <el-button
            v-if="selectedIds.length"
            type="danger"
            :icon="Delete"
            @click="handleBatchDelete"
          >
            删除所选（{{ selectedIds.length }}）
          </el-button>
          <el-button :icon="Lock" @click="handleLock">锁定</el-button>
          <el-button :icon="Setting" @click="openChangePwdDialog">修改主密码</el-button>
          <el-button type="primary" :icon="Plus" @click="openDialog('create')">
            新增账号
          </el-button>
        </div>
      </div>

      <!-- ── 筛选栏 ───────────────────────────────────────────── -->
      <el-card class="filter-card" shadow="never">
        <el-form :model="searchForm" inline class="filter-form">
          <el-form-item>
            <el-input
              v-model="searchForm.keyword"
              placeholder="搜索平台 / 账号 / 备注..."
              clearable
              :prefix-icon="Search"
              style="width: 260px"
              @keyup.enter="handleSearch"
            />
          </el-form-item>
          <el-form-item label="分类">
            <el-select v-model="searchForm.category" placeholder="全部" clearable style="width: 120px">
              <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>
          <el-form-item label="收藏">
            <el-select v-model="searchForm.is_starred" placeholder="全部" clearable style="width: 90px">
              <el-option label="⭐ 已收藏" :value="1" />
              <el-option label="全部" :value="''" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
            <el-button :icon="RefreshRight" @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- ── 账号表格 ─────────────────────────────────────────── -->
      <el-card class="table-card" shadow="never">
        <el-table
          v-loading="tableLoading"
          :data="tableData"
          stripe
          border
          style="width: 100%"
          @selection-change="(rows) => selectedIds = rows.map(r => r.id)"
        >
          <el-table-column type="selection" width="46" align="center" />

          <!-- 收藏星标 -->
          <el-table-column label="" width="44" align="center">
            <template #default="{ row }">
              <el-icon
                :style="{ color: row.is_starred ? '#f59e0b' : '#cbd5e1', cursor: 'pointer' }"
                @click="handleToggleStar(row)"
              >
                <StarFilled v-if="row.is_starred" />
                <Star v-else />
              </el-icon>
            </template>
          </el-table-column>

          <!-- 平台 -->
          <el-table-column label="平台" min-width="120">
            <template #default="{ row }">
              <div class="platform-cell">
                <span class="platform-avatar" :style="{ backgroundColor: getAvatarColor(row.platform) }">
                  {{ row.platform.charAt(0).toUpperCase() }}
                </span>
                <div class="platform-info">
                  <span class="platform-name">{{ row.platform }}</span>
                  <a
                    v-if="row.url"
                    :href="row.url"
                    class="platform-url"
                    @click.prevent="openUrl(row.url)"
                  >{{ row.url }}</a>
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 账号 -->
          <el-table-column label="账号 / 用户名" min-width="180">
            <template #default="{ row }">
              <div class="copy-cell">
                <span class="copy-text">{{ row.username || '—' }}</span>
                <el-button
                  v-if="row.username"
                  size="small"
                  link
                  :icon="CopyDocument"
                  class="copy-btn"
                  @click="copyText(row.username, '账号')"
                />
              </div>
            </template>
          </el-table-column>

          <!-- 密码（隐藏，按需显示）-->
          <el-table-column label="密码" width="180">
            <template #default="{ row }">
              <div class="copy-cell">
                <span class="copy-text password-mask">
                  {{ visiblePasswords.has(row.id) ? (rowPasswords[row.id] || '加载中...') : '••••••••' }}
                </span>
                <div class="pwd-actions">
                  <el-button
                    size="small"
                    link
                    :icon="visiblePasswords.has(row.id) ? Hide : View"
                    class="copy-btn"
                    @click="togglePassword(row)"
                  />
                  <el-button
                    size="small"
                    link
                    :icon="CopyDocument"
                    class="copy-btn"
                    @click="copyPassword(row)"
                  />
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 分类 -->
          <el-table-column prop="category" label="分类" width="90" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="categoryTagType(row.category)" effect="light">
                {{ row.category }}
              </el-tag>
            </template>
          </el-table-column>

          <!-- 备注 -->
          <el-table-column prop="notes" label="备注" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="text-secondary">{{ row.notes || '—' }}</span>
            </template>
          </el-table-column>

          <!-- 更新时间 -->
          <el-table-column prop="updated_at" label="更新时间" width="145" align="center">
            <template #default="{ row }">
              <span class="text-secondary text-sm">{{ row.updated_at }}</span>
            </template>
          </el-table-column>

          <!-- 操作 -->
          <el-table-column label="操作" width="120" align="center" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" :icon="Edit" @click="openDialog('edit', row.id)">
                编辑
              </el-button>
              <el-popconfirm
                title="确认删除该账号？"
                confirm-button-text="确认"
                cancel-button-text="取消"
                :icon="WarningFilled"
                icon-color="#f56c6c"
                @confirm="handleDelete(row.id)"
              >
                <template #reference>
                  <el-button type="danger" link size="small" :icon="Delete">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[20, 50, 100]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="(s) => { pagination.pageSize = s; pagination.page = 1; loadData() }"
            @current-change="(p) => { pagination.page = p; loadData() }"
          />
        </div>
      </el-card>

      <!-- ── 新增 / 编辑 弹窗 ─────────────────────────────────── -->
      <el-dialog
        v-model="dialogVisible"
        :title="dialogMode === 'create' ? '新增账号' : '编辑账号'"
        width="560px"
        :close-on-click-modal="false"
        destroy-on-close
        @close="resetForm"
      >
        <el-form
          ref="formRef"
          :model="formData"
          :rules="formRules"
          label-width="90px"
          status-icon
        >
          <el-form-item label="平台名称" prop="platform">
            <el-input
              v-model="formData.platform"
              placeholder="如：微信、GitHub、工商银行"
              maxlength="50"
              autofocus
            />
          </el-form-item>

          <el-form-item label="平台网址" prop="url">
            <el-input
              v-model="formData.url"
              placeholder="https://（选填）"
              maxlength="200"
            />
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="分类" prop="category">
                <el-select
                  v-model="formData.category"
                  allow-create
                  filterable
                  style="width: 100%"
                  placeholder="选择或输入"
                >
                  <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="收藏">
                <el-switch
                  v-model="formData.is_starred"
                  :active-value="1"
                  :inactive-value="0"
                  active-text="收藏"
                  inactive-text="普通"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="账号" prop="username">
            <el-input
              v-model="formData.username"
              placeholder="用户名 / 手机号 / 邮箱"
              maxlength="200"
            >
              <template #append>
                <el-button :icon="CopyDocument" @click="copyText(formData.username, '账号')" :disabled="!formData.username" />
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="formData.password"
              :type="showFormPwd ? 'text' : 'password'"
              placeholder="请输入密码"
              maxlength="500"
              autocomplete="new-password"
            >
              <template #append>
                <el-button :icon="showFormPwd ? Hide : View" @click="showFormPwd = !showFormPwd" />
              </template>
            </el-input>
          </el-form-item>

          <el-form-item v-if="formData.password" label=" ">
            <div class="pwd-strength">
              <div
                v-for="(_, i) in 4" :key="i"
                :class="['pwd-bar', { active: pwdStrength > i }]"
                :style="{ backgroundColor: pwdStrength > i ? pwdStrengthColor : undefined }"
              />
              <span class="pwd-strength-label" :style="{ color: pwdStrengthColor }">
                {{ pwdStrengthLabel }}
              </span>
            </div>
          </el-form-item>

          <el-form-item label="备注" prop="notes">
            <el-input
              v-model="formData.notes"
              type="textarea"
              :rows="2"
              placeholder="备注信息（选填）"
              maxlength="200"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <div class="dialog-footer">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
              确认保存
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- ── 修改主密码弹窗 ────────────────────────────────────── -->
      <el-dialog
        v-model="changePwdVisible"
        title="修改主密码"
        width="460px"
        :close-on-click-modal="false"
        destroy-on-close
        @close="resetChangePwd"
      >
        <el-alert
          type="warning"
          show-icon
          :closable="false"
          style="margin-bottom:20px"
        >
          修改主密码时，所有已保存的账号密码将自动使用新密码重新加密。
        </el-alert>
        <el-form
          ref="changePwdFormRef"
          :model="changePwdForm"
          :rules="changePwdRules"
          label-width="100px"
          status-icon
        >
          <el-form-item label="当前主密码" prop="oldPassword">
            <el-input
              v-model="changePwdForm.oldPassword"
              type="password"
              placeholder="请输入当前主密码"
              show-password
            />
          </el-form-item>
          <el-form-item label="新主密码" prop="password">
            <el-input
              v-model="changePwdForm.password"
              type="password"
              placeholder="至少 6 位"
              show-password
            />
          </el-form-item>
          <el-form-item label="确认新密码" prop="confirmPassword">
            <el-input
              v-model="changePwdForm.confirmPassword"
              type="password"
              placeholder="再次输入新主密码"
              show-password
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="changePwdVisible = false">取消</el-button>
            <el-button type="primary" :loading="changePwdLoading" @click="handleChangePwd">
              确认修改
            </el-button>
          </div>
        </template>
      </el-dialog>

    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import {
  Plus, Delete, Edit, Search, RefreshRight, WarningFilled,
  Star, StarFilled, CopyDocument, View, Hide, Lock, Unlock, Setting
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchAccountList, fetchAccountDetail, addAccount, editAccount,
  removeAccount, batchRemoveAccounts, toggleAccountStar, fetchAccountCategories
} from '@/api/account'
import {
  checkHasMasterPassword, checkIsUnlocked,
  setupMasterPassword, unlockVault, lockVault
} from '@/api/auth'

// ─── 主密码 / 解锁状态 ────────────────────────────────────────────
const isUnlocked       = ref(false)
const hasMasterPassword = ref(false)
const authLoading      = ref(false)

// 初始化检查解锁状态
async function initAuthState() {
  hasMasterPassword.value = await checkHasMasterPassword()
  isUnlocked.value        = await checkIsUnlocked()
  if (isUnlocked.value) {
    await loadCategories()
    await loadData()
  }
}

// ── 首次设置主密码 ────────────────────────────────────────────────
const setupFormRef = ref(null)
const setupForm = reactive({ password: '', confirmPassword: '' })

const setupRules = {
  password: [
    { required: true, message: '请输入主密码', trigger: 'blur' },
    { min: 6, message: '主密码不能少于 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入主密码', trigger: 'blur' },
    {
      validator: (_, val, cb) => {
        if (val !== setupForm.password) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur'
    }
  ]
}

// 首次设置密码的强度计算
const setupPwdStrength = computed(() => calcStrength(setupForm.password))
const setupPwdStrengthLabel = computed(() => ['极弱', '弱', '中等', '强', '极强'][setupPwdStrength.value] ?? '')
const setupPwdStrengthColor = computed(() => ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#16a34a'][setupPwdStrength.value] ?? '#ef4444')

async function handleSetupMasterPassword() {
  const valid = await setupFormRef.value?.validate().catch(() => false)
  if (!valid) return
  authLoading.value = true
  try {
    await setupMasterPassword({ password: setupForm.password })
    hasMasterPassword.value = true
    isUnlocked.value = true
    ElMessage.success('主密码设置成功，金库已解锁')
    await loadCategories()
    await loadData()
  } catch (err) {
    ElMessage.error('设置失败：' + err.message)
  } finally {
    authLoading.value = false
  }
}

// ── 解锁 ─────────────────────────────────────────────────────────
const unlockFormRef = ref(null)
const unlockForm = reactive({ password: '' })
const unlockRules = {
  password: [{ required: true, message: '请输入主密码', trigger: 'blur' }]
}

async function handleUnlock() {
  const valid = await unlockFormRef.value?.validate().catch(() => false)
  if (!valid) return
  authLoading.value = true
  try {
    await unlockVault(unlockForm.password)
    isUnlocked.value = true
    unlockForm.password = ''
    ElMessage.success('金库已解锁')
    await loadCategories()
    await loadData()
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    authLoading.value = false
  }
}

// ── 锁定 ─────────────────────────────────────────────────────────
async function handleLock() {
  await lockVault()
  isUnlocked.value = false
  // 清理内存中的密码缓存
  visiblePasswords.value = new Set()
  Object.keys(rowPasswords).forEach(k => delete rowPasswords[k])
  tableData.value = []
  ElMessage.success('金库已锁定')
}

// ── 修改主密码 ───────────────────────────────────────────────────
const changePwdVisible  = ref(false)
const changePwdLoading  = ref(false)
const changePwdFormRef  = ref(null)
const changePwdForm     = reactive({ oldPassword: '', password: '', confirmPassword: '' })

const changePwdRules = {
  oldPassword: [{ required: true, message: '请输入当前主密码', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入新主密码', trigger: 'blur' },
    { min: 6, message: '新主密码不能少于 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新主密码', trigger: 'blur' },
    {
      validator: (_, val, cb) => {
        if (val !== changePwdForm.password) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur'
    }
  ]
}

function openChangePwdDialog() { changePwdVisible.value = true }
function resetChangePwd() {
  changePwdFormRef.value?.clearValidate()
  Object.assign(changePwdForm, { oldPassword: '', password: '', confirmPassword: '' })
}

async function handleChangePwd() {
  const valid = await changePwdFormRef.value?.validate().catch(() => false)
  if (!valid) return
  changePwdLoading.value = true
  try {
    await setupMasterPassword({
      password: changePwdForm.password,
      oldPassword: changePwdForm.oldPassword
    })
    changePwdVisible.value = false
    ElMessage.success('主密码修改成功，所有账号密码已重新加密')
    // 清空密码缓存（旧明文缓存已失效）
    visiblePasswords.value = new Set()
    Object.keys(rowPasswords).forEach(k => delete rowPasswords[k])
  } catch (err) {
    ElMessage.error('修改失败：' + err.message)
  } finally {
    changePwdLoading.value = false
  }
}

// ─── 分类 ─────────────────────────────────────────────────────────
const categoryOptions = ref([])
async function loadCategories() {
  try { categoryOptions.value = await fetchAccountCategories() } catch {}
}

// ─── 搜索 ─────────────────────────────────────────────────────────
const searchForm = reactive({ keyword: '', category: '', is_starred: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

// ─── 表格数据 ─────────────────────────────────────────────────────
const tableData = ref([])
const tableLoading = ref(false)
const selectedIds = ref([])

async function loadData() {
  tableLoading.value = true
  try {
    const res = await fetchAccountList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword,
      category: searchForm.category,
      is_starred: searchForm.is_starred === '' ? undefined : searchForm.is_starred
    })
    tableData.value = res.list
    pagination.total = res.total
    visiblePasswords.value.clear()
  } catch (err) {
    ElMessage.error('加载失败：' + err.message)
  } finally {
    tableLoading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { keyword: '', category: '', is_starred: '' })
  pagination.page = 1; loadData()
}

// ─── 密码显示/隐藏（逐行控制）────────────────────────────────────
const visiblePasswords = ref(new Set())
const rowPasswords = reactive({})

async function togglePassword(row) {
  if (visiblePasswords.value.has(row.id)) {
    visiblePasswords.value.delete(row.id)
    visiblePasswords.value = new Set(visiblePasswords.value)
  } else {
    if (!rowPasswords[row.id]) {
      try {
        const detail = await fetchAccountDetail(row.id)
        rowPasswords[row.id] = detail.password
      } catch (err) {
        ElMessage.error('获取密码失败：' + err.message)
        return
      }
    }
    visiblePasswords.value = new Set([...visiblePasswords.value, row.id])
  }
}

async function copyPassword(row) {
  try {
    let pwd = rowPasswords[row.id]
    if (!pwd) {
      const detail = await fetchAccountDetail(row.id)
      pwd = detail.password
      rowPasswords[row.id] = pwd
    }
    if (!pwd) { ElMessage.warning('该账号未设置密码'); return }
    await navigator.clipboard.writeText(pwd)
    ElMessage.success('密码已复制到剪贴板')
  } catch (err) {
    ElMessage.error('复制失败：' + err.message)
  }
}

// ─── 复制文字 ─────────────────────────────────────────────────────
async function copyText(text, label = '') {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`${label ? label + '已' : ''}复制到剪贴板`)
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

// ─── 标星 ─────────────────────────────────────────────────────────
async function handleToggleStar(row) {
  try {
    const { is_starred } = await toggleAccountStar(row.id)
    row.is_starred = is_starred
  } catch (err) {
    ElMessage.error('操作失败：' + err.message)
  }
}

// ─── 打开外链 ─────────────────────────────────────────────────────
function openUrl(url) {
  if (!url) return
  const a = document.createElement('a')
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click()
}

// ─── 删除 ─────────────────────────────────────────────────────────
async function handleDelete(id) {
  try {
    await removeAccount(id)
    ElMessage.success('删除成功')
    if (tableData.value.length === 1 && pagination.page > 1) pagination.page--
    loadData()
  } catch (err) { ElMessage.error('删除失败：' + err.message) }
}

async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedIds.value.length} 条账号？`,
      '批量删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    await batchRemoveAccounts(selectedIds.value)
    ElMessage.success(`已删除 ${selectedIds.value.length} 条`)
    selectedIds.value = []; pagination.page = 1; loadData()
  } catch (err) {
    if (err === 'cancel') return
    ElMessage.error('批量删除失败：' + err.message)
  }
}

// ─── 弹窗表单 ─────────────────────────────────────────────────────
const dialogVisible = ref(false)
const dialogMode = ref('create')
const submitLoading = ref(false)
const formRef = ref(null)
const showFormPwd = ref(false)

const formData = reactive({
  id: null, platform: '', url: '', username: '',
  password: '', category: '其他', notes: '', is_starred: 0
})

const formRules = {
  platform: [
    { required: true, message: '平台名称不能为空', trigger: 'blur' },
    { max: 50, message: '平台名称不超过 50 个字符', trigger: 'blur' }
  ],
  url: [
    {
      validator: (_, val, cb) => {
        if (!val || !val.trim()) return cb()
        try { new URL(val); cb() } catch { cb(new Error('请输入有效的网址（含 http:// 或 https://）')) }
      },
      trigger: 'blur'
    }
  ]
}

async function openDialog(mode, idParam = null) {
  dialogMode.value = mode
  showFormPwd.value = false
  resetForm()
  if (mode === 'edit' && idParam) {
    try {
      const detail = await fetchAccountDetail(idParam)
      Object.assign(formData, {
        id: detail.id, platform: detail.platform, url: detail.url,
        username: detail.username, password: detail.password,
        category: detail.category, notes: detail.notes, is_starred: detail.is_starred
      })
    } catch (err) {
      ElMessage.error('获取账号数据失败：' + err.message); return
    }
  }
  dialogVisible.value = true
}

function resetForm() {
  formRef.value?.clearValidate()
  Object.assign(formData, {
    id: null, platform: '', url: '', username: '',
    password: '', category: '其他', notes: '', is_starred: 0
  })
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitLoading.value = true
  try {
    if (dialogMode.value === 'create') {
      await addAccount({ ...formData })
      ElMessage.success('账号已添加')
    } else {
      await editAccount({ ...formData })
      ElMessage.success('账号已更新')
    }
    dialogVisible.value = false
    loadData(); loadCategories()
  } catch (err) {
    ElMessage.error('操作失败：' + err.message)
  } finally {
    submitLoading.value = false
  }
}

// ─── 密码强度计算 ─────────────────────────────────────────────────
function calcStrength(pwd) {
  if (!pwd) return 0
  let score = 0
  if (pwd.length >= 8)  score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++
  return score
}

const pwdStrength      = computed(() => calcStrength(formData.password))
const pwdStrengthLabel = computed(() => ['极弱', '弱', '中等', '强', '极强'][pwdStrength.value] ?? '')
const pwdStrengthColor = computed(() => ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#16a34a'][pwdStrength.value] ?? '#ef4444')

// ─── 工具函数 ─────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#06b6d4', '#f97316'
]
function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const CATEGORY_TYPE_MAP = {
  '社交': '', '工作': 'primary', '金融': 'danger',
  '购物': 'warning', '娱乐': 'success', '学习': 'info'
}
function categoryTagType(cat) { return CATEGORY_TYPE_MAP[cat] ?? 'info' }

// ─── 初始化 ───────────────────────────────────────────────────────
onMounted(initAuthState)
</script>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 14px; height: 100%; }

/* ══════════════════════════════════════════════════ */
/* 锁屏遮罩                                          */
/* ══════════════════════════════════════════════════ */
.vault-lock-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vault-lock-card {
  width: 420px;
  padding: 48px 40px 40px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.vault-lock-icon {
  font-size: 56px;
  color: var(--color-primary);
  margin-bottom: 16px;
  display: block;
}

.vault-lock-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.vault-lock-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 28px;
  line-height: 1.5;
}

.vault-form {
  text-align: left;
}

/* ══════════════════════════════════════════════════ */
/* 正常内容区                                        */
/* ══════════════════════════════════════════════════ */

/* ── 页头 ─────────────────────────────────────────────────── */
.page-header { display: flex; align-items: center; justify-content: space-between; }
.header-left { display: flex; align-items: center; gap: 10px; }
.page-title  { font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
.security-badge { font-size: 11px; }
.header-actions { display: flex; gap: 10px; }

/* ── 筛选栏 ───────────────────────────────────────────────── */
.filter-card :deep(.el-card__body) { padding: 14px 16px 0; }
.filter-form { display: flex; flex-wrap: wrap; }

/* ── 表格区域 ─────────────────────────────────────────────── */
.table-card { flex: 1; overflow: hidden; }
.table-card :deep(.el-card__body) {
  padding: 14px; display: flex; flex-direction: column;
  height: 100%; overflow: hidden;
}

/* ── 平台列 ───────────────────────────────────────────────── */
.platform-cell { display: flex; align-items: center; gap: 10px; }
.platform-avatar {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 14px; font-weight: 700; flex-shrink: 0;
}
.platform-info { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
.platform-name { font-weight: 600; color: var(--color-text-primary); font-size: 13px; }
.platform-url {
  font-size: 11px; color: var(--color-primary); cursor: pointer;
  text-decoration: none; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; max-width: 120px;
}
.platform-url:hover { text-decoration: underline; }

/* ── 账号 / 密码列 ────────────────────────────────────────── */
.copy-cell { display: flex; align-items: center; gap: 4px; }
.copy-text {
  flex: 1; font-size: 13px; color: var(--color-text-regular);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.password-mask { font-family: 'SF Mono', Consolas, monospace; letter-spacing: 1px; }
.copy-btn { flex-shrink: 0; opacity: 0.5; transition: opacity 0.15s; }
.copy-btn:hover { opacity: 1; }
.pwd-actions { display: flex; gap: 0; flex-shrink: 0; }

/* ── 辅助 ─────────────────────────────────────────────────── */
.text-secondary { color: var(--color-text-secondary); }
.text-sm { font-size: 12px; }
.pagination-wrap { display: flex; justify-content: flex-end; padding-top: 12px; flex-shrink: 0; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }

/* ── 密码强度条 ───────────────────────────────────────────── */
.pwd-strength { display: flex; align-items: center; gap: 6px; }
.pwd-bar {
  height: 4px; flex: 1; background-color: var(--color-border);
  border-radius: 2px; transition: background-color 0.3s;
}
.pwd-strength-label { font-size: 12px; font-weight: 600; min-width: 30px; flex-shrink: 0; }
</style>
