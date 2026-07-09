import { describe, it, expect } from 'vitest'
import { runAssignmentAlgorithm } from './assignmentAlgorithm'

const gradeConfigs = [1, 2, 3, 4, 5, 6].map(grade => ({
  grade,
  num_classes: 7,
  periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5,
}))

const subjects = [
  { id: 'eng3', grade: 3, name: '영어', weekly_hours: 2, is_major: true },
  { id: 'eng4', grade: 4, name: '영어', weekly_hours: 2, is_major: true },
  { id: 'eng5', grade: 5, name: '영어', weekly_hours: 3, is_major: true },
  { id: 'eng6', grade: 6, name: '영어', weekly_hours: 3, is_major: true },
  { id: 'sci3', grade: 3, name: '과학', weekly_hours: 2, is_major: true },
  { id: 'sci4', grade: 4, name: '과학', weekly_hours: 2, is_major: true },
  { id: 'sci5', grade: 5, name: '과학', weekly_hours: 3, is_major: true },
  { id: 'sci6', grade: 6, name: '과학', weekly_hours: 2, is_major: true },
  { id: 'pe5', grade: 5, name: '체육', weekly_hours: 1, is_major: true },
  { id: 'pe6', grade: 6, name: '체육', weekly_hours: 2, is_major: true },
  { id: 'int1', grade: 1, name: '통합', weekly_hours: 1, is_major: false },
  { id: 'int2', grade: 2, name: '통합', weekly_hours: 1, is_major: false },
]

const teachers = Array.from({ length: 7 }, (_, i) => ({
  id: `t${i + 1}`,
  code: `교사${i + 1}`,
  teacher_assignments: [],
}))

const assignmentSettings = { maxMajorSubjectsPerTeacher: 1 }

