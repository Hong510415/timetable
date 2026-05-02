# 전담 배정 알고리즘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **전제:** Plan 1 (local 브랜치 마이그레이션)이 완료된 상태에서 진행한다.

**Goal:** 전담 교사의 담당 과목·학년·반·시수를 자동 배정하는 새 탭을 추가한다. 담임 시수 균형, 전담 교사 시수 균형, 주요 과목 제한을 맞추며 결과를 수동으로 편집할 수 있다.

**Architecture:** `assignmentAlgorithm.js`가 순수 함수로 배정 결과를 계산하고, `Assignment.jsx`가 입력 UI + 결과 테이블 + 경고를 렌더링한다. 결과는 AppContext의 `teachers[].teacher_assignments`에 저장된다. 과목 설정(is_major 포함)은 SchoolSetup의 subjects 탭에서 이미 관리하므로 별도 탭으로 이동하지 않고 재사용한다.

**Tech Stack:** React 18, AppContext (Plan 1에서 생성), 순수 JS 배정 알고리즘

---

## 파일 구조

### 신규 생성
- `src/lib/assignmentAlgorithm.js` — 배정 알고리즘 순수 함수
- `src/pages/Assignment.jsx` — 전담 배정 탭 UI

### 수정
- `src/components/Layout.jsx` — 전담 배정 탭 추가
- `src/pages/SchoolSetup.jsx` — subjects 탭에 is_major 선택 추가
- `src/context/AppContext.jsx` — assignmentSettings 이미 존재, 변경 없음

---

## 알고리즘 설계 상세

### 입력
```js
{
  gradeConfigs: [{ grade, num_classes, periods_mon, ..., periods_fri }],
  subjects: [{ id, grade, name, weekly_hours, is_major }],
  teachers: [{ id, code }],  // teacher_assignments는 무시하고 새로 계산
  assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }
}
```

### 출력
```js
{
  assignments: [
    {
      teacherId: string,
      subjectId: string,
      grade: number,
      classNums: number[],  // 담당하는 반 목록
      weeklyHours: number,  // 시수 × classNums.length
    }
  ],
  warnings: [{ type: string, message: string }],
  gradeSummary: [{ grade, dedicatedHours, homeRoomHours }],
  teacherSummary: [{ teacherId, totalHours, targetHours }],
}
```

### 알고리즘 단계

**Step A: 배정 단위(unit) 목록 생성**
- (subject_id, grade) 조합마다 배정 단위 생성
- unit.totalHours = subject.weekly_hours × gradeConfig.num_classes

**Step B: 교사 목표 시수 계산**
- totalDedicatedHours = Σ(unit.totalHours for all units)
- targetHoursPerTeacher = Math.round(totalDedicatedHours / teachers.length)

**Step C: 주요 과목 먼저 교사에게 배정 (그리디)**
- 주요 과목 units를 totalHours 내림차순 정렬
- 각 unit에 대해, 주요 과목 수가 maxMajorSubjectsPerTeacher 미만이고 현재 시수가 가장 적은 교사에게 배정
- 모든 교사가 주요 과목 한도에 달했는데 주요 unit이 남아있으면: 한도 초과를 허용하고 배정 (경고 없음 — 학교 규모상 불가피)

**Step D: 일반 과목 배정**
- 일반 과목 units를 totalHours 내림차순 정렬
- 각 unit에 대해, 현재 시수가 목표에 가장 가까운 교사에게 배정

**Step E: 시수 편차 확인 → 학급 분리**
- 배정 후 교사 간 시수 편차가 클 경우 (가장 많은 교사 - 가장 적은 교사 > 목표 × 0.3):
  - 시수가 많은 교사의 unit 중 가장 큰 unit을 찾아 학급을 절반으로 분리
  - 절반을 시수가 가장 적은 교사에게 이전
  - 이 과정을 최대 20회 반복

**Step F: 경고 계산**
- 학년 간 담임 시수 편차 > 2h → 경고
- 교사 시수가 target + 3h 초과 → 경고
- 교사 시수가 target - 3h 미만 → 경고

---

