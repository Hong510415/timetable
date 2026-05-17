/**
 * 특별실 시간표 자동 배정
 * 선택한 교사(들)의 전담 시간표 슬롯을 특별실 스케줄로 복사
 * teacherIds: string[] — 복수 교사 지원 (예: 체육관에 체육 교사 2명)
 * subjectIds: string[] | null — null이면 전 과목, 배열이면 해당 과목만
 *
 * 이미 다른 특별실에 배정된 수업(row.room_id가 다른 방)은 제외 — 중복 방지.
 * 메인 scheduler가 room_id를 매겨주므로, 이 방 또는 미지정 슬롯만 포함.
 */
export function buildRoomSchedule(room, timetableSlots, blockedSlots, teacherIds, subjectIds = null) {
  const ids = Array.isArray(teacherIds) ? teacherIds : [teacherIds]
  const sids = subjectIds && subjectIds.length > 0 ? new Set(subjectIds) : null
  const blocked = blockedSlots.filter(b => b.room_id === room.id)

  const teacherSlots = timetableSlots.filter(
    s => ids.includes(s.teacher_id) && !s.is_unassigned &&
         (sids === null || sids.has(s.subject_id)) &&
         // 다른 방에 이미 배정된 수업은 제외 (room_id 없거나 이 방이면 OK)
         (!s.room_id || s.room_id === room.id)
  )

  // 같은 (day, slot)에 여러 교사가 배정된 경우 첫 번째만 사용
  const seen = new Set()
  const roomSlots = []

  for (const ts of teacherSlots) {
    const key = `${ts.day_of_week}-${ts.slot}`
    if (seen.has(key)) continue
    const isBlocked = blocked.some(
      b => b.day_of_week === ts.day_of_week && b.slot === ts.slot
    )
    if (!isBlocked) {
      seen.add(key)
      roomSlots.push({
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