describe('assignment algorithm — 3 teachers, asymmetric class counts', () => {
  it('gives 통합1 (3 classes) to one teacher, splits 통합2 (4 classes) between two', () => {
    // 사용자 시나리오: 1학년=3반, 2학년=4반
    // 효율: 교사3이 통합1 전체 받고, 교사1·2가 통합2를 2반씩 분배
    const gc = [
      { grade: 1, num_classes: 3, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 2, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 3, num_classes: 2, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 4, num_classes: 2, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 5, num_classes: 2, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      { grade: 6, num_classes: 1, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
    ]
    const subj = [
      { id: 'eng3', grade: 3, name: '영어', weekly_hours: 2, is_major: true },
      { id: 'eng4', grade: 4, name: '영어', weekly_hours: 2, is_major: true },
      { id: 'eng5', grade: 5, name: '영어', weekly_hours: 3, is_major: true },
      { id: 'eng6', grade: 6, name: '영어', weekly_hours: 3, is_major: true },
      { id: 'sci3', grade: 3, name: '과학', weekly_hours: 2, is_major: true },
      { id: 'sci4', grade: 4, name: '과학', weekly_hours: 2, is_major: true },
      { id: 'sci5', grade: 5, name: '과학', weekly_hours: 2, is_major: true },
      { id: 'sci6', grade: 6, name: '과학', weekly_hours: 2, is_major: true },
      { id: 'pe3', grade: 3, name: '체육', weekly_hours: 2, is_major: true },
      { id: 'pe4', grade: 4, name: '체육', weekly_hours: 2, is_major: true },
      { id: 'pe5', grade: 5, name: '체육', weekly_hours: 3, is_major: true },
      { id: 'pe6', grade: 6, name: '체육', weekly_hours: 3, is_major: true },
      { id: 'int1', grade: 1, name: '통합', weekly_hours: 2, is_major: false },
      { id: 'int2', grade: 2, name: '통합', weekly_hours: 2, is_major: false },
    ]
    const tch = Array.from({ length: 3 }, (_, i) => ({ id: `t${i + 1}`, code: `교사${i + 1}`, teacher_assignments: [] }))
    const result = runAssignmentAlgorithm({ gradeConfigs: gc, subjects: subj, teachers: tch, assignmentSettings: { maxMajorSubjectsPerTeacher: 1 } })

    console.log('\n=== 사용자 시나리오 (3명, 비대칭 학급수) ===')
    for (const t of tch) {
      const ta = result.assignments.filter(a => a.teacherId === t.id)
      const totalH = ta.reduce((s, a) => s + a.weeklyHours, 0)
      console.log(`\n${t.code} (${totalH}h):`)
      for (const a of ta) console.log(`  - ${a.subjectName} ${a.grade}학년 ${a.classNums.join(',')}반 (${a.weeklyHours}h)`)
    }

    // 통합 다학년 담당 교사 수 = 0
    let multiGradeCount = 0
    for (const t of tch) {
      const intGrades = new Set(result.assignments.filter(a => a.teacherId === t.id && a.subjectName === '통합').map(a => a.grade))
      if (intGrades.size > 1) multiGradeCount++
    }
    expect(multiGradeCount).toBe(0)
  })
})

describe('assignment algorithm — minor subject grade splitting', () => {
  it('reports current behavior: how many teachers hold 통합 across multiple grades', () => {
    const result = runAssignmentAlgorithm({ gradeConfigs, subjects, teachers, assignmentSettings })

    // 교사별 통합 담당 학년 집합
    const teachersWithMultiIntGrades = []
    for (const t of teachers) {
      const gradesForInt = new Set(
        result.assignments
          .filter(a => a.teacherId === t.id && a.subjectName === '통합')
          .map(a => a.grade)
      )
      if (gradesForInt.size > 1) {
        teachersWithMultiIntGrades.push({ code: t.code, grades: [...gradesForInt] })
      }
    }

    console.log('\n=== 자동 배정 결과 ===')
    console.log(`총 시수: ${result.assignments.reduce((s, a) => s + a.weeklyHours, 0)}h, 목표: ${result.teacherSummary[0]?.targetHours}h`)
    for (const t of teachers) {
      const ta = result.assignments.filter(a => a.teacherId === t.id)
      const totalH = ta.reduce((s, a) => s + a.weeklyHours, 0)
      console.log(`\n${t.code} (${totalH}h):`)
      for (const a of ta) {
        console.log(`  - ${a.subjectName} ${a.grade}학년 ${a.classNums.join(',')}반 (${a.weeklyHours}h)`)
      }
    }
    console.log('\n=== 통합 다학년 담당 교사 ===')
    if (teachersWithMultiIntGrades.length === 0) {
      console.log('없음 — 통합과목이 모두 한 교사 = 한 학년')
    } else {
      teachersWithMultiIntGrades.forEach(t => {
        console.log(`  ${t.code}: ${t.grades.map(g => `${g}학년`).join(', ')}`)
      })
    }
    console.log('')

    // 이 테스트는 진단용이므로 항상 통과 (관찰 결과 출력)
    expect(result.assignments.length).toBeGreaterThan(0)
  })
})

describe('assignment algorithm — 교사 고정(preAssigned)', () => {
  it('preAssigned로 고정된 (과목·학년·반)은 재분배 결과에서 제외된다', () => {
    const pre = new Set(['eng3_3_1', 'eng3_3_2'])
    const result = runAssignmentAlgorithm({ gradeConfigs, subjects, teachers, assignmentSettings, preAssigned: pre })
    const leaked = result.assignments.some(a => a.subjectId === 'eng3' && a.grade === 3 && (a.classNums.includes(1) || a.classNums.includes(2)))
    expect(leaked).toBe(false)
    // 고정 안 한 반(3~7)은 여전히 배정됨
    const others = result.assignments.some(a => a.subjectId === 'eng3' && a.grade === 3 && a.classNums.some(c => c >= 3))
    expect(others).toBe(true)
  })
})
