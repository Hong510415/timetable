import { useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { buildRoomSchedule } from '../lib/roomScheduler'
import { exportRoomTimetable } from '../lib/excelExport'
import ManualModal from '../components/ManualModal'

const MANUAL = [
  {
    title: '특별실 시간표',
    items: [
      '특별실별 주간 사용 현황을 확인합니다.',
      '전담 시간표 자동 생성 후 자동으로 반영됩니다.',
      '시간 충돌이 있는 경우 빨간색으로 표시됩니다.',
    ],
  },
  {
    title: '엑셀 내보내기',
    items: ['특별실별 시간표를 엑셀 파일로 내보낼 수 있습니다.'],
  },
]

const DAY_LABELS = ['월', '화', '수', '목', '금']

export default function RoomTimetable() {
  const { state, setRoomTimetableSlots } = useApp()
  const { rooms, gradeConfigs, lunchConfig, timetableSlots, roomBlockedSlots, teachers, subjects } = state

  const [selectedRoom, setSelectedRoom] = useState(rooms[0]?.id || null)
  const [selectedTeachers, setSelectedTeachers] = useState([])
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [generating, setGenerating] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [saving, setSaving] = useState(false)

  const hasSplit = lunchConfig?.split_lunch && lunchConfig?.lunch_groups?.length > 0
  const totalSlots = hasSplit ? 7 : 6
  const gradeLunchSlot = {}
  if (hasSplit) {
    for (const g of (lunchConfig.lunch_groups || [])) {
      for (const grade of g.grades) gradeLunchSlot[grade] = g.slot
    }
  }

  const roomSlots = state.roomTimetableSlots.filter(s => s.room_id === selectedRoom)

  function toggleTeacher(id) {
    setSelectedTeachers(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  function toggleSubject(name) {
    setSelectedSubjects(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    )
  }

  function getTeacherSubjectNames() {
    if (selectedTeachers.length === 0) return []
    const subjectIds = new Set(
      timetableSlots
        .filter(s => selectedTeachers.includes(s.teacher_id) && !s.is_unassigned)
        .map(s => s.subject_id)
    )
    const seen = new Set()
    return subjects
      .filter(s => subjectIds.has(s.id))
      .filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true })
  }

  async function handleGenerate() {
    if (!selectedRoom) return
    if (selectedTeachers.length === 0) return alert('시간표를 생성할 교사를 선택하세요.')
    if (!timetableSlots.length) return alert('전담 시간표를 먼저 생성하세요.')
    setGenerating(true)

    const subjectIdFilter = selectedSubjects.length > 0
      ? subjects.filter(s => selectedSubjects.includes(s.name)).map(s => s.id)
      : null

    const roomBlocked = roomBlockedSlots.filter(b => b.room_id === selectedRoom)
    const rows = buildRoomSchedule(
      rooms.find(r => r.id === selectedRoom), timetableSlots, roomBlocked,
      selectedTeachers, subjectIdFilter
    )

    const otherRoomSlots = state.roomTimetableSlots.filter(s => s.room_id !== selectedRoom)
    const newSlots = rows.map(r => ({ ...r, id: crypto.randomUUID() }))
    setRoomTimetableSlots([...otherRoomSlots, ...newSlots])
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

  function handleEditSave(grade, classNum) {
    if (!editModal) return
    setSaving(true)
    const { day, slot } = editModal
    const existing = state.roomTimetableSlots.find(r => r.room_id === selectedRoom && r.day_of_week === day && r.slot === slot)
    let updated = [...state.roomTimetableSlots]
    if (existing) {
      if (grade && classNum) {
        updated = updated.map(r => r.id === existing.id ? { ...r, grade, class_num: classNum } : r)
      } else {
        updated = updated.filter(r => r.id !== existing.id)
      }
    } else if (grade && classNum) {
      updated.push({ id: crypto.randomUUID(), room_id: selectedRoom, day_of_week: day, slot, grade, class_num: classNum })
    }
    setRoomTimetableSlots(updated)
    setEditModal(null)
    setSaving(false)
  }

  const grid = getSlotsGrid()
  const selectedRoomObj = rooms.find(r => r.id === selectedRoom)

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">특별실 시간표</h1>
        <div className="flex gap-2">
          <ManualModal title="특별실 시간표" sections={MANUAL} />
          <button
            onClick={() => exportRoomTimetable(rooms, state.roomTimetableSlots, gradeConfigs, gradeLunchSlot, totalSlots)}
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
          <div className="flex gap-2 mb-5 flex-wrap">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => { setSelectedRoom(room.id); setSelectedTeachers([]); setSelectedSubjects([]) }}
                className={`h-9 px-4 rounded-sm text-[13px] font-semibold border transition-colors
                  ${selectedRoom === room.id ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                {room.name}
              </button>
            ))}
          </div>

          {selectedRoom && (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[14px] font-semibold">{selectedRoomObj?.name}</span>
                  <span className="text-[12px] text-gray-400">시간표 — 셀을 클릭하면 수정할 수 있습니다</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-[12px] text-gray-500 font-semibold w-[56px]">담당 교사</span>
                  {teachers.map(t => (
                    <button
                      key={t.id}
                      onClick={() => toggleTeacher(t.id)}
                      className={`h-7 px-3 rounded-sm text-[12px] font-semibold border transition-colors
                        ${selectedTeachers.includes(t.id) ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {t.code}
                    </button>
                  ))}
                </div>
                {getTeacherSubjectNames().length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] text-gray-500 font-semibold w-[56px]">과목 필터</span>
                    {getTeacherSubjectNames().map(s => (
                      <button
                        key={s.name}
                        onClick={() => toggleSubject(s.name)}
                        className={`h-7 px-3 rounded-sm text-[12px] font-semibold border transition-colors
                          ${selectedSubjects.includes(s.name) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                      >
                        {s.name}
                      </button>
                    ))}
                    <span className="text-[11px] text-gray-400">선택 안 하면 전체 포함</span>
                  </div>
                )}
              </div>

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
          timetableSlots={timetableSlots}
          onSave={handleEditSave}
          onClose={() => setEditModal(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

function EditRoomCellModal({ modal, gradeConfigs, timetableSlots, onSave, onClose, saving }) {
  const { day, slot, current } = modal

  const busySet = new Set(
    timetableSlots
      .filter(s => s.day_of_week === day && s.slot === slot && !s.is_unassigned)
      .map(s => `${s.grade}-${s.class_num}`)
  )

  const allClasses = gradeConfigs
    .slice()
    .sort((a, b) => a.grade - b.grade)
    .flatMap(gc => Array.from({ length: gc.num_classes }, (_, i) => ({ grade: gc.grade, classNum: i + 1 })))

  const availableClasses = allClasses.filter(c => !busySet.has(`${c.grade}-${c.classNum}`))

  const defaultVal = current ? `${current.grade}-${current.class_num}` : ''
  const [selected, setSelected] = useState(defaultVal)

  function handleSave() {
    if (!selected) {
      onSave(null, null)
    } else {
      const [g, c] = selected.split('-').map(Number)
      onSave(g, c)
    }
  }

  const currentIsInBusy = current && busySet.has(`${current.grade}-${current.class_num}`)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[360px] rounded-sm border border-gray-200 p-6">
        <h2 className="text-[16px] font-bold mb-4">{DAY_LABELS[day]}요일 {slot + 1}교시 편집</h2>
        <div className="mb-5">
          <label className="text-[12px] font-semibold text-gray-600 block mb-1">
            학급 선택
            <span className="text-gray-400 font-normal ml-1">(이 시간에 전담 없는 학급)</span>
          </label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
          >
            <option value="">없음 (비우기)</option>
            {currentIsInBusy && (
              <option value={`${current.grade}-${current.class_num}`}>
                {current.grade}학년 {current.class_num}반 (현재)
              </option>
            )}
            {availableClasses.map(c => (
              <option key={`${c.grade}-${c.classNum}`} value={`${c.grade}-${c.classNum}`}>
                {c.grade}학년 {c.classNum}반
              </option>
            ))}
          </select>
          {availableClasses.length === 0 && !currentIsInBusy && (
            <p className="text-[11px] text-gray-400 mt-1">이 시간에 전담수업이 없는 학급이 없습니다.</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
          <button
            onClick={handleSave}
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
