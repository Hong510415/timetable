import { describe, it, expect } from 'vitest'
import { reducer } from './reducer'
import { initialState } from '../lib/storage'

function makeStateWithPlan(planId, subjects) {
  return {
    ...initialState,
    subjectPlans: {
      ...initialState.subjectPlans,
      plans: initialState.subjectPlans.plans.map(p =>
        p.id === planId ? { ...p, subjects } : p
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

  it('does not touch state.subjects (live data) or downstream state', () => {
    const stateWithDownstream = {
      ...initialState,
      subjects: [{ id: 'live', grade: 1, name: '음악', weekly_hours: 2, is_major: false }],
      teachers: [{ id: 't1', code: '교사1', teacher_assignments: [{ id: 'a', subject_id: 'live', grade: 1, class_num: 1, weekly_hours: 2 }] }],
    }
    const next = reducer(stateWithDownstream, {
      type: 'UPDATE_PLAN_SUBJECTS',
      payload: { planId: 'plan1', subjects: [] },
    })
    expect(next.subjects).toEqual(stateWithDownstream.subjects)
    expect(next.teachers).toEqual(stateWithDownstream.teachers)
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
})
