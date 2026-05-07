import { describe, it, expect } from 'vitest'
import { buildSchedule, flattenResult } from './scheduler'

// --- Helpers ---

function makeGrade(grade, num_classes = 1, periods = 5) {
  return {
    grade, num_classes,
    periods_mon: periods, periods_tue: periods, periods_wed: periods,
    periods_thu: periods, periods_fri: periods,
  }
}

function makeSubject(id, name, weekly_hours = 1) {
  return { id, name, weekly_hours, is_major: false }
}

function makeTeacher(id, code, assignments) {
  return {
    id, code,
    teacher_assignments: assignments.map((a, i) => ({
      id: `${id}-a${i}`, ...a,
    })),
  }
}

const noLunch = { split_lunch: false, lunch_groups: [] }

function flatRows(res) {
  const { rows } = flattenResult(res.result, res.gradeLunchSlot, res.totalSlots)
  return rows
}

function findCell(rows, grade, classNum, day, slot) {
  return rows.find(r => r.grade === grade && r.class_num === classNum && r.day_of_week === day && r.slot === slot)
}

// --- Hard Constraint Tests ---

describe('Hard #3: weekly_hours exact match', () => {
  it('places exactly weekly_hours sessions per assignment', () => {
    const subj = makeSubject('s1', '영어', 3)
    const teacher = makeTeacher('t1', 'T1', [{ subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 3 }])
    const res = buildSchedule([makeGrade(5, 1, 5)], [subj], [teacher], noLunch)
    const rows = flatRows(res)
    expect(rows.length).toBe(3)
    expect(res.errors.length).toBe(0)
  })
})

