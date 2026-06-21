import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { exportRoomTimetable } from '../lib/excelExport'
import ManualModal from '../components/ManualModal'

const MANUAL = [
  {
    title: '특별실 시간표',
    items: [
      '전담 시간표를 자동 생성하면 각 수업이 사용한 특별실이 자동 반영됩니다.',
      '여기서 보이는 결과는 전담 시간표 교사별 보기와 1:1 동기화됩니다 — 어느 한쪽 편집 시 즉시 양쪽 반영.',
    ],
  },
  {
    title: '빈 셀에 수업 추가',
    items: [
      '빈 셀을 클릭하면 그 시간에 가능한 수업 후보가 표시됩니다.',
      '전담: 특별실 관리에 설정된 "사용 교사 + 사용 과목"에 맞고 학급·교사가 그 시간에 자유로워야 합니다.',
      '담임 사용: 학급이 그 시간에 어떤 수업도 없으면 어느 특별실이든 사용 가능 (방 제약 무관).',
      '예: 5학년 1반이 화 4교시에 비어있다면 강당 화요일 4교시에 "담임 사용"으로 배정할 수 있습니다.',
    ],
  },
  {
    title: '셀 삭제',
    items: ['이미 배정된 셀을 클릭하고 "이 셀에서 삭제"를 누르면 해당 수업이 제거됩니다.'],
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
  const { state, setTimetableSlots } = useApp()
  const { rooms, gradeConfigs, lunchConfig, timetableSlots, roomBlockedSlots, teachers, subjects } = state
  const allClassesList = gradeConfigs.flatMap(gc =>
    Array.from({ length: gc.num_classes }, (_, i) => ({ grade: gc.grade, classNum: i + 1 })),
  )

  const [editModal, setEditModal] = useState(null)

  const hasSplit = lunchConfig?.split_lunch && lunchConfig?.lunch_groups?.length > 0
  const totalSlots = hasSplit ? 7 : 6
  const gradeLunchSlot = {}
  if (hasSplit) {
    for (const g of (lunchConfig.lunch_groups || [])) {
      for (const grade of g.grades) gradeLunchSlot[grade] = g.slot
    }
  }

  function handleCellClick(roomId, day, slot, currentCell) {
    const isBlocked = roomBlockedSlots.some(b => b.room_id === roomId && b.day_of_week === day && b.slot === slot)
    if (isBlocked) return
    setEditModal({ roomId, day, slot, currentCell })
  }

  function handleAdd({ grade, classNum, teacherId, subjectId }) {
    if (!editModal) return
    const { roomId, day, slot } = editModal
    setTimetableSlots([
      ...timetableSlots,
      {
        id: crypto.randomUUID(),
        grade,
        class_num: classNum,
        day_of_week: day,
        slot,
        teacher_id: teacherId ?? null,
        subject_id: subjectId ?? null,
        room_id: roomId,
        is_unassigned: false,
      },
    ])
    setEditModal(null)
  }

  function handleRemove(rowId) {
    setTimetableSlots(timetableSlots.filter(s => s.id !== rowId))
    setEditModal(null)
  }

  const exportData = timetableSlots
    .filter(s => s.room_id && !s.is_unassigned)
    .map(s => ({
      room_id: s.room_id,
      day_of_week: s.day_of_week,
      slot: s.slot,
      grade: s.grade,
      class_num: s.class_num,
    }))

  const editRoom = editModal ? rooms.find(r => r.id === editModal.roomId) : null

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-full">
      <div className="max-w-[1100px] flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-[22px] font-bold">특별실 시간표</h1>
        <div className="flex flex-wrap gap-2">
          <ManualModal title="특별실 시간표" sections={MANUAL} />
          <button
            onClick={() => exportRoomTimetable(rooms, exportData, gradeConfigs, gradeLunchSlot, totalSlots)}
            className="flex items-center gap-2 h-10 px-3 md:px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50 whitespace-nowrap"
          >
            <Download size={14} />엑셀 다운로드
          </button>
        </div>
      </div>

      <p className="max-w-[1100px] text-[12px] text-gray-400 -mt-3 mb-5">특별실별 사용 현황을 확인하고, 빈 시간에 수업을 직접 추가할 수 있습니다. 전담 시간표와 실시간으로 연동됩니다.</p>

      {rooms.length === 0 ? (
        <div className="text-center py-20 text-gray-300 text-[14px]">
          특별실을 먼저 등록하세요
        </div>
      ) : (
        <>
          {!timetableSlots.length && (
            <div className="max-w-[1100px] mb-4 p-3 bg-gray-50 border border-gray-200 rounded-sm text-[12px] text-gray-500">
              전담 시간표를 먼저 자동 생성하세요.
            </div>
          )}
          <div className="max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-5">
            {rooms.map(room => (
              <RoomGrid
                key={room.id}
                room={room}
                totalSlots={totalSlots}
                timetableSlots={timetableSlots}
                roomBlockedSlots={roomBlockedSlots}
                teachers={teachers}
                subjects={subjects}
                onCellClick={handleCellClick}
              />
            ))}
          </div>
        </>
      )}

      {editModal && editRoom && (
        <EditRoomCellModal
          modal={editModal}
          room={editRoom}
          timetableSlots={timetableSlots}
          subjects={subjects}
          teachers={teachers}
          allClasses={allClassesList}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}

function RoomGrid({ room, totalSlots, timetableSlots, roomBlockedSlots, teachers, subjects, onCellClick }) {
  const roomSlots = timetableSlots.filter(s => s.room_id === room.id && !s.is_unassigned)
  const grid = {}
  for (let d = 0; d < 5; d++) {
    grid[d] = {}
    const relevant = roomSlots.filter(r => r.day_of_week === d)
    for (const r of relevant) {
      grid[d][r.slot] = {
        rowId: r.id,
        grade: r.grade,
        class_num: r.class_num,
        teacher_id: r.teacher_id,
        subject_id: r.subject_id,
      }
    }
  }

  return (
    <div>
      <div className="mb-2 text-[14px] font-semibold text-gray-900">{room.name}</div>
      <div className="border border-gray-200 rounded-sm overflow-hidden bg-white">
        <div className="flex bg-gray-50">
          <div className="w-[60px] flex-shrink-0 border-r border-gray-200 h-9 flex items-center justify-center text-[11px] font-semibold text-gray-500">교시</div>
          {DAY_LABELS.map(d => (
            <div key={d} className="flex-1 h-9 flex items-center justify-center border-r border-gray-200 last:border-r-0 text-[11px] font-semibold text-gray-500">{d}</div>
          ))}
        </div>
        {Array.from({ length: totalSlots }, (_, slot) => (
          <div key={slot} className="flex border-t border-gray-100 h-[52px]">
            <div className="w-[60px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-400 bg-gray-50">
              {slot + 1}교시
            </div>
            {Array.from({ length: 5 }, (_, day) => {
              const isDayBlocked = roomBlockedSlots.some(b => b.room_id === room.id && b.day_of_week === day && b.slot === slot)
              const cell = grid[day]?.[slot]
              const teacher = cell ? teachers.find(t => t.id === cell.teacher_id) : null
              const subject = cell ? subjects.find(s => s.id === cell.subject_id) : null
              return (
                <div
                  key={day}
                  onClick={() => !isDayBlocked && onCellClick(room.id, day, slot, cell)}
                  className={`flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0 transition-colors
                    ${isDayBlocked ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}
                >
                  {isDayBlocked ? (
                    <span className="text-[10px] text-gray-300">사용불가</span>
                  ) : cell ? (
                    <>
                      <span className="text-[12px] font-semibold text-gray-900">{cell.grade}-{cell.class_num}</span>
                      {subject || teacher ? (
                        <span className="text-[9px] text-gray-500">{subject?.name || ''}{teacher?.code ? ` · ${teacher.code}` : ''}</span>
                      ) : (
                        <span className="text-[9px] text-gray-400">담임</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-200">—</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function EditRoomCellModal({ modal, room, timetableSlots, subjects, teachers, allClasses, onAdd, onRemove, onClose }) {
  const { day, slot, currentCell } = modal

  const dedicatedCandidates = []
  const homeroomCandidates = []
  const seenKey = new Set()

  if (!currentCell) {
    if (room) {
      const allowedSubjects = new Set(room.subjectNames || [])
      const allowedTeachers = new Set(room.teacherIds || [])
      for (const teacher of teachers) {
        if (allowedTeachers.size > 0 && !allowedTeachers.has(teacher.id)) continue
        const teacherBusy = timetableSlots.some(s =>
          s.teacher_id === teacher.id &&
          s.day_of_week === day && s.slot === slot &&
          !s.is_unassigned,
        )
        if (teacherBusy) continue
        for (const a of teacher.teacher_assignments || []) {
          const subj = subjects.find(s => s.id === a.subject_id)
          if (!subj) continue
          if (allowedSubjects.size > 0 && !allowedSubjects.has(subj.name)) continue
          const classBusy = timetableSlots.some(s =>
            s.grade === a.grade && s.class_num === a.class_num &&
            s.day_of_week === day && s.slot === slot &&
            !s.is_unassigned,
          )
          if (classBusy) continue
          const key = `${a.grade}-${a.class_num}-${teacher.id}-${subj.id}`
          if (seenKey.has(key)) continue
          seenKey.add(key)
          dedicatedCandidates.push({
            mode: 'dedicated',
            grade: a.grade,
            classNum: a.class_num,
            teacherId: teacher.id,
            teacherCode: teacher.code,
            subjectId: subj.id,
            subjectName: subj.name,
          })
        }
      }
      dedicatedCandidates.sort((a, b) =>
        a.grade - b.grade ||
        a.classNum - b.classNum ||
        a.subjectName.localeCompare(b.subjectName) ||
        a.teacherCode.localeCompare(b.teacherCode),
      )
    }

    for (const { grade, classNum } of (allClasses || [])) {
      const busy = timetableSlots.some(s =>
        s.grade === grade && s.class_num === classNum &&
        s.day_of_week === day && s.slot === slot &&
        !s.is_unassigned,
      )
      if (busy) continue
      homeroomCandidates.push({ mode: 'homeroom', grade, classNum })
    }
    homeroomCandidates.sort((a, b) => a.grade - b.grade || a.classNum - b.classNum)
  }

  const allCandidates = [...dedicatedCandidates, ...homeroomCandidates]
  const [selectedIdx, setSelectedIdx] = useState(0)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[420px] rounded-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold">
            {DAY_LABELS[day]}요일 {slot + 1}교시 — {room?.name}
          </h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        {currentCell ? (
          <>
            <div className="mb-5 p-3 border border-gray-200 rounded-sm">
              <div className="text-[13px] font-semibold text-gray-900">
                {currentCell.grade}학년 {currentCell.class_num}반
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {currentCell.subject_id || currentCell.teacher_id ? (
                  <>
                    {subjects.find(s => s.id === currentCell.subject_id)?.name || ''}
                    {currentCell.subject_id && currentCell.teacher_id ? ' · ' : ''}
                    {teachers.find(t => t.id === currentCell.teacher_id)?.code || ''}
                  </>
                ) : (
                  <>담임</>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
              <button
                onClick={() => onRemove(currentCell.rowId)}
                className="h-9 px-4 border border-red-200 text-red-600 text-[13px] rounded-sm hover:bg-red-50"
              >
                이 셀에서 삭제
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="text-[12px] font-semibold text-gray-600 block mb-1.5">
              추가할 수업
              <span className="text-gray-400 font-normal ml-1">(전담 또는 담임 사용)</span>
            </label>
            {allCandidates.length === 0 ? (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-sm text-[12px] text-gray-500">
                추가 가능한 수업이 없습니다.
              </div>
            ) : (
              <>
                <select
                  value={selectedIdx}
                  onChange={e => setSelectedIdx(Number(e.target.value))}
                  className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white mb-4"
                >
                  {dedicatedCandidates.length > 0 && (
                    <optgroup label="전담">
                      {dedicatedCandidates.map((c, i) => (
                        <option key={`d-${i}`} value={i}>
                          {c.grade}학년 {c.classNum}반 — {c.subjectName} · {c.teacherCode}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {homeroomCandidates.length > 0 && (
                    <optgroup label="담임 사용 (학급 자유 시간)">
                      {homeroomCandidates.map((c, i) => (
                        <option key={`h-${i}`} value={dedicatedCandidates.length + i}>
                          {c.grade}학년 {c.classNum}반 — 담임
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div className="flex justify-end gap-2">
                  <button onClick={onClose} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
                  <button
                    onClick={() => onAdd(allCandidates[selectedIdx])}
                    className="h-9 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800"
                  >
                    추가
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
