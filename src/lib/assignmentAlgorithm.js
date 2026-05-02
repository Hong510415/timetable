/**
 * 전담 배정 알고리즘
 *
 * 원칙:
 * 1. 같은 과목명은 한 교사에게 몰아줌 (여러 학년이어도 OK, 시수 넘치면 학급 쪼개기)
 * 2. 주요과목 1인 제한 절대 준수 (과목 종류 기준)
 * 3. 일반과목은 자투리 시수 채우기
 */
export function runAssignmentAlgorithm({ gradeConfigs, subjects, teachers, assignmentSettings }) {
  const maxMajor = assignmentSettings?.maxMajorSubjectsPerTeacher ?? 1

  if (!teachers.length) return { assignments: [], warnings: [{ type: 'error', message: '교사가 없습니다.' }], gradeSummary: [], teacherSummary: [] }
  if (!subjects.length) return { assignments: [], warnings: [{ type: 'error', message: '과목이 없습니다.' }], gradeSummary: [], teacherSummary: [] }

  // Step A: 배정 단위 생성 (과목×학년 조합, 학급별로 분리 가능한 단위)
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

  // 교사 상태
  const ts = teachers.map(t => ({
    id: t.id,
    code: t.code,
    hours: 0,
    majorSubjectNames: new Set(), // 담당 중인 주요과목 이름
    assignments: [], // { subjectId, subjectName, grade, classNums, hoursPerClass }
  }))

  function addAssignment(teacher, unit, classNums) {
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
      if (unit.is_major) teacher.majorSubjectNames.add(unit.subjectName)
    }
    teacher.hours += unit.hoursPerClass * classNums.length
  }

  const warnings = []

  // Step C: 주요과목 배정
  // 과목명 단위로 묶어서 처리 (영어 전체, 과학 전체, 체육 전체...)
  // 각 과목명 그룹을 총시수 큰 순으로 정렬
  const majorUnitsBySubject = []
  const majorSubjectNames = [...new Set(
    units.filter(u => u.is_major).map(u => u.subjectName)
  )]

  for (const name of majorSubjectNames) {
    const group = units.filter(u => u.is_major && u.subjectName === name)
      .sort((a, b) => b.totalHours - a.totalHours) // 학년별 시수 큰 순
    const groupTotal = group.reduce((s, u) => s + u.totalHours, 0)
    majorUnitsBySubject.push({ name, group, groupTotal })
  }
  // 과목 그룹을 총시수 큰 순으로 정렬
  majorUnitsBySubject.sort((a, b) => b.groupTotal - a.groupTotal)

  for (const { name, group } of majorUnitsBySubject) {
    // 이 과목 전체를 처리할 남은 학급 목록 (학년별로 분리 가능)
    // remaining: [{ subjectId, subjectName, grade, hoursPerClass, classNums[] }]
    const remaining = group.map(u => ({ ...u, classNums: [...u.classNums] }))

    while (remaining.some(r => r.classNums.length > 0)) {
      // 주요과목 슬롯 남아있는 교사 중 시수 가장 적은 교사
      // 단, 이미 이 과목을 담당 중인 교사가 있으면 그 교사 우선
      const continuationTeacher = ts.find(t => t.majorSubjectNames.has(name))

      let teacher
      if (continuationTeacher) {
        teacher = continuationTeacher
      } else {
        const eligible = ts.filter(t => t.majorSubjectNames.size < maxMajor)
        if (eligible.length === 0) {
          // 교사 수 부족 — 강제 배정
          teacher = ts.slice().sort((a, b) => a.hours - b.hours)[0]
          warnings.push({
            type: 'warning',
            message: `교사 수 부족으로 ${name}이(가) 주요과목 제한을 초과해 배정되었습니다. 교사 수를 늘리거나 제한을 해제하세요.`,
          })
        } else {
          teacher = eligible.slice().sort((a, b) => a.hours - b.hours)[0]
        }
      }

      // 이 교사가 받을 수 있는 시수 여유
      let roomLeft = targetHours - teacher.hours

      // 여유가 없으면 (목표 초과) continuation이면 1반씩 강제, 아니면 다음 루프에서 새 교사
      if (roomLeft <= 0 && continuationTeacher) {
        // continuation 교사가 꽉 찼으면 더 이상 이 교사에게 주지 않음
        // majorSubjectNames에서 제거해서 다음 루프에서 새 교사를 뽑게 함
        teacher.majorSubjectNames.delete(name)
        continue
      }

      if (roomLeft <= 0) {
        // 새 교사인데 시수 여유 없음 → 최소 1반
        roomLeft = unit => unit.hoursPerClass
      }

      // 남은 학급을 순서대로 배정 (학년 큰 것부터)
      let assigned = false
      for (const rem of remaining) {
        if (rem.classNums.length === 0) continue
        const canTake = Math.max(1, Math.floor(
          (typeof roomLeft === 'function' ? roomLeft(rem) : roomLeft) / rem.hoursPerClass
        ))
        const toAssign = rem.classNums.slice(0, canTake)
        rem.classNums = rem.classNums.slice(canTake)
        addAssignment(teacher, rem, toAssign)
        roomLeft = typeof roomLeft === 'function'
          ? 0
          : roomLeft - rem.hoursPerClass * toAssign.length
        assigned = true
        if (roomLeft <= 0) break
      }

      if (!assigned) break // 안전장치
    }
  }

  // Step D: 일반과목 배정 — 학급 쪼개서 자투리 시수 채우기
  const minorUnits = units.filter(u => !u.is_major).sort((a, b) => b.totalHours - a.totalHours)

  for (const unit of minorUnits) {
    let remaining = [...unit.classNums]

    while (remaining.length > 0) {
      const teacher = ts.slice().sort((a, b) => a.hours - b.hours)[0]
      const roomLeft = targetHours - teacher.hours
      const canTake = roomLeft > 0
        ? Math.min(remaining.length, Math.max(1, Math.floor(roomLeft / unit.hoursPerClass)))
        : 1
      addAssignment(teacher, unit, remaining.slice(0, canTake))
      remaining = remaining.slice(canTake)
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
