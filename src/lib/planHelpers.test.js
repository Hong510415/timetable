import { describe, it, expect } from 'vitest'
import {
  cloneSubjects,
  subjectsEqualByContent,
  getDedicatedHoursForGrade,
  getWeeklyTotalForGrade,
  getHomeroomHoursForGrade,
  getOverflowGrades,
  classifySubjectsAcrossPlans,
} from './planHelpers'

const sampleSubjects = [
  { id: 'a', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
  { id: 'b', grade: 1, name: '음악', weekly_hours: 2, is_major: false },
  { id: 'c', grade: 2, name: '영어', weekly_hours: 3, is_major: true },
]

const gradeConfigs = [
  { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 4 },
  { grade: 2, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
  { grade: 3, num_classes: 0, periods_mon: 0, periods_tue: 0, periods_wed: 0, periods_thu: 0, periods_fri: 0 },
]

describe('cloneSubjects', () => {
  it('returns a new array of new objects (no shared reference)', () => {
    const cloned = cloneSubjects(sampleSubjects)
    expect(cloned).not.toBe(sampleSubjects)
    expect(cloned[0]).not.toBe(sampleSubjects[0])
    expect(cloned[0]).toEqual(sampleSubjects[0])
  })

  it('handles empty array', () => {
    expect(cloneSubjects([])).toEqual([])
  })

  it('treats null/undefined as empty', () => {
    expect(cloneSubjects(null)).toEqual([])
    expect(cloneSubjects(undefined)).toEqual([])
  })
})

describe('subjectsEqualByContent', () => {
  it('returns true for arrays with identical content (any id, any order)', () => {
    const a = [{ id: '1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }]
    const b = [{ id: 'different-id', grade: 1, name: '영어', weekly_hours: 3, is_major: true }]
    expect(subjectsEqualByContent(a, b)).toBe(true)
  })

  it('returns true for differently ordered arrays of identical content', () => {
    const a = [
      { id: '1', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
      { id: '2', grade: 1, name: '음악', weekly_hours: 2, is_major: false },
    ]
    const b = [
      { id: '99', grade: 1, name: '음악', weekly_hours: 2, is_major: false },
      { id: '88', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
    ]
    expect(subjectsEqualByContent(a, b)).toBe(true)
  })

  it('returns false when content differs', () => {
    const a = [{ id: '1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }]
    const b = [{ id: '1', grade: 1, name: '영어', weekly_hours: 4, is_major: true }]
    expect(subjectsEqualByContent(a, b)).toBe(false)
  })

  it('returns false when lengths differ', () => {
    expect(subjectsEqualByContent([{ id: '1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }], [])).toBe(false)
  })

  it('treats null/undefined as empty', () => {
    expect(subjectsEqualByContent(null, [])).toBe(true)
    expect(subjectsEqualByContent(undefined, null)).toBe(true)
  })
})

describe('getDedicatedHoursForGrade', () => {
  it('sums weekly_hours of subjects matching grade', () => {
    expect(getDedicatedHoursForGrade(sampleSubjects, 1)).toBe(5)
    expect(getDedicatedHoursForGrade(sampleSubjects, 2)).toBe(3)
  })

  it('returns 0 for grade with no subjects', () => {
    expect(getDedicatedHoursForGrade(sampleSubjects, 6)).toBe(0)
  })

  it('treats invalid weekly_hours as 0', () => {
    const subs = [{ id: 'x', grade: 1, name: '영어', weekly_hours: '', is_major: false }]
    expect(getDedicatedHoursForGrade(subs, 1)).toBe(0)
  })
})

describe('getWeeklyTotalForGrade', () => {
  it('sums periods_mon..periods_fri for matching grade', () => {
    expect(getWeeklyTotalForGrade(gradeConfigs, 1)).toBe(24)
    expect(getWeeklyTotalForGrade(gradeConfigs, 2)).toBe(25)
  })

  it('returns 0 for unknown grade', () => {
    expect(getWeeklyTotalForGrade(gradeConfigs, 99)).toBe(0)
  })

  it('treats invalid period values as 0', () => {
    const gc = [{ grade: 1, num_classes: 4, periods_mon: '', periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: '' }]
    expect(getWeeklyTotalForGrade(gc, 1)).toBe(15)
  })
})

describe('getHomeroomHoursForGrade', () => {
  it('returns weeklyTotal - dedicated', () => {
    expect(getHomeroomHoursForGrade(sampleSubjects, gradeConfigs, 1)).toBe(19) // 24 - 5
    expect(getHomeroomHoursForGrade(sampleSubjects, gradeConfigs, 2)).toBe(22) // 25 - 3
  })

  it('returns negative when dedicated > weeklyTotal', () => {
    const subs = [{ id: 'x', grade: 1, name: '영어', weekly_hours: 30, is_major: false }]
    expect(getHomeroomHoursForGrade(subs, gradeConfigs, 1)).toBe(-6)
  })
})

describe('getOverflowGrades', () => {
  it('returns grades where dedicated > weeklyTotal', () => {
    const subs = [
      { id: 'a', grade: 1, name: 'x', weekly_hours: 30, is_major: false },
      { id: 'b', grade: 2, name: 'y', weekly_hours: 1, is_major: false },
    ]
    expect(getOverflowGrades(subs, gradeConfigs, [1, 2])).toEqual([
      { grade: 1, dedicated: 30, weeklyTotal: 24, overBy: 6 },
    ])
  })

  it('returns empty array when no overflow', () => {
    expect(getOverflowGrades(sampleSubjects, gradeConfigs, [1, 2])).toEqual([])
  })

  it('only checks grades passed in gradesToCheck', () => {
    const subs = [{ id: 'a', grade: 3, name: 'x', weekly_hours: 99, is_major: false }]
    // grade 3 has weeklyTotal 0 but we don't check it
    expect(getOverflowGrades(subs, gradeConfigs, [1, 2])).toEqual([])
  })
})

describe('classifySubjectsAcrossPlans', () => {
  it('marks subject row as "differs" when only some plans have it', () => {
    const plans = [
      { id: 'plan1', name: 'A안', subjects: [{ id: '1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
      { id: 'plan2', name: 'B안', subjects: [] },
      { id: 'plan3', name: 'C안', subjects: [{ id: '2', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
    ]
    const result = classifySubjectsAcrossPlans(plans, 1)
    // result is a 2D map: result[planIdx] = [{ subject, differs }]
    expect(result[0][0].differs).toBe(true)  // A안 영어 differs because B안 doesn't have it
    expect(result[1]).toEqual([])
    expect(result[2][0].differs).toBe(true)
  })

  it('marks as "same" when all plans share the subject identically (by name+hours+is_major)', () => {
    const sameSubject = (id) => ({ id, grade: 1, name: '영어', weekly_hours: 3, is_major: true })
    const plans = [
      { id: 'plan1', name: 'A안', subjects: [sameSubject('a')] },
      { id: 'plan2', name: 'B안', subjects: [sameSubject('b')] },
      { id: 'plan3', name: 'C안', subjects: [sameSubject('c')] },
    ]
    const result = classifySubjectsAcrossPlans(plans, 1)
    expect(result[0][0].differs).toBe(false)
    expect(result[1][0].differs).toBe(false)
    expect(result[2][0].differs).toBe(false)
  })

  it('marks as "differs" when same name but different weekly_hours', () => {
    const plans = [
      { id: 'plan1', name: 'A안', subjects: [{ id: 'a', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
      { id: 'plan2', name: 'B안', subjects: [{ id: 'b', grade: 1, name: '영어', weekly_hours: 4, is_major: true }] },
      { id: 'plan3', name: 'C안', subjects: [{ id: 'c', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
    ]
    const result = classifySubjectsAcrossPlans(plans, 1)
    expect(result[0][0].differs).toBe(true)
    expect(result[1][0].differs).toBe(true)
    expect(result[2][0].differs).toBe(true)
  })
})
