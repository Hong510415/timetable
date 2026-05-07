import { describe, it, expect } from 'vitest'
import { reducer } from './reducer'
import { initialState } from '../lib/storage'

function makeStateWithPlan(planId, subjects) {
  // 모든 플랜을 visible로 설정 — single-plan auto-sync를 우회해 APPLY_PLAN 같은 multi-plan 시나리오 테스트 가능
  return {
    ...initialState,
    subjectPlans: {
      ...initialState.subjectPlans,
      plans: initialState.subjectPlans.plans.map(p =>
        p.id === planId ? { ...p, subjects, visible: true } : { ...p, visible: true }
      ),
    },
  }
}

describe('SET_ACTIVE_PLAN_TAB', () => {
  it('updates activeTabId', () => {
    const next = reducer(initialState, { type: 'SET_ACTIVE_PLAN_TAB', payload: 'plan2' })
    expect(next.subjectPlans.activeTabId).toBe('plan2')
  })

  it('preserves other subjectPlans fields', () => {
    const next = reducer(initialState, { type: 'SET_ACTIVE_PLAN_TAB', payload: 'plan3' })
    expect(next.subjectPlans.plans).toEqual(initialState.subjectPlans.plans)
    expect(next.subjectPlans.appliedPlanId).toBe(initialState.subjectPlans.appliedPlanId)
  })
})