## Task 1: SchoolSetup subjects 탭에 is_major 옵션 추가

**Files:**
- Modify: `src/pages/SchoolSetup.jsx`

- [ ] **Step 1: subjects 탭의 각 과목 행에 주요/일반 select 추가**

`src/pages/SchoolSetup.jsx`의 subjects 탭 내 과목 행 JSX를 찾아서 과목명 input 뒤에 select 추가:

```jsx
{/* 기존 과목명 input 뒤에 추가 */}
<select
  value={s.is_major ? '주요' : '일반'}
  onChange={e => setSubjects(subjects.map((x, j) => j === i ? { ...x, is_major: e.target.value === '주요' } : x))}
  className="w-20 h-9 px-2 border border-gray-200 rounded-sm text-[12px] outline-none bg-white"
>
  <option value="일반">일반</option>
  <option value="주요">주요</option>
</select>
```

- [ ] **Step 2: 헤더 레이블 추가 (과목명 | 주당 | 구분 | 삭제)**

과목 행 위에 컬럼 헤더 추가:
```jsx
<div className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
  <span className="flex-1">과목명</span>
  <span className="w-[80px] text-center">주당 시수</span>
  <span className="w-20 text-center">구분</span>
  <span className="w-8" />
</div>
```

- [ ] **Step 3: 커밋**

```bash
git add src/pages/SchoolSetup.jsx
git commit -m "feat: add is_major selector to subjects tab"
```

---

## Task 2: assignmentAlgorithm.js 작성

**Files:**
- Create: `src/lib/assignmentAlgorithm.js`

- [ ] **Step 1: assignmentAlgorithm.js 작성**

