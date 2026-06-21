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

// --- 외부강사 배치 ---

describe('외부강사 사전 고정 배치', () => {
  const ext = (over = {}) => ({
    id: 'x1', name: '리코더', grades: [3], subjectName: '리코더',
    hoursPerClass: 1, consecutive: false, days: [], ...over,
  })

  it('7학급(hpc1, 자동, 하루5교시)을 연속 2일에 균등 분할(4-3), gap 없이', () => {
    const res = buildSchedule([makeGrade(3, 7)], [], [], noLunch, [], [], { externalInstructors: [ext()] })
    const rows = flatRows(res).filter(r => r.is_external)
    expect(rows.length).toBe(7)
    expect(new Set(rows.map(r => r.class_num)).size).toBe(7)
    // 연속 2일
    const days = [...new Set(rows.map(r => r.day_of_week))].sort()
    expect(days).toEqual([0, 1])
    // 균등 4-3
    const c0 = rows.filter(r => r.day_of_week === 0).length
    const c1 = rows.filter(r => r.day_of_week === 1).length
    expect([c0, c1].sort((a, b) => a - b)).toEqual([3, 4])
    // 각 날 gap 없이(0..n-1)
    for (const d of days) {
      const slots = rows.filter(r => r.day_of_week === d).map(r => r.slot).sort((a, b) => a - b)
      expect(slots).toEqual(slots.map((_, i) => i))
    }
    expect(rows[0].external_name).toBe('리코더')
    expect(rows[0].subject_name).toBe('리코더')
  })

  it('두 학년(각 7반)은 같은 학년을 한 날에 몰고 경계 날만 혼합', () => {
    // 3·4학년 각 7반, 하루 5교시 → 월:3학년5, 화:3학년2+4학년3, 수:4학년4
    const res = buildSchedule([makeGrade(3, 7), makeGrade(4, 7)], [], [], noLunch, [], [],
      { externalInstructors: [ext({ grades: [3, 4] })] })
    const rows = flatRows(res).filter(r => r.is_external)
    expect(rows.length).toBe(14)
    // 한 날에 들어간 학년 수가 2개인 날은 최대 1개(경계)뿐
    const gradesByDay = {}
    for (const r of rows) (gradesByDay[r.day_of_week] ||= new Set()).add(r.grade)
    const mixedDays = Object.values(gradesByDay).filter(s => s.size > 1).length
    expect(mixedDays).toBeLessThanOrEqual(1)
  })

  it('지정 요일 1개(화)에 다 들어가면 그 날에 몰아서 배치', () => {
    const res = buildSchedule([makeGrade(3, 4)], [], [], noLunch, [], [], { externalInstructors: [ext({ days: [1] })] })
    const rows = flatRows(res).filter(r => r.is_external)
    expect(rows.length).toBe(4)
    expect(new Set(rows.map(r => r.day_of_week))).toEqual(new Set([1]))
    expect(rows.map(r => r.slot).sort((a, b) => a - b)).toEqual([0, 1, 2, 3])
  })

  it('hpc2 연속이면 각 학급 2시간 붙여서 배치', () => {
    const res = buildSchedule([makeGrade(3, 2)], [], [], noLunch, [], [], { externalInstructors: [ext({ hoursPerClass: 2, consecutive: true, days: [0] })] })
    const rows = flatRows(res).filter(r => r.is_external)
    expect(rows.length).toBe(4) // 2학급 × 2시간
    // 같은 학급 2시간이 연속 슬롯
    for (const c of [1, 2]) {
      const slots = rows.filter(r => r.class_num === c).map(r => r.slot).sort((a, b) => a - b)
      expect(slots.length).toBe(2)
      expect(slots[1] - slots[0]).toBe(1)
    }
  })

  it('지정 요일(화수목) 안에서 두 학년을 균등 분산하고 미배정 없이 배치(같은 날 뒤에 다른 학년)', () => {
    const res = buildSchedule([makeGrade(5, 7), makeGrade(6, 7)], [], [], noLunch, [], [],
      { externalInstructors: [ext({ grades: [5, 6], days: [1, 2, 3] })] })
    const rows = flatRows(res).filter(r => r.is_external)
    expect(rows.length).toBe(14) // 미배정 0
    const days = [...new Set(rows.map(r => r.day_of_week))].sort()
    expect(days).toEqual([1, 2, 3])
    const counts = [1, 2, 3].map(d => rows.filter(r => r.day_of_week === d).length).sort((a, b) => a - b)
    expect(counts).toEqual([4, 5, 5]) // 균등 분산
  })

  it('같은 특별실을 쓰는 두 외부강사는 같은 (요일,슬롯) 방을 겹치지 않는다', () => {
    const room = { id: 'R', name: '실험실', externalInstructorIds: ['x1', 'y1'] }
    const X = ext({ id: 'x1', name: 'A', grades: [3], days: [0] })
    const Y = ext({ id: 'y1', name: 'B', grades: [4], days: [0] })
    const res = buildSchedule([makeGrade(3, 1), makeGrade(4, 1)], [], [], noLunch, [room], [], { externalInstructors: [X, Y] })
    const rows = flatRows(res).filter(r => r.is_external)
    expect(rows.length).toBe(2)
    expect(rows.every(r => r.room_id === 'R')).toBe(true)
    // 같은 방·요일·슬롯 중복 없음
    const keys = rows.map(r => `${r.room_id}_${r.day_of_week}_${r.slot}`)
    expect(new Set(keys).size).toBe(2)
  })

  it('외부강사가 점유한 슬롯에는 전담이 배정되지 않는다', () => {
    const s = makeSubject('s1', '미술', 1)
    const t = makeTeacher('t1', '미술', [{ subject_id: 's1', grade: 3, class_num: 1, weekly_hours: 1 }])
    const res = buildSchedule([makeGrade(3, 1)], [s], [t], noLunch, [], [], { externalInstructors: [ext({ grades: [3], days: [0] })] })
    const rows = flatRows(res)
    const extCell = rows.find(r => r.is_external && r.class_num === 1)
    const teacherCell = rows.find(r => r.teacher_id === 't1' && r.class_num === 1)
    // 같은 (요일,슬롯)에 겹치지 않음
    if (extCell && teacherCell) {
      expect(extCell.day_of_week === teacherCell.day_of_week && extCell.slot === teacherCell.slot).toBe(false)
    }
  })
})

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

