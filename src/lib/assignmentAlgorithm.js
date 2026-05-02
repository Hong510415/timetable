/**
 * 전담 배정 알고리즘
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
    assignments: [],
  }))

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
  return map
}
