/**
 * 전담 배정 알고리즘 — Greedy "큰 덩어리 우선" 방식
 *
 * 1. 주요과목을 과목명 단위로 묶어서, 시수 많은 학년부터 순서대로 한 교사에게 채움
 *    - 목표시수 도달 시 학급을 쪼개서 다음 교사에게 이어서 배정
 *    - 한 교사가 받는 학년 수를 최소화
 * 2. 주요과목 1인 제한 절대 준수
 * 3. 일반과목으로 나머지 시수 채우기
 * 4. swap으로 균등화하되 학년 분산이 늘어나지 않게
 */
export function runAssignmentAlgorithm({ gradeConfigs, subjects, teachers, assignmentSettings }) {
  const maxMajor = assignmentSettings?.maxMajorSubjectsPerTeacher ?? 1

  if (!teachers.length) return { assignments: [], warnings: [{ type: 'error', message: '교사가 없습니다.' }], gradeSummary: [], teacherSummary: [] }
  if (!subjects.length) return { assignments: [], warnings: [{ type: 'error', message: '과목이 없습니다.' }], gradeSummary: [], teacherSummary: [] }

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

  const totalDedicated = units.reduce((s, u) => s + u.totalHours, 0)
  const targetHours = Math.round(totalDedicated / teachers.length)

  const ts = teachers.map(t => ({
    id: t.id,
    code: t.code,
    hours: 0,
    majorSubjectNames: new Set(),
    assignments: [], // { subjectId, subjectName, grade, classNums, hoursPerClass, is_major }
  }))

  function addClasses(teacher, unit, classNums) {
    if (classNums.length === 0) return
    const existing = teacher.assignments.find(a => a.subjectId === unit.subjectId && a.grade === unit.grade)
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

  function removeClasses(teacher, unit, classNums) {
    if (classNums.length === 0) return
    const a = teacher.assignments.find(a => a.subjectId === unit.subjectId && a.grade === unit.grade)
    if (!a) return
    const toRemove = new Set(classNums)
    a.classNums = a.classNums.filter(c => !toRemove.has(c))
    teacher.hours -= unit.hoursPerClass * classNums.length
    if (a.classNums.length === 0) {
      teacher.assignments = teacher.assignments.filter(x => x !== a)
      if (unit.is_major) teacher.majorSubjectNames.delete(unit.subjectName)
    }
  }

  const warnings = []

  // ── Step C: 주요과목 배정 ──────────────────────────────────────────
  // 과목명 그룹별로, 각 그룹 내에서 학년별 시수 큰 순으로 정렬
  // 한 교사가 목표시수 채울 때까지 학년을 순서대로 통째로 배정
  // 한 학년이 넘치면 그 학년의 학급을 쪼개서 나머지는 다음 교사에게

  const majorSubjectNames = [...new Set(units.filter(u => u.is_major).map(u => u.subjectName))]
  const majorGroups = majorSubjectNames.map(name => {
    const group = units
      .filter(u => u.is_major && u.subjectName === name)
      .sort((a, b) => b.totalHours - a.totalHours) // 시수 많은 학년부터
    return { name, group, total: group.reduce((s, u) => s + u.totalHours, 0) }
  }).sort((a, b) => b.total - a.total) // 총시수 많은 과목부터

  for (const { name, group } of majorGroups) {
    // 각 학년별 남은 학급을 추적
    const rem = group.map(u => ({ unit: u, classNums: [...u.classNums] }))
    let currentTeacher = null

    while (rem.some(r => r.classNums.length > 0)) {
      // 새 교사 선택
      if (currentTeacher === null) {
        const eligible = ts.filter(t => t.majorSubjectNames.size < maxMajor)
        if (eligible.length === 0) {
          currentTeacher = ts.slice().sort((a, b) => a.hours - b.hours)[0]
          warnings.push({
            type: 'warning',
            message: `교사 수 부족으로 ${name}이(가) 주요과목 제한을 초과해 배정되었습니다. 교사 수를 늘리거나 제한을 해제하세요.`,
          })
        } else {
          currentTeacher = eligible.slice().sort((a, b) => a.hours - b.hours)[0]
        }
      }

      const roomLeft = targetHours - currentTeacher.hours
      if (roomLeft <= 0) {
        currentTeacher = null
        continue
      }

      // 남은 학년을 순서대로(시수 큰 학년부터) 배정
      let filled = false
      for (const r of rem) {
        if (r.classNums.length === 0) continue
        const canTake = Math.max(1, Math.floor((targetHours - currentTeacher.hours) / r.unit.hoursPerClass))
        const toAssign = r.classNums.splice(0, canTake)
        addClasses(currentTeacher, r.unit, toAssign)
        filled = true
        if (currentTeacher.hours >= targetHours) {
          currentTeacher = null
          break
        }
      }
      if (!filled) break
    }
  }

  // ── Step D: swap — 같은 과목 담당 교사 간 정확히 같은 학년·반 교환 ──
  // 목표: 교사A가 "과학3학년1반 + 과학4학년1반"을 갖고 있고
  //        교사B가 "과학3학년2~7반 + 과학4학년2~7반"을 가질 때
  //        교사A의 자투리 반을 교사B의 해당 학년으로 합쳐서 교사B가 통째로 갖게 함
  for (const { name, group } of majorGroups) {
    const subjectTeachers = ts.filter(t => t.majorSubjectNames.has(name))
    if (subjectTeachers.length < 2) continue

    // 각 학년별로, 여러 교사에게 분산된 반을 최대한 한 교사에게 합치기
    for (const unit of group) {
      const holders = subjectTeachers
        .map(t => ({ t, a: t.assignments.find(a => a.subjectId === unit.subjectId && a.grade === unit.grade) }))
        .filter(x => x.a)
      if (holders.length <= 1) continue

      // 가장 많은 반을 가진 교사에게 나머지를 합침 (단, 시수 초과 안 되게)
      holders.sort((a, b) => b.a.classNums.length - a.a.classNums.length)
      const main = holders[0]

      for (let i = 1; i < holders.length; i++) {
        const other = holders[i]
        const classesToMove = [...other.a.classNums]
        const newHours = main.t.hours + unit.hoursPerClass * classesToMove.length
        // 합쳤을 때 목표시수 + 여유(hoursPerClass-1)를 넘지 않으면 합침
        if (newHours <= targetHours + unit.hoursPerClass - 1) {
          removeClasses(other.t, unit, classesToMove)
          addClasses(main.t, unit, classesToMove)
        }
      }
    }

    // 합친 후에도 시수 편차가 있으면 단순 swap
    for (let iter = 0; iter < 20; iter++) {
      const sorted = subjectTeachers.filter(t => t.majorSubjectNames.has(name)).slice().sort((a, b) => a.hours - b.hours)
      if (sorted.length < 2) break
      const least = sorted[0]
      const most = sorted[sorted.length - 1]
      if (most.hours - least.hours <= 2) break

      // most에서 가장 작은 단위(1반)를 least에게
      const movable = most.assignments
        .filter(a => a.subjectName === name)
        .sort((a, b) => a.classNums.length - b.classNums.length)
      if (!movable.length) break

      const fromAssign = movable[0]
      const classToMove = fromAssign.classNums[fromAssign.classNums.length - 1]
      const unit = group.find(u => u.subjectId === fromAssign.subjectId && u.grade === fromAssign.grade)
      if (!unit) break

      removeClasses(most, unit, [classToMove])
      addClasses(least, unit, [classToMove])
    }
  }

  // ── Step E: 일반과목 배정 ──────────────────────────────────────────
  // 우선순위:
  // 1) 이미 이 학년을 담당 중 + 시수 여유 있음
  // 2) 담당 학년 수가 적음 (학년 분산 최소화) + 시수 여유 있음
  // 3) 시수 가장 적은 교사
  const minorUnits = units.filter(u => !u.is_major).sort((a, b) => b.totalHours - a.totalHours)

  function countGrades(teacher) {
    return new Set(teacher.assignments.map(a => a.grade)).size
  }

  function countMinorGrades(teacher) {
    return new Set(teacher.assignments.filter(a => !a.is_major).map(a => a.grade)).size
  }

  function pickMinorTeacher(pool) {
    // 1) 일반과목 학년 수 가장 적은 교사 (일반과목 없는 교사 최우선)
    // 2) 동점이면 전체 학년 수 가장 적은 교사
    // 3) 동점이면 시수 적은 교사
    return pool.slice().sort((a, b) => {
      const minorGradeDiff = countMinorGrades(a) - countMinorGrades(b)
      if (minorGradeDiff !== 0) return minorGradeDiff
      const gradeDiff = countGrades(a) - countGrades(b)
      return gradeDiff !== 0 ? gradeDiff : a.hours - b.hours
    })[0]
  }

  for (const unit of minorUnits) {
    let remaining = [...unit.classNums]
    while (remaining.length > 0) {
      const available = ts.filter(t => targetHours - t.hours > 0)
      const pool = available.length > 0 ? available : ts.slice()

      // 교사 선택 우선순위:
      // 1) 일반과목 학년 수 가장 적은 교사 (일반과목 없는 교사 최우선)
      // 2) 동점이면 전체 학년 수 가장 적은 교사
      // 3) 동점이면 시수 적은 교사
      const teacher = pickMinorTeacher(pool)
      const roomLeft = targetHours - teacher.hours
      const canTake = roomLeft > 0
        ? Math.min(remaining.length, Math.max(1, Math.floor(roomLeft / unit.hoursPerClass)))
        : 1
      addClasses(teacher, unit, remaining.splice(0, canTake))
    }
  }

  // ── Step F-1: 같은 과목+학년 담당 교사 간 반 균등 재배분 ────────
  // 영어6학년을 교사1(1반)과 교사2(6반)이 나눠 담당할 때,
  // 교사1의 총시수가 더 적으면 교사2의 반을 교사1에게 이동
  const allSubjectGrades = [...new Set(units.map(u => `${u.subjectId}_${u.grade}`))]
  for (const key of allSubjectGrades) {
    const [subjectId, gradeStr] = key.split('_')
    const grade = Number(gradeStr)
    const unit = units.find(u => u.subjectId === subjectId && u.grade === grade)
    if (!unit) continue

    const holders = ts
      .map(t => ({ t, a: t.assignments.find(a => a.subjectId === subjectId && a.grade === grade) }))
      .filter(x => x.a)
    if (holders.length < 2) continue

    // 시수 균형 맞을 때까지 반복
    for (let iter = 0; iter < 20; iter++) {
      holders.sort((a, b) => a.t.hours - b.t.hours)
      const low = holders[0]
      const high = holders[holders.length - 1]
      if (high.t.hours - low.t.hours < unit.hoursPerClass * 2) break
      if (high.a.classNums.length === 0) break

      const classToMove = high.a.classNums[high.a.classNums.length - 1]
      const newHighHours = high.t.hours - unit.hoursPerClass
      const newLowHours = low.t.hours + unit.hoursPerClass
      // 이동 후 역전되거나 범위 초과하면 중단
      if (newHighHours < newLowHours - unit.hoursPerClass) break
      if (newLowHours > targetHours + unit.hoursPerClass) break

      removeClasses(high.t, unit, [classToMove])
      addClasses(low.t, unit, [classToMove])
    }
  }

  // ── Step F-2: 일반과목 학년 수 불균형 swap ───────────────────────
  // 일반과목 학년이 많은 교사 → 적은 교사로 반 이동
  // 시수는 targetHours 이내로 유지
  for (let iter = 0; iter < 30; iter++) {
    const sorted = ts.slice().sort((a, b) => countMinorGrades(b) - countMinorGrades(a))
    const most = sorted[0]
    const least = sorted[sorted.length - 1]
    if (countMinorGrades(most) - countMinorGrades(least) <= 1) break

    const minorAssigns = most.assignments.filter(a => !a.is_major)
    if (!minorAssigns.length) break

    // least가 아직 담당하지 않는 학년의 일반과목 반
    const movable = minorAssigns
      .filter(a => !least.assignments.some(la => la.grade === a.grade && la.subjectId === a.subjectId))
      .sort((a, b) => a.classNums.length - b.classNums.length)
    if (!movable.length) break

    const fromAssign = movable[0]
    const unit = units.find(u => u.subjectId === fromAssign.subjectId && u.grade === fromAssign.grade)
    if (!unit) break

    const classToMove = fromAssign.classNums[fromAssign.classNums.length - 1]
    const newMostHours = most.hours - unit.hoursPerClass
    const newLeastHours = least.hours + unit.hoursPerClass
    // 시수가 targetHours 초과하지 않도록
    if (newLeastHours > targetHours) break

    removeClasses(most, unit, [classToMove])
    addClasses(least, unit, [classToMove])
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

  // ── Step F: 경고 ──────────────────────────────────────────────────
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
