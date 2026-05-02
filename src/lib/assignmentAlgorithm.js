/**
 * 전담 배정 알고리즘
 *
 * 원칙:
 * 1. 같은 과목명은 한 교사에게 몰아줌 (여러 학년 OK, 시수 넘치면 학급 쪼개서 다음 교사)
 * 2. 주요과목 1인 제한 절대 준수 (과목 종류 기준)
 * 3. 일반과목으로 목표시수 정확히 채우기
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
    units.push({
      subjectId: subj.id,
      subjectName: subj.name,
      grade: subj.grade,
      is_major: subj.is_major,
      hoursPerClass: subj.weekly_hours,
      totalHours: subj.weekly_hours * gc.num_classes,
      classNums: Array.from({ length: gc.num_classes }, (_, i) => i + 1),
    })
  }

  if (!units.length) return { assignments: [], warnings: [{ type: 'error', message: '배정 가능한 과목이 없습니다.' }], gradeSummary: [], teacherSummary: [] }

  // Step B: 목표 시수
  const totalDedicated = units.reduce((s, u) => s + u.totalHours, 0)
  const targetHours = Math.round(totalDedicated / teachers.length)

  const ts = teachers.map(t => ({
    id: t.id,
    code: t.code,
    hours: 0,
    majorSubjectNames: new Set(), // 담당 확정된 주요과목 이름
    assignments: [],
  }))

  function addAssignment(teacher, subjectId, subjectName, grade, hoursPerClass, is_major, classNums) {
    const existing = teacher.assignments.find(a => a.subjectId === subjectId && a.grade === grade)
    if (existing) {
      existing.classNums = [...existing.classNums, ...classNums].sort((a, b) => a - b)
    } else {
      teacher.assignments.push({ subjectId, subjectName, grade, classNums: [...classNums].sort((a, b) => a - b), hoursPerClass, is_major })
      if (is_major) teacher.majorSubjectNames.add(subjectName)
    }
    teacher.hours += hoursPerClass * classNums.length
  }

  function removeClasses(teacher, subjectId, grade, classNums) {
    const a = teacher.assignments.find(a => a.subjectId === subjectId && a.grade === grade)
    if (!a) return
    const toRemove = new Set(classNums)
    a.classNums = a.classNums.filter(c => !toRemove.has(c))
    teacher.hours -= a.hoursPerClass * classNums.length
    if (a.classNums.length === 0) {
      teacher.assignments = teacher.assignments.filter(x => x !== a)
      if (a.is_major) teacher.majorSubjectNames.delete(a.subjectName)
    }
  }

  const warnings = []

  // Step C: 주요과목 배정
  // 과목명 그룹별로 처리. 각 그룹에서 담당 교사를 순서대로 지정하며 학급을 채움.
  // 한 교사가 목표시수에 도달하면 그 교사 담당은 끝내고 새 교사에게 이어서 배정.
  const majorSubjectNames = [...new Set(units.filter(u => u.is_major).map(u => u.subjectName))]
  const majorGroups = majorSubjectNames.map(name => {
    const group = units.filter(u => u.is_major && u.subjectName === name)
      .sort((a, b) => b.totalHours - a.totalHours) // 학년별 시수 큰 순
    return { name, group, total: group.reduce((s, u) => s + u.totalHours, 0) }
  }).sort((a, b) => b.total - a.total)

  for (const { name, group } of majorGroups) {
    // 이 과목의 남은 학급 (학년별)
    const remaining = group.map(u => ({ ...u, classNums: [...u.classNums] }))
    // 이 과목을 담당할 교사 목록 (순서대로 채움)
    // currentTeacher: 현재 이 과목을 받고 있는 교사 (null이면 새로 선택)
    let currentTeacher = null

    while (remaining.some(r => r.classNums.length > 0)) {
      // 새 교사 선택
      if (currentTeacher === null) {
        const eligible = ts.filter(t => t.majorSubjectNames.size < maxMajor)
        if (eligible.length === 0) {
          // 교사 수 부족 — 강제 배정
          currentTeacher = ts.slice().sort((a, b) => a.hours - b.hours)[0]
          warnings.push({
            type: 'warning',
            message: `교사 수 부족으로 ${name}이(가) 주요과목 제한을 초과해 배정되었습니다. 교사 수를 늘리거나 제한을 해제하세요.`,
          })
        } else {
          currentTeacher = eligible.slice().sort((a, b) => a.hours - b.hours)[0]
        }
      }

      let roomLeft = targetHours - currentTeacher.hours

      // 이 교사가 이미 목표시수 도달했으면 다음 교사로
      if (roomLeft <= 0) {
        currentTeacher = null
        continue
      }

      // 남은 학급을 시수 큰 학년부터 목표시수까지 배정
      for (const rem of remaining) {
        if (rem.classNums.length === 0) continue
        if (roomLeft <= 0) break
        const canTake = Math.max(1, Math.floor(roomLeft / rem.hoursPerClass))
        const toAssign = rem.classNums.splice(0, canTake)
        addAssignment(currentTeacher, rem.subjectId, rem.subjectName, rem.grade, rem.hoursPerClass, true, toAssign)
        roomLeft -= rem.hoursPerClass * toAssign.length
      }

      // 배정 후 목표시수 도달하면 다음 교사로
      if (targetHours - currentTeacher.hours <= 0) {
        currentTeacher = null
      }
    }
  }

  // Step D: swap — 같은 과목 담당 교사 간 반 교환으로 시수 균등화
  for (const { name, group } of majorGroups) {
    const subjectTeachers = ts.filter(t => t.majorSubjectNames.has(name))
    if (subjectTeachers.length < 2) continue

    for (let iter = 0; iter < 20; iter++) {
      subjectTeachers.sort((a, b) => a.hours - b.hours)
      const least = subjectTeachers[0]
      const most = subjectTeachers[subjectTeachers.length - 1]
      if (most.hours - least.hours <= 2) break

      // most 교사의 이 과목 배정 중 반이 가장 많은 것에서 1반 옮기기
      const mostAssigns = most.assignments
        .filter(a => a.subjectName === name && a.classNums.length >= 1)
        .sort((a, b) => b.classNums.length - a.classNums.length)
      if (!mostAssigns.length) break

      const fromAssign = mostAssigns[0]
      const classToMove = fromAssign.classNums[fromAssign.classNums.length - 1]
      const unit = group.find(u => u.subjectId === fromAssign.subjectId && u.grade === fromAssign.grade)
      if (!unit) break

      removeClasses(most, fromAssign.subjectId, fromAssign.grade, [classToMove])
      addAssignment(least, unit.subjectId, unit.subjectName, unit.grade, unit.hoursPerClass, true, [classToMove])
    }
  }

  // Step E: 일반과목 배정 — 학급 쪼개서 목표시수 채우기
  const minorUnits = units.filter(u => !u.is_major).sort((a, b) => b.totalHours - a.totalHours)

  for (const unit of minorUnits) {
    let remaining = [...unit.classNums]
    while (remaining.length > 0) {
      const teacher = ts.slice().sort((a, b) => a.hours - b.hours)[0]
      const roomLeft = targetHours - teacher.hours
      const canTake = roomLeft > 0
        ? Math.min(remaining.length, Math.max(1, Math.floor(roomLeft / unit.hoursPerClass)))
        : 1
      const toAssign = remaining.splice(0, canTake)
      addAssignment(teacher, unit.subjectId, unit.subjectName, unit.grade, unit.hoursPerClass, false, toAssign)
    }
  }

  // 결과 변환
  const assignments = []
  for (const t of ts) {
    for (const a of t.assignments) {
      assignments.push({
        teacherId: t.id,
        teacherCode: t.code,
        subjectId: a.subjectId,
        subjectName: a.subjectName,
        grade: a.grade,
        classNums: [...a.classNums],
        weeklyHours: a.hoursPerClass * a.classNums.length,
        hoursPerClass: a.hoursPerClass,
        isManual: false,
      })
    }
  }

  // Step F: 경고
  const gradeSummary = gradeConfigs.map(gc => {
    const weeklyTotal = gc.periods_mon + gc.periods_tue + gc.periods_wed + gc.periods_thu + gc.periods_fri
    const dedicatedHours = subjects.filter(s => s.grade === gc.grade).reduce((sum, s) => sum + s.weekly_hours, 0)
    return { grade: gc.grade, dedicatedHours, homeRoomHours: weeklyTotal - dedicatedHours }
  })

  const homeRoomHours = gradeSummary.map(g => g.homeRoomHours)
  const hrMax = Math.max(...homeRoomHours)
  const hrMin = Math.min(...homeRoomHours)
  if (hrMax - hrMin > 2) {
    warnings.push({ type: 'warning', message: `학년 간 담임 시수 편차가 ${hrMax - hrMin}h입니다. (최대 ${hrMax}h, 최소 ${hrMin}h) — 과목 시수를 조정하세요.` })
  }

  const teacherSummary = ts.map(t => ({ teacherId: t.id, teacherCode: t.code, totalHours: t.hours, targetHours }))

  for (const t of ts) {
    if (t.hours > targetHours + 3) warnings.push({ type: 'warning', message: `${t.code}: 시수 초과 (${t.hours}h / 목표 ${targetHours}h)` })
    if (t.hours < targetHours - 3) warnings.push({ type: 'warning', message: `${t.code}: 시수 부족 (${t.hours}h / 목표 ${targetHours}h)` })
  }

  return { assignments, warnings, gradeSummary, teacherSummary }
}

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
