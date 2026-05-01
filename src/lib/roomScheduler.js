/**
 * 특별실 시간표 자동 배정
 * 선택한 교사의 전담 시간표 슬롯을 특별실 스케줄로 복사
 */
export function buildRoomSchedule(room, timetableSlots, blockedSlots, schoolId, teacherId) {
  const roomSlots = []
  const blocked = blockedSlots.filter(b => b.room_id === room.id)

  const teacherSlots = timetableSlots.filter(
    s => s.teacher_id === teacherId && !s.is_unassigned
  )

  for (const ts of teacherSlots) {
    const isBlocked = blocked.some(
      b => b.day_of_week === ts.day_of_week && b.slot === ts.slot
    )
    if (!isBlocked) {
      roomSlots.push({
        school_id: schoolId,
        room_id: room.id,
        day_of_week: ts.day_of_week,
        slot: ts.slot,
        grade: ts.grade,
        class_num: ts.class_num,
      })
    }
  }

  return roomSlots
}
