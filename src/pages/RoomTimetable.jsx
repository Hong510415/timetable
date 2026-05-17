import { useState } from 'react'
import { Download } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { exportRoomTimetable } from '../lib/excelExport'
import ManualModal from '../components/ManualModal'

const MANUAL = [
  {
    title: '특별실 시간표',
    items: [
      '전담 시간표를 자동 생성하면 각 수업이 사용한 특별실이 자동 반영됩니다.',
      '여기서 보이는 결과는 전담 시간표 교사별 보기와 동일하게 동기화됩니다.',
    ],
  },
  {
    title: '엑셀 내보내기',
    items: ['특별실별 시간표를 엑셀 파일로 내보낼 수 있습니다.'],
  },
  {
    title: '점심시간 분리 배정',
    items: ['점심시간 분리 배정 시 특별실 시간표, 전담교사 시간표는 7교시 형식으로 제시됩니다.'],
  },
]

const DAY_LABELS = ['월', '화', '수', '목', '금']

export default function RoomTimetable() {
  const { state } = useApp()
  const { rooms, gradeConfigs, lunchConfig, timetableSlots, roomBlockedSlots, teachers, subjects } = state

  const [selectedRoom, setSelectedRoom] = useState(rooms[0]?.id || null)

  const hasSplit = lunchConfig?.split_lunch && lunchConfig?.lunch_groups?.length > 0
  const totalSlots = hasSplit ? 7 : 6
  const gradeLunchSlot = {}
  if (hasSplit) {
    for (const g of (lunchConfig.lunch_groups || [])) {
      for (const grade of g.grades) gradeLunchSlot[grade] = g.slot
    }
  }

  // 전담 시간표(timetableSlots)에서 직접 room_id로 필터링
  // — 교사별 보기에 표시된 방 배정을 그대로 동기화
  const roomSlots = timetableSlots.filter(
    s => s.room_id === selectedRoom && !s.is_unassigned
  )

  function getSlotsGrid() {
    const grid = {}
    for (let d = 0; d < 5; d++) {
      grid[d] = {}
      const relevant = roomSlots.filter(r => r.day_of_week === d)
      for (const r of relevant) {
        grid[d][r.slot] = {
          grade: r.grade,
          class_num: r.class_num,
          teacher_id: r.teacher_id,
          subject_id: r.subject_id,
        }
      }
    }
    return grid
  }

  const grid = getSlotsGrid()
  const selectedRoomObj = rooms.find(r => r.id === selectedRoom)

  // 화면 표시용: 호환 위해 roomTimetableSlots 형식으로 변환해 엑셀 내보냄
  const exportData = timetableSlots
    .filter(s => s.room_id && !s.is_unassigned)
    .map(s => ({
      room_id: s.room_id,
      day_of_week: s.day_of_week,
      slot: s.slot,
      grade: s.grade,
      class_num: s.class_num,
    }))

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-full">
      <div className="max-w-[1100px] flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">특별실 시간표</h1>
        <div className="flex gap-2">
          <ManualModal title="특별실 시간표" sections={MANUAL} />
          <button
            onClick={() => exportRoomTimetable(rooms, exportData, gradeConfigs, gradeLunchSlot, totalSlots)}
            className="flex items-center gap-2 h-10 px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50"
          >
            <Download size={14} />엑셀 다운로드
          </button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-20 text-gray-300 text-[14px]">
          특별실을 먼저 등록하세요
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-5 flex-wrap">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className={`h-9 px-4 rounded-sm text-[13px] font-semibold border transition-colors
                  ${selectedRoom === room.id ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                {room.name}
              </button>
            ))}
          </div>

          {selectedRoom && (
            <div className="max-w-[540px]">
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-[14px] font-semibold">{selectedRoomObj?.name}</span>
                <span className="text-[12px] text-gray-400">
                  전담 시간표에서 이 방으로 배정된 수업만 표시됩니다
                </span>
              </div>

              {!timetableSlots.length && (
                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-sm text-[12px] text-gray-500">
                  전담 시간표를 먼저 자동 생성하세요.
                </div>
              )}

              <div className="border border-gray-200 rounded-sm overflow-hidden bg-white">
                <div className="flex bg-gray-50">
                  <div className="w-[72px] flex-shrink-0 border-r border-gray-200 h-9 flex items-center justify-center text-[11px] font-semibold text-gray-500">교시</div>
                  {DAY_LABELS.map(d => (
                    <div key={d} className="flex-1 h-9 flex items-center justify-center border-r border-gray-200 last:border-r-0 text-[11px] font-semibold text-gray-500">{d}</div>
                  ))}
                </div>

                {Array.from({ length: totalSlots }, (_, slot) => (
                  <div key={slot} className="flex border-t border-gray-100 h-[62px]">
                    <div className="w-[72px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-400 bg-gray-50">
                      {slot + 1}교시
                    </div>
                    {Array.from({ length: 5 }, (_, day) => {
                      const isDayBlocked = roomBlockedSlots.some(b => b.room_id === selectedRoom && b.day_of_week === day && b.slot === slot)
                      const cell = grid[day]?.[slot]
                      const teacher = cell ? teachers.find(t => t.id === cell.teacher_id) : null
                      const subject = cell ? subjects.find(s => s.id === cell.subject_id) : null
                      return (
                        <div
                          key={day}
                          className={`flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0.5
                            ${isDayBlocked ? 'bg-gray-100' : ''}`}
                        >
                          {isDayBlocked ? (
                            <span className="text-[11px] text-gray-300">사용불가</span>
                          ) : cell ? (
                            <>
                              <span className="text-[13px] font-semibold text-gray-900">{cell.grade}학년 {cell.class_num}반</span>
                              {subject && <span className="text-[10px] text-gray-500">{subject.name} {teacher?.code ? `· ${teacher.code}` : ''}</span>}
                            </>
                          ) : (
                            <span className="text-[12px] text-gray-200">—</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
