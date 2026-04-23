import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import type { Plugin } from "vite"
import { defineConfig } from "vitest/config"

const UTF8_TEXT_RESPONSE = /^(text\/|application\/(?:javascript|json|xml)|image\/svg\+xml)/i

function needsUtf8Charset(contentType: string) {
  return UTF8_TEXT_RESPONSE.test(contentType) && !/;\s*charset=/i.test(contentType)
}

function appendUtf8Charset(contentType: string) {
  return `${contentType}; charset=utf-8`
}

function applyUtf8CharsetHeaders(): Plugin {
  const patchResponse = (res: any) => {
    const originalWriteHead = res.writeHead.bind(res)

    res.writeHead = (...args: any[]) => {
      const contentType = res.getHeader("Content-Type")
      if (typeof contentType === "string" && needsUtf8Charset(contentType)) {
        res.setHeader("Content-Type", appendUtf8Charset(contentType))
      }

      return originalWriteHead(...args)
    }
  }

  return {
    name: "utf8-charset-headers",
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        patchResponse(res)
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        patchResponse(res)
        next()
      })
    },
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  plugins: [applyUtf8CharsetHeaders(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    open: true,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心
          'vendor-react': ['react', 'react-dom', 'react-router'],
          // 动画库（较重，单独拆出）
          'vendor-motion': ['framer-motion'],
          // 数据层
          'vendor-query': ['@tanstack/react-query'],
          // 表单
          'vendor-form': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // UI 基础组件（Radix）
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-label',
            '@radix-ui/react-separator',
            '@radix-ui/react-avatar',
            '@radix-ui/react-progress',
            '@radix-ui/react-slot',
          ],
          // HTTP + 工具
          'vendor-utils': ['ky', 'date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority', 'sonner'],
          // 状态管理
          'vendor-state': ['zustand'],
        },
      },
    },
  },
})
