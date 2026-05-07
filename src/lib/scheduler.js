/**
 * 전담 시간표 자동 생성 알고리즘
 *
 * slot은 0-based (0=1교시, 1=2교시, ...)
 * gradeLunchSlot: { grade: slotIndex } (DB값 3,4,5 그대로)
 */

export function buildSchedule(gradeConfigs, subjects, teachers, lunchConfig, rooms = [], roomBlockedSlots = []) {
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
  function findAvailableRoom(subjectId, day, slot) {
    const eligible = subjectRooms[subjectId]
    if (!eligible || eligible.length === 0) return undefined  // 일반 교실 — 방 필요 없음
    for (const room of eligible) {
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

  // 1시간 단위 배정 목록 (session은 라운드로빈 순서용)
  const units = []
  for (const teacher of teachers) {
    for (const a of (teacher.teacher_assignments || [])) {
      if (a.weekly_hours > 0) {
        for (let session = 0; session < a.weekly_hours; session++) {
          units.push({
            teacherId: teacher.id,
            subjectId: a.subject_id,
            grade: a.grade,
            classNum: a.class_num,
            session,
          })
        }
      }
    }
  }

  // 교사별 총 시수
  const teacherTotalHours = {}
  for (const u of units) {
    teacherTotalHours[u.teacherId] = (teacherTotalHours[u.teacherId] || 0) + 1
  }

  // 정렬 우선순위:
  // ① session (라운드로빈: 전체 1회차 완료 후 2회차)
  // ② 총 시수 많은 교사 (제약 강한 교사 먼저)
  // ③ 교사ID → 학년 → 반
  units.sort((a, b) => {
    if (a.session !== b.session) return a.session - b.session
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
  // 학급+요일별 전담 수업 수 (담임 시각 균형용)
  const classDayCount = {}

  // 교사 점심 제약 + 특별실 사용 가능 여부 고려하여 슬롯 탐색
  function findSlot(teacherId, subjectId, day, classAvailable) {
    for (let slot = 0; slot < totalSlots; slot++) {
      if (!classAvailable.has(slot)) continue
      if (teacherOccupied[teacherId][day].has(slot)) continue
      // 특별실 필요 과목이면 사용 가능한 방이 있어야 함
      if (subjectRooms[subjectId] && findAvailableRoom(subjectId, day, slot) === null) continue
      if (splitLunch && allLunchSlotIndexes.includes(slot)) {
        const occ = allLunchSlotIndexes.filter(ls => teacherOccupied[teacherId][day].has(ls))
        if (occ.length >= allLunchSlotIndexes.length - 1) continue
      }
      return slot
    }
    return -1
  }

  // 요일 점수 계산 후 최적 배정
  function doAssign(teacherId, subjectId, grade, classNum) {
    const candidates = []
    for (let day = 0; day < 5; day++) {
      const ca = gradeClassSlots[grade]?.[classNum]?.[day]
      if (!ca) continue
      const slot = findSlot(teacherId, subjectId, day, ca)
      if (slot === -1) continue

      const teacherLoad = teacherOccupied[teacherId][day].size
      const sameGradeLoad = teacherGradeDay[teacherId]?.[grade]?.[day] || 0
      // 같은 학년이 이미 있는지 여부 (binary - 누적 보상 방지)
      const hasSameGrade = sameGradeLoad > 0 ? 1 : 0
      const diffGradeLoad = teacherLoad - sameGradeLoad
      const classLoad = classDayCount[grade]?.[classNum]?.[day] || 0

      // 점수:
      // +3 같은 학년 수업이 이미 있는 날 선호 (Priority 1)
      // -2 다른 학년 수업이 있는 날 페널티 (Priority 1)
      // -1 교사 요일 부하 (Priority 3: 교사 요일 균형)
      // -3 학급 요일 부하 (Priority 3: 담임 요일 균형)
      const score = hasSameGrade * 3 - diffGradeLoad * 2 - teacherLoad - classLoad * 3

      candidates.push({ day, slot, score })
    }

    if (candidates.length === 0) return false

    // 점수 높은 날 선택, 동점이면 랜덤
    candidates.sort((a, b) => b.score - a.score || Math.random() - 0.5)
    const { day, slot } = candidates[0]

    // 특별실 결정 (필요한 경우)
    const roomId = findAvailableRoom(subjectId, day, slot)
    result[grade][classNum][day][slot] = { teacherId, subjectId, roomId: roomId || undefined }
    teacherOccupied[teacherId][day].add(slot)
    gradeClassSlots[grade][classNum][day].delete(slot)
    if (roomId) roomOccupied[roomId][day].add(slot)

    if (!teacherGradeDay[teacherId]) teacherGradeDay[teacherId] = {}
    if (!teacherGradeDay[teacherId][grade]) teacherGradeDay[teacherId][grade] = [0, 0, 0, 0, 0]
    teacherGradeDay[teacherId][grade][day]++

    if (!classDayCount[grade]) classDayCount[grade] = {}
    if (!classDayCount[grade][classNum]) classDayCount[grade][classNum] = [0, 0, 0, 0, 0]
    classDayCount[grade][classNum][day]++

    return true
  }

  const errorMap = {}

  for (const unit of units) {
    const { teacherId, subjectId, grade, classNum } = unit
    if (!doAssign(teacherId, subjectId, grade, classNum)) {
      const key = `${grade}|${classNum}|${teacherId}|${subjectId}`
      if (!errorMap[key]) errorMap[key] = { grade, classNum, teacherId, subjectId, unassigned: 0 }
      errorMap[key].unassigned++
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
