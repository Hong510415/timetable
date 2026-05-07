import { describe, it, expect } from 'vitest'
import { buildSchedule, flattenResult } from './scheduler'

describe('reproduces user 영어전담 19h scenario', () => {
  it('no sandwich, even for the single 통합 2학년 4반 unit', () => {
    const gc = [
      { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 2, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 3, num_classes: 2, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 5 },
      { grade: 4, num_classes: 2, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 5 },
      { grade: 5, num_classes: 2, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 6 },
      { grade: 6, num_classes: 1, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 6 },
    ]
    const subj = [
      { id: 'eng3', grade: 3, name: '영어', weekly_hours: 2, is_major: true },
      { id: 'eng4', grade: 4, name: '영어', weekly_hours: 2, is_major: true },
      { id: 'eng5', grade: 5, name: '영어', weekly_hours: 3, is_major: true },
      { id: 'eng6', grade: 6, name: '영어', weekly_hours: 3, is_major: true },
      { id: 'int2', grade: 2, name: '통합', weekly_hours: 2, is_major: false },
    ]
    const t = [
      {
        id: 't1',
        code: '영어전담',
        teacher_assignments: [
          { id: 'a1', subject_id: 'eng3', grade: 3, class_num: 1, weekly_hours: 2 },
          { id: 'a2', subject_id: 'eng3', grade: 3, class_num: 2, weekly_hours: 2 },
          { id: 'a3', subject_id: 'eng4', grade: 4, class_num: 1, weekly_hours: 2 },
          { id: 'a4', subject_id: 'eng4', grade: 4, class_num: 2, weekly_hours: 2 },
          { id: 'a5', subject_id: 'eng5', grade: 5, class_num: 1, weekly_hours: 3 },
          { id: 'a6', subject_id: 'eng5', grade: 5, class_num: 2, weekly_hours: 3 },
          { id: 'a7', subject_id: 'eng6', grade: 6, class_num: 1, weekly_hours: 3 },
          { id: 'a8', subject_id: 'int2', grade: 2, class_num: 4, weekly_hours: 2 },
        ],
      },
    ]
    const lc = { split_lunch: false, lunch_groups: [] }

    const failures = []
    for (let trial = 0; trial < 50; trial++) {
      const r = buildSchedule(gc, subj, t, lc, [], [], { subjectSettings: { '영어': { allow: true, maxCount: 2 }, '통합': { allow: false, maxCount: 1 } } })
      const { rows } = flattenResult(r.result, r.gradeLunchSlot, r.totalSlots)

      for (let day = 0; day < 5; day++) {
        const dayRows = rows.filter(x => x.teacher_id === 't1' && x.day_of_week === day && !x.is_unassigned)
        const slotSubject = {}
        for (const r of dayRows) slotSubject[r.slot] = r.subject_id
        const ranges = {}
        for (const [s, sj] of Object.entries(slotSubject)) {
          const slot = Number(s)
          if (!ranges[sj]) ranges[sj] = [slot, slot]
          else { ranges[sj][0] = Math.min(ranges[sj][0], slot); ranges[sj][1] = Math.max(ranges[sj][1], slot) }
        }
        for (const [s, sj] of Object.entries(slotSubject)) {
          const slot = Number(s)
          for (const [other, [minH, maxH]] of Object.entries(ranges)) {
            if (other === String(sj)) continue
            if (slot > minH && slot < maxH) {
              const dayName = ['월', '화', '수', '목', '금'][day]
              const slotsDump = Object.entries(slotSubject).sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([s, sj]) => `${Number(s) + 1}교시:${sj}`).join(', ')
              failures.push(`trial ${trial} ${dayName}: ${slotsDump}`)
            }
          }
        }
      }
    }
    if (failures.length > 0) {
      throw new Error(`Sandwich detected:\n${failures.slice(0, 5).join('\n')}\n... (${failures.length} total)`)
    }
  })
})

