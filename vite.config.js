import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'

// 환경변수 OFFLINE=1 로 빌드하면 자체 실행 가능한 단일 HTML 파일 생성
// 예) cross-env OFFLINE=1 vite build  →  dist/index.html (1개 파일)
const offline = process.env.OFFLINE === '1'

// 오프라인 빌드에서는 사용자 매뉴얼 PDF를 HTML 안에 data URI로 내장한다.
// (file:// 에서는 브라우저가 로컬 파일 download 를 차단하므로 사이드카 PDF는 동작하지 않음)
let manualPdfDataUri = ''
if (offline) {
  try {
    const b64 = readFileSync('public/user-manual.pdf').toString('base64')
    manualPdfDataUri = 'data:application/pdf;base64,' + b64
  } catch { /* PDF 없으면 웹 기본 동작으로 폴백 */ }
}

export default defineConfig({
  plugins: [react(), ...(offline ? [viteSingleFile()] : [])],
  base: offline ? './' : '/',
  define: {
    __MANUAL_PDF_DATAURI__: JSON.stringify(manualPdfDataUri),
  },
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
    exclude: ['**/node_modules/**', '**/.claude/worktrees/**', '**/전담시간표_프로그램_이양/**'],
  },
})
