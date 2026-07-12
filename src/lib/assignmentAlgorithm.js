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
export function runAssignmentAlgorithm({ gradeConfigs, subjects, teachers, assignmentSettings, preAssigned }) {
  const maxMajor = assignmentSettings?.maxMajorSubjectsPerTeacher ?? 1
  // 고정 교사가 이미 맡은 (과목·학년·반)은 재분배 대상에서 제외 (자동배정 전 일부 교사 고정 기능)
  const locked = preAssigned instanceof Set ? preAssigned : new Set(preAssigned || [])

  if (!teachers.length) return { assignments: [], warnings: [{ type: 'error', message: '교사가 없습니다.' }], gradeSummary: [], teacherSummary: [] }
  if (!subjects.length) return { assignments: [], warnings: [{ type: 'error', message: '과목이 없습니다.' }], gradeSummary: [], teacherSummary: [] }

  const allUnits = []
  for (const subj of subjects) {
    const gc = gradeConfigs.find(g => g.grade === subj.grade)
    if (!gc) continue
    const classNums = Array.from({ length: gc.num_classes }, (_, i) => i + 1)
      .filter(c => !locked.has(`${subj.id}_${subj.grade}_${c}`))
    if (classNums.length === 0) continue // 모든 반이 고정 교사에게 배정됨
    // 학기 과목(1·2학기)은 연간 기준 절반이므로 균형 계산엔 0.5 가중값(hoursPerClass) 사용,
    // 실제 주당 시수(realHpc)는 출력용으로 별도 보관. 미설정 시 factor=1 → 기존과 완전 동일.
    const factor = (subj.semester === '1' || subj.semester === '2') ? 0.5 : 1
    const wHpc = subj.weekly_hours * factor
    allUnits.push({
      subjectId: subj.id,
      subjectName: subj.name,
      grade: subj.grade,
      is_major: subj.is_major,
      semester: subj.semester || 'year',
      hoursPerClass: wHpc,          // 균형 계산용 (가중)
      realHpc: subj.weekly_hours,   // 출력용 (실제 시수)
      totalHours: wHpc * classNums.length,
      classNums,
    })
  }

  if (!allUnits.length) return { assignments: [], warnings: [{ type: 'error', message: '배정 가능한 과목이 없습니다.' }], gradeSummary: [], teacherSummary: [] }

  const totalDedicated = allUnits.reduce((s, u) => s + u.totalHours, 0)
  const targetHours = Math.round(totalDedicated / teachers.length)

  const ts = teachers.map(t => ({
    id: t.id,
    code: t.code,
    hours: 0,
    majorSubjectNames: new Set(),
    assignments: [], // { subjectId, subjectName, grade, classNums, hoursPerClass, is_major }
  }))

  const units = allUnits // 학기 과목도 일반 분배를 그대로 거침 (주요과목 배치가 꼬이지 않게)

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
        hoursPerClass: unit.hoursPerClass, // 가중값(균형용)
        realHpc: unit.realHpc,             // 실제 시수(출력용)
        semester: unit.semester,
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

  // ── Step C-post: 주요과목 그룹 내 균등화 → 일반과목 여유 확보 ─────
  // 같은 주요과목 그룹에서 targetHours에 도달한 교사 → 여유 있는 교사로 반 1개씩 이동
  // 목적: 영어 교사 등이 주요과목만으로 가득 차지 않고 일반과목도 받을 수 있게
  const minMinorHPC = units.filter(u => !u.is_major)
    .reduce((m, u) => Math.min(m, u.hoursPerClass), Infinity)

  if (isFinite(minMinorHPC)) {
    for (const { name, group } of majorGroups) {
      const grp = ts.filter(t => t.majorSubjectNames.has(name))
      if (grp.length < 2) continue

      for (let iter = 0; iter < 30; iter++) {
        grp.sort((a, b) => b.hours - a.hours)
        const from = grp[0]
        const to = grp[grp.length - 1]

        // from이 targetHours 미만 → 더 이상 이동 불필요
        if (from.hours < targetHours) break
        // to가 (targetHours - minMinorHPC)를 초과 → 받을 자리 없음
        if (to.hours + minMinorHPC > targetHours) break

        let moved = false
        const candidates = from.assignments
          .filter(a => a.is_major && a.subjectName === name)
          .sort((a, b) => a.hoursPerClass - b.hoursPerClass)

        for (const assign of candidates) {
          const unit = group.find(u => u.subjectId === assign.subjectId && u.grade === assign.grade)
          if (!unit) continue
          if (to.hours + unit.hoursPerClass > targetHours) continue
          const classToMove = assign.classNums[assign.classNums.length - 1]
          removeClasses(from, unit, [classToMove])
          addClasses(to, unit, [classToMove])
          moved = true
          break
        }
        if (!moved) break
      }
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

  function pickMinorTeacher(pool, unit) {
    // 1) 이미 같은 과목+학년 담당 중인 교사 우선 (같은 학년 통합)
    // 2) 일반과목 학년 수 가장 적은 교사
    // 3) 전체 학년 수 가장 적은 교사
    // 4) 시수 적은 교사
    return pool.slice().sort((a, b) => {
      const aHasUnit = a.assignments.some(x => x.subjectId === unit.subjectId && x.grade === unit.grade) ? 0 : 1
      const bHasUnit = b.assignments.some(x => x.subjectId === unit.subjectId && x.grade === unit.grade) ? 0 : 1
      if (aHasUnit !== bHasUnit) return aHasUnit - bHasUnit
      const minorGradeDiff = countMinorGrades(a) - countMinorGrades(b)
      if (minorGradeDiff !== 0) return minorGradeDiff
      const gradeDiff = countGrades(a) - countGrades(b)
      return gradeDiff !== 0 ? gradeDiff : a.hours - b.hours
    })[0]
  }

  for (const unit of minorUnits) {
    let remaining = [...unit.classNums]
    while (remaining.length > 0) {
      // 일반과목은 targetHours + hoursPerClass 이내까지 허용 (minor 분산 우선)
      const available = ts.filter(t => t.hours < targetHours + unit.hoursPerClass)
      const pool = available.length > 0 ? available : ts.slice()
      // 1반씩 배정해서 매 루프마다 재선택 → 골고루 분산
      const teacher = pickMinorTeacher(pool, unit)
      addClasses(teacher, unit, remaining.splice(0, 1))
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
  // most: 일반과목 학년 수 최다 교사
  // least: 일반과목 학년 수 최소 교사 중 시수 가장 적은 교사
  for (let iter = 0; iter < 50; iter++) {
    const byMinorGrades = ts.slice().sort((a, b) => countMinorGrades(b) - countMinorGrades(a))
    const most = byMinorGrades[0]
    const maxMinorGrades = countMinorGrades(most)

    // least: 일반과목 학년 수 가장 적고, 그 중 시수 가장 적은 교사
    const minMinorGrades = countMinorGrades(byMinorGrades[byMinorGrades.length - 1])
    if (maxMinorGrades - minMinorGrades <= 1) break

    const leastCandidates = byMinorGrades
      .filter(t => countMinorGrades(t) === minMinorGrades)
      .sort((a, b) => a.hours - b.hours)
    const least = leastCandidates[0]

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
    const newLeastHours = least.hours + unit.hoursPerClass
    const newMostHours = most.hours - unit.hoursPerClass
    // 이동 후 least가 most보다 2단위 이상 역전되면 중단
    if (newLeastHours > newMostHours + unit.hoursPerClass) break

    removeClasses(most, unit, [classToMove])
    addClasses(least, unit, [classToMove])
  }

  // ── Step F-3: 시수 균형 보정 ──────────────────────────────────────
  // 일반과목 반을 1개씩 시수 많은 교사 → 적은 교사로 이동해 시수 균등화
  for (let iter = 0; iter < 50; iter++) {
    const sorted = ts.slice().sort((a, b) => a.hours - b.hours)
    const least = sorted[0]
    const most = sorted[sorted.length - 1]
    if (most.hours - least.hours <= 1) break

    const minorAssigns = most.assignments
      .filter(a => !a.is_major)
      .sort((a, b) => a.hoursPerClass - b.hoursPerClass) // 작은 단위부터 시도

    let moved = false
    for (const fromAssign of minorAssigns) {
      const unit = units.find(u => u.subjectId === fromAssign.subjectId && u.grade === fromAssign.grade)
      if (!unit) continue
      if (unit.hoursPerClass > most.hours - least.hours) continue // 이동 시 역전
      const classToMove = fromAssign.classNums[fromAssign.classNums.length - 1]
      removeClasses(most, unit, [classToMove])
      addClasses(least, unit, [classToMove])
      moved = true
      break
    }
    if (!moved) break
  }

  // ── Step G-pre: 크로스-과목 스왑 — 교사 간 과목 교환으로 담당 학년 집중도 최적화 ──
  // 예: A=과학3학년+영어5학년, B=과학5학년+영어3학년
  //   → A=과학5학년+영어5학년, B=과학3학년+영어3학년
  function uniqueGradeCount(teacher) {
    return new Set(teacher.assignments.map(a => a.grade)).size
  }

  let swapImproved = true
  while (swapImproved) {
    swapImproved = false
    outer:
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const tA = ts[i]
        const tB = ts[j]
        for (const aAssign of tA.assignments) {
          for (const bAssign of tB.assignments) {
            if (aAssign.subjectId === bAssign.subjectId) continue
            if (aAssign.grade === bAssign.grade) continue
            const aHours = aAssign.hoursPerClass * aAssign.classNums.length
            const bHours = bAssign.hoursPerClass * bAssign.classNums.length
            if (aHours !== bHours) continue

            // 주요과목 제약 확인
            const tAMajorsAfter = new Set(
              tA.assignments.filter(a => a !== aAssign && a.is_major).map(a => a.subjectName)
            )
            if (bAssign.is_major) tAMajorsAfter.add(bAssign.subjectName)
            if (tAMajorsAfter.size > maxMajor) continue

            const tBMajorsAfter = new Set(
              tB.assignments.filter(a => a !== bAssign && a.is_major).map(a => a.subjectName)
            )
            if (aAssign.is_major) tBMajorsAfter.add(aAssign.subjectName)
            if (tBMajorsAfter.size > maxMajor) continue

            // 스왑 후 학년 다양성 계산
            const tAGradesAfter = new Set(tA.assignments.filter(a => a !== aAssign).map(a => a.grade))
            tAGradesAfter.add(bAssign.grade)
            const tBGradesAfter = new Set(tB.assignments.filter(a => a !== bAssign).map(a => a.grade))
            tBGradesAfter.add(aAssign.grade)
            const afterDiv = tAGradesAfter.size + tBGradesAfter.size
            const beforeDiv = uniqueGradeCount(tA) + uniqueGradeCount(tB)

            if (afterDiv < beforeDiv) {
              const aIdx = tA.assignments.indexOf(aAssign)
              const bIdx = tB.assignments.indexOf(bAssign)
              tA.assignments[aIdx] = { ...bAssign }
              tB.assignments[bIdx] = { ...aAssign }
              tA.majorSubjectNames = new Set(tA.assignments.filter(a => a.is_major).map(a => a.subjectName))
              tB.majorSubjectNames = new Set(tB.assignments.filter(a => a.is_major).map(a => a.subjectName))
              swapImproved = true
              break outer
            }
          }
        }
      }
    }
  }

  // ── Step G: 통합 같은 일반과목의 다학년 분산 해결 (2차 패스) ─────
  // 1차 결과에서 한 교사가 같은 일반과목명으로 여러 학년을 담당하면,
  // 해당 과목의 minor 배정을 모두 되돌리고 best-fit 빈 패킹으로 재배정.
  // 재배정 결과가 더 나쁘면(분산 미감소 또는 시수 편차 악화) 1차 결과 유지.
  function detectMultiGradeMinor() {
    const issues = new Map() // subjectName -> count of teachers with multi-grade
    for (const t of ts) {
      const minorBySubject = new Map()
      for (const a of t.assignments) {
        if (a.is_major) continue
        if (!minorBySubject.has(a.subjectName)) minorBySubject.set(a.subjectName, new Set())
        minorBySubject.get(a.subjectName).add(a.grade)
      }
      for (const [subjectName, grades] of minorBySubject) {
        if (grades.size > 1) issues.set(subjectName, (issues.get(subjectName) ?? 0) + 1)
      }
    }
    return issues
  }

  function snapshotState() {
    return ts.map(t => ({
      hours: t.hours,
      majorSubjectNames: new Set(t.majorSubjectNames),
      assignments: t.assignments.map(a => ({ ...a, classNums: [...a.classNums] })),
    }))
  }

  function restoreState(snap) {
    // 깊은 복사로 복원 — 이후 mutation이 snap에 역으로 영향 주지 않게
    for (let i = 0; i < ts.length; i++) {
      ts[i].hours = snap[i].hours
      ts[i].majorSubjectNames = new Set(snap[i].majorSubjectNames)
      ts[i].assignments = snap[i].assignments.map(a => ({ ...a, classNums: [...a.classNums] }))
    }
  }

  function imbalance() {
    const hs = ts.map(t => t.hours)
    return Math.max(...hs) - Math.min(...hs)
  }

  function binPackMinorSubject(subjectName, heuristic = 'max') {
    const subjUnits = units.filter(u => !u.is_major && u.subjectName === subjectName)
    if (subjUnits.length === 0) return

    // 학년별 남은 시수
    const gradeRemaining = new Map()
    for (const u of subjUnits) gradeRemaining.set(u.grade, u.totalHours)

    // 교사 → 약속된 학년
    const teacherGrade = new Map()

    // 시수 여유 큰 순 (best-fit decreasing)
    const sorted = ts.slice()
      .map(t => ({ t, capacity: targetHours - t.hours }))
      .filter(x => x.capacity > 0)
      .sort((a, b) => b.capacity - a.capacity)

    for (const { t, capacity } of sorted) {
      const remaining = [...gradeRemaining.entries()].filter(([_, r]) => r > 0)
      if (remaining.length === 0) break

      let chosenGrade
      if (heuristic === 'fit') {
        // 캐파에 완전히 들어가는 학년 중 가장 큰 것 (작은 학년을 한 교사에 몰아주기)
        const fits = remaining.filter(([_, r]) => r <= capacity)
        if (fits.length > 0) {
          fits.sort((a, b) => b[1] - a[1])
          chosenGrade = fits[0][0]
        } else {
          remaining.sort((a, b) => b[1] - a[1])
          chosenGrade = remaining[0][0]
        }
      } else {
        // 'max': 가장 많이 남은 학년부터
        remaining.sort((a, b) => b[1] - a[1])
        chosenGrade = remaining[0][0]
      }
      teacherGrade.set(t.id, chosenGrade)
      const r = gradeRemaining.get(chosenGrade)
      gradeRemaining.set(chosenGrade, r - Math.min(capacity, r))
    }

    // 실제 반 배정
    for (const u of subjUnits) {
      let remaining = [...u.classNums]
      while (remaining.length > 0) {
        const eligible = ts.filter(t =>
          teacherGrade.get(t.id) === u.grade &&
          t.hours + u.hoursPerClass <= targetHours
        )
        let teacher
        if (eligible.length > 0) {
          teacher = eligible.slice().sort((a, b) => (targetHours - b.hours) - (targetHours - a.hours))[0]
        } else {
          const fallback = ts.filter(t => teacherGrade.get(t.id) === u.grade)
          if (fallback.length > 0) {
            teacher = fallback.slice().sort((a, b) => a.hours - b.hours)[0]
          } else {
            // 최종 폴백: 분산 발생 가능
            teacher = pickMinorTeacher(ts.slice(), u)
          }
        }
        addClasses(teacher, u, remaining.splice(0, 1))
      }
    }
  }

  // 크로스-스왑은 행을 교체(병합 X)하므로, 한 교사가 같은 (과목·학년)을
  // 여러 행으로 갖게 될 수 있다. 이후 Step H(반 번호 인접화)는 교사당 한 행만
  // 재정렬하므로 남은 행의 반 번호가 어긋나 중복·누락을 유발한다 → 행 병합으로 정규화.
  for (const t of ts) {
    const byKey = new Map()
    const merged = []
    for (const a of t.assignments) {
      const k = `${a.subjectId}_${a.grade}`
      if (byKey.has(k)) {
        const ex = byKey.get(k)
        ex.classNums = [...new Set([...ex.classNums, ...a.classNums])].sort((x, y) => x - y)
      } else {
        const copy = { ...a, classNums: [...a.classNums] }
        byKey.set(k, copy)
        merged.push(copy)
      }
    }
    t.assignments = merged
  }
  const issues = detectMultiGradeMinor()
  if (issues.size > 0) {
    const originalSnap = snapshotState()
    const originalIssueCount = [...issues.values()].reduce((s, n) => s + n, 0)
    const originalImbalance = imbalance()
    const problemSubjects = [...issues.keys()]

    function tryHeuristic(heuristic) {
      restoreState(originalSnap)
      for (const subjectName of problemSubjects) {
        for (const t of ts) {
          const toRemove = t.assignments.filter(a => !a.is_major && a.subjectName === subjectName)
          for (const a of toRemove) {
            const unit = units.find(u => u.subjectId === a.subjectId && u.grade === a.grade)
            if (unit) removeClasses(t, unit, [...a.classNums])
          }
        }
        binPackMinorSubject(subjectName, heuristic)
      }
      const ic = [...detectMultiGradeMinor().values()].reduce((s, n) => s + n, 0)
      return { snap: snapshotState(), issueCount: ic, imbalance: imbalance() }
    }

    const candidates = [
      { snap: originalSnap, issueCount: originalIssueCount, imbalance: originalImbalance },
      tryHeuristic('max'),
      tryHeuristic('fit'),
    ]
    // 우선순위: 분산 적은 것 → 시수 편차 적은 것
    candidates.sort((a, b) => a.issueCount - b.issueCount || a.imbalance - b.imbalance)
    restoreState(candidates[0].snap)
  }

  // ── Step H: 반 번호 인접화 ─────────────────────────────────────
  // 같은 (과목, 학년)을 여러 교사가 나눠 가질 때, 각 교사의 반 번호를
  // 연속 구간(예: 1~4반, 5~7반)으로 재배정. 시수와 인원은 보존되므로
  // 시수 균형·분산 결과에 영향 없음.
  const sgPairs = [...new Set(units.map(u => `${u.subjectId}_${u.grade}`))]
  for (const key of sgPairs) {
    const [subjectId, gradeStr] = key.split('_')
    const grade = Number(gradeStr)
    const holders = ts
      .map(t => ({ t, a: t.assignments.find(x => x.subjectId === subjectId && x.grade === grade) }))
      .filter(x => x.a && x.a.classNums.length > 0)
    if (holders.length <= 1) continue

    // 현재 최소 반 번호 기준 정렬 → 시각적 순서 보존
    holders.sort((x, y) => Math.min(...x.a.classNums) - Math.min(...y.a.classNums))

    let cursor = 1
    for (const { a } of holders) {
      const count = a.classNums.length
      a.classNums = Array.from({ length: count }, (_, i) => cursor + i)
      cursor += count
    }
  }


  // ── 학기 과목 한 교사에게 모으기 (같은 이름=한 교사) ──
  // 정상 분배로 흩어진 학기 과목을 최소 시수 교사에게 모은다. (미설정 시 학기 과목 없어 무동작)
  const semSubjectNames = [...new Set(units.filter(u => u.semester === '1' || u.semester === '2').map(u => u.subjectName))]
  for (const name of semSubjectNames) {
    const holders = ts.filter(t => t.assignments.some(a => a.subjectName === name))
    if (holders.length === 0) continue
    const main = ts.slice().sort((a, b) => a.hours - b.hours)[0]
    for (const other of holders) {
      if (other === main) continue
      const moving = other.assignments.filter(a => a.subjectName === name)
      for (const a of moving) {
        const unit = units.find(u => u.subjectId === a.subjectId && u.grade === a.grade)
        if (!unit) continue
        const cls = [...a.classNums]
        removeClasses(other, unit, cls)
        addClasses(main, unit, cls)
      }
    }
  }


  // ── 편차 보정: 학기 과목을 모으며 생긴 시수 편차를, 학기 구분 안 된 일반과목만 옮겨 완화 ──
  // (학기 과목·주요과목은 건드리지 않고, 연간 일반과목 한 반씩 이동)
  // 학기 과목이 있을 때만 동작 → 학기제 OFF면 기존 배정과 완전히 동일.
  if (semSubjectNames.length > 0) {
    const isMovable = (a) => !a.is_major && (a.semester !== '1' && a.semester !== '2')
    for (let iter = 0; iter < 200; iter++) {
      const sorted = ts.slice().sort((a, b) => a.hours - b.hours)
      const low = sorted[0]
      if (sorted[sorted.length - 1].hours - low.hours <= 1) break
      // 초과 교사들(시수 큰 순)에서 기부 가능한 연간 일반과목 한 반 찾기
      let moved = false
      for (let i = sorted.length - 1; i > 0; i--) {
        const donor = sorted[i]
        if (donor.hours - low.hours <= 1) break
        const cand = donor.assignments.filter(isMovable).sort((a, b) => a.hoursPerClass - b.hoursPerClass)[0]
        if (!cand) continue
        const unit = units.find(u => u.subjectId === cand.subjectId && u.grade === cand.grade)
        if (!unit || unit.hoursPerClass > donor.hours - low.hours) continue // 이동 시 역전
        const classToMove = cand.classNums[cand.classNums.length - 1]
        removeClasses(donor, unit, [classToMove])
        addClasses(low, unit, [classToMove])
        moved = true
        break
      }
      if (!moved) break
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
        weeklyHours: (a.realHpc ?? a.hoursPerClass) * a.classNums.length, // 실제 시수
        hoursPerClass: a.realHpc ?? a.hoursPerClass,
        semester: a.semester,
        isManual: false,
      })
    }
  }

  // ── Step F: 경고 ──────────────────────────────────────────────────
  const gradeSummary = gradeConfigs.map(gc => {
    const weeklyTotal = gc.periods_mon + gc.periods_tue + gc.periods_wed + gc.periods_thu + gc.periods_fri
    const dedicatedHours = subjects.filter(s => s.grade === gc.grade)
      .reduce((sum, s) => sum + s.weekly_hours * ((s.semester === '1' || s.semester === '2') ? 0.5 : 1), 0)
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
