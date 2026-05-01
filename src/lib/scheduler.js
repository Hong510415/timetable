/**
 * 전담 시간표 자동 생성 알고리즘
 *
 * slot은 0-based (0=1교시, 1=2교시, ...)
 * DB의 lunch_groups.slot은 교시번호(3,4,5) → 0-based 변환: slot - 1
 * gradeLunchSlot: { grade: slotIndex(0-based) }
 */

export function buildSchedule(gradeConfigs, subjects, teachers, lunchConfig) {
  const splitLunch = lunchConfig?.split_lunch || false
  const lunchGroups = lunchConfig?.lunch_groups || []

  // 학년별 최대 교시 수
  const maxPeriods = Math.max(...gradeConfigs.map(gc =>
    Math.max(gc.periods_mon, gc.periods_tue, gc.periods_wed, gc.periods_thu, gc.periods_fri)
  ))
  // 분리 배정 시 점심 슬롯이 절대 슬롯 인덱스를 차지하므로 +1
  const totalSlots = splitLunch ? maxPeriods + 1 : maxPeriods

  // 학년별 점심 슬롯 (0-based)
  // DB의 slot값은 교시번호(예: 3 = 3교시 후 점심 = slot index 3, 즉 4교시 자리)
  // 3교시 후 점심 → 3교시와 4교시 사이 → slot index 3 (0-based)
  const gradeLunchSlot = {}
  if (splitLunch) {
    for (const group of lunchGroups) {
      for (const grade of group.grades) {
        gradeLunchSlot[grade] = group.slot  // 그대로 사용 (3,4,5 = slot index)
      }
    }
  }

  // 교사 점심 제약: 하루에 모든 점심 슬롯 중 최소 1개는 비워야 함
  const allLunchSlotIndexes = splitLunch
    ? [...new Set(Object.values(gradeLunchSlot))]
    : []

  // 학년·반의 요일별 사용 가능 슬롯 (점심 슬롯 제외)
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
          if (splitLunch && lunchSlot === s) continue  // 해당 학년 점심 슬롯 제외
          if (count < periods) { slots.add(s); count++ }
        }
        return slots
      })
    }
  }

  // 배정 목록
  const assignmentList = []
  for (const teacher of teachers) {
    for (const a of (teacher.teacher_assignments || [])) {
      if (a.weekly_hours > 0) {
        assignmentList.push({
          teacherId: teacher.id,
          subjectId: a.subject_id,
          grade: a.grade,
          classNum: a.class_num,
          periodsLeft: a.weekly_hours,
        })
      }
    }
  }

  // 결과 구조
  const result = {}
  for (const gc of gradeConfigs) {
    result[gc.grade] = {}
    for (let cls = 1; cls <= gc.num_classes; cls++) {
      result[gc.grade][cls] = Array.from({ length: 5 }, () => Array(totalSlots).fill(null))
    }
  }

  // 교사별 점유 추적
  const teacherOccupied = {}
  for (const teacher of teachers) {
    teacherOccupied[teacher.id] = Array.from({ length: 5 }, () => new Set())
  }

  // 총 시수 많은 교사 먼저 배정 (제약 강한 순서)
  const teacherTotalHours = {}
  for (const item of assignmentList) {
    teacherTotalHours[item.teacherId] = (teacherTotalHours[item.teacherId] || 0) + item.periodsLeft
  }
  assignmentList.sort((a, b) => (teacherTotalHours[b.teacherId] || 0) - (teacherTotalHours[a.teacherId] || 0))

  const errors = []

  function tryAssignSlot(teacherId, day, classAvailable, splitLunch, allLunchSlotIndexes) {
    for (let slot = 0; slot < totalSlots; slot++) {
      if (!classAvailable.has(slot)) continue
      if (teacherOccupied[teacherId]?.[day]?.has(slot)) continue
      if (splitLunch && allLunchSlotIndexes.includes(slot)) {
        const occupiedLunch = allLunchSlotIndexes.filter(ls => teacherOccupied[teacherId][day].has(ls))
        if (occupiedLunch.length >= allLunchSlotIndexes.length - 1) continue
      }
      return slot
    }
    return -1
  }

  for (const item of assignmentList) {
    const { teacherId, subjectId, grade, classNum } = item
    let remaining = item.periodsLeft

    // 1차: 요일별 1슬롯씩 분산 배정
    const dayOrder = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5)
    for (const day of dayOrder) {
      if (remaining <= 0) break
      const classAvailable = gradeClassSlots[grade]?.[classNum]?.[day]
      if (!classAvailable) continue
      const slot = tryAssignSlot(teacherId, day, classAvailable, splitLunch, allLunchSlotIndexes)
      if (slot === -1) continue
      result[grade][classNum][day][slot] = { teacherId, subjectId }
      teacherOccupied[teacherId][day].add(slot)
      classAvailable.delete(slot)
      remaining--
    }

    // 2차: 미배정 남으면 같은 날 추가 배정 허용
    if (remaining > 0) {
      const dayOrder2 = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5)
      for (const day of dayOrder2) {
        if (remaining <= 0) break
        const classAvailable = gradeClassSlots[grade]?.[classNum]?.[day]
        if (!classAvailable) continue
        while (remaining > 0) {
          const slot = tryAssignSlot(teacherId, day, classAvailable, splitLunch, allLunchSlotIndexes)
          if (slot === -1) break
          result[grade][classNum][day][slot] = { teacherId, subjectId }
          teacherOccupied[teacherId][day].add(slot)
          classAvailable.delete(slot)
          remaining--
        }
      }
    }

    if (remaining > 0) {
      errors.push({ grade, classNum, teacherId, subjectId, unassigned: remaining })
    }
  }

  return { result, errors, gradeLunchSlot, totalSlots }
}

export function flattenResult(result, schoolId, gradeLunchSlot, totalSlots) {
  const rows = []

  for (const [gradeStr, classes] of Object.entries(result)) {
    const grade = Number(gradeStr)
    const lunchSlot = gradeLunchSlot?.[grade]

    for (const [classStr, days] of Object.entries(classes)) {
      const classNum = Number(classStr)

      for (let day = 0; day < 5; day++) {
        for (let slot = 0; slot < totalSlots; slot++) {
          if (lunchSlot !== undefined && lunchSlot === slot) continue  // 점심 슬롯 저장 안 함

          const cell = days[day][slot]
          if (!cell) continue  // 빈 셀은 저장 안 함 (미배정 아님, 그냥 전담 없는 시간)

          rows.push({
            school_id: schoolId,
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
