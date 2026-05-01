const DAY_LABELS = ['월', '화', '수', '목', '금']

export default function TimetableGrid({ slots, totalSlots, gradeLunchSlot, teachers, subjects, onCellClick, grade }) {
  // 해당 학년의 점심 슬롯 (없으면 -1)
  const lunchSlot = (gradeLunchSlot && grade) ? (gradeLunchSlot[grade] ?? -1) : -1

  function getSlotLabel(slot) {
    // 점심 슬롯 이후 교시는 점심이 한 자리를 차지하므로 번호 -1 보정
    if (lunchSlot !== -1 && slot > lunchSlot) {
      return `${slot}교시`
    }
    return `${slot + 1}교시`
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
        return (
          <div key={slot} className={`flex border-t border-gray-100 ${isLunch ? 'h-8 bg-gray-50' : 'h-[62px]'}`}>
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
              const unassigned = cell?.is_unassigned

              return (
                <div
                  key={day}
                  onClick={() => onCellClick?.(day, slot, cell)}
                  className={`flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0.5 transition-colors
                    ${unassigned ? 'bg-red-500 cursor-pointer' : onCellClick ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
                >
                  {teacher && subject ? (
                    <>
                      <span className={`text-[13px] font-semibold ${unassigned ? 'text-white' : 'text-gray-900'}`}>{subject.name}</span>
                      <span className={`text-[10px] ${unassigned ? 'text-red-200' : 'text-gray-400'}`}>{teacher.code}</span>
                    </>
                  ) : unassigned ? (
                    <span className="text-[11px] font-semibold text-white">미배정</span>
                  ) : (
                    <span className="text-[12px] text-gray-200">—</span>
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
