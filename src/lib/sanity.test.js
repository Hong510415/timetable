import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('runs basic assertions', () => {
    expect(1 + 1).toBe(2)
  })

  it('has DOM via jsdom', () => {
    const div = document.createElement('div')
    div.textContent = 'hello'
    expect(div.textContent).toBe('hello')
  })

  it('has crypto.randomUUID', () => {
    expect(typeof crypto.randomUUID()).toBe('string')
  })
})
