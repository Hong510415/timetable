/**
 * 전담 시간표 자동 생성 알고리즘
 *
 * 슬롯 구조:
 * - 일반 학교: slot 0~5 = 1~6교시
 * - 분리 배정: slot 0~6 = 7개 절대 시간 슬롯 (학년별 점심 슬롯 포함)
 *
 * lunchConfig.lunch_groups 예시:
 * [{grades:[1,6], slot:3}, {grades:[2,5], slot:4}, {grades:[3,4], slot:5}]
 */

export function buildSchedule(gradeConfigs, subjects, teachers, lunchConfig) {
  const splitLunch = lunchConfig?.split_lunch || false
  const lunchGroups = lunchConfig?.lunch_groups || []
  const totalSlots = splitLunch ? 7 : 6

  // 학년별 점심 슬롯 인덱스 계산
  const gradeLunchSlot = {}
  if (splitLunch) {
    for (const group of lunchGroups) {
      for (const grade of group.grades) {
        gradeLunchSlot[grade] = group.slot
      }
    }
  }

  // 점심 구간 슬롯 인덱스 목록 (교사 점심 제약에 사용)
  const lunchZoneSlots = splitLunch ? [...new Set(lunchGroups.map(g => g.slot))] : []

  // 학년·반의 사용 가능한 슬롯 목록 생성
  const gradeClassSlots = {}
  for (const gc of gradeConfigs) {
    const { grade, num_classes } = gc
    const dayPeriods = [gc.periods_mon, gc.periods_tue, gc.periods_wed, gc.periods_thu, gc.periods_fri]
    gradeClassSlots[grade] = {}
    for (let cls = 1; cls <= num_classes; cls++) {
      gradeClassSlots[grade][cls] = dayPeriods.map((periods) => {
        const slots = new Set()
        let count = 0
        for (let s = 0; s < totalSlots; s++) {
          if (splitLunch && gradeLunchSlot[grade] === s) continue
          if (count < periods) { slots.add(s); count++ }
        }
        return slots
      })
    }
  }

  // 배정 작업 목록
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

  // 결과 시간표: result[grade][classNum][day][slot]
  const result = {}
  for (const gc of gradeConfigs) {
    result[gc.grade] = {}
    for (let cls = 1; cls <= gc.num_classes; cls++) {
      result[gc.grade][cls] = Array.from({ length: 5 }, () => Array(totalSlots).fill(null))
    }
  }

  // 교사별 점유 슬롯 추적
  const teacherOccupied = {}
  for (const teacher of teachers) {
    teacherOccupied[teacher.id] = Array.from({ length: 5 }, () => new Set())
  }

  const errors = []

  for (const item of assignmentList) {
    const { teacherId, subjectId, grade, classNum } = item
    let remaining = item.periodsLeft

    // 요일 순서 무작위로 고르게 분산
    const dayOrder = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5)

    for (const day of dayOrder) {
      if (remaining <= 0) break
      const classAvailable = gradeClassSlots[grade]?.[classNum]?.[day]
      if (!classAvailable) continue

      for (let slot = 0; slot < totalSlots; slot++) {
        if (remaining <= 0) break
        if (!classAvailable.has(slot)) continue
        if (teacherOccupied[teacherId]?.[day]?.has(slot)) continue

        // 교사 점심 보장: 분리 배정 학교에서 점심 구간 슬롯 모두 채우지 못하게
        if (splitLunch && lunchZoneSlots.includes(slot)) {
          const occupiedLunchZone = lunchZoneSlots.filter(ls => teacherOccupied[teacherId][day].has(ls))
          if (occupiedLunchZone.length >= lunchZoneSlots.length - 1) continue
        }

        result[grade][classNum][day][slot] = { teacherId, subjectId }
        teacherOccupied[teacherId][day].add(slot)
        classAvailable.delete(slot)
        remaining--
        break
      }
    }

    if (remaining > 0) {
      errors.push({ grade, classNum: classNum, teacherId, subjectId, unassigned: remaining })
    }
  }

  return { result, errors, gradeLunchSlot, totalSlots }
}

export function flattenResult(result, schoolId, gradeLunchSlot, totalSlots) {
  const rows = []

  for (const [gradeStr, classes] of Object.entries(result)) {
    const grade = Number(gradeStr)
    const lunchSlot = gradeLunchSlot[grade]

    for (const [classStr, days] of Object.entries(classes)) {
      const classNum = Number(classStr)

      for (let day = 0; day < 5; day++) {
        for (let slot = 0; slot < totalSlots; slot++) {
          const cell = days[day][slot]
          const isLunch = lunchSlot === slot

          if (isLunch) continue // 점심 슬롯은 DB에 저장 안 함

          rows.push({
            school_id: schoolId,
            grade,
            class_num: classNum,
            day_of_week: day,
            slot,
            teacher_id: cell?.teacherId || null,
            subject_id: cell?.subjectId || null,
            is_unassigned: !cell,
          })
        }
      }
    }
  }

  return { rows, errors }
}
