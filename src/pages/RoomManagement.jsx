import { useState } from 'react'
import { Plus, X, Trash2, Edit2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import ManualModal from '../components/ManualModal'

const MANUAL = [
  {
    title: '특별실 등록',
    items: [
      '과학실, 음악실, 체육관 등 전담 수업에 사용하는 특별실을 등록합니다.',
      '특별실과 사용 과목을 연결하면 해당 과목 배정 시 특별실 제약이 적용됩니다.',
    ],
  },
  {
    title: '사용 불가 시간 설정',
    items: [
      '특별실을 사용할 수 없는 시간(예: 타 행사, 청소 등)을 지정합니다.',
      '설정된 시간에는 해당 특별실을 사용하는 과목이 배정되지 않습니다.',
    ],
  },
  {
    title: '점심시간 분리 배정',
    items: ['점심시간 분리 배정 시 특별실 시간표, 전담교사 시간표는 7교시 형식으로 제시됩니다.'],
  },
]

const DAY_LABELS = ['월', '화', '수', '목', '금']

export default function RoomManagement() {
  const { state, setRooms, setRoomBlockedSlots } = useApp()
  const { rooms, lunchConfig, roomBlockedSlots, subjects } = state
  const uniqueSubjectNames = [...new Set(subjects.map(s => s.name))]

  function toggleRoomSubject(roomId, subjectName) {
    setRooms(rooms.map(r => {
      if (r.id !== roomId) return r
      const names = r.subjectNames || []
      return {
        ...r,
        subjectNames: names.includes(subjectName)
          ? names.filter(n => n !== subjectName)
          : [...names, subjectName],
      }
    }))
  }
  const [showModal, setShowModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [form, setForm] = useState({ name: '' })

  const hasSplit = lunchConfig?.split_lunch && lunchConfig?.lunch_groups?.length > 0
  const totalSlots = hasSplit ? 7 : 6

  const blockedMap = {}
  for (const b of roomBlockedSlots) {
    if (!blockedMap[b.room_id]) blockedMap[b.room_id] = new Set()
    blockedMap[b.room_id].add(`${b.day_of_week}-${b.slot}`)
  }

  function openAdd() {
    setEditingRoom(null)
    setForm({ name: '' })
    setShowModal(true)
  }

  function openEdit(room) {
    setEditingRoom(room)
    setForm({ name: room.name })
    setShowModal(true)
  }

  function handleDelete(roomId) {
    if (!confirm('이 특별실을 삭제하시겠습니까?')) return
    setRooms(rooms.filter(r => r.id !== roomId))
    setRoomBlockedSlots(roomBlockedSlots.filter(b => b.room_id !== roomId))
  }

  function handleSave() {
    if (!form.name.trim()) return alert('특별실 이름을 입력하세요')
    if (editingRoom) {
      setRooms(rooms.map(r => r.id === editingRoom.id ? { ...r, name: form.name } : r))
    } else {
      setRooms([...rooms, { id: crypto.randomUUID(), name: form.name }])
    }
    setShowModal(false)
  }

  function toggleBlocked(roomId, day, slot) {
    const exists = roomBlockedSlots.find(b => b.room_id === roomId && b.day_of_week === day && b.slot === slot)
    if (exists) {
      setRoomBlockedSlots(roomBlockedSlots.filter(b => !(b.room_id === roomId && b.day_of_week === day && b.slot === slot)))
    } else {
      setRoomBlockedSlots([...roomBlockedSlots, { id: crypto.randomUUID(), room_id: roomId, day_of_week: day, slot }])
    }
  }

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-full">
      <div className="max-w-[1100px] flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">특별실 관리</h1>
        <div className="flex items-center gap-2">
          <ManualModal title="특별실 관리" sections={MANUAL} />
          <button
            onClick={openAdd}
            className="flex items-center gap-2 h-10 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800 transition-colors"
          >
            <Plus size={14} />특별실 추가
          </button>
        </div>
      </div>

      <div className="max-w-[1100px] flex items-center gap-2 p-3 bg-gray-100 rounded-sm mb-5 text-[12px] text-gray-500">
        💡 사용 불가 시간대를 체크하면 해당 시간에 특별실 배정이 제외됩니다. (예: 방과후 수업 등)
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-20 text-gray-300 text-[14px]">특별실을 추가하세요</div>
      ) : (
        <div className="max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rooms.map(room => (
            <div key={room.id} className="bg-white border border-gray-200 rounded-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="h-9 px-3 bg-black text-white text-[13px] font-bold flex items-center rounded-sm">
                    {room.name}
                  </span>
                  <span className="text-[12px] text-gray-400">사용 불가 시간 설정</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(room)}
                    className="h-8 px-3 border border-gray-300 rounded-sm text-[12px] hover:bg-gray-50 flex items-center gap-1"
                  >
                    <Edit2 size={12} />편집
                  </button>
                  <button
                    onClick={() => handleDelete(room.id)}
                    className="h-8 px-3 border border-red-200 rounded-sm text-[12px] text-red-500 hover:bg-red-50 flex items-center gap-1"
                  >
                    <Trash2 size={12} />삭제
                  </button>
                </div>
              </div>

              {uniqueSubjectNames.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <span className="text-[12px] text-gray-500 font-semibold w-[56px] flex-shrink-0">사용 과목</span>
                  {uniqueSubjectNames.map(name => {
                    const active = (room.subjectNames || []).includes(name)
                    return (
                      <button
                        key={name}
                        onClick={() => toggleRoomSubject(room.id, name)}
                        className={`h-7 px-3 rounded-sm text-[12px] font-semibold border transition-colors
                          ${active ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                      >
                        {name}
                      </button>
                    )
                  })}
                  <span className="text-[11px] text-gray-400">선택한 과목의 수업이 사용 불가 시간에 배정되지 않습니다</span>
                </div>
              )}

              <div className="border border-gray-200 rounded-sm overflow-hidden">
                <div className="flex bg-gray-50 border-b border-gray-200">
                  <div className="w-[64px] flex-shrink-0 border-r border-gray-200 h-8 flex items-center justify-center text-[11px] font-semibold text-gray-500">교시</div>
                  {DAY_LABELS.map(d => (
                    <div key={d} className="flex-1 h-8 flex items-center justify-center text-[11px] font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">{d}</div>
                  ))}
                </div>
                {Array.from({ length: totalSlots }, (_, slot) => (
                  <div key={slot} className="flex border-t border-gray-100">
                    <div className="w-[64px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] text-gray-400 bg-gray-50 h-10">
                      {slot + 1}교시
                    </div>
                    {Array.from({ length: 5 }, (_, day) => {
                      const blocked = blockedMap[room.id]?.has(`${day}-${slot}`)
                      return (
                        <div
                          key={day}
                          onClick={() => toggleBlocked(room.id, day, slot)}
                          className={`flex-1 border-r border-gray-100 last:border-r-0 h-10 flex items-center justify-center cursor-pointer transition-colors
                            ${blocked ? 'bg-gray-800 hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                        >
                          {blocked && <span className="text-[11px] text-white font-semibold">✕</span>}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[400px] rounded-sm border border-gray-200 p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold">{editingRoom ? '특별실 편집' : '특별실 추가'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="mb-5">
              <label className="text-[12px] font-semibold text-gray-600 block mb-1.5">특별실 이름</label>
              <input
                placeholder="예: 음악실, 컴퓨터실"
                value={form.name}
                onChange={e => setForm({ name: e.target.value })}
                className="w-full h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="h-10 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
              <button onClick={handleSave} className="h-10 px-5 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