```js
// src/lib/assignmentAlgorithm.js

/**
 * 전담 배정 알고리즘
 * @param {Object} params
 * @param {Array} params.gradeConfigs
 * @param {Array} params.subjects - { id, grade, name, weekly_hours, is_major }
 * @param {Array} params.teachers - { id, code }
 * @param {Object} params.assignmentSettings - { maxMajorSubjectsPerTeacher }
 * @returns {{ assignments, warnings, gradeSummary, teacherSummary }}
 */
export function runAssignmentAlgorithm({ gradeConfigs, subjects, teachers, assignmentSettings }) {
  const maxMajor = assignmentSettings?.maxMajorSubjectsPerTeacher ?? 1

  if (!teachers.length) return { assignments: [], warnings: [{ type: 'error', message: '교사가 없습니다.' }], gradeSummary: [], teacherSummary: [] }
  if (!subjects.length) return { assignments: [], warnings: [{ type: 'error', message: '과목이 없습니다.' }], gradeSummary: [], teacherSummary: [] }

  // Step A: 배정 단위 생성
  const units = []
  for (const subj of subjects) {
    const gc = gradeConfigs.find(g => g.grade === subj.grade)
    if (!gc) continue
    const numClasses = gc.num_classes
    units.push({
      subjectId: subj.id,
      subjectName: subj.name,
      grade: subj.grade,
      is_major: subj.is_major,
      hoursPerClass: subj.weekly_hours,
      numClasses,
      totalHours: subj.weekly_hours * numClasses,
      classNums: Array.from({ length: numClasses }, (_, i) => i + 1),
    })
  }

  if (!units.length) return { assignments: [], warnings: [{ type: 'error', message: '배정 가능한 과목이 없습니다.' }], gradeSummary: [], teacherSummary: [] }

  // Step B: 목표 시수
  const totalDedicated = units.reduce((s, u) => s + u.totalHours, 0)
  const targetHours = Math.round(totalDedicated / teachers.length)

  // 교사 상태 (mutable)
  const teacherState = teachers.map(t => ({
    id: t.id,
    code: t.code,
    currentHours: 0,
    majorCount: 0,
    assignments: [], // { subjectId, grade, classNums, hoursPerClass }
  }))

  function teacherById(id) { return teacherState.find(t => t.id === id) }
  function leastBusyTeacher(filterFn = () => true) {
    return teacherState.filter(filterFn).sort((a, b) => a.currentHours - b.currentHours)[0]
  }

  function assignUnit(unit, teacherSt, classNums) {
    const hours = unit.hoursPerClass * classNums.length
    teacherSt.assignments.push({
      subjectId: unit.subjectId,
      grade: unit.grade,
      classNums: [...classNums],
      hoursPerClass: unit.hoursPerClass,
    })
    teacherSt.currentHours += hours
    if (unit.is_major) teacherSt.majorCount++
  }

  // Step C: 주요 과목 배정
  const majorUnits = units.filter(u => u.is_major).sort((a, b) => b.totalHours - a.totalHours)
  for (const unit of majorUnits) {
    const eligible = teacherState.filter(t => t.majorCount < maxMajor)
    const target = eligible.length > 0
      ? eligible.sort((a, b) => a.currentHours - b.currentHours)[0]
      : teacherState.sort((a, b) => a.currentHours - b.currentHours)[0]
    assignUnit(unit, target, unit.classNums)
  }

  // Step D: 일반 과목 배정
  const minorUnits = units.filter(u => !u.is_major).sort((a, b) => b.totalHours - a.totalHours)
  for (const unit of minorUnits) {
    const target = teacherState.sort((a, b) => a.currentHours - b.currentHours)[0]
    assignUnit(unit, target, unit.classNums)
  }

  // Step E: 시수 편차 줄이기 (학급 분리)
  for (let iter = 0; iter < 20; iter++) {
    const sorted = [...teacherState].sort((a, b) => a.currentHours - b.currentHours)
    const least = sorted[0]
    const most = sorted[sorted.length - 1]
    if (most.currentHours - least.currentHours <= Math.max(3, targetHours * 0.15)) break

    // most의 assignments 중 classNums > 1 인 것을 찾아 절반 분리
    const splitableAssign = most.assignments
      .filter(a => a.classNums.length >= 2)
      .sort((a, b) => (b.hoursPerClass * b.classNums.length) - (a.hoursPerClass * a.classNums.length))[0]
    if (!splitableAssign) break

    const half = Math.floor(splitableAssign.classNums.length / 2)
    const movedClasses = splitableAssign.classNums.slice(0, half)
    splitableAssign.classNums = splitableAssign.classNums.slice(half)
    const movedHours = splitableAssign.hoursPerClass * movedClasses.length
    most.currentHours -= movedHours

    least.assignments.push({
      subjectId: splitableAssign.subjectId,
      grade: splitableAssign.grade,
      classNums: movedClasses,
      hoursPerClass: splitableAssign.hoursPerClass,
    })
    least.currentHours += movedHours
  }

  // 결과 변환
  const assignments = []
  for (const ts of teacherState) {
    for (const a of ts.assignments) {
      assignments.push({
        teacherId: ts.id,
        teacherCode: ts.code,
        subjectId: a.subjectId,
        subjectName: subjects.find(s => s.id === a.subjectId)?.name || '',
        grade: a.grade,
        classNums: a.classNums,
        weeklyHours: a.hoursPerClass * a.classNums.length,
        hoursPerClass: a.hoursPerClass,
        isManual: false,
      })
    }
  }

  // Step F: 경고 계산
  const warnings = []

  // 학년별 담임 시수
  const gradeSummary = gradeConfigs.map(gc => {
    const weeklyTotal = gc.periods_mon + gc.periods_tue + gc.periods_wed + gc.periods_thu + gc.periods_fri
    const dedicatedHours = subjects
      .filter(s => s.grade === gc.grade)
      .reduce((sum, s) => sum + s.weekly_hours, 0)
    return { grade: gc.grade, dedicatedHours, homeRoomHours: weeklyTotal - dedicatedHours }
  })

  const homeRoomHours = gradeSummary.map(g => g.homeRoomHours)
  const hrMax = Math.max(...homeRoomHours)
  const hrMin = Math.min(...homeRoomHours)
  if (hrMax - hrMin > 2) {
    warnings.push({
      type: 'warning',
      message: `학년 간 담임 시수 편차가 ${hrMax - hrMin}h입니다. (최대 ${hrMax}h, 최소 ${hrMin}h) — 과목 시수를 조정하세요.`,
    })
  }

  // 교사 시수 경고
  const teacherSummary = teacherState.map(ts => ({
    teacherId: ts.id,
    teacherCode: ts.code,
    totalHours: ts.currentHours,
    targetHours,
  }))

  for (const ts of teacherState) {
    if (ts.currentHours > targetHours + 3) {
      warnings.push({ type: 'warning', message: `${ts.code}: 시수 초과 (${ts.currentHours}h / 목표 ${targetHours}h)` })
    }
    if (ts.currentHours < targetHours - 3) {
      warnings.push({ type: 'warning', message: `${ts.code}: 시수 부족 (${ts.currentHours}h / 목표 ${targetHours}h)` })
    }
  }

  return { assignments, warnings, gradeSummary, teacherSummary }
}

/**
 * 알고리즘 결과를 AppContext의 teachers[].teacher_assignments 형태로 변환
 */
export function assignmentsToTeacherAssignments(assignments) {
  // teacherId → { assignments: [...] } 로 그루핑
  const map = {}
  for (const a of assignments) {
    if (!map[a.teacherId]) map[a.teacherId] = []
    for (const classNum of a.classNums) {
      map[a.teacherId].push({
        id: crypto.randomUUID(),
        subject_id: a.subjectId,
        grade: a.grade,
        class_num: classNum,
        weekly_hours: a.hoursPerClass,
      })
    }
  }
  return map // { teacherId: [{ id, subject_id, grade, class_num, weekly_hours }] }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/assignmentAlgorithm.js
git commit -m "feat: add assignment algorithm"
```

