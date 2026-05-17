import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 환경변수 OFFLINE=1 로 빌드하면 자체 실행 가능한 단일 HTML 파일 생성
// 예) cross-env OFFLINE=1 vite build  →  dist/index.html (1개 파일)
const offline = process.env.OFFLINE === '1'

export default defineConfig({
  plugins: [react(), ...(offline ? [viteSingleFile()] : [])],
  base: offline ? './' : '/',
  build: offline
    ? {
        outDir: 'dist-offline',
        assetsInlineLimit: 100_000_000,
        chunkSizeWarningLimit: 100_000_000,
        cssCodeSplit: false,
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : undefined,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    exclude: ['**/node_modules/**', '**/.claude/worktrees/**'],
  },
})
