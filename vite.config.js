import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 使用相对路径，兼容 Electron file:// 协议和浏览器 HTTP 访问
  base: './',
  // 开发服务器配置
  server: {
    host: '0.0.0.0',    // 监听所有网卡，局域网手机可直接访问
    port: 5173,
    strictPort: true,
    // 将 /api/* 代理到 Electron 主进程的内置 HTTP 服务
    proxy: {
      '/api': {
        target: 'http://localhost:8899',
        changeOrigin: true
      }
    }
  },
  // 路径别名
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  // 生产构建配置
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 资源内联阈值
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  // 定义全局常量
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
  }
})
