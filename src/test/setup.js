import '@testing-library/jest-dom/vitest'

// jsdom does not implement window.confirm — provide a default that auto-accepts.
// Individual tests can override via vi.spyOn(window, 'confirm').mockReturnValue(false).
if (typeof window !== 'undefined') {
  window.confirm = window.confirm || (() => true)
  window.alert = window.alert || (() => {})
  window.print = window.print || (() => {})
}

// crypto.randomUUID is available in jsdom 25+ but verify
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  globalThis.crypto = globalThis.crypto || {}
  globalThis.crypto.randomUUID = () => 'test-uuid-' + Math.random().toString(36).slice(2, 10)
}
