/**
 * 전담 배정 알고리즘
 *
 * 원칙:
 * 1. 같은 과목·같은 학년은 한 교사에게 몰아줌 (학년 수 최소화)
 * 2. 주요과목 1인 제한은 절대 준수 (넘치면 학급 분리)
 * 3. 일반과목은 자투리 시수 채우는 용도로 학급 쪼개서 배정
 */
export function runAssignmentAlgorithm({ gradeConfigs, subjects, teachers, assignmentSettings }) {
  const maxMajor = assignmentSettings?.maxMajorSubjectsPerTeacher ?? 1

  if (!teachers.length) return { assignments: [], warnings: [{ type: 'error', message: '교사가 없습니다.' }], gradeSummary: [], teacherSummary: [] }
  if (!subjects.length) return { assignments: [], warnings: [{ type: 'error', message: '과목이 없습니다.' }], gradeSummary: [], teacherSummary: [] }

  // Step A: 배정 단위 생성 (과목×학년 조합)
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
      numClasses: gc.num_classes,
      totalHours: subj.weekly_hours * gc.num_classes,
      classNums: Array.from({ length: gc.num_classes }, (_, i) => i + 1),
    })
  }

  if (!units.length) return { assignments: [], warnings: [{ type: 'error', message: '배정 가능한 과목이 없습니다.' }], gradeSummary: [], teacherSummary: [] }

  // Step B: 목표 시수
  const totalDedicated = units.reduce((s, u) => s + u.totalHours, 0)
  const targetHours = Math.round(totalDedicated / teachers.length)

  // 교사 상태
  const teacherState = teachers.map(t => ({
    id: t.id,
    code: t.code,
    currentHours: 0,
    majorCount: 0,   // 담당 중인 주요과목 종류 수
    assignments: [], // { subjectId, subjectName, grade, classNums, hoursPerClass }
  }))

  // 시수 가장 적고 주요과목 제한 미달인 교사 반환
  function pickTeacher(requireMajorSlot) {
    const pool = requireMajorSlot
      ? teacherState.filter(t => t.majorCount < maxMajor)
      : teacherState
    if (!pool.length) return null
    return pool.slice().sort((a, b) => a.currentHours - b.currentHours)[0]
  }

  // 교사에게 classNums 배정
  function assign(teacher, unit, classNums) {
    const existing = teacher.assignments.find(
      a => a.subjectId === unit.subjectId && a.grade === unit.grade
    )
    if (existing) {
      existing.classNums = [...existing.classNums, ...classNums]
    } else {
      teacher.assignments.push({
        subjectId: unit.subjectId,
        subjectName: unit.subjectName,
        grade: unit.grade,
        classNums: [...classNums],
        hoursPerClass: unit.hoursPerClass,
      })
      if (unit.is_major) teacher.majorCount++
    }
    teacher.currentHours += unit.hoursPerClass * classNums.length
  }

  // Step C: 주요과목 배정
  // 총시수 큰 순서대로, 한 과목·학년 단위를 통째로 한 교사에게
  // 목표시수 초과 시 학급 분리 → 나머지는 다른 교사에게
  const majorUnits = units.filter(u => u.is_major).sort((a, b) => b.totalHours - a.totalHours)
  const warnings = []

  for (const unit of majorUnits) {
    let remaining = [...unit.classNums]

    while (remaining.length > 0) {
      // 이 unit을 이미 담당 중인 교사가 있으면 그 교사에게 계속 배정 (같은 과목·학년 내 학급 추가)
      const continuationTeacher = teacherState.find(
        t => t.assignments.some(a => a.subjectId === unit.subjectId && a.grade === unit.grade)
      )

      let teacher
      if (continuationTeacher) {
        teacher = continuationTeacher
      } else {
        // 새로운 주요과목 — 제한 슬롯 남은 교사 중 시수 가장 적은 교사
        teacher = pickTeacher(true)
      }

      if (!teacher) {
        // 모든 교사가 주요과목 제한 초과 — 어쩔 수 없이 시수 적은 교사에게
        const fallback = teacherState.slice().sort((a, b) => a.currentHours - b.currentHours)[0]
        assign(fallback, unit, remaining)
        warnings.push({
          type: 'warning',
          message: `교사 수 부족으로 ${unit.subjectName}(${unit.grade}학년)이 주요과목 제한을 초과해 배정되었습니다. 전담 교사 수를 늘리거나 제한을 해제하세요.`,
        })
        remaining = []
        break
      }

      // 이 교사가 받을 수 있는 반 수 계산
      // roomLeft가 0 이하이면 최소 1반은 배정 (막히면 loop 탈출 안 되므로)
      const roomLeft = targetHours - teacher.currentHours
      const maxClasses = roomLeft > 0
        ? Math.floor(roomLeft / unit.hoursPerClass)
        : 1
      const classesCanTake = Math.min(remaining.length, Math.max(1, maxClasses))

      const toAssign = remaining.slice(0, classesCanTake)
      remaining = remaining.slice(classesCanTake)

      assign(teacher, unit, toAssign)
    }
  }

  // Step D: 일반과목 배정 — 학급을 쪼개서 자투리 시수 채우기
  const minorUnits = units.filter(u => !u.is_major).sort((a, b) => b.totalHours - a.totalHours)

  for (const unit of minorUnits) {
    let remaining = [...unit.classNums]

    while (remaining.length > 0) {
      // 시수 가장 적은 교사에게 배정
      const teacher = teacherState.slice().sort((a, b) => a.currentHours - b.currentHours)[0]

      const roomLeft = targetHours - teacher.currentHours
      const classesCanTake = Math.max(1, Math.min(remaining.length, Math.ceil(roomLeft / unit.hoursPerClass)))

      const toAssign = remaining.slice(0, classesCanTake)
      remaining = remaining.slice(classesCanTake)

      assign(teacher, unit, toAssign)
    }
  }

  // 결과 변환
  const assignments = []
  for (const ts of teacherState) {
    for (const a of ts.assignments) {
      assignments.push({
        teacherId: ts.id,
        teacherCode: ts.code,
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

  // Step E: 경고 계산
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
