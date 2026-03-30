<template>
  <div class="page-container">
    <!-- ── 页面头部 ───────────────────────────────────────────── -->
    <div class="page-header">
      <h2 class="page-title">我的笔记</h2>
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
          新建笔记
        </el-button>
      </div>
    </div>

    <!-- ── 筛选栏 ─────────────────────────────────────────────── -->
    <el-card class="filter-card" shadow="never">
      <el-form :model="searchForm" inline class="filter-form">
        <el-form-item>
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索笔记标题或内容..."
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
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="RefreshRight" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- ── 笔记表格 ───────────────────────────────────────────── -->
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

        <!-- 置顶标识 -->
        <el-table-column label="📌" width="44" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.is_pinned" color="#f59e0b"><StarFilled /></el-icon>
          </template>
        </el-table-column>

        <!-- 标题 -->
        <el-table-column label="笔记标题" min-width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click="openDetail(row.id)">
              {{ row.title }}
            </el-button>
          </template>
        </el-table-column>

        <!-- 内容预览 -->
        <el-table-column label="内容预览" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-secondary">{{ row.preview || '（暂无内容）' }}</span>
          </template>
        </el-table-column>

        <!-- 分类 -->
        <el-table-column prop="category" label="分类" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.category }}</el-tag>
          </template>
        </el-table-column>

        <!-- 更新时间 -->
        <el-table-column prop="updated_at" label="最后更新" width="145" align="center">
          <template #default="{ row }">
            <span class="text-secondary text-sm">{{ row.updated_at }}</span>
          </template>
        </el-table-column>

        <!-- 操作 -->
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="Edit" @click="openDialog('edit', row.id)">
              编辑
            </el-button>
            <el-popconfirm
              title="确认删除该笔记？"
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

    <!-- ── 编辑弹窗（新增 / 编辑）────────────────────────────── -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建笔记' : '编辑笔记'"
      width="680px"
      :close-on-click-modal="false"
      destroy-on-close
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="70px"
        status-icon
      >
        <!-- 标题 -->
        <el-form-item label="标题" prop="title">
          <el-input
            v-model="formData.title"
            placeholder="请输入笔记标题"
            maxlength="100"
            show-word-limit
            autofocus
          />
        </el-form-item>

        <el-row :gutter="16">
          <!-- 分类 -->
          <el-col :span="14">
            <el-form-item label="分类" prop="category">
              <el-select
                v-model="formData.category"
                allow-create
                filterable
                style="width: 100%"
                placeholder="选择或输入新分类"
              >
                <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
          <!-- 置顶 -->
          <el-col :span="10">
            <el-form-item label="置顶">
              <el-switch
                v-model="formData.is_pinned"
                :active-value="1"
                :inactive-value="0"
                active-text="置顶"
                inactive-text="普通"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 正文 -->
        <el-form-item label="正文" prop="content">
          <el-input
            v-model="formData.content"
            type="textarea"
            :rows="12"
            placeholder="开始记录你的想法..."
            maxlength="5000"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
            保存笔记
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- ── 查看详情弹窗 ────────────────────────────────────────── -->
    <el-dialog
      v-model="detailVisible"
      :title="detailData.title"
      width="660px"
      destroy-on-close
    >
      <div class="detail-meta">
        <el-tag size="small" type="info" effect="plain">{{ detailData.category }}</el-tag>
        <el-tag v-if="detailData.is_pinned" size="small" type="warning" effect="plain">📌 置顶</el-tag>
        <span class="text-secondary text-sm">更新于 {{ detailData.updated_at }}</span>
      </div>
      <div class="detail-content">{{ detailData.content || '（暂无内容）' }}</div>

      <template #footer>
        <el-button type="primary" @click="openDialog('edit', detailData.id)">
          编辑
        </el-button>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import {
  Plus, Delete, Edit, Search, RefreshRight,
  WarningFilled, StarFilled
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchNoteList, fetchNoteDetail, addNote, editNote,
  removeNote, batchRemoveNotes, fetchNoteCategories
} from '@/api/note'

// ─── 分类 ─────────────────────────────────────────────────────────
const categoryOptions = ref([])
async function loadCategories() {
  try { categoryOptions.value = await fetchNoteCategories() } catch {}
}

// ─── 搜索 ─────────────────────────────────────────────────────────
const searchForm = reactive({ keyword: '', category: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

// ─── 表格 ─────────────────────────────────────────────────────────
const tableData = ref([])
const tableLoading = ref(false)
const selectedIds = ref([])

async function loadData() {
  tableLoading.value = true
  try {
    const res = await fetchNoteList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword,
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
  Object.assign(searchForm, { keyword: '', category: '' })
  pagination.page = 1
  loadData()
}

// ─── 删除 ─────────────────────────────────────────────────────────
async function handleDelete(id) {
  try {
    await removeNote(id)
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
      `确认删除选中的 ${selectedIds.value.length} 条笔记？`,
      '批量删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    await batchRemoveNotes(selectedIds.value)
    ElMessage.success(`已删除 ${selectedIds.value.length} 条`)
    selectedIds.value = []
    pagination.page = 1
    loadData()
  } catch (err) {
    if (err === 'cancel') return
    ElMessage.error('批量删除失败：' + err.message)
  }
}

// ─── 详情弹窗 ─────────────────────────────────────────────────────
const detailVisible = ref(false)
const detailData = ref({})

async function openDetail(id) {
  try {
    detailData.value = await fetchNoteDetail(id)
    detailVisible.value = true
  } catch (err) {
    ElMessage.error('获取详情失败：' + err.message)
  }
}

// ─── 编辑弹窗 ─────────────────────────────────────────────────────
const dialogVisible = ref(false)
const dialogMode = ref('create')
const submitLoading = ref(false)
const formRef = ref(null)

const formData = reactive({
  id: null, title: '', content: '', category: '默认', is_pinned: 0
})

const formRules = {
  title: [
    { required: true, message: '笔记标题不能为空', trigger: 'blur' },
    { max: 100, message: '标题不超过 100 个字符', trigger: 'blur' }
  ]
}

async function openDialog(mode, idOrRow = null) {
  dialogMode.value = mode
  resetForm()

  if (mode === 'edit' && idOrRow) {
    try {
      const id = typeof idOrRow === 'number' ? idOrRow : idOrRow
      const detail = await fetchNoteDetail(id)
      Object.assign(formData, {
        id: detail.id, title: detail.title, content: detail.content,
        category: detail.category, is_pinned: detail.is_pinned
      })
    } catch (err) {
      ElMessage.error('获取笔记数据失败：' + err.message)
      return
    }
  }

  detailVisible.value = false  // 关闭详情弹窗
  dialogVisible.value = true
}

function resetForm() {
  formRef.value?.clearValidate()
  Object.assign(formData, { id: null, title: '', content: '', category: '默认', is_pinned: 0 })
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitLoading.value = true
  try {
    if (dialogMode.value === 'create') {
      await addNote({ ...formData })
      ElMessage.success('笔记已创建')
    } else {
      await editNote({ ...formData })
      ElMessage.success('笔记已保存')
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

.text-secondary { color: #94a3b8; }
.text-sm { font-size: 12px; }

.pagination-wrap {
  display: flex; justify-content: flex-end;
  padding-top: 12px; flex-shrink: 0;
}

.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }

/* 详情弹窗 */
.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.detail-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.8;
  color: #374151;
  font-size: 14px;
  max-height: 450px;
  overflow-y: auto;
  padding: 4px 0;
}
</style>