describe('Hard #8: subject sandwich — realistic 영어전담 scenario from user screenshot', () => {
  it('reproduces 영어-영어-통합-영어-영어 case', () => {
    const s1 = makeSubject('영어', '영어', 1)
    const s2 = makeSubject('통합', '통합', 1)
    const t1 = makeTeacher('t1', '영어전담', [
      { subject_id: '영어', grade: 3, class_num: 1, weekly_hours: 1 },
      { subject_id: '영어', grade: 3, class_num: 2, weekly_hours: 1 },
      { subject_id: '영어', grade: 4, class_num: 1, weekly_hours: 1 },
      { subject_id: '영어', grade: 4, class_num: 2, weekly_hours: 1 },
      { subject_id: '통합', grade: 2, class_num: 4, weekly_hours: 1 },
    ])
    // 모든 학급 월요일에 5교시만 → 강제로 같은 교사가 한 날에 다 몰리게
    const grades = [
      { grade: 2, num_classes: 4, periods_mon: 5, periods_tue: 0, periods_wed: 0, periods_thu: 0, periods_fri: 0 },
      { grade: 3, num_classes: 2, periods_mon: 5, periods_tue: 0, periods_wed: 0, periods_thu: 0, periods_fri: 0 },
      { grade: 4, num_classes: 2, periods_mon: 5, periods_tue: 0, periods_wed: 0, periods_thu: 0, periods_fri: 0 },
    ]
    const res = buildSchedule(grades, [s1, s2], [t1], noLunch)
    const rows = flatRows(res)
    const monRows = rows.filter(r => r.teacher_id === 't1' && r.day_of_week === 0)
    monRows.sort((a, b) => a.slot - b.slot)

    // sandwich 검사
    const subjRange = {}
    for (const r of monRows) {
      if (!subjRange[r.subject_id]) subjRange[r.subject_id] = [r.slot, r.slot]
      else subjRange[r.subject_id][1] = r.slot
    }
    for (const r of monRows) {
      for (const [otherSj, [minS, maxS]] of Object.entries(subjRange)) {
        if (otherSj === r.subject_id) continue
        const inside = r.slot > minS && r.slot < maxS
        if (inside) {
          throw new Error(`Sandwich: ${r.subject_id}@${r.slot} inside ${otherSj}[${minS},${maxS}] | all: ${monRows.map(x => `${x.slot}:${x.subject_id}`).join(' ')}`)
        }
      }
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

describe('Hard #13: teacher day load balance (cap = ceil(T/5))', () => {
  it('no day exceeds ceil(T/5) for any teacher', () => {
    // T=19 → cap=4
    const s1 = makeSubject('영어', '영어', 1)
    const s2 = makeSubject('통합', '통합', 1)
    const t1 = makeTeacher('t1', '영어전담', [
      ...[3, 4].flatMap(g => [1, 2].map(c => ({ subject_id: '영어', grade: g, class_num: c, weekly_hours: 2 }))),
      ...[5].flatMap(g => [1, 2].map(c => ({ subject_id: '영어', grade: g, class_num: c, weekly_hours: 3 }))),
      { subject_id: '영어', grade: 6, class_num: 1, weekly_hours: 3 },
      { subject_id: '통합', grade: 2, class_num: 4, weekly_hours: 2 },
    ])
    // total: 4*2 + 2*3 + 3 + 2 = 8+6+3+2 = 19h
    const grades = [
      { grade: 2, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 3, num_classes: 2, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 4, num_classes: 2, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 5, num_classes: 2, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 6, num_classes: 1, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
    ]
    const res = buildSchedule(grades, [s1, s2], [t1], noLunch)
    const rows = flatRows(res)
    const tRows = rows.filter(r => r.teacher_id === 't1')
    const dayLoads = [0, 0, 0, 0, 0]
    for (const r of tRows) dayLoads[r.day_of_week]++
    const T = 19
    const cap = Math.ceil(T / 5) // = 4
    for (let d = 0; d < 5; d++) {
      expect(dayLoads[d]).toBeLessThanOrEqual(cap)
    }
    // 미배정 0 확인 (총 19h)
    expect(tRows.length).toBe(19)
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
