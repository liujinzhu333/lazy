/**
 * Vue Router 路由配置 — 个人助手
 * 使用 hash 模式（Electron 文件加载必须使用 hash 模式）
 */

import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/todo'
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: 'todo',
        name: 'Todo',
        component: () => import('@/views/todo/TodoList.vue'),
        meta: { title: '待办任务', icon: 'Checked' }
      },
      {
        path: 'note',
        name: 'Note',
        component: () => import('@/views/note/NoteList.vue'),
        meta: { title: '我的笔记', icon: 'Notebook' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/todo'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.afterEach((to) => {
  document.title = to.meta?.title
    ? `${to.meta.title} — 个人助手`
    : '个人助手'
})

export default router