---

## Task 3: Assignment.jsx 작성 (전담 배정 탭 UI)

**Files:**
- Create: `src/pages/Assignment.jsx`

- [ ] **Step 1: Assignment.jsx 작성**

```jsx
// src/pages/Assignment.jsx
import { useState } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { runAssignmentAlgorithm, assignmentsToTeacherAssignments } from '../lib/assignmentAlgorithm'

const DAY_LABELS = ['월', '화', '수', '목', '금']

export default function Assignment() {
  const { state, setTeachers, setAssignmentSettings } = useApp()
  const { gradeConfigs, subjects, teachers, assignmentSettings } = state

  const [result, setResult] = useState(null) // { assignments, warnings, gradeSummary, teacherSummary }
  const [editedAssignments, setEditedAssignments] = useState(null) // null = 알고리즘 결과 그대로
  const [running, setRunning] = useState(false)

  const activeAssignments = editedAssignments ?? result?.assignments ?? []

  function handleRun() {
    if (editedAssignments !== null) {
      if (!confirm('자동 배정을 재실행하면 수동 수정 내용이 초기화됩니다. 계속하시겠습니까?')) return
    }
    setRunning(true)
    setTimeout(() => {
      const r = runAssignmentAlgorithm({ gradeConfigs, subjects, teachers, assignmentSettings })
      setResult(r)
      setEditedAssignments(null)
      setRunning(false)
    }, 0)
  }

  function handleApply() {
    if (!activeAssignments.length) return alert('먼저 자동 배정을 실행하세요.')
    const map = assignmentsToTeacherAssignments(activeAssignments)
    setTeachers(teachers.map(t => ({
      ...t,
      teacher_assignments: map[t.id] || [],
    })))
    alert('전담 교사 관리에 적용되었습니다.')
  }

  // 수동 수정: classNums 변경
  function updateAssignment(idx, field, value) {
    const next = activeAssignments.map((a, i) => i === idx ? { ...a, [field]: value, isManual: true } : a)
    setEditedAssignments(next)
  }

  // 수동 수정 후 경고 재계산
  const warnings = editedAssignments !== null
    ? computeWarnings(editedAssignments, gradeConfigs, subjects, teachers.length)
    : (result?.warnings ?? [])

  const gradeSummary = result?.gradeSummary ?? []
  const teacherSummary = result?.teacherSummary ?? []

  const totalDedicated = subjects.reduce((sum, s) => {
    const gc = gradeConfigs.find(g => g.grade === s.grade)
    return sum + (gc ? s.weekly_hours * gc.num_classes : 0)
  }, 0)
  const targetHours = teachers.length ? Math.round(totalDedicated / teachers.length) : 0

  if (!teachers.length || !subjects.length) {
    return (
      <div className="p-10 bg-gray-50 min-h-full">
        <h1 className="text-[22px] font-bold mb-6">전담 배정</h1>
        <div className="text-center py-20 text-gray-300 text-[14px]">
          {!teachers.length ? '전담 교사 관리에서 교사를 먼저 추가하세요.' : '학교 설정에서 전담 과목을 먼저 입력하세요.'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">전담 배정</h1>
        <div className="flex gap-2">
          {result && (
            <button
              onClick={handleApply}
              className="h-10 px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50"
            >
              전담 교사 관리에 적용
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 h-10 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
            {running ? '배정 중...' : '자동 배정 실행'}
          </button>
        </div>
      </div>

      {/* 배정 설정 */}
      <div className="bg-white border border-gray-200 rounded-sm p-5 mb-5 flex items-center gap-6">
        <span className="text-[13px] font-semibold text-gray-700">배정 설정</span>
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-gray-500">교사 1명당 주요 과목 최대</label>
          <select
            value={assignmentSettings.maxMajorSubjectsPerTeacher}
            onChange={e => setAssignmentSettings({ ...assignmentSettings, maxMajorSubjectsPerTeacher: Number(e.target.value) })}
            className="h-8 px-2 border border-gray-300 rounded-sm text-[12px] outline-none bg-white"
          >
            <option value={1}>1개</option>
            <option value={2}>2개</option>
            <option value={99}>제한없음</option>
          </select>
        </div>
        <div className="text-[12px] text-gray-400">
          교사 수: <strong>{teachers.length}명</strong> &nbsp;|&nbsp; 전체 전담시수: <strong>{totalDedicated}h</strong> &nbsp;|&nbsp; 교사 목표 시수: <strong>{targetHours}h</strong>
        </div>
      </div>

      {/* 경고 */}
      {warnings.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-sm text-[12px] text-yellow-800">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              {w.message}
            </div>
          ))}
        </div>
      )}

      {result && warnings.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-sm text-[12px] text-green-700 mb-5">
          <CheckCircle size={14} />
          배정이 균형 기준을 만족합니다.
        </div>
      )}

      {!result && (
        <div className="text-center py-20 text-gray-300 text-[14px]">
          자동 배정 실행 버튼을 눌러 배정을 시작하세요.
        </div>
      )}

      {result && (
        <>
          {/* 배정 결과 테이블 */}
          <div className="bg-white border border-gray-200 rounded-sm overflow-hidden mb-5">
            <div className="flex bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500">
              <div className="w-[100px] flex-shrink-0 px-4 py-2.5 border-r border-gray-200">교사</div>
              <div className="w-[80px] flex-shrink-0 px-3 py-2.5 border-r border-gray-200">과목</div>
              <div className="w-[60px] flex-shrink-0 px-3 py-2.5 border-r border-gray-200">학년</div>
              <div className="flex-1 px-3 py-2.5 border-r border-gray-200">담당 반</div>
              <div className="w-[80px] flex-shrink-0 px-3 py-2.5 border-r border-gray-200">주당시수</div>
              <div className="w-[60px] flex-shrink-0 px-3 py-2.5">수정</div>
            </div>

            {/* 교사별 그루핑 */}
            {teachers.map(teacher => {
              const teacherAssigns = activeAssignments.filter(a => a.teacherId === teacher.id)
              const totalH = teacherAssigns.reduce((s, a) => s + a.weeklyHours, 0)
              const isOver = totalH > targetHours + 3
              const isUnder = totalH < targetHours - 3
              return (
                <div key={teacher.id} className={`border-b border-gray-100 last:border-b-0 ${isOver || isUnder ? 'bg-yellow-50' : ''}`}>
                  {teacherAssigns.length === 0 ? (
                    <div className="flex items-center h-10">
                      <div className="w-[100px] flex-shrink-0 px-4 text-[12px] font-semibold border-r border-gray-100">{teacher.code}</div>
                      <div className="flex-1 px-3 text-[12px] text-gray-300">배정 없음</div>
                      <div className="w-[80px] flex-shrink-0 px-3 text-[12px] font-bold text-gray-900">0h</div>
                      <div className="w-[60px]" />
                    </div>
                  ) : teacherAssigns.map((a, localIdx) => {
                    const globalIdx = activeAssignments.indexOf(a)
                    return (
                      <div key={localIdx} className="flex items-center h-10 border-b border-gray-50 last:border-b-0">
                        <div className="w-[100px] flex-shrink-0 px-4 text-[12px] font-semibold border-r border-gray-100">
                          {localIdx === 0 ? teacher.code : ''}
                        </div>
                        <div className="w-[80px] flex-shrink-0 px-3 text-[12px] border-r border-gray-100">
                          {a.subjectName}
                          {a.isManual && <span className="ml-1 text-blue-400 text-[10px]">✎</span>}
                        </div>
                        <div className="w-[60px] flex-shrink-0 px-3 text-[12px] border-r border-gray-100">{a.grade}학년</div>
                        <div className="flex-1 px-3 text-[12px] border-r border-gray-100">
                          {a.classNums.length === gradeConfigs.find(g => g.grade === a.grade)?.num_classes
                            ? '전체'
                            : `${a.classNums[0]}~${a.classNums[a.classNums.length - 1]}반`
                          } ({a.classNums.length}반)
                        </div>
                        <div className={`w-[80px] flex-shrink-0 px-3 text-[12px] font-bold border-r border-gray-100 ${localIdx === 0 && (isOver || isUnder) ? 'text-yellow-700' : 'text-gray-900'}`}>
                          {localIdx === 0 ? `${totalH}h` : ''}
                        </div>
                        <div className="w-[60px] flex-shrink-0 px-3">
                          <EditAssignmentButton
                            assignment={a}
                            teachers={teachers}
                            onUpdate={(field, value) => updateAssignment(globalIdx, field, value)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* 담임 시수 현황 */}
          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <h3 className="text-[13px] font-semibold mb-3">담임 시수 현황</h3>
            <div className="flex gap-4 flex-wrap">
              {gradeSummary.map(g => (
                <div key={g.grade} className="text-center">
                  <div className="text-[11px] text-gray-400 mb-1">{g.grade}학년</div>
                  <div className="text-[14px] font-bold text-gray-900">{g.homeRoomHours}h</div>
                  <div className="text-[10px] text-gray-400">전담 {g.dedicatedHours}h</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function EditAssignmentButton({ assignment, teachers, onUpdate }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[11px] text-gray-400 hover:text-gray-700">
        편집
      </button>
    )
  }
  return (
    <button onClick={() => setOpen(false)} className="text-[11px] text-blue-500 hover:text-blue-700">
      완료
    </button>
  )
}

function computeWarnings(assignments, gradeConfigs, subjects, teacherCount) {
  const warnings = []
  const totalDedicated = subjects.reduce((sum, s) => {
    const gc = gradeConfigs.find(g => g.grade === s.grade)
    return sum + (gc ? s.weekly_hours * gc.num_classes : 0)
  }, 0)
  const targetHours = teacherCount ? Math.round(totalDedicated / teacherCount) : 0

  // 교사별 시수 합산
  const teacherHours = {}
  for (const a of assignments) {
    teacherHours[a.teacherId] = (teacherHours[a.teacherId] || 0) + a.weeklyHours
  }
  for (const [tid, hours] of Object.entries(teacherHours)) {
    const code = assignments.find(a => a.teacherId === tid)?.teacherCode || tid
    if (hours > targetHours + 3) warnings.push({ type: 'warning', message: `${code}: 시수 초과 (${hours}h / 목표 ${targetHours}h)` })
    if (hours < targetHours - 3) warnings.push({ type: 'warning', message: `${code}: 시수 부족 (${hours}h / 목표 ${targetHours}h)` })
  }

  // 학년 간 담임 시수
  const homeRoomHours = gradeConfigs.map(gc => {
    const weeklyTotal = gc.periods_mon + gc.periods_tue + gc.periods_wed + gc.periods_thu + gc.periods_fri
    const dedicated = subjects.filter(s => s.grade === gc.grade).reduce((s, sub) => s + sub.weekly_hours, 0)
    return weeklyTotal - dedicated
  })
  const hrMax = Math.max(...homeRoomHours)
  const hrMin = Math.min(...homeRoomHours)
  if (hrMax - hrMin > 2) {
    warnings.push({ type: 'warning', message: `학년 간 담임 시수 편차 ${hrMax - hrMin}h (최대 ${hrMax}h, 최소 ${hrMin}h)` })
  }

  return warnings
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/Assignment.jsx
git commit -m "feat: add Assignment tab UI with algorithm result display"
```