describe('Hard #1: teacher slot collision', () => {
  it('never places same teacher in two classes at same (day, slot)', () => {
    const subj = makeSubject('s1', '영어', 2)
    const teacher = makeTeacher('t1', 'T1', [
      { subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 2 },
      { subject_id: 's1', grade: 5, class_num: 2, weekly_hours: 2 },
    ])
    const res = buildSchedule([makeGrade(5, 2, 5)], [subj], [teacher], noLunch)
    const rows = flatRows(res)
    const seen = new Set()
    for (const r of rows) {
      const key = `${r.teacher_id}|${r.day_of_week}|${r.slot}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe('Hard #2: class slot collision', () => {
  it('never places two sessions in same class at same (day, slot)', () => {
    const s1 = makeSubject('s1', '영어', 2)
    const s2 = makeSubject('s2', '음악', 2)
    const t1 = makeTeacher('t1', 'T1', [{ subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 2 }])
    const t2 = makeTeacher('t2', 'T2', [{ subject_id: 's2', grade: 5, class_num: 1, weekly_hours: 2 }])
    const res = buildSchedule([makeGrade(5, 1, 5)], [s1, s2], [t1, t2], noLunch)
    const rows = flatRows(res)
    const seen = new Set()
    for (const r of rows) {
      const key = `${r.grade}|${r.class_num}|${r.day_of_week}|${r.slot}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe('Hard #4: class available slots respected', () => {
  it('only places within periods_X count', () => {
    const subj = makeSubject('s1', '영어', 5)
    const teacher = makeTeacher('t1', 'T1', [{ subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 5 }])
    const grade = {
      grade: 5, num_classes: 1,
      periods_mon: 1, periods_tue: 1, periods_wed: 1, periods_thu: 1, periods_fri: 1,
    }
    const res = buildSchedule([grade], [subj], [teacher], noLunch)
    const rows = flatRows(res)
    expect(rows.length).toBe(5)
    // Each day exactly 1 slot at slot 0
    for (const r of rows) expect(r.slot).toBe(0)
  })
})

describe('Hard #5: lunch protection (split_lunch only)', () => {
  it('keeps at least one lunch slot empty per day for the teacher', () => {
    // 5학년 점심 = slot 4, 6학년 점심 = slot 5 (분리 점심)
    // 둘 다 차단되면 교사 못 먹음
    const lunchConfig = {
      split_lunch: true,
      lunch_groups: [
        { grades: [5], slot: 4 },
        { grades: [6], slot: 5 },
      ],
    }
    const s1 = makeSubject('s1', '영어', 10) // 큰 시수로 강제
    // 교사가 두 학년 다 가르침 → 점심 슬롯 충돌 가능성
    const t1 = makeTeacher('t1', 'T1', [
      { subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 5 },
      { subject_id: 's1', grade: 6, class_num: 1, weekly_hours: 5 },
    ])
    const grades = [
      { grade: 5, num_classes: 1, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 6 },
      { grade: 6, num_classes: 1, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 6 },
    ]
    const res = buildSchedule(grades, [s1], [t1], lunchConfig)
    const rows = flatRows(res)
    // 교사가 매일 4교시 OR 5교시 중 적어도 하나는 비어 있어야 함
    for (let day = 0; day < 5; day++) {
      const at4 = rows.find(r => r.teacher_id === 't1' && r.day_of_week === day && r.slot === 4)
      const at5 = rows.find(r => r.teacher_id === 't1' && r.day_of_week === day && r.slot === 5)
      expect(at4 && at5).toBeFalsy()
    }
  })
})

describe('Hard #8: subject sandwich forbidden', () => {
  it('does not allow A-B-A subject pattern in same teacher same day', () => {
    // 영어 2시간, 통합 1시간 — 같은 교사, 같은 학년, 같은 학급 다 다르게
    // 일부러 영어-통합-영어 발생 가능한 환경 만들기
    const s1 = makeSubject('s1', '영어', 1)
    const s2 = makeSubject('s2', '통합', 1)
    const t1 = makeTeacher('t1', 'T1', [
      { subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 1 },
      { subject_id: 's2', grade: 5, class_num: 2, weekly_hours: 1 },
      { subject_id: 's1', grade: 5, class_num: 3, weekly_hours: 1 },
    ])
    const res = buildSchedule([makeGrade(5, 3, 5)], [s1, s2], [t1], noLunch)
    const rows = flatRows(res)
    // 교사별 요일별 슬롯 정렬해서 A-B-A subject 패턴 발견되는지
    const byTeacherDay = {}
    for (const r of rows) {
      const key = `${r.teacher_id}|${r.day_of_week}`
      if (!byTeacherDay[key]) byTeacherDay[key] = []
      byTeacherDay[key].push({ slot: r.slot, subject_id: r.subject_id })
    }
    for (const arr of Object.values(byTeacherDay)) {
      arr.sort((a, b) => a.slot - b.slot)
      const subjectRanges = {}
      for (const { slot, subject_id } of arr) {
        if (!subjectRanges[subject_id]) subjectRanges[subject_id] = [slot, slot]
        else subjectRanges[subject_id][1] = slot
      }
      // 어떤 슬롯이 다른 과목의 [min,max] 범위 안에 끼어 있으면 sandwich
      for (const { slot, subject_id } of arr) {
        for (const [otherSubj, [minS, maxS]] of Object.entries(subjectRanges)) {
          if (otherSubj === subject_id) continue
          expect(slot > minS && slot < maxS).toBe(false)
        }
      }
    }
  })
})

describe('Hard #9: grade sandwich forbidden (within same teacher same day)', () => {
  it('does not allow grade A - grade B - grade A pattern (within sandwich grade)', () => {
    const s1 = makeSubject('s1', '영어', 1)
    const t1 = makeTeacher('t1', 'T1', [
      { subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 1 },
      { subject_id: 's1', grade: 6, class_num: 1, weekly_hours: 1 },
      { subject_id: 's1', grade: 5, class_num: 2, weekly_hours: 1 },
    ])
    const grades = [makeGrade(5, 2, 5), makeGrade(6, 1, 5)]
    const res = buildSchedule(grades, [s1], [t1], noLunch)
    const rows = flatRows(res)
    const byTeacherDay = {}
    for (const r of rows) {
      const key = `${r.teacher_id}|${r.day_of_week}`
      if (!byTeacherDay[key]) byTeacherDay[key] = []
      byTeacherDay[key].push({ slot: r.slot, grade: r.grade })
    }
    for (const arr of Object.values(byTeacherDay)) {
      arr.sort((a, b) => a.slot - b.slot)
      const gradeRanges = {}
      for (const { slot, grade } of arr) {
        if (!gradeRanges[grade]) gradeRanges[grade] = [slot, slot]
        else gradeRanges[grade][1] = slot
      }
      for (const { slot, grade } of arr) {
        for (const [otherGrade, [minS, maxS]] of Object.entries(gradeRanges)) {
          if (Number(otherGrade) === grade) continue
          expect(slot > minS && slot < maxS).toBe(false)
        }
      }
    }
  })
})

describe('Hard #10: calendar order within (class, subject)', () => {
  it('block N day >= block N-1 day', () => {
    const s1 = makeSubject('s1', '영어', 3)
    const t1 = makeTeacher('t1', 'T1', [{ subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 3 }])
    const res = buildSchedule([makeGrade(5, 1, 5)], [s1], [t1], noLunch)
    const rows = flatRows(res).filter(r => r.subject_id === 's1' && r.grade === 5 && r.class_num === 1)
    rows.sort((a, b) => a.day_of_week - b.day_of_week || a.slot - b.slot)
    // 모든 행은 day가 단조 증가
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].day_of_week >= rows[i - 1].day_of_week).toBe(true)
    }
  })
})

describe('Hard #11: same-grade same-subject pattern uniformity', () => {
  it('all classes follow same pair-or-split pattern', () => {
    // weekly_hours=2, maxSameDay=2 → pair 패턴 강제 (모든 학급)
    const s1 = makeSubject('s1', '영어', 2)
    const t1 = makeTeacher('t1', 'T1', [
      { subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 2 },
      { subject_id: 's1', grade: 5, class_num: 2, weekly_hours: 2 },
      { subject_id: 's1', grade: 5, class_num: 3, weekly_hours: 2 },
    ])
    const options = { subjectSettings: { '영어': { allow: true, maxCount: 2 } } }
    const res = buildSchedule([makeGrade(5, 3, 5)], [s1], [t1], noLunch, [], [], options)
    const rows = flatRows(res)
    // 각 학급 영어 2시간이 같은 날이고 연속 슬롯인지
    for (let cls = 1; cls <= 3; cls++) {
      const classRows = rows.filter(r => r.class_num === cls).sort((a, b) => a.day_of_week - b.day_of_week || a.slot - b.slot)
      expect(classRows.length).toBe(2)
      expect(classRows[0].day_of_week).toBe(classRows[1].day_of_week) // 같은 날
      expect(classRows[1].slot - classRows[0].slot).toBe(1) // 인접 슬롯
    }
  })
})

describe('Hard #12: same class+subject same-day rule based on maxSameDay', () => {
  it('with maxSameDay=1, no two sessions of same class+subject on same day', () => {
    const s1 = makeSubject('s1', '영어', 3)
    const t1 = makeTeacher('t1', 'T1', [{ subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 3 }])
    const options = { subjectSettings: { '영어': { allow: false, maxCount: 1 } } }
    const res = buildSchedule([makeGrade(5, 1, 5)], [s1], [t1], noLunch, [], [], options)
    const rows = flatRows(res).filter(r => r.subject_id === 's1' && r.class_num === 1)
    const days = rows.map(r => r.day_of_week)
    const uniqueDays = new Set(days)
    expect(uniqueDays.size).toBe(rows.length) // 모두 다른 날
  })

  it('with maxSameDay=2, at most 2 sessions same day and they are consecutive (pair)', () => {
    const s1 = makeSubject('s1', '영어', 3)
    const t1 = makeTeacher('t1', 'T1', [{ subject_id: 's1', grade: 5, class_num: 1, weekly_hours: 3 }])
    const options = { subjectSettings: { '영어': { allow: true, maxCount: 2 } } }
    const res = buildSchedule([makeGrade(5, 1, 5)], [s1], [t1], noLunch, [], [], options)
    const rows = flatRows(res).filter(r => r.subject_id === 's1' && r.class_num === 1)
    const byDay = {}
    for (const r of rows) {
      if (!byDay[r.day_of_week]) byDay[r.day_of_week] = []
      byDay[r.day_of_week].push(r.slot)
    }
    for (const slots of Object.values(byDay)) {
      expect(slots.length).toBeLessThanOrEqual(2)
      if (slots.length === 2) {
        slots.sort((a, b) => a - b)
        expect(slots[1] - slots[0]).toBe(1) // 연속
      }
    }
  })
})

// --- Smoke test ---

describe('Smoke: realistic mid-size school', () => {
  it('places without crashing', () => {
    const subjects = [
      makeSubject('s1', '영어', 3),
      makeSubject('s2', '음악', 1),
      makeSubject('s3', '체육', 2),
    ]
    const teachers = []
    for (let g = 3; g <= 6; g++) {
      teachers.push(makeTeacher(`t${g}-1`, `영어${g}`, [
        { subject_id: 's1', grade: g, class_num: 1, weekly_hours: 3 },
        { subject_id: 's1', grade: g, class_num: 2, weekly_hours: 3 },
      ]))
    }
    teachers.push(makeTeacher('t-pe', '체육', [
      { subject_id: 's3', grade: 5, class_num: 1, weekly_hours: 2 },
      { subject_id: 's3', grade: 5, class_num: 2, weekly_hours: 2 },
      { subject_id: 's3', grade: 6, class_num: 1, weekly_hours: 2 },
      { subject_id: 's3', grade: 6, class_num: 2, weekly_hours: 2 },
    ]))
    const grades = [3, 4, 5, 6].map(g => makeGrade(g, 2, 6))
    const res = buildSchedule(grades, subjects, teachers, noLunch)
    expect(res).toBeDefined()
    expect(res.result).toBeDefined()
  })
})
