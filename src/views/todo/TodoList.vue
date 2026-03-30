<template>
  <div class="page-container">
    <!-- ── 页面头部 ───────────────────────────────────────────── -->
    <div class="page-header">
      <h2 class="page-title">待办任务</h2>
      <div class="header-actions">
        <el-button
          v-if="selectedIds.length"
          type="danger"
          :icon="Delete"
          @click="handleBatchDelete"
        >
          删除所选（{{ selectedIds.length }}）
        </el-button>
        <el-button type="primary" :icon="Plus" @click="openDialog('create')">
          新建任务
        </el-button>
      </div>
    </div>

    <!-- ── 筛选栏 ─────────────────────────────────────────────── -->
    <el-card class="filter-card" shadow="never">
      <el-form :model="searchForm" inline class="filter-form">
        <el-form-item>
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索任务标题或描述..."
            clearable
            :prefix-icon="Search"
            style="width: 240px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>

        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 110px">
            <el-option label="待办" :value="0" />
            <el-option label="进行中" :value="1" />
            <el-option label="已完成" :value="2" />
          </el-select>
        </el-form-item>

        <el-form-item label="优先级">
          <el-select v-model="searchForm.priority" placeholder="全部" clearable style="width: 110px">
            <el-option label="高" :value="1" />
            <el-option label="中" :value="2" />
            <el-option label="低" :value="3" />
          </el-select>
        </el-form-item>

        <el-form-item label="分类">
          <el-select v-model="searchForm.category" placeholder="全部" clearable style="width: 110px">
            <el-option
              v-for="c in categoryOptions"
              :key="c"
              :label="c"
              :value="c"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="RefreshRight" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- ── 任务表格 ───────────────────────────────────────────── -->
    <el-card class="table-card" shadow="never">
      <el-table
        v-loading="tableLoading"
        :data="tableData"
        stripe
        border
        style="width: 100%"
        @selection-change="handleSelectionChange"
        :row-class-name="getRowClass"
      >
        <el-table-column type="selection" width="46" align="center" />

        <!-- 优先级标识条 -->
        <el-table-column label="" width="6" align="center">
          <template #default="{ row }">
            <div :class="['priority-bar', priorityClass(row.priority)]" />
          </template>
        </el-table-column>

        <!-- 状态切换按钮 -->
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tooltip :content="statusToggleTip(row.status)" placement="top">
              <el-tag
                :type="statusType(row.status)"
                class="status-tag"
                style="cursor:pointer"
                @click="handleToggleStatus(row)"
              >
                {{ statusLabel(row.status) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>

        <!-- 优先级 -->
        <el-table-column label="优先级" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="priorityType(row.priority)" size="small" effect="light">
              {{ priorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 任务标题 -->
        <el-table-column label="任务标题" min-width="200">
          <template #default="{ row }">
            <span :class="{ 'text-done': row.status === 2 }">{{ row.title }}</span>
          </template>
        </el-table-column>

        <!-- 描述 -->
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-secondary">{{ row.description || '—' }}</span>
          </template>
        </el-table-column>

        <!-- 分类 -->
        <el-table-column prop="category" label="分类" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.category }}</el-tag>
          </template>
        </el-table-column>

        <!-- 截止日期 -->
        <el-table-column prop="due_date" label="截止日期" width="110" align="center">
          <template #default="{ row }">
            <span :class="{ 'text-overdue': isOverdue(row) }">
              {{ row.due_date || '—' }}
            </span>
          </template>
        </el-table-column>

        <!-- 创建时间 -->
        <el-table-column prop="created_at" label="创建时间" width="145" align="center">
          <template #default="{ row }">
            <span class="text-secondary text-sm">{{ row.created_at }}</span>
          </template>
        </el-table-column>

        <!-- 操作 -->
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="Edit" @click="openDialog('edit', row)">
              编辑
            </el-button>
            <el-popconfirm
              title="确认删除该任务？"
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
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="(s) => { pagination.pageSize = s; pagination.page = 1; loadData() }"
          @current-change="(p) => { pagination.page = p; loadData() }"
        />
      </div>
    </el-card>

    <!-- ── 新增 / 编辑 弹窗 ───────────────────────────────────── -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建任务' : '编辑任务'"
      width="560px"
      :close-on-click-modal="false"
      destroy-on-close
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="80px"
        status-icon
      >
        <!-- 标题 -->
        <el-form-item label="任务标题" prop="title">
          <el-input
            v-model="formData.title"
            placeholder="请输入任务标题"
            maxlength="100"
            show-word-limit
            autofocus
          />
        </el-form-item>

        <!-- 描述 -->
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="任务描述（选填）"
            maxlength="500"
          />
        </el-form-item>

        <el-row :gutter="16">
          <!-- 优先级 -->
          <el-col :span="8">
            <el-form-item label="优先级" prop="priority">
              <el-select v-model="formData.priority" style="width: 100%">
                <el-option label="🔴 高" :value="1" />
                <el-option label="🟡 中" :value="2" />
                <el-option label="🟢 低" :value="3" />
              </el-select>
            </el-form-item>
          </el-col>
          <!-- 状态 -->
          <el-col :span="8">
            <el-form-item label="状态" prop="status">
              <el-select v-model="formData.status" style="width: 100%">
                <el-option label="待办" :value="0" />
                <el-option label="进行中" :value="1" />
                <el-option label="已完成" :value="2" />
              </el-select>
            </el-form-item>
          </el-col>
          <!-- 分类 -->
          <el-col :span="8">
            <el-form-item label="分类" prop="category">
              <el-select
                v-model="formData.category"
                allow-create
                filterable
                style="width: 100%"
                placeholder="选或输入"
              >
                <el-option
                  v-for="c in categoryOptions"
                  :key="c"
                  :label="c"
                  :value="c"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 截止日期 -->
        <el-form-item label="截止日期" prop="due_date">
          <el-date-picker
            v-model="formData.due_date"
            type="date"
            placeholder="选择截止日期（选填）"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import {
  Plus, Delete, Edit, Search, RefreshRight, WarningFilled
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchTodoList, addTodo, editTodo, removeTodo,
  batchRemoveTodos, toggleTodo, fetchTodoCategories
} from '@/api/todo'

// ─── 分类选项 ─────────────────────────────────────────────────────
const categoryOptions = ref([])
async function loadCategories() {
  try { categoryOptions.value = await fetchTodoCategories() } catch {}
}

// ─── 搜索表单 ─────────────────────────────────────────────────────
const searchForm = reactive({ keyword: '', status: '', priority: '', category: '' })

// ─── 分页 ─────────────────────────────────────────────────────────
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

// ─── 表格 ─────────────────────────────────────────────────────────
const tableData = ref([])
const tableLoading = ref(false)

async function loadData() {
  tableLoading.value = true
  try {
    const res = await fetchTodoList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword,
      status:   searchForm.status   === '' ? undefined : searchForm.status,
      priority: searchForm.priority === '' ? undefined : searchForm.priority,
      category: searchForm.category
    })
    tableData.value = res.list
    pagination.total = res.total
  } catch (err) {
    ElMessage.error('加载失败：' + err.message)
  } finally {
    tableLoading.value = false
  }
}