---

## Task 4: Layout.jsx에 전담 배정 탭 추가

**Files:**
- Modify: `src/components/Layout.jsx`

- [ ] **Step 1: navItems에 전담 배정 추가**

`src/components/Layout.jsx`에서 import에 `ClipboardList` 추가하고 navItems에 삽입:

```jsx
// import 줄에 ClipboardList 추가
import { Settings, Users, Calendar, DoorOpen, CalendarCheck, Download, Upload, ClipboardList } from 'lucide-react'

// navItems 배열
const navItems = [
  { path: '/setup', label: '학교 설정', icon: Settings },
  { path: '/teachers', label: '전담 교사 관리', icon: Users },
  { path: '/assignment', label: '전담 배정', icon: ClipboardList },
  { path: '/rooms', label: '특별실 관리', icon: DoorOpen },
  { path: '/timetable', label: '전담 시간표', icon: Calendar },
  { path: '/room-timetable', label: '특별실 시간표', icon: CalendarCheck },
]
```

- [ ] **Step 2: App.jsx에 Assignment 라우트 추가**

```jsx
// 변경 전
import RoomTimetable from './pages/RoomTimetable'

// 변경 후
import Assignment from './pages/Assignment'
import RoomTimetable from './pages/RoomTimetable'

// Routes 안에 추가
<Route path="/assignment" element={<Layout><Assignment /></Layout>} />
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/Layout.jsx src/App.jsx
git commit -m "feat: add Assignment tab to navigation"
```

