import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initialState, loadFromStorage } from './storage'

const STORAGE_KEY = 'timetable_app_data'

describe('initialState.subjectPlans', () => {
  it('contains 3 plans named A안, B안, C안 with empty subjects', () => {
    expect(initialState.subjectPlans).toBeDefined()
    expect(initialState.subjectPlans.plans).toHaveLength(3)
    expect(initialState.subjectPlans.plans[0]).toEqual({ id: 'plan1', name: 'A안', subjects: [], visible: false })
    expect(initialState.subjectPlans.plans[1]).toEqual({ id: 'plan2', name: 'B안', subjects: [], visible: false })
    expect(initialState.subjectPlans.plans[2]).toEqual({ id: 'plan3', name: 'C안', subjects: [], visible: false })
  })

  it('starts with activeTabId=plan1, appliedPlanId=null, appliedAt=null', () => {
    expect(initialState.subjectPlans.activeTabId).toBe('plan1')
    expect(initialState.subjectPlans.appliedPlanId).toBeNull()
    expect(initialState.subjectPlans.appliedAt).toBeNull()
  })
})

describe('loadFromStorage migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('returns initialState when storage is empty', () => {
    const loaded = loadFromStorage()
    expect(loaded.subjects).toEqual([])
    expect(loaded.subjectPlans.appliedPlanId).toBeNull()
  })

  it('does not overwrite existing subjectPlans', () => {
    const stored = {
      subjects: [],
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [{ id: 'x', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan2',
        appliedPlanId: 'plan1',
        appliedAt: '2026-05-07T10:00:00.000Z',
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    const loaded = loadFromStorage()
    expect(loaded.subjectPlans.activeTabId).toBe('plan2')
    expect(loaded.subjectPlans.appliedPlanId).toBe('plan1')
    expect(loaded.subjectPlans.plans[0].subjects).toHaveLength(1)
  })

  it('migrates legacy data (no subjectPlans key) — copies subjects to plan1, appliedPlanId=plan1', () => {
    const legacySubjects = [
      { id: 'a', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
      { id: 'b', grade: 2, name: '음악', weekly_hours: 2, is_major: false },
    ]
    const stored = {
      schoolName: '테스트초',
      subjects: legacySubjects,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    const loaded = loadFromStorage()

    expect(loaded.subjectPlans.plans[0].subjects).toHaveLength(2)
    expect(loaded.subjectPlans.plans[0].subjects[0]).toEqual(legacySubjects[0])
    // Plan1 must be a deep copy — different object references
    expect(loaded.subjectPlans.plans[0].subjects[0]).not.toBe(legacySubjects[0])
    expect(loaded.subjectPlans.plans[1].subjects).toEqual([])
    expect(loaded.subjectPlans.plans[2].subjects).toEqual([])
    expect(loaded.subjectPlans.activeTabId).toBe('plan1')
    expect(loaded.subjectPlans.appliedPlanId).toBe('plan1')
    expect(loaded.subjectPlans.appliedAt).toBeNull()
    expect(loaded.subjects).toEqual(legacySubjects) // live mirror preserved
  })

  it('migrates legacy data with empty subjects → appliedPlanId=null', () => {
    const stored = { schoolName: '테스트초', subjects: [] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    const loaded = loadFromStorage()
    expect(loaded.subjectPlans.appliedPlanId).toBeNull()
  })

  it('returns initialState if JSON parse fails', () => {
    localStorage.setItem(STORAGE_KEY, 'not json{{{')
    const loaded = loadFromStorage()
    expect(loaded.subjectPlans.appliedPlanId).toBeNull()
    expect(loaded.subjects).toEqual([])
  })
})
