/**
 * 전담 배정 알고리즘
 *
 * 원칙:
 * 1. 같은 과목명은 한 교사에게 몰아줌 (여러 학년 OK, 시수 넘치면 학급 쪼개기)
 * 2. 주요과목 1인 제한 절대 준수
 * 3. 일반과목으로 정확히 목표시수 맞추기
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
    majorSubjectNames: new Set(),
    assignments: [],
  }))

  function addAssignment(teacher, unit, classNums) {
    const existing = teacher.assignments.find(
      a => a.subjectId === unit.subjectId && a.grade === unit.grade
    )
    if (existing) {
      existing.classNums = [...existing.classNums, ...classNums].sort((a, b) => a - b)
    } else {
      teacher.assignments.push({
        subjectId: unit.subjectId,
        subjectName: unit.subjectName,
        grade: unit.grade,
        classNums: [...classNums].sort((a, b) => a - b),
        hoursPerClass: unit.hoursPerClass,
        is_major: unit.is_major,
      })
      if (unit.is_major) teacher.majorSubjectNames.add(unit.subjectName)
    }
    teacher.hours += unit.hoursPerClass * classNums.length
  }

  function removeClasses(teacher, subjectId, grade, classNums) {
    const a = teacher.assignments.find(a => a.subjectId === subjectId && a.grade === grade)
    if (!a) return
    const removing = new Set(classNums)
    a.classNums = a.classNums.filter(c => !removing.has(c))
    teacher.hours -= a.hoursPerClass * classNums.length
    if (a.classNums.length === 0) {
      teacher.assignments = teacher.assignments.filter(x => x !== a)
      if (a.is_major) teacher.majorSubjectNames.delete(a.subjectName)
    }
  }

  const warnings = []

  // Step C: 주요과목 배정
  // 과목명 단위로 묶어서, 총시수 큰 과목부터 처리
  // 각 과목은 학년별 시수 큰 순으로 한 교사에게 목표시수까지 배정, 넘치면 다음 교사
  const majorSubjectNames = [...new Set(units.filter(u => u.is_major).map(u => u.subjectName))]
  const majorGroups = majorSubjectNames.map(name => {
    const group = units.filter(u => u.is_major && u.subjectName === name)
      .sort((a, b) => b.totalHours - a.totalHours)
    return { name, group, total: group.reduce((s, u) => s + u.totalHours, 0) }
  }).sort((a, b) => b.total - a.total)

  for (const { name, group } of majorGroups) {
    // 남은 학급 목록 (학년별)
    const remaining = group.map(u => ({ ...u, classNums: [...u.classNums] }))

    while (remaining.some(r => r.classNums.length > 0)) {
      const continuationTeacher = ts.find(t => t.majorSubjectNames.has(name))

      let teacher
      if (continuationTeacher) {
        teacher = continuationTeacher
      } else {
        const eligible = ts.filter(t => t.majorSubjectNames.size < maxMajor)
        if (eligible.length === 0) {
          teacher = ts.slice().sort((a, b) => a.hours - b.hours)[0]
          warnings.push({
            type: 'warning',
            message: `교사 수 부족으로 ${name}이(가) 주요과목 제한을 초과해 배정되었습니다. 교사 수를 늘리거나 제한을 해제하세요.`,
          })
        } else {
          teacher = eligible.slice().sort((a, b) => a.hours - b.hours)[0]
        }
      }

      let roomLeft = targetHours - teacher.hours

      // continuation 교사가 목표시수 도달 → 더 이상 이 교사에게 주지 않음
      if (roomLeft <= 0 && continuationTeacher) {
        teacher.majorSubjectNames.delete(name)
        continue
      }

      // 남은 학급을 시수 큰 학년부터 배정
      for (const rem of remaining) {
        if (rem.classNums.length === 0) continue
        if (roomLeft <= 0) break
        const canTake = Math.max(1, Math.floor(roomLeft / rem.hoursPerClass))
        const toAssign = rem.classNums.splice(0, canTake)
        addAssignment(teacher, rem, toAssign)
        roomLeft -= rem.hoursPerClass * toAssign.length
      }
    }
  }

  // Step D: 주요과목 배정 후 교환(swap) — 같은 과목 내에서 반을 교환해 시수 균등화
  // 같은 주요과목을 담당하는 두 교사 사이에서 반 교환
  for (const { name, group } of majorGroups) {
    const subjectTeachers = ts.filter(t => t.majorSubjectNames.has(name))
    if (subjectTeachers.length < 2) continue

    // 최대 10회 반복
    for (let iter = 0; iter < 10; iter++) {
      subjectTeachers.sort((a, b) => a.hours - b.hours)
      const least = subjectTeachers[0]
      const most = subjectTeachers[subjectTeachers.length - 1]
      if (most.hours - least.hours <= 2) break

      // most 교사의 이 과목 배정 중 분리 가능한 것 찾기
      const mostAssigns = most.assignments.filter(a => a.subjectName === name && a.classNums.length >= 1)
      if (!mostAssigns.length) break

      // 가장 많은 반을 가진 학년에서 1반 옮기기
      mostAssigns.sort((a, b) => b.classNums.length - a.classNums.length)
      const fromAssign = mostAssigns[0]
      const classToMove = fromAssign.classNums[fromAssign.classNums.length - 1]
      const unit = group.find(u => u.subjectId === fromAssign.subjectId && u.grade === fromAssign.grade)
      if (!unit) break

      removeClasses(most, fromAssign.subjectId, fromAssign.grade, [classToMove])
      addAssignment(least, unit, [classToMove])
    }
  }

  // Step E: 일반과목 배정 — 학급 쪼개서 목표시수 정확히 맞추기
  const minorUnits = units.filter(u => !u.is_major).sort((a, b) => b.totalHours - a.totalHours)

  for (const unit of minorUnits) {
    let remaining = [...unit.classNums]

    while (remaining.length > 0) {
      // 시수 가장 적은 교사에게 배정
      const teacher = ts.slice().sort((a, b) => a.hours - b.hours)[0]
      const roomLeft = targetHours - teacher.hours
      const canTake = roomLeft > 0
        ? Math.min(remaining.length, Math.max(1, Math.floor(roomLeft / unit.hoursPerClass)))
        : 1
      addAssignment(teacher, unit, remaining.splice(0, canTake))
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

  // Step F: 경고 계산
  const gradeSummary = gradeConfigs.map(gc => {
    const weeklyTotal = gc.periods_mon + gc.periods_tue + gc.periods_wed + gc.periods_thu + gc.periods_fri
    const dedicatedHours = subjects.filter(s => s.grade === gc.grade).reduce((sum, s) => sum + s.weekly_hours, 0)
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

  const teacherSummary = ts.map(t => ({ teacherId: t.id, teacherCode: t.code, totalHours: t.hours, targetHours }))

  for (const t of ts) {
    if (t.hours > targetHours + 3) {
      warnings.push({ type: 'warning', message: `${t.code}: 시수 초과 (${t.hours}h / 목표 ${targetHours}h)` })
    }
    if (t.hours < targetHours - 3) {
      warnings.push({ type: 'warning', message: `${t.code}: 시수 부족 (${t.hours}h / 목표 ${targetHours}h)` })
    }
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