function handleSearch() { pagination.page = 1; loadData() }
function handleReset() {
  Object.assign(searchForm, { keyword: '', status: '', priority: '', category: '' })
  pagination.page = 1
  loadData()
}

// ─── 多选 ─────────────────────────────────────────────────────────
const selectedIds = ref([])
const handleSelectionChange = (rows) => { selectedIds.value = rows.map((r) => r.id) }

// ─── 状态快速切换 ─────────────────────────────────────────────────
async function handleToggleStatus(row) {
  try {
    const { status } = await toggleTodo(row.id)
    row.status = status
    ElMessage.success('状态已更新：' + statusLabel(status))
  } catch (err) {
    ElMessage.error('切换失败：' + err.message)
  }
}

// ─── 删除 ─────────────────────────────────────────────────────────
async function handleDelete(id) {
  try {
    await removeTodo(id)
    ElMessage.success('删除成功')
    if (tableData.value.length === 1 && pagination.page > 1) pagination.page--
    loadData()
  } catch (err) {
    ElMessage.error('删除失败：' + err.message)
  }
}

async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedIds.value.length} 条任务？`,
      '批量删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    await batchRemoveTodos(selectedIds.value)
    ElMessage.success(`已删除 ${selectedIds.value.length} 条`)
    selectedIds.value = []
    pagination.page = 1
    loadData()
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

const formData = reactive({
  id: null, title: '', description: '',
  priority: 2, status: 0, category: '其他', due_date: ''
})

const formRules = {
  title: [
    { required: true, message: '任务标题不能为空', trigger: 'blur' },
    { max: 100, message: '标题不超过 100 个字符', trigger: 'blur' }
  ]
}

function openDialog(mode, row = null) {
  dialogMode.value = mode
  resetForm()
  if (mode === 'edit' && row) {
    Object.assign(formData, {
      id: row.id, title: row.title, description: row.description,
      priority: row.priority, status: row.status,
      category: row.category, due_date: row.due_date
    })
  }
  dialogVisible.value = true
}

function resetForm() {
  formRef.value?.clearValidate()
  Object.assign(formData, {
    id: null, title: '', description: '',
    priority: 2, status: 0, category: '其他', due_date: ''
  })
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitLoading.value = true
  try {
    if (dialogMode.value === 'create') {
      await addTodo({ ...formData })
      ElMessage.success('任务已创建')
    } else {
      await editTodo({ ...formData })
      ElMessage.success('任务已更新')
    }
    dialogVisible.value = false
    loadData()
    loadCategories()
  } catch (err) {
    ElMessage.error('操作失败：' + err.message)
  } finally {
    submitLoading.value = false
  }
}

// ─── 工具函数 ─────────────────────────────────────────────────────
const statusLabel = (s) => ({ 0: '待办', 1: '进行中', 2: '已完成' }[s] ?? '—')
const statusType  = (s) => ({ 0: 'info', 1: 'warning', 2: 'success' }[s] ?? '')
const statusToggleTip = (s) => ({
  0: '点击→进行中', 1: '点击→已完成', 2: '点击→待办'
}[s] ?? '')

const priorityLabel = (p) => ({ 1: '高', 2: '中', 3: '低' }[p] ?? '—')
const priorityType  = (p) => ({ 1: 'danger', 2: 'warning', 3: 'success' }[p] ?? '')
const priorityClass = (p) => ({ 1: 'high', 2: 'mid', 3: 'low' }[p] ?? '')

const getRowClass = ({ row }) => row.status === 2 ? 'row-done' : ''

function isOverdue(row) {
  if (!row.due_date || row.status === 2) return false
  return new Date(row.due_date) < new Date(new Date().toDateString())
}

// ─── 初始化 ───────────────────────────────────────────────────────
onMounted(async () => {
  await loadCategories()
  await loadData()
})
</script>

<style scoped>
.page-container { display: flex; flex-direction: column; gap: 14px; height: 100%; }

.page-header {
  display: flex; align-items: center; justify-content: space-between;
}
.page-title { font-size: 18px; font-weight: 600; color: #1e293b; margin: 0; }
.header-actions { display: flex; gap: 10px; }

.filter-card :deep(.el-card__body) { padding: 14px 16px 0; }
.filter-form { display: flex; flex-wrap: wrap; }

.table-card { flex: 1; overflow: hidden; }
.table-card :deep(.el-card__body) {
  padding: 14px; display: flex; flex-direction: column;
  height: 100%; overflow: hidden;
}

/* 优先级色条 */
.priority-bar { width: 4px; height: 34px; border-radius: 2px; margin: 0 auto; }
.priority-bar.high { background: #ef4444; }
.priority-bar.mid  { background: #f59e0b; }
.priority-bar.low  { background: #22c55e; }

/* 已完成行样式 */
:deep(.row-done td) { opacity: 0.5; }
.text-done { text-decoration: line-through; color: #94a3b8; }

.text-secondary { color: #94a3b8; }
.text-sm { font-size: 12px; }
.text-overdue { color: #ef4444; font-weight: 600; }

.status-tag { user-select: none; }

.pagination-wrap {
  display: flex; justify-content: flex-end;
  padding-top: 12px; flex-shrink: 0;
}

.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }
</style>
