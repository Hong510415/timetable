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