---

## Task 5: 통합 테스트 및 배포

- [ ] **Step 1: 로컬에서 전체 플로우 테스트**

```bash
npm run dev
```

다음 시나리오를 순서대로 테스트:
1. 학교 설정 → 학급 정보 입력 (1-6학년 각 7반, 교시수 설정)
2. 학교 설정 → 과목 설정 탭 → 3~6학년 영어(주요), 3~6학년 과학(주요), 1~6학년 체육(주요), 1~2학년 동아리(일반), 1~2학년 안전(일반) 입력
3. 전담 교사 관리 → 교사 5~10명 추가 (코드만 입력, 담당 학급은 비워도 됨)
4. 전담 배정 탭 → 자동 배정 실행 → 결과 확인
5. 경고 메시지 확인 (편차가 있으면 표시, 없으면 초록 체크)
6. 전담 교사 관리에 적용 버튼 → 전담 교사 관리 탭에서 배정 결과 확인
7. 전담 시간표 → 시간표 자동 생성 → 시간표 확인
8. 사이드바 엑셀 내보내기 → xlsx 파일 다운로드 확인
9. 새로고침 → 데이터 유지 확인 (localStorage)
10. 엑셀 가져오기 → 동일 파일 업로드 → 데이터 복원 확인

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 오류 없이 빌드 완료

- [ ] **Step 3: local 브랜치 푸시**

```bash
git push origin local
```

Expected: Vercel이 자동으로 `timetable-local` 프로젝트 재배포

- [ ] **Step 4: 배포 URL에서 동일 시나리오 테스트**

Vercel 배포 URL에서 Step 1의 시나리오를 반복. localStorage는 브라우저별로 독립이므로 로컬 테스트와 별개로 동작 확인.
