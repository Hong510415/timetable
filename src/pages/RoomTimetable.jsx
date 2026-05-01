import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { buildRoomSchedule } from '../lib/roomScheduler'
import { exportRoomTimetable } from '../lib/excelExport'

const DAY_LABELS = ['월', '화', '수', '목', '금']
const GRADES = [1, 2, 3, 4, 5, 6]

export default function RoomTimetable() {
  const [schoolId, setSchoolId] = useState(null)
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [roomSlots, setRoomSlots] = useState([]) // from room_timetable_slots
  const [timetableSlots, setTimetableSlots] = useState([]) // dedicated teacher slots
  const [blockedSlots, setBlockedSlots] = useState([])
  const [gradeConfigs, setGradeConfigs] = useState([])
  const [lunchConfig, setLunchConfig] = useState(null)
  const [totalSlots, setTotalSlots] = useState(6)
  const [gradeLunchSlot, setGradeLunchSlot] = useState({})
  const [generating, setGenerating] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: school } = await supabase.from('schools').select('id').eq('user_id', user.id).single()
    if (!school) return
    setSchoolId(school.id)

    const [{ data: r }, { data: gc }, { data: lunch }, { data: ts }, { data: blocked }] = await Promise.all([
      supabase.from('rooms').select('*').eq('school_id', school.id).order('name'),
      supabase.from('grade_configs').select('*').eq('school_id', school.id),
      supabase.from('lunch_config').select('*').eq('school_id', school.id).single(),
      supabase.from('timetable_slots').select('*').eq('school_id', school.id),
      supabase.from('room_blocked_slots').select('*').eq('school_id', school.id),
    ])

    setRooms(r || [])
    setGradeConfigs(gc || [])
    setLunchConfig(lunch)
    setTimetableSlots(ts || [])
    setBlockedSlots(blocked || [])

    const hasSplit = lunch?.split_lunch && lunch?.lunch_groups?.length > 0
    setTotalSlots(hasSplit ? 7 : 6)

    if (hasSplit) {
      const gls = {}
      for (const g of (lunch.lunch_groups || [])) {
        for (const grade of g.grades) gls[grade] = g.slot
      }
      setGradeLunchSlot(gls)
    }

    if (r?.length) {
      setSelectedRoom(prev => prev || r[0]?.id)
    }
  }

  async function loadRoomSlots(roomId) {
    if (!roomId) return
    const { data } = await supabase.from('room_timetable_slots').select('*').eq('room_id', roomId)
    setRoomSlots(data || [])
  }

  useEffect(() => {
    if (selectedRoom) loadRoomSlots(selectedRoom)
  }, [selectedRoom])

  async function handleGenerate() {
    if (!selectedRoom) return
    if (!timetableSlots.length) return alert('전담 시간표를 먼저 생성하세요.')
    setGenerating(true)

    const roomBlocked = blockedSlots.filter(b => b.room_id === selectedRoom)
    const rows = buildRoomSchedule([rooms.find(r => r.id === selectedRoom)], timetableSlots, roomBlocked, schoolId)

    await supabase.from('room_timetable_slots').delete().eq('room_id', selectedRoom)
    if (rows.length > 0) {
      await supabase.from('room_timetable_slots').insert(rows)
    }

    await loadRoomSlots(selectedRoom)
    setGenerating(false)
  }

  function getSlotsGrid() {
    const grid = {}
    for (let d = 0; d < 5; d++) {
      grid[d] = {}
      const relevant = roomSlots.filter(r => r.day_of_week === d)
      for (const r of relevant) {
        grid[d][r.slot] = { grade: r.grade, class_num: r.class_num, id: r.id }
      }
    }
    return grid
  }

  async function handleEditSave(grade, classNum) {
    if (!editModal) return
    setSaving(true)
    const { day, slot } = editModal

    const existing = roomSlots.find(r => r.day_of_week === day && r.slot === slot)
    if (existing) {
      if (grade && classNum) {
        await supabase.from('room_timetable_slots').update({ grade, class_num: classNum }).eq('id', existing.id)
      } else {
        await supabase.from('room_timetable_slots').delete().eq('id', existing.id)
      }
    } else if (grade && classNum) {
      await supabase.from('room_timetable_slots').insert({
        room_id: selectedRoom, school_id: schoolId,
        day_of_week: day, slot, grade, class_num: classNum,
      })
    }

    setEditModal(null)
    setSaving(false)
    await loadRoomSlots(selectedRoom)
  }

  const grid = getSlotsGrid()
  const allLunchSlots = Object.values(gradeLunchSlot)
  const selectedRoomObj = rooms.find(r => r.id === selectedRoom)

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">특별실 시간표</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportRoomTimetable(rooms, roomSlots, gradeConfigs, gradeLunchSlot, totalSlots)}
            className="flex items-center gap-2 h-10 px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50"
          >
            <Download size={14} />엑셀 다운로드
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedRoom}
            className="flex items-center gap-2 h-10 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {generating ? '생성 중...' : '시간표 자동 생성'}
          </button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-20 text-gray-300 text-[14px]">
          특별실을 먼저 등록하세요
        </div>
      ) : (
        <>
          {/* 특별실 선택 */}
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
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[14px] font-semibold">{selectedRoomObj?.name}</span>
                <span className="text-[12px] text-gray-400">시간표 — 셀을 클릭하면 수정할 수 있습니다</span>
              </div>

              <div className="border border-gray-200 rounded-sm overflow-hidden bg-white">
                {/* 헤더 */}
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
                      const isDayBlocked = blockedSlots.some(b => b.room_id === selectedRoom && b.day_of_week === day && b.slot === slot)
                      const cell = grid[day]?.[slot]
                      return (
                        <div
                          key={day}
                          onClick={() => !isDayBlocked && setEditModal({ day, slot, current: cell })}
                          className={`flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0.5 transition-colors
                            ${isDayBlocked ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}
                        >
                          {isDayBlocked ? (
                            <span className="text-[11px] text-gray-300">사용불가</span>
                          ) : cell ? (
                            <>
                              <span className="text-[13px] font-semibold text-gray-900">{cell.grade}학년</span>
                              <span className="text-[11px] text-gray-400">{cell.class_num}반</span>
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
            </>
          )}
        </>
      )}

      {editModal && (
        <EditRoomCellModal
          modal={editModal}
          gradeConfigs={gradeConfigs}
          onSave={handleEditSave}
          onClose={() => setEditModal(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

function EditRoomCellModal({ modal, gradeConfigs, onSave, onClose, saving }) {
  const { day, slot, current } = modal
  const [grade, setGrade] = useState(current?.grade || '')
  const [classNum, setClassNum] = useState(current?.class_num || 1)

  const numClasses = gradeConfigs.find(g => g.grade === Number(grade))?.num_classes || 6

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[360px] rounded-sm border border-gray-200 p-6">
        <h2 className="text-[16px] font-bold mb-4">{DAY_LABELS[day]}요일 {slot + 1}교시 편집</h2>
        <div className="flex flex-col gap-3 mb-5">
          <div>
            <label className="text-[12px] font-semibold text-gray-600 block mb-1">학년</label>
            <select
              value={grade}
              onChange={e => { setGrade(e.target.value); setClassNum(1) }}
              className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
            >
              <option value="">없음 (비우기)</option>
              {GRADES.map(g => <option key={g} value={g}>{g}학년</option>)}
            </select>
          </div>
          {grade && (
            <div>
              <label className="text-[12px] font-semibold text-gray-600 block mb-1">반</label>
              <select
                value={classNum}
                onChange={e => setClassNum(Number(e.target.value))}
                className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
              >
                {Array.from({ length: numClasses }, (_, i) => i + 1).map(c => (
                  <option key={c} value={c}>{c}반</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
          <button
            onClick={() => onSave(grade ? Number(grade) : null, grade ? classNum : null)}
            disabled={saving}
            className="h-9 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
