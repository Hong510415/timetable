/**
 * 전담 배정 알고리즘
 *
 * 원칙:
 * 1. 주요과목 1인 제한 절대 준수
 * 2. 한 주요과목(과목+학년)은 최대한 1명에게, 넘치면 학급 쪼개서 다음 교사에게
 * 3. 일반과목은 자투리 시수 채우는 용도로 학급 쪼개서 배정
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
  const ts = teachers.map(t => ({
    id: t.id,
    code: t.code,
    hours: 0,
    majorSubjectKeys: new Set(), // "subjectId:grade" 형태로 담당 중인 주요과목 추적
    assignments: [],
  }))

  function getMajorCount(teacher) {
    return teacher.majorSubjectKeys.size
  }

  function addAssignment(teacher, unit, classNums) {
    const key = `${unit.subjectId}:${unit.grade}`
    const existing = teacher.assignments.find(a => a.key === key)
    if (existing) {
      existing.classNums = [...existing.classNums, ...classNums]
    } else {
      teacher.assignments.push({
        key,
        subjectId: unit.subjectId,
        subjectName: unit.subjectName,
        grade: unit.grade,
        classNums: [...classNums],
        hoursPerClass: unit.hoursPerClass,
        is_major: unit.is_major,
      })
      if (unit.is_major) teacher.majorSubjectKeys.add(key)
    }
    teacher.hours += unit.hoursPerClass * classNums.length
  }

  const warnings = []

  // Step C: 주요과목 배정
  // 총시수 큰 순 정렬 후, 각 unit을 순서대로 처리
  // 각 unit 내에서: 목표시수 여유 있는 교사에게 학급씩 배정, 가득 차면 다음 교사로
  const majorUnits = units.filter(u => u.is_major).sort((a, b) => b.totalHours - a.totalHours)

  for (const unit of majorUnits) {
    let remaining = [...unit.classNums]

    while (remaining.length > 0) {
      // 이 unit(과목+학년)을 이미 담당 중인 교사가 있으면 그 교사에게 계속 배정
      const continuation = ts.find(t => t.assignments.some(a => a.key === `${unit.subjectId}:${unit.grade}`))

      let teacher
      if (continuation) {
        teacher = continuation
      } else {
        // 새 주요과목 — 주요과목 슬롯 남아있는 교사 중 시수 가장 적은 교사
        const eligible = ts.filter(t => getMajorCount(t) < maxMajor)
        if (eligible.length === 0) {
          // 교사 수 부족 — 가장 시수 적은 교사에게 강제 배정
          teacher = ts.slice().sort((a, b) => a.hours - b.hours)[0]
          warnings.push({
            type: 'warning',
            message: `교사 수 부족으로 ${unit.subjectName}(${unit.grade}학년)이 주요과목 제한을 초과해 배정되었습니다. 전담 교사 수를 늘리거나 제한을 해제하세요.`,
          })
        } else {
          teacher = eligible.slice().sort((a, b) => a.hours - b.hours)[0]
        }
      }

      // 이 교사가 받을 수 있는 반 수 (목표시수 기준)
      const roomLeft = targetHours - teacher.hours
      const canTake = roomLeft > 0
        ? Math.min(remaining.length, Math.floor(roomLeft / unit.hoursPerClass))
        : 0

      if (canTake > 0) {
        addAssignment(teacher, unit, remaining.slice(0, canTake))
        remaining = remaining.slice(canTake)
      } else {
        // 이 교사는 이미 목표시수 도달 — 남은 반은 다음 루프에서 새 교사에게
        // continuation이었다면 강제로 1반 배정 (무한루프 방지)
        if (continuation) {
          addAssignment(teacher, unit, remaining.slice(0, 1))
          remaining = remaining.slice(1)
        } else {
          // 새 교사를 골랐는데 시수 여유가 없음 → 이 교사 포함 전체에서 가장 여유 있는 교사로 강제
          const forced = ts.slice().sort((a, b) => a.hours - b.hours)[0]
          addAssignment(forced, unit, remaining.slice(0, 1))
          remaining = remaining.slice(1)
        }
      }
    }
  }

  // Step D: 일반과목 배정 — 학급 쪼개서 자투리 시수 채우기
  const minorUnits = units.filter(u => !u.is_major).sort((a, b) => b.totalHours - a.totalHours)

  for (const unit of minorUnits) {
    let remaining = [...unit.classNums]

    while (remaining.length > 0) {
      // 시수 가장 적은 교사 선택
      const teacher = ts.slice().sort((a, b) => a.hours - b.hours)[0]

      const roomLeft = targetHours - teacher.hours
      const canTake = roomLeft > 0
        ? Math.min(remaining.length, Math.floor(roomLeft / unit.hoursPerClass))
        : 1 // 목표 이미 넘었어도 1반씩은 배정 (남은 과목 처리)

      const classesCount = Math.max(1, canTake)
      addAssignment(teacher, unit, remaining.slice(0, classesCount))
      remaining = remaining.slice(classesCount)
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
