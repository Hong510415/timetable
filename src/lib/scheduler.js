/**
 * 전담 시간표 자동 생성 알고리즘
 *
 * slot은 0-based (0=1교시, 1=2교시, ...)
 * gradeLunchSlot: { grade: slotIndex } (DB값 3,4,5 그대로)
 *
 * 하드 제약:
 * 1. 같은 교사의 하루 스케줄에서 학년 블록이 끊기지 않도록 (끼어들기 금지)
 *    예: 3학년-4학년-3학년 순서 절대 불가
 * 2. 같은 반의 session N은 session N-1보다 반드시 늦은 요일에 배정
 *    (달력 순서 기준 라운드로빈 보장)
 */

export function buildSchedule(gradeConfigs, subjects, teachers, lunchConfig, rooms = [], roomBlockedSlots = [], options = {}) {
  const subjectSettings = options.subjectSettings || {}

  function getSubjectMaxSameDay(subjectId) {
    const subj = subjects.find(s => s.id === subjectId)
    const settings = subjectSettings[subj?.name]
    if (!settings || !settings.allow) return 1
    return settings.maxCount || 2
  }
  const splitLunch = lunchConfig?.split_lunch || false
  const lunchGroups = lunchConfig?.lunch_groups || []

  const maxPeriods = Math.max(...gradeConfigs.map(gc =>
    Math.max(gc.periods_mon, gc.periods_tue, gc.periods_wed, gc.periods_thu, gc.periods_fri)
  ))
  const totalSlots = splitLunch ? maxPeriods + 1 : maxPeriods

  const gradeLunchSlot = {}
  if (splitLunch) {
    for (const group of lunchGroups) {
      for (const grade of group.grades) {
        gradeLunchSlot[grade] = group.slot
      }
    }
  }

  const allLunchSlotIndexes = splitLunch
    ? [...new Set(Object.values(gradeLunchSlot))]
    : []

  // 과목ID → 사용 가능 특별실 리스트 (이름 매칭)
  const subjectRooms = {}
  for (const subj of subjects) {
    const eligible = rooms.filter(r => r.subjectNames?.includes(subj.name))
    if (eligible.length > 0) subjectRooms[subj.id] = eligible
  }

  // 방별 차단 day-slot Set
  const roomBlockedMap = {}
  for (const room of rooms) {
    roomBlockedMap[room.id] = new Set(
      roomBlockedSlots.filter(b => b.room_id === room.id).map(b => `${b.day_of_week}-${b.slot}`)
    )
  }

  // (day, slot)에서 사용 가능한 방 찾기 — 차단되지 않고, 다른 수업이 점유 안 한 방
  // teacherId가 주어지면 그 교사가 사용 권한 있는 방만 후보 (room.teacherIds 검사)
  function findAvailableRoom(subjectId, day, slot, teacherId) {
    const eligible = subjectRooms[subjectId]
    if (!eligible || eligible.length === 0) return undefined  // 일반 교실 — 방 필요 없음
    for (const room of eligible) {
      if (Array.isArray(room.teacherIds) && room.teacherIds.length > 0 && teacherId != null) {
        if (!room.teacherIds.includes(teacherId)) continue
      }
      if (roomBlockedMap[room.id]?.has(`${day}-${slot}`)) continue
      if (roomOccupied[room.id][day].has(slot)) continue
      return room.id
    }
    return null  // 사용 가능 방 없음 → 슬롯 불가
  }

  // 학년·반의 요일별 가용 슬롯
  const gradeClassSlots = {}
  for (const gc of gradeConfigs) {
    const { grade, num_classes } = gc
    const dayPeriods = [gc.periods_mon, gc.periods_tue, gc.periods_wed, gc.periods_thu, gc.periods_fri]
    const lunchSlot = gradeLunchSlot[grade]
    gradeClassSlots[grade] = {}
    for (let cls = 1; cls <= num_classes; cls++) {
      gradeClassSlots[grade][cls] = dayPeriods.map(periods => {
        const slots = new Set()
        let count = 0
        for (let s = 0; s < totalSlots; s++) {
          if (splitLunch && lunchSlot === s) continue
          if (count < periods) { slots.add(s); count++ }
        }
        return slots
      })
    }
  }

  // 배정 단위: 모든 시수를 개별 session으로 만든다 (singleton round-robin)
  // 같은 학년 모든 반이 session N을 다 마친 뒤 session N+1로 넘어가도록 정렬
  // pair 패턴(연속 2시간)은 doAssign 내부에서 인접 슬롯 검사 + score 보너스로 soft 처리
  const units = []
  for (const teacher of teachers) {
    for (const a of (teacher.teacher_assignments || [])) {
      const wh = a.weekly_hours || 0
      if (wh <= 0) continue
      for (let s = 0; s < wh; s++) {
        units.push({
          teacherId: teacher.id,
          subjectId: a.subject_id,
          grade: a.grade,
          classNum: a.class_num,
          kind: 'single',
          unitIdx: s,
          sessionEquiv: s,
          maxSession: wh,
        })
      }
    }
  }

  // 교사별 총 시수
  const teacherTotalHours = {}
  for (const u of units) {
    teacherTotalHours[u.teacherId] = (teacherTotalHours[u.teacherId] || 0) + 1
  }

  // 정렬: unitIdx (세션 라운드로빈) → 총시수 desc → 교사ID → 학년 → 반
  units.sort((a, b) => {
    if (a.unitIdx !== b.unitIdx) return a.unitIdx - b.unitIdx
    const aH = teacherTotalHours[a.teacherId] || 0
    const bH = teacherTotalHours[b.teacherId] || 0
    if (aH !== bH) return bH - aH
    if (a.teacherId !== b.teacherId) return a.teacherId < b.teacherId ? -1 : 1
    if (a.grade !== b.grade) return a.grade - b.grade
    return a.classNum - b.classNum
  })

  // 결과 구조
  const result = {}
  for (const gc of gradeConfigs) {
    result[gc.grade] = {}
    for (let cls = 1; cls <= gc.num_classes; cls++) {
      result[gc.grade][cls] = Array.from({ length: 5 }, () => Array(totalSlots).fill(null))
    }
  }

  // 교사별 점유 슬롯
  const teacherOccupied = {}
  for (const teacher of teachers) {
    teacherOccupied[teacher.id] = Array.from({ length: 5 }, () => new Set())
  }

  // 방별 점유 슬롯 (특별실 1방=동시간 1수업)
  const roomOccupied = {}
  for (const room of rooms) {
    roomOccupied[room.id] = Array.from({ length: 5 }, () => new Set())
  }

  // 교사+학년+요일별 배정 수 (같은 학년 클러스터링용)
  const teacherGradeDay = {}
  const classDayCount = {}
  const teacherSubjectDaySlots = {}
  const teacherSlotGrade = {}
  // 교사 하루 안에서 슬롯별 과목 추적 — 과목 끼어들기(예: 영어-통합-영어) 방지용
  const teacherSlotSubject = {}

  // 하드 제약 1: 학년 끼어들기 금지
  // slot s를 grade G로 배정하면 그 날 다른 학년의 범위 안에 G가 들어가는지,
  // 혹은 G의 기존 범위 안에 다른 학년이 끼는지 검사
  function wouldCauseGradeSandwich(teacherId, day, newSlot, newGrade) {
    const existing = teacherSlotGrade[teacherId]?.[day]
    if (!existing) return false
    // 기존 슬롯 + 새 슬롯의 학년 맵 구성
    const hypothetical = { ...existing, [newSlot]: newGrade }
    const occupiedSlots = Object.keys(hypothetical).map(Number)
    // 학년별 [min, max] 범위 계산
    const gradeRanges = {}
    for (const s of occupiedSlots) {
      const g = hypothetical[s]
      if (!gradeRanges[g]) gradeRanges[g] = [s, s]
      else { gradeRanges[g][0] = Math.min(gradeRanges[g][0], s); gradeRanges[g][1] = Math.max(gradeRanges[g][1], s) }
    }
    // 어떤 슬롯이 다른 학년의 범위 안에 끼어 있으면 끼어들기
    for (const s of occupiedSlots) {
      const g = hypothetical[s]
      for (const [h, [minH, maxH]] of Object.entries(gradeRanges)) {
        if (Number(h) === g) continue
        if (s > minH && s < maxH) return true
      }
    }
    return false
  }

  // pair 배정용: 두 슬롯 동시 배치 후 sandwich 검사
  function pairWouldCauseGradeSandwich(teacherId, day, slotA, slotB, newGrade) {
    const existing = teacherSlotGrade[teacherId]?.[day] || {}
    const hypothetical = { ...existing, [slotA]: newGrade, [slotB]: newGrade }
    const occupiedSlots = Object.keys(hypothetical).map(Number)
    const gradeRanges = {}
    for (const s of occupiedSlots) {
      const g = hypothetical[s]
      if (!gradeRanges[g]) gradeRanges[g] = [s, s]
      else { gradeRanges[g][0] = Math.min(gradeRanges[g][0], s); gradeRanges[g][1] = Math.max(gradeRanges[g][1], s) }
    }
    for (const s of occupiedSlots) {
      const g = hypothetical[s]
      for (const [h, [minH, maxH]] of Object.entries(gradeRanges)) {
        if (Number(h) === g) continue
        if (s > minH && s < maxH) return true
      }
    }
    return false
  }

  // 과목 끼어들기 검사 — 같은 교사의 하루 안에서 ABA 패턴(영어-통합-영어 등) 금지
  function wouldCauseSubjectSandwich(teacherId, day, newSlot, newSubjectId) {
    const existing = teacherSlotSubject[teacherId]?.[day]
    if (!existing) return false
    const hypothetical = { ...existing, [newSlot]: newSubjectId }
    const occupiedSlots = Object.keys(hypothetical).map(Number)
    const ranges = {}
    for (const s of occupiedSlots) {
      const subj = hypothetical[s]
      if (!ranges[subj]) ranges[subj] = [s, s]
      else { ranges[subj][0] = Math.min(ranges[subj][0], s); ranges[subj][1] = Math.max(ranges[subj][1], s) }
    }
    for (const s of occupiedSlots) {
      const subj = hypothetical[s]
      for (const [other, [minH, maxH]] of Object.entries(ranges)) {
        if (other === String(subj)) continue
        if (s > minH && s < maxH) return true
      }
    }
    return false
  }

  function pairWouldCauseSubjectSandwich(teacherId, day, slotA, slotB, newSubjectId) {
    const existing = teacherSlotSubject[teacherId]?.[day] || {}
    const hypothetical = { ...existing, [slotA]: newSubjectId, [slotB]: newSubjectId }
    const occupiedSlots = Object.keys(hypothetical).map(Number)
    const ranges = {}
    for (const s of occupiedSlots) {
      const subj = hypothetical[s]
      if (!ranges[subj]) ranges[subj] = [s, s]
      else { ranges[subj][0] = Math.min(ranges[subj][0], s); ranges[subj][1] = Math.max(ranges[subj][1], s) }
    }
    for (const s of occupiedSlots) {
      const subj = hypothetical[s]
      for (const [other, [minH, maxH]] of Object.entries(ranges)) {
        if (other === String(subj)) continue
        if (s > minH && s < maxH) return true
      }
    }
    return false
  }

  function isSlotValid(teacherId, subjectId, day, slot, classAvailable) {
    if (!classAvailable.has(slot)) return false
    if (teacherOccupied[teacherId][day].has(slot)) return false
    if (subjectRooms[subjectId] && findAvailableRoom(subjectId, day, slot, teacherId) === null) return false
    if (splitLunch && allLunchSlotIndexes.includes(slot)) {
      const occ = allLunchSlotIndexes.filter(ls => teacherOccupied[teacherId][day].has(ls))
      if (occ.length >= allLunchSlotIndexes.length - 1) return false
    }
    return true
  }

  // 하드 제약 2: 달력 기준 라운드로빈
  // classLastDay[grade_classNum]: 해당 반의 마지막 배정 요일 (session N-1)
  const classLastDay = {}
  // tgMaxSessionDay[teacherId_grade]: 동일 교사·학년의 직전 session batch 최대 요일
  const tgMaxSessionDay = {}

  // doAssign: minDay 이상의 요일에만 배정 시도 (하드 제약 2 적용)
  function doAssign(teacherId, subjectId, grade, classNum, session, maxSession, minDay) {
    const candidates = []

    for (let day = 0; day < 5; day++) {
      if (day < minDay) continue  // 하드 제약 2

      const ca = gradeClassSlots[grade]?.[classNum]?.[day]
      if (!ca) continue

      const classSubjectDayKey = `${grade}_${classNum}_${subjectId}_${day}`
      const existingSlotsOnDay = teacherSubjectDaySlots[classSubjectDayKey]
      const existingCount = existingSlotsOnDay?.size || 0
      if (existingCount >= getSubjectMaxSameDay(subjectId)) continue

      // 이 날의 유효한 슬롯 전부 탐색 (하드 제약 1: 끼어들기 금지 적용)
      const validSlots = []
      const trySlot = (slot) => {
        if (!isSlotValid(teacherId, subjectId, day, slot, ca)) return
        if (wouldCauseGradeSandwich(teacherId, day, slot, grade)) return  // 하드 제약 1: 학년 끼어들기
        if (wouldCauseSubjectSandwich(teacherId, day, slot, subjectId)) return  // 하드 제약 1-2: 과목 끼어들기
        validSlots.push(slot)
      }

      if (existingSlotsOnDay && existingSlotsOnDay.size > 0) {
        // 연속 배치: 기존 슬롯에 인접한 슬롯만
        for (let slot = 0; slot < totalSlots; slot++) {
          if (existingSlotsOnDay.has(slot - 1) || existingSlotsOnDay.has(slot + 1)) trySlot(slot)
        }
      } else {
        for (let slot = 0; slot < totalSlots; slot++) trySlot(slot)
      }
      if (validSlots.length === 0) continue

      // 같은 날 여러 슬롯 중 최적 슬롯 선택 (인접 다른 학년 최소화)
      let bestSlot = validSlots[0], bestAdjPenalty = Infinity, bestSameAdj = -1
      for (const slot of validSlots) {
        let ap = 0, sa = 0
        for (const adj of [slot - 1, slot + 1]) {
          if (adj < 0 || adj >= totalSlots) continue
          const ag = teacherSlotGrade[teacherId]?.[day]?.[adj]
          if (ag !== undefined) { ag !== grade ? ap++ : sa++ }
        }
        if (ap < bestAdjPenalty || (ap === bestAdjPenalty && sa > bestSameAdj)) {
          bestAdjPenalty = ap; bestSameAdj = sa; bestSlot = slot
        }
      }
      const slot = bestSlot

      const teacherLoad = teacherOccupied[teacherId][day].size
      const sameGradeLoad = teacherGradeDay[teacherId]?.[grade]?.[day] || 0
      const hasSameGrade = sameGradeLoad > 0 ? 1 : 0
      const diffGradeLoad = teacherLoad - sameGradeLoad
      const classLoad = classDayCount[grade]?.[classNum]?.[day] || 0

      let pairBonus = 0
      if (getSubjectMaxSameDay(subjectId) >= 2 && existingCount === 0) {
        for (const adj of [slot - 1, slot + 1]) {
          if (adj < 0 || adj >= totalSlots) continue
          if (!ca.has(adj)) continue
          if (teacherOccupied[teacherId][day].has(adj)) continue
          if (subjectRooms[subjectId] && findAvailableRoom(subjectId, day, adj, teacherId) === null) continue
          if (splitLunch && allLunchSlotIndexes.includes(adj)) continue
          pairBonus = 5
          break
        }
      }

      // session 기반 요일 분산 (소프트 강선호)
      // session 0 → 월, session 1 → 수, session 2 → 금 (weekly_hours=3 기준)
      const targetDay = maxSession <= 1 ? 2 : Math.round(session * 4 / (maxSession - 1))
      const sessionDayScore = -Math.abs(day - targetDay) * 3

      const score = pairBonus + hasSameGrade * 3 - diffGradeLoad * 2 - bestAdjPenalty * 6 - teacherLoad - classLoad * 3 + sessionDayScore

      candidates.push({ day, slot, score })
    }

    if (candidates.length === 0) return -1

    candidates.sort((a, b) => b.score - a.score || Math.random() - 0.5)
    const { day, slot } = candidates[0]

    // 특별실 결정 (필요한 경우)
    const roomId = findAvailableRoom(subjectId, day, slot, teacherId)
    result[grade][classNum][day][slot] = { teacherId, subjectId, roomId: roomId || undefined }
    teacherOccupied[teacherId][day].add(slot)
    gradeClassSlots[grade][classNum][day].delete(slot)
    if (roomId) roomOccupied[roomId][day].add(slot)
    if (!teacherSlotGrade[teacherId]) teacherSlotGrade[teacherId] = Array.from({ length: 5 }, () => ({}))
    teacherSlotGrade[teacherId][day][slot] = grade
    if (!teacherSlotSubject[teacherId]) teacherSlotSubject[teacherId] = Array.from({ length: 5 }, () => ({}))
    teacherSlotSubject[teacherId][day][slot] = subjectId

    if (!teacherGradeDay[teacherId]) teacherGradeDay[teacherId] = {}
    if (!teacherGradeDay[teacherId][grade]) teacherGradeDay[teacherId][grade] = [0, 0, 0, 0, 0]
    teacherGradeDay[teacherId][grade][day]++

    if (!classDayCount[grade]) classDayCount[grade] = {}
    if (!classDayCount[grade][classNum]) classDayCount[grade][classNum] = [0, 0, 0, 0, 0]
    classDayCount[grade][classNum][day]++

    const classSubjectDayKey = `${grade}_${classNum}_${subjectId}_${day}`
    if (!teacherSubjectDaySlots[classSubjectDayKey]) teacherSubjectDaySlots[classSubjectDayKey] = new Set()
    teacherSubjectDaySlots[classSubjectDayKey].add(slot)

    return day
  }

  // pair 단위 배정 — 같은 학년 학급들이 모두 동일한 패턴(2시간 연속)을 따르도록 강제
  function doAssignPair(teacherId, subjectId, grade, classNum, sessionEquiv, maxSession, minDay) {
    const candidates = []
    for (let day = 0; day < 5; day++) {
      if (day < minDay) continue
      const ca = gradeClassSlots[grade]?.[classNum]?.[day]
      if (!ca) continue

      const cKey = `${grade}_${classNum}_${subjectId}_${day}`
      const existingCount = teacherSubjectDaySlots[cKey]?.size || 0
      if (existingCount + 2 > getSubjectMaxSameDay(subjectId)) continue

      for (let slot = 0; slot < totalSlots - 1; slot++) {
        if (!isSlotValid(teacherId, subjectId, day, slot, ca)) continue
        if (!isSlotValid(teacherId, subjectId, day, slot + 1, ca)) continue
        if (pairWouldCauseGradeSandwich(teacherId, day, slot, slot + 1, grade)) continue
        if (pairWouldCauseSubjectSandwich(teacherId, day, slot, slot + 1, subjectId)) continue

        const teacherLoad = teacherOccupied[teacherId][day].size
        const sameGradeLoad = teacherGradeDay[teacherId]?.[grade]?.[day] || 0
        const hasSameGrade = sameGradeLoad > 0 ? 1 : 0
        const diffGradeLoad = teacherLoad - sameGradeLoad
        const classLoad = classDayCount[grade]?.[classNum]?.[day] || 0

        // pair 외곽 인접 다른 학년 페널티
        let adjPenalty = 0
        for (const adj of [slot - 1, slot + 2]) {
          if (adj < 0 || adj >= totalSlots) continue
          const ag = teacherSlotGrade[teacherId]?.[day]?.[adj]
          if (ag !== undefined && ag !== grade) adjPenalty++
        }

        const targetDay = maxSession <= 1 ? 2 : Math.round(sessionEquiv * 4 / (maxSession - 1))
        const sessionDayScore = -Math.abs(day - targetDay) * 3

        const score = hasSameGrade * 3 - diffGradeLoad * 2 - adjPenalty * 6 - teacherLoad - classLoad * 3 + sessionDayScore
        candidates.push({ day, slot, score })
      }
    }

    if (candidates.length === 0) return -1
    candidates.sort((a, b) => b.score - a.score || Math.random() - 0.5)
    const { day, slot } = candidates[0]

    for (const s of [slot, slot + 1]) {
      const roomId = findAvailableRoom(subjectId, day, s, teacherId)
      result[grade][classNum][day][s] = { teacherId, subjectId, roomId: roomId || undefined }
      teacherOccupied[teacherId][day].add(s)
      gradeClassSlots[grade][classNum][day].delete(s)
      if (roomId) roomOccupied[roomId][day].add(s)
      if (!teacherSlotGrade[teacherId]) teacherSlotGrade[teacherId] = Array.from({ length: 5 }, () => ({}))
      teacherSlotGrade[teacherId][day][s] = grade
      if (!teacherSlotSubject[teacherId]) teacherSlotSubject[teacherId] = Array.from({ length: 5 }, () => ({}))
      teacherSlotSubject[teacherId][day][s] = subjectId

      if (!teacherGradeDay[teacherId]) teacherGradeDay[teacherId] = {}
      if (!teacherGradeDay[teacherId][grade]) teacherGradeDay[teacherId][grade] = [0, 0, 0, 0, 0]
      teacherGradeDay[teacherId][grade][day]++

      if (!classDayCount[grade]) classDayCount[grade] = {}
      if (!classDayCount[grade][classNum]) classDayCount[grade][classNum] = [0, 0, 0, 0, 0]
      classDayCount[grade][classNum][day]++

      const cKey = `${grade}_${classNum}_${subjectId}_${day}`
      if (!teacherSubjectDaySlots[cKey]) teacherSubjectDaySlots[cKey] = new Set()
      teacherSubjectDaySlots[cKey].add(s)
    }
    return day
  }

  const errorMap = {}

  for (const unit of units) {
    const { teacherId, subjectId, grade, classNum, kind, unitIdx, sessionEquiv, maxSession } = unit
    const classKey = `${grade}_${classNum}`
    const tgKey = `${teacherId}_${grade}`

    // 하드 제약 2-A: 같은 반의 이전 unit보다 반드시 늦은 요일
    const perClassMinDay = unitIdx > 0 ? (classLastDay[classKey] ?? -1) + 1 : 0

    // 하드 제약 2-B: 동일 교사·학년의 이전 unitIdx batch 최대 요일 이상
    let tgMinDay = 0
    const tgInfo = tgMaxSessionDay[tgKey]
    if (unitIdx > 0 && tgInfo && tgInfo.unitIdx === unitIdx - 1) {
      tgMinDay = tgInfo.maxDay
    }

    const hardMinDay = Math.max(perClassMinDay, tgMinDay)

    // 배정 시도: kind에 따라 doAssign / doAssignPair 디스패치, 폴백 체인
    const tryAssign = (minDay) => kind === 'pair'
      ? doAssignPair(teacherId, subjectId, grade, classNum, sessionEquiv, maxSession, minDay)
      : doAssign(teacherId, subjectId, grade, classNum, sessionEquiv, maxSession, minDay)

    let placedDay = tryAssign(hardMinDay)
    if (placedDay === -1 && hardMinDay > perClassMinDay) placedDay = tryAssign(perClassMinDay)
    if (placedDay === -1 && perClassMinDay > 0) placedDay = tryAssign(0)

    const hours = kind === 'pair' ? 2 : 1
    if (placedDay === -1) {
      const key = `${grade}|${classNum}|${teacherId}|${subjectId}`
      if (!errorMap[key]) errorMap[key] = { grade, classNum, teacherId, subjectId, unassigned: 0 }
      errorMap[key].unassigned += hours
    } else {
      classLastDay[classKey] = Math.max(classLastDay[classKey] ?? -1, placedDay)
      if (!tgMaxSessionDay[tgKey] || tgMaxSessionDay[tgKey].unitIdx < unitIdx) {
        tgMaxSessionDay[tgKey] = { unitIdx, maxDay: placedDay }
      } else if (tgMaxSessionDay[tgKey].unitIdx === unitIdx) {
        tgMaxSessionDay[tgKey].maxDay = Math.max(tgMaxSessionDay[tgKey].maxDay, placedDay)
      }
    }
  }

  const errors = Object.values(errorMap)
  return { result, errors, gradeLunchSlot, totalSlots }
}

export function flattenResult(result, gradeLunchSlot, totalSlots) {
  const rows = []

  for (const [gradeStr, classes] of Object.entries(result)) {
    const grade = Number(gradeStr)
    const lunchSlot = gradeLunchSlot?.[grade]

    for (const [classStr, days] of Object.entries(classes)) {
      const classNum = Number(classStr)

      for (let day = 0; day < 5; day++) {
        for (let slot = 0; slot < totalSlots; slot++) {
          if (lunchSlot !== undefined && lunchSlot === slot) continue

          const cell = days[day][slot]
          if (!cell) continue

          rows.push({
            grade,
            class_num: classNum,
            day_of_week: day,
            slot,
            teacher_id: cell.teacherId,
            subject_id: cell.subjectId,
            room_id: cell.roomId || null,
            is_unassigned: false,
          })
        }
      }
    }
  }

  return { rows, errors: [] }
}