describe('subject sandwich prevention — multiple subject settings combinations', () => {
  const baseGradeConfigs = [
    { grade: 1, num_classes: 3, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
    { grade: 2, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
    { grade: 3, num_classes: 2, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 5 },
    { grade: 4, num_classes: 2, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 5 },
    { grade: 5, num_classes: 2, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 6 },
    { grade: 6, num_classes: 1, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 6 },
  ]
  const baseSubjects = [
    { id: 'eng3', grade: 3, name: '영어', weekly_hours: 2, is_major: true },
    { id: 'eng4', grade: 4, name: '영어', weekly_hours: 2, is_major: true },
    { id: 'eng5', grade: 5, name: '영어', weekly_hours: 3, is_major: true },
    { id: 'eng6', grade: 6, name: '영어', weekly_hours: 3, is_major: true },
    { id: 'int2', grade: 2, name: '통합', weekly_hours: 2, is_major: false },
  ]
  const baseTeachers = [
    {
      id: 't1',
      code: '영어전담',
      teacher_assignments: [
        { id: 'a1', subject_id: 'eng3', grade: 3, class_num: 1, weekly_hours: 2 },
        { id: 'a2', subject_id: 'eng3', grade: 3, class_num: 2, weekly_hours: 2 },
        { id: 'a3', subject_id: 'eng4', grade: 4, class_num: 1, weekly_hours: 2 },
        { id: 'a4', subject_id: 'eng4', grade: 4, class_num: 2, weekly_hours: 2 },
        { id: 'a5', subject_id: 'eng5', grade: 5, class_num: 1, weekly_hours: 3 },
        { id: 'a6', subject_id: 'eng5', grade: 5, class_num: 2, weekly_hours: 3 },
        { id: 'a7', subject_id: 'eng6', grade: 6, class_num: 1, weekly_hours: 3 },
        { id: 'a8a', subject_id: 'int2', grade: 2, class_num: 1, weekly_hours: 2 },
        { id: 'a8b', subject_id: 'int2', grade: 2, class_num: 2, weekly_hours: 2 },
      ],
    },
  ]
  const lunchConfig = { split_lunch: false, lunch_groups: [] }

  function checkSandwich(rows, label) {
    for (let day = 0; day < 5; day++) {
      const dayRows = rows.filter(x => x.teacher_id === 't1' && x.day_of_week === day && !x.is_unassigned)
      const slotSubject = {}
      for (const r of dayRows) slotSubject[r.slot] = r.subject_id
      const ranges = {}
      for (const [s, subj] of Object.entries(slotSubject)) {
        const slot = Number(s)
        if (!ranges[subj]) ranges[subj] = [slot, slot]
        else { ranges[subj][0] = Math.min(ranges[subj][0], slot); ranges[subj][1] = Math.max(ranges[subj][1], slot) }
      }
      for (const [s, subj] of Object.entries(slotSubject)) {
        const slot = Number(s)
        for (const [other, [minH, maxH]] of Object.entries(ranges)) {
          if (other === String(subj)) continue
          if (slot > minH && slot < maxH) {
            const dayName = ['월', '화', '수', '목', '금'][day]
            const slotsDump = Object.entries(slotSubject)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([s, subj]) => `${Number(s) + 1}교시:${subj}`)
              .join(', ')
            throw new Error(`${label}: ${dayName}요일 ${slot + 1}교시 ${subj}가 ${other}의 [${minH + 1}, ${maxH + 1}] 범위 안에 끼어듦. 슬롯: ${slotsDump}`)
          }
        }
      }
    }
  }

  const settingsCombinations = [
    { '영어': { allow: true, maxCount: 2 }, '통합': { allow: false, maxCount: 1 } },
    { '영어': { allow: true, maxCount: 2 }, '통합': { allow: true, maxCount: 2 } },
    { '영어': { allow: false, maxCount: 1 }, '통합': { allow: false, maxCount: 1 } },
    { '영어': { allow: true, maxCount: 3 }, '통합': { allow: true, maxCount: 2 } },
  ]

  for (let cIdx = 0; cIdx < settingsCombinations.length; cIdx++) {
    const subjectSettings = settingsCombinations[cIdx]
    it(`combo ${cIdx}: 영어=${JSON.stringify(subjectSettings['영어'])} 통합=${JSON.stringify(subjectSettings['통합'])}`, () => {
      for (let trial = 0; trial < 30; trial++) {
        const r = buildSchedule(baseGradeConfigs, baseSubjects, baseTeachers, lunchConfig, [], [], { subjectSettings })
        const { rows } = flattenResult(r.result, r.gradeLunchSlot, r.totalSlots)
        checkSandwich(rows, `combo ${cIdx} trial ${trial}`)
      }
    })
  }
})

describe('subject sandwich prevention', () => {
  it('does not place a different subject between same-subject sessions on same teacher/day', () => {
    // 영어전담이 영어 + 통합을 가르치는 시나리오
    // 의도된 결과: 같은 날에 영어와 통합이 인터리브되지 않음
    const gradeConfigs = [
      { grade: 1, num_classes: 3, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 2, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 3, num_classes: 2, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 5 },
      { grade: 4, num_classes: 2, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 5 },
      { grade: 5, num_classes: 2, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 6 },
      { grade: 6, num_classes: 1, periods_mon: 6, periods_tue: 6, periods_wed: 6, periods_thu: 6, periods_fri: 6 },
    ]
    const subjects = [
      { id: 'eng3', grade: 3, name: '영어', weekly_hours: 2, is_major: true },
      { id: 'eng4', grade: 4, name: '영어', weekly_hours: 2, is_major: true },
      { id: 'eng5', grade: 5, name: '영어', weekly_hours: 3, is_major: true },
      { id: 'eng6', grade: 6, name: '영어', weekly_hours: 3, is_major: true },
      { id: 'int1', grade: 1, name: '통합', weekly_hours: 2, is_major: false },
      { id: 'int2', grade: 2, name: '통합', weekly_hours: 2, is_major: false },
    ]
    const teachers = [
      {
        id: 't1',
        code: '영어전담',
        teacher_assignments: [
          { id: 'a1', subject_id: 'eng3', grade: 3, class_num: 1, weekly_hours: 2 },
          { id: 'a2', subject_id: 'eng3', grade: 3, class_num: 2, weekly_hours: 2 },
          { id: 'a3', subject_id: 'eng4', grade: 4, class_num: 1, weekly_hours: 2 },
          { id: 'a4', subject_id: 'eng4', grade: 4, class_num: 2, weekly_hours: 2 },
          { id: 'a5', subject_id: 'eng5', grade: 5, class_num: 1, weekly_hours: 3 },
          { id: 'a6', subject_id: 'eng5', grade: 5, class_num: 2, weekly_hours: 3 },
          { id: 'a7', subject_id: 'eng6', grade: 6, class_num: 1, weekly_hours: 3 },
          { id: 'a8', subject_id: 'int2', grade: 2, class_num: 2, weekly_hours: 2 },
        ],
      },
    ]
    const lunchConfig = { split_lunch: false, lunch_groups: [] }

    // 여러 번 실행 (랜덤 동률 처리 확인)
    for (let trial = 0; trial < 30; trial++) {
      const r = buildSchedule(gradeConfigs, subjects, teachers, lunchConfig, [], [], { subjectSettings: { '영어': { allow: true, maxCount: 2 } } })
      const { rows } = flattenResult(r.result, r.gradeLunchSlot, r.totalSlots)

      // For each (teacher, day), check no subject is sandwiched between another subject's range
      for (let day = 0; day < 5; day++) {
        const dayRows = rows.filter(x => x.teacher_id === 't1' && x.day_of_week === day && !x.is_unassigned)
        const slotSubject = {}
        for (const r of dayRows) slotSubject[r.slot] = r.subject_id
        const ranges = {}
        for (const [s, subj] of Object.entries(slotSubject)) {
          const slot = Number(s)
          if (!ranges[subj]) ranges[subj] = [slot, slot]
          else { ranges[subj][0] = Math.min(ranges[subj][0], slot); ranges[subj][1] = Math.max(ranges[subj][1], slot) }
        }
        for (const [s, subj] of Object.entries(slotSubject)) {
          const slot = Number(s)
          for (const [other, [minH, maxH]] of Object.entries(ranges)) {
            if (other === String(subj)) continue
            if (slot > minH && slot < maxH) {
              const dayName = ['월', '화', '수', '목', '금'][day]
              throw new Error(`Trial ${trial}: ${dayName}요일 ${slot + 1}교시에 ${subj}가 ${other}의 범위 [${minH + 1}, ${maxH + 1}]교시 안에 끼어듦`)
            }
          }
        }
      }
    }
  })
})
