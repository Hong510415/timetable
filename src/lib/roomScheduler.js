/**
 * 특별실 시간표 자동 배정
 * 담당 교사가 있는 특별실 → 전담 시간표 슬롯 그대로 복사
 */
export function buildRoomSchedule(rooms, timetableSlots, blockedSlots, schoolId) {
  const roomSlots = []

  for (const room of rooms) {
    const blocked = blockedSlots.filter(b => b.room_id === room.id)

    if (room.teacher_id) {
      const teacherSlots = timetableSlots.filter(
        s => s.teacher_id === room.teacher_id && !s.is_unassigned
      )
      for (const ts of teacherSlots) {
        const isBlocked = blocked.some(b => b.day === ts.day && b.slot === ts.slot)
        if (!isBlocked) {
          roomSlots.push({
            school_id: schoolId,
            room_id: room.id,
            day: ts.day,
            slot: ts.slot,
            grade: ts.grade,
            class_num: ts.class_num,
            assignment_type: 'dedicated',
          })
        }
      }
    }
  }

  return roomSlots
}
