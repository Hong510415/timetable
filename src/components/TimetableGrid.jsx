const DAY_LABELS = ['월', '화', '수', '목', '금']

export default function TimetableGrid({ slots, totalSlots, gradeLunchSlot, teachers, subjects, rooms, timetableRows, onCellClick, grade, classNum, compact, selectedCell }) {
  // 해당 학년의 점심 슬롯 (없으면 -1)
  const lunchSlot = (gradeLunchSlot && grade) ? (gradeLunchSlot[grade] ?? -1) : -1

  function getSlotLabel(slot) {
    if (lunchSlot !== -1 && slot > lunchSlot) {
      return `${slot}교시`
    }
    return `${slot + 1}교시`
  }

  // 같은 교사가 같은 day/slot에서 다른 학급도 가르치고 있으면 충돌
  function getConflicts(cell, day, slot) {
    if (!cell || !timetableRows || !cell.teacher_id) return []
    return timetableRows.filter(r =>
      r.teacher_id &&
      r.subject_id &&
      !r.is_unassigned &&
      r.teacher_id === cell.teacher_id &&
      r.day_of_week === day &&
      r.slot === slot &&
      !(r.grade === grade && r.class_num === classNum)
    )
  }

  return (
    <div className="border border-gray-200 rounded-sm overflow-hidden bg-white">
      <div className="flex bg-gray-50">
        <div className="w-[72px] flex-shrink-0 border-r border-gray-200 h-9 flex items-center justify-center text-[11px] font-semibold text-gray-500">교시</div>
        {DAY_LABELS.map(d => (
          <div key={d} className="flex-1 h-9 flex items-center justify-center border-r border-gray-200 last:border-r-0 text-[11px] font-semibold text-gray-500">{d}</div>
        ))}
      </div>

      {Array.from({ length: totalSlots }, (_, slot) => {
        const isLunch = lunchSlot === slot
        const rowH = isLunch ? 'h-8 bg-gray-50' : (compact ? 'h-[44px]' : 'h-[62px]')
        return (
          <div key={slot} className={`flex border-t border-gray-100 ${rowH}`}>
            <div className="w-[72px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-400 bg-gray-50">
              {isLunch ? '점심' : getSlotLabel(slot)}
            </div>
            {Array.from({ length: 5 }, (_, day) => {
              if (isLunch) {
                return (
                  <div key={day} className="flex-1 border-r border-gray-100 last:border-r-0 flex items-center justify-center text-[11px] text-gray-300">
                    점심시간
                  </div>
                )
              }
              const cell = slots?.[day]?.[slot]
              const teacher = cell?.teacher_id ? teachers?.find(t => t.id === cell.teacher_id) : null
              const subject = cell?.subject_id ? subjects?.find(s => s.id === cell.subject_id) : null
              const room = cell?.room_id ? rooms?.find(r => r.id === cell.room_id) : null
              const unassigned = cell?.is_unassigned
              const conflicts = getConflicts(cell, day, slot)
              const hasConflict = conflicts.length > 0
              const tooltipText = hasConflict
                ? conflicts.map(c => `${c.grade}학년 ${c.class_num}반`).join(', ') + '에서도 같은 교사가 수업 중'
                : ''
              const isSelected = selectedCell?.day === day && selectedCell?.slot === slot

              return (
                <div
                  key={day}
                  onClick={() => onCellClick?.(day, slot, cell)}
                  className={`relative group flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0 transition-colors
                    ${isSelected ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : unassigned ? 'bg-red-500 cursor-pointer' : onCellClick ? 'hover:bg-blue-50 cursor-pointer' : ''}`}
                >
                  {cell?.is_external ? (
                    <>
                      <span className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-semibold text-indigo-700`}>{cell.subject_name || '외부강사'}</span>
                      <span className="text-[10px] text-indigo-400">{cell.external_name || '외부강사'}</span>
                      {room && <span className="text-[10px] text-indigo-400">{room.name}</span>}
                    </>
                  ) : teacher && subject ? (
                    <>
                      <span className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-semibold ${unassigned ? 'text-white' : hasConflict ? 'text-red-600' : 'text-gray-900'}`}>{subject.name}</span>
                      <span className={`text-[10px] ${unassigned ? 'text-red-200' : hasConflict ? 'text-red-400' : 'text-gray-400'}`}>{teacher.code}</span>
                      {room && <span className={`text-[10px] ${hasConflict ? 'text-red-400' : 'text-blue-500'}`}>{room.name}</span>}
                      {hasConflict && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 hidden group-hover:block bg-gray-900 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap">
                          {tooltipText}
                        </div>
                      )}
                    </>
                  ) : unassigned ? (
                    <span className="text-[11px] font-semibold text-white">미배정</span>
                  ) : (
                    <span className="text-[12px] text-gray-200">—</span>
                  )}
                  {onCellClick && !hasConflict && !unassigned && (
                    <div className={`pointer-events-none absolute z-20 hidden group-hover:block bg-gray-800/85 text-white text-[11px] rounded px-2 py-1 w-max max-w-[190px] text-center leading-snug shadow-lg break-keep ${slot === 0 ? 'top-full mt-1' : 'bottom-full mb-1'} ${day === 0 ? 'left-0' : day === 4 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                      {cell
                        ? '클릭해 선택한 뒤 다른 칸을 클릭하면 두 수업이 서로 바뀝니다. 같은 칸을 다시 클릭하면 내용을 수정할 수 있어요.'
                        : '클릭하면 이 시간에 수업을 직접 입력할 수 있어요.'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
