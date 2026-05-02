/**
 * 전담 시간표 자동 생성 알고리즘
 *
 * slot은 0-based (0=1교시, 1=2교시, ...)
 * gradeLunchSlot: { grade: slotIndex } (DB값 3,4,5 그대로)
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

  // 과목ID → 차단 day-slot Set (특별실 사용 불가 시간)
  const subjectBlockedMap = {}
  for (const room of rooms) {
    if (!room.subjectNames?.length) continue
    const blocked = roomBlockedSlots.filter(b => b.room_id === room.id)
    if (!blocked.length) continue
    for (const subj of subjects) {
      if (!room.subjectNames.includes(subj.name)) continue
      if (!subjectBlockedMap[subj.id]) subjectBlockedMap[subj.id] = new Set()
      for (const b of blocked) subjectBlockedMap[subj.id].add(`${b.day_of_week}-${b.slot}`)
    }
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
  // ① 총 시수 많은 교사 (제약 강한 교사 먼저)
  // ② 교사ID → 학년 → 반 → session
  // 같은 학급의 session을 연속 처리해야 2반도 1반과 같은 요일에 연속 배치됨
  units.sort((a, b) => {
    const aH = teacherTotalHours[a.teacherId] || 0
    const bH = teacherTotalHours[b.teacherId] || 0
    if (aH !== bH) return bH - aH
    if (a.teacherId !== b.teacherId) return a.teacherId < b.teacherId ? -1 : 1
    if (a.grade !== b.grade) return a.grade - b.grade
    if (a.classNum !== b.classNum) return a.classNum - b.classNum
    return a.session - b.session
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

  // 교사+학년+요일별 배정 수 (같은 학년 클러스터링용)
  const teacherGradeDay = {}
  // 학급+요일별 전담 수업 수 (담임 시각 균형용)
  const classDayCount = {}
  // 교사+과목+요일별 배정 슬롯 (연속 배치 + 최대 횟수 제한용)
  const teacherSubjectDaySlots = {}

  function isSlotValid(teacherId, subjectId, day, slot, classAvailable) {
    const subjectBlocked = subjectBlockedMap[subjectId]
    if (!classAvailable.has(slot)) return false
    if (teacherOccupied[teacherId][day].has(slot)) return false
    if (subjectBlocked?.has(`${day}-${slot}`)) return false
    if (splitLunch && allLunchSlotIndexes.includes(slot)) {
      const occ = allLunchSlotIndexes.filter(ls => teacherOccupied[teacherId][day].has(ls))
      if (occ.length >= allLunchSlotIndexes.length - 1) return false
    }
    return true
  }

  // 교사 점심 제약 + 특별실 사용 불가 시간 고려하여 슬롯 탐색
  function findSlot(teacherId, subjectId, day, classAvailable, existingSlotsOnDay) {
    // 같은 과목이 이미 배정된 경우: 연속된 슬롯만 허용
    if (existingSlotsOnDay && existingSlotsOnDay.size > 0) {
      for (let slot = 0; slot < totalSlots; slot++) {
        const isAdjacent = existingSlotsOnDay.has(slot - 1) || existingSlotsOnDay.has(slot + 1)
        if (!isAdjacent) continue
        if (isSlotValid(teacherId, subjectId, day, slot, classAvailable)) return slot
      }
      return -1
    }
    for (let slot = 0; slot < totalSlots; slot++) {
      if (isSlotValid(teacherId, subjectId, day, slot, classAvailable)) return slot
    }
    return -1
  }

  // 요일 점수 계산 후 최적 배정
  function doAssign(teacherId, subjectId, grade, classNum) {
    const candidates = []
    for (let day = 0; day < 5; day++) {
      const ca = gradeClassSlots[grade]?.[classNum]?.[day]
      if (!ca) continue

      // 같은 학급+과목이 하루에 N회 이상이면 스킵 (교사 전체 기준이 아닌 학급 기준)
      const classSubjectDayKey = `${grade}_${classNum}_${subjectId}_${day}`
      const existingSlotsOnDay = teacherSubjectDaySlots[classSubjectDayKey]
      const existingCount = existingSlotsOnDay?.size || 0

      if (existingCount >= getSubjectMaxSameDay(subjectId)) continue

      const slot = findSlot(teacherId, subjectId, day, ca, existingSlotsOnDay)
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

    result[grade][classNum][day][slot] = { teacherId, subjectId }
    teacherOccupied[teacherId][day].add(slot)
    gradeClassSlots[grade][classNum][day].delete(slot)

    if (!teacherGradeDay[teacherId]) teacherGradeDay[teacherId] = {}
    if (!teacherGradeDay[teacherId][grade]) teacherGradeDay[teacherId][grade] = [0, 0, 0, 0, 0]
    teacherGradeDay[teacherId][grade][day]++

    if (!classDayCount[grade]) classDayCount[grade] = {}
    if (!classDayCount[grade][classNum]) classDayCount[grade][classNum] = [0, 0, 0, 0, 0]
    classDayCount[grade][classNum][day]++

    const classSubjectDayKey = `${grade}_${classNum}_${subjectId}_${day}`
    if (!teacherSubjectDaySlots[classSubjectDayKey]) teacherSubjectDaySlots[classSubjectDayKey] = new Set()
    teacherSubjectDaySlots[classSubjectDayKey].add(slot)

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
            is_unassigned: false,
          })
        }
      }
    }
  }

  return { rows, errors: [] }
}