describe('UPDATE_PLAN_SUBJECTS', () => {
  it('updates only the matching plan subjects', () => {
    const next = reducer(initialState, {
      type: 'UPDATE_PLAN_SUBJECTS',
      payload: { planId: 'plan2', subjects: [{ id: 'x', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
    })
    expect(next.subjectPlans.plans[0].subjects).toEqual([])
    expect(next.subjectPlans.plans[1].subjects).toHaveLength(1)
    expect(next.subjectPlans.plans[2].subjects).toEqual([])
  })

  it('does not touch state.subjects (live data) when 2+ plans visible', () => {
    const stateWithDownstream = {
      ...initialState,
      subjects: [{ id: 'live', grade: 1, name: '음악', weekly_hours: 2, is_major: false }],
      teachers: [{ id: 't1', code: '교사1', teacher_assignments: [{ id: 'a', subject_id: 'live', grade: 1, class_num: 1, weekly_hours: 2 }] }],
      subjectPlans: {
        ...initialState.subjectPlans,
        plans: initialState.subjectPlans.plans.map(p =>
          p.id === 'plan1' || p.id === 'plan2' ? { ...p, visible: true } : p
        ),
      },
    }
    const next = reducer(stateWithDownstream, {
      type: 'UPDATE_PLAN_SUBJECTS',
      payload: { planId: 'plan1', subjects: [] },
    })
    expect(next.subjects).toEqual(stateWithDownstream.subjects)
    expect(next.teachers).toEqual(stateWithDownstream.teachers)
  })

  it('auto-syncs state.subjects when only 1 plan is visible', () => {
    // 1개 플랜만 visible이면 플랜 = live (auto-apply 모드)
    const stateOnePlan = {
      ...initialState,
      subjects: [{ id: 'old', grade: 1, name: '음악', weekly_hours: 2, is_major: false }],
    }
    const newSubjects = [{ id: 'new', grade: 2, name: '영어', weekly_hours: 3, is_major: true }]
    const next = reducer(stateOnePlan, {
      type: 'UPDATE_PLAN_SUBJECTS',
      payload: { planId: 'plan1', subjects: newSubjects },
    })
    expect(next.subjects).toEqual(newSubjects)
    expect(next.subjects[0]).not.toBe(newSubjects[0]) // deep copy
    expect(next.subjectPlans.appliedPlanId).toBe('plan1')
  })
})

describe('APPLY_PLAN', () => {
  it('copies plan.subjects to state.subjects (deep copy)', () => {
    const planSubjects = [{ id: 'p', grade: 1, name: '영어', weekly_hours: 4, is_major: true }]
    const state = makeStateWithPlan('plan2', planSubjects)
    const next = reducer(state, { type: 'APPLY_PLAN', payload: { planId: 'plan2' } })
    expect(next.subjects).toEqual(planSubjects)
    expect(next.subjects[0]).not.toBe(planSubjects[0])
  })

  it('clears teacher_assignments but preserves teacher records', () => {
    const state = {
      ...initialState,
      teachers: [
        { id: 't1', code: '교사1', teacher_assignments: [{ id: 'a', subject_id: 's1', grade: 1, class_num: 1, weekly_hours: 2 }] },
        { id: 't2', code: '교사2', teacher_assignments: [] },
      ],
      // make plan1 differ from state.subjects so APPLY_PLAN takes the clearing branch
      subjectPlans: {
        ...initialState.subjectPlans,
        plans: initialState.subjectPlans.plans.map(p =>
          p.id === 'plan1' ? { ...p, subjects: [{ id: 'pp', grade: 1, name: 'X', weekly_hours: 1, is_major: false }] } : p
        ),
      },
    }
    const next = reducer(state, { type: 'APPLY_PLAN', payload: { planId: 'plan1' } })
    expect(next.teachers).toHaveLength(2)
    expect(next.teachers[0].id).toBe('t1')
    expect(next.teachers[0].code).toBe('교사1')
    expect(next.teachers[0].teacher_assignments).toEqual([])
    expect(next.teachers[1].teacher_assignments).toEqual([])
  })

  it('clears timetableSlots, roomTimetableSlots, assignmentResult', () => {
    const state = {
      ...initialState,
      timetableSlots: [{ id: 'tt1', grade: 1, class_num: 1, day_of_week: 0, slot: 0, teacher_id: 't', subject_id: 's' }],
      roomTimetableSlots: [{ id: 'rt1', room_id: 'r', grade: 1, class_num: 1, day_of_week: 0, slot: 0 }],
      assignmentResult: { result: { assignments: [], warnings: [], gradeSummary: [], teacherSummary: [] }, edited: null },
      // make plan1 differ from state.subjects so APPLY_PLAN takes the clearing branch
      subjectPlans: {
        ...initialState.subjectPlans,
        plans: initialState.subjectPlans.plans.map(p =>
          p.id === 'plan1' ? { ...p, subjects: [{ id: 'pp', grade: 1, name: 'X', weekly_hours: 1, is_major: false }] } : p
        ),
      },
    }
    const next = reducer(state, { type: 'APPLY_PLAN', payload: { planId: 'plan1' } })
    expect(next.timetableSlots).toEqual([])
    expect(next.roomTimetableSlots).toEqual([])
    expect(next.assignmentResult).toBeNull()
  })

  it('preserves rooms and roomBlockedSlots', () => {
    const state = {
      ...initialState,
      rooms: [{ id: 'r1', name: '음악실', subjectNames: [] }],
      roomBlockedSlots: [{ id: 'b1', room_id: 'r1', day_of_week: 0, slot: 0 }],
      // make plan1 differ from state.subjects so APPLY_PLAN takes the clearing branch
      subjectPlans: {
        ...initialState.subjectPlans,
        plans: initialState.subjectPlans.plans.map(p =>
          p.id === 'plan1' ? { ...p, subjects: [{ id: 'pp', grade: 1, name: 'X', weekly_hours: 1, is_major: false }] } : p
        ),
      },
    }
    const next = reducer(state, { type: 'APPLY_PLAN', payload: { planId: 'plan1' } })
    expect(next.rooms).toEqual(state.rooms)
    expect(next.roomBlockedSlots).toEqual(state.roomBlockedSlots)
  })

  it('updates appliedPlanId, appliedAt, and activeTabId', () => {
    const before = Date.now()
    const next = reducer(initialState, { type: 'APPLY_PLAN', payload: { planId: 'plan3' } })
    expect(next.subjectPlans.appliedPlanId).toBe('plan3')
    expect(next.subjectPlans.activeTabId).toBe('plan3')
    expect(new Date(next.subjectPlans.appliedAt).getTime()).toBeGreaterThanOrEqual(before)
  })

  it('returns state unchanged when planId does not exist', () => {
    const next = reducer(initialState, { type: 'APPLY_PLAN', payload: { planId: 'plan999' } })
    expect(next).toBe(initialState)
  })

  it('skips downstream clearing when plan content matches live state.subjects', () => {
    const sharedSubject = { id: 's1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }
    const state = {
      ...initialState,
      subjects: [sharedSubject],
      teachers: [{ id: 't1', code: '교사1', teacher_assignments: [{ id: 'a', subject_id: 's1', grade: 1, class_num: 1, weekly_hours: 3 }] }],
      timetableSlots: [{ id: 'tt1', grade: 1, class_num: 1, day_of_week: 0, slot: 0, teacher_id: 't1', subject_id: 's1' }],
      subjectPlans: {
        ...initialState.subjectPlans,
        plans: initialState.subjectPlans.plans.map(p => {
          if (p.id === 'plan2') return { ...p, subjects: [{ ...sharedSubject, id: 'different-id' }], visible: true }
          return { ...p, visible: true }
        }),
        appliedPlanId: 'plan1',
      },
    }
    const next = reducer(state, { type: 'APPLY_PLAN', payload: { planId: 'plan2' } })
    // Metadata updated
    expect(next.subjectPlans.appliedPlanId).toBe('plan2')
    expect(next.subjectPlans.activeTabId).toBe('plan2')
    // Live data NOT cleared
    expect(next.subjects).toEqual(state.subjects)
    expect(next.teachers[0].teacher_assignments).toHaveLength(1)
    expect(next.timetableSlots).toHaveLength(1)
  })
})
