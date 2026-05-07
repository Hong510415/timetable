import { useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { buildSchedule, flattenResult } from '../lib/scheduler'
import { exportTimetableByClass, exportTimetableByTeacher } from '../lib/excelExport'
import TimetableGrid from '../components/TimetableGrid'

const GRADES = [1, 2, 3, 4, 5, 6]

export default function Timetable() {
  const { state, setTimetableSlots } = useApp()
  const { gradeConfigs, subjects, teachers, lunchConfig, timetableSlots: timetableRows, rooms, roomBlockedSlots } = state

  const [generating, setGenerating] = useState(false)
  const [errors, setErrors] = useState([])
  const [tab, setTab] = useState('class')
  const [selectedGrade, setSelectedGrade] = useState(1)
  const [selectedClass, setSelectedClass] = useState(1)
  const [selectedTeacher, setSelectedTeacher] = useState(teachers[0]?.id || null)
  const [editModal, setEditModal] = useState(null)
  const [saving, setSaving] = useState(false)

  function computeSlotMeta(gc, lunch) {
    if (!gc?.length) return { gradeLunchSlot: {}, totalSlots: 6 }
    const maxPeriods = Math.max(...gc.map(c => Math.max(c.periods_mon, c.periods_tue, c.periods_wed, c.periods_thu, c.periods_fri)))
    if (!lunch?.split_lunch || !lunch?.lunch_groups?.length) {
      return { gradeLunchSlot: {}, totalSlots: maxPeriods }
    }
    const gradeLunchSlot = {}
    for (const g of lunch.lunch_groups) {
      for (const grade of g.grades) {
        gradeLunchSlot[grade] = g.slot
      }
    }
    return { gradeLunchSlot, totalSlots: maxPeriods + 1 }
  }

  async function handleGenerate() {
    if (!gradeConfigs.length || !subjects.length || !teachers.length) {
      return alert('학급 정보, 전담 과목, 교사 정보를 먼저 설정하세요.')
    }
    const hasAssignments = teachers.some(t => t.teacher_assignments?.length > 0)
    if (!hasAssignments) {
      return alert('전담 배정 탭에서 배정을 실행하고 "시간표에 적용"을 먼저 해주세요.')
    }
    setGenerating(true)
    setErrors([])
    try {
      const result = buildSchedule(gradeConfigs, subjects, teachers, lunchConfig || { split_lunch: false, lunch_groups: [] }, rooms, roomBlockedSlots)
      const { rows } = flattenResult(result.result, result.gradeLunchSlot, result.totalSlots)
      const flatErrors = (result.errors || []).map(e => {
        const subjName = subjects.find(s => s.id === e.subjectId)?.name || '과목 미상'
        return `${e.grade}학년 ${e.classNum}반 ${subjName} ${e.unassigned}시수 미배정`
      })
      setErrors(flatErrors)
      const rowsWithId = rows.map(r => ({ ...r, id: crypto.randomUUID() }))
      setTimetableSlots(rowsWithId)
    } catch (e) {
      console.error(e)
      alert('시간표 생성 중 오류가 발생했습니다.')
    }
    setGenerating(false)
  }

  function getSlotsForClass(grade, classNum) {
    const daySlots = {}
    for (let d = 0; d < 5; d++) {
      daySlots[d] = {}
      const relevant = timetableRows.filter(r => r.grade === grade && r.class_num === classNum && r.day_of_week === d)
      for (const r of relevant) {
        daySlots[d][r.slot] = { teacher_id: r.teacher_id, subject_id: r.subject_id, is_unassigned: r.is_unassigned, id: r.id }
      }
    }
    return daySlots
  }

  function getSlotsForTeacher(teacherId) {
    const daySlots = {}
    for (let d = 0; d < 5; d++) {
      daySlots[d] = {}
      const relevant = timetableRows.filter(r => r.teacher_id === teacherId && r.day_of_week === d)
      for (const r of relevant) {
        daySlots[d][r.slot] = { teacher_id: r.teacher_id, subject_id: r.subject_id, is_unassigned: r.is_unassigned, label: `${r.grade}학년 ${r.class_num}반`, grade: r.grade, class_num: r.class_num, id: r.id }
      }
    }
    return daySlots
  }

  function openEditModal(day, slot, cell) {
    if (tab === 'class') {
      setEditModal({ day, slot, grade: selectedGrade, classNum: selectedClass, current: cell, rowId: cell?.id || null })
    } else if (tab === 'teacher') {
      setEditModal({ day, slot, grade: cell?.grade || null, classNum: cell?.class_num || null, current: cell, classLabel: cell?.label || null, teacherView: true, defaultTeacherId: selectedTeacher, rowId: cell?.id || null })
    }
  }

  function handleEditSave(teacherId, subjectId, grade, classNum) {
    if (!editModal) return
    setSaving(true)
    const g = grade ?? editModal.grade
    const cn = classNum ?? editModal.classNum
    if (!g || !cn) { setSaving(false); return }

    let updated
    if (editModal.rowId) {
      // 기존 행을 id로 특정해서 수정 — 같은 슬롯의 다른 수업은 건드리지 않음
      updated = timetableRows.map(r =>
        r.id === editModal.rowId
          ? { ...r, teacher_id: teacherId || null, subject_id: subjectId || null, is_unassigned: !teacherId }
          : r
      )
    } else {
      // 빈 칸에 새로 추가 — 기존 행 덮어쓰기 없이 INSERT
      updated = [...timetableRows]
      if (teacherId) {
        updated.push({ id: crypto.randomUUID(), grade: g, class_num: cn, day_of_week: editModal.day, slot: editModal.slot, teacher_id: teacherId, subject_id: subjectId, is_unassigned: false })
      }
    }

    setTimetableSlots(updated)
    setEditModal(null)
    setSaving(false)
  }

  const numClasses = gradeConfigs.find(g => g.grade === selectedGrade)?.num_classes || 1
  const { gradeLunchSlot } = computeSlotMeta(gradeConfigs, lunchConfig)
  const splitLunch = lunchConfig?.split_lunch || false
  const totalSlots = splitLunch ? 7 : 6

  const classSlots = getSlotsForClass(selectedGrade, selectedClass)
  const teacherSlots = selectedTeacher ? getSlotsForTeacher(selectedTeacher) : {}

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">전담 시간표</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportTimetableByClass(timetableRows, gradeConfigs, teachers, subjects, gradeLunchSlot, totalSlots)}
            className="flex items-center gap-2 h-10 px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50"
          >
            <Download size={14} />학급별 엑셀
          </button>
          <button
            onClick={() => exportTimetableByTeacher(timetableRows, teachers, subjects, gradeConfigs, gradeLunchSlot, totalSlots)}
            className="flex items-center gap-2 h-10 px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50"
          >
            <Download size={14} />교사별 엑셀
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 h-10 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {generating ? '생성 중...' : '시간표 자동 생성'}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-sm text-[12px] text-red-600">
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {timetableRows.length === 0 ? (
        <div className="text-center py-20 text-gray-300 text-[14px]">
          시간표를 자동 생성하거나 수동으로 입력하세요
        </div>
      ) : (
        <>
          <div className="flex border border-gray-200 bg-white rounded-sm w-fit mb-5">
            {[{ key: 'class', label: '학급별 보기' }, { key: 'teacher', label: '교사별 보기' }].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 h-[42px] text-[13px] transition-colors ${tab === t.key ? 'bg-black text-white font-semibold' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'class' && (
            <>
              <div className="flex gap-3 mb-5">
                <select
                  value={selectedGrade}
                  onChange={e => { setSelectedGrade(Number(e.target.value)); setSelectedClass(1) }}
                  className="h-9 px-3 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
                >
                  {GRADES.map(g => <option key={g} value={g}>{g}학년</option>)}
                </select>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(Number(e.target.value))}
                  className="h-9 px-3 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
                >
                  {Array.from({ length: numClasses }, (_, i) => i + 1).map(c => (
                    <option key={c} value={c}>{c}반</option>
                  ))}
                </select>
              </div>
              <TimetableGrid
                slots={classSlots}
                totalSlots={totalSlots}
                gradeLunchSlot={gradeLunchSlot}
                teachers={teachers}
                subjects={subjects}
                onCellClick={(day, slot, cell) => openEditModal(day, slot, cell)}
                grade={selectedGrade}
              />
            </>
          )}

          {tab === 'teacher' && (
            <>
              <div className="flex gap-3 mb-5">
                <select
                  value={selectedTeacher || ''}
                  onChange={e => setSelectedTeacher(e.target.value)}
                  className="h-9 px-3 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
                >
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
                </select>
              </div>
              <TeacherTimetableGrid
                slots={teacherSlots}
                totalSlots={totalSlots}
                gradeLunchSlot={gradeLunchSlot}
                subjects={subjects}
                timetableRows={timetableRows}
                teachers={teachers}
                onCellClick={(day, slot, cell) => openEditModal(day, slot, cell)}
              />
            </>
          )}
        </>
      )}

      {editModal && (
        <EditCellModal
          modal={editModal}
          teachers={teachers}
          subjects={subjects}
          gradeConfigs={gradeConfigs}
          grade={editModal.grade}
          onSave={handleEditSave}
          onClose={() => setEditModal(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

function TeacherTimetableGrid({ slots, totalSlots, gradeLunchSlot, subjects, timetableRows, teachers, onCellClick }) {
  const DAY_LABELS = ['월', '화', '수', '목', '금']

  function getConflicts(cell, day, slot) {
    if (!cell || !timetableRows) return []
    return timetableRows.filter(r =>
      r.grade === cell.grade &&
      r.class_num === cell.class_num &&
      r.day_of_week === day &&
      r.slot === slot &&
      r.teacher_id !== cell.teacher_id
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
      {Array.from({ length: totalSlots }, (_, slot) => (
        <div key={slot} className="flex border-t border-gray-100 h-[62px]">
          <div className="w-[72px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-400 bg-gray-50">
            {slot + 1}교시
          </div>
          {Array.from({ length: 5 }, (_, day) => {
            const cell = slots?.[day]?.[slot]
            const subject = cell?.subject_id ? subjects?.find(s => s.id === cell.subject_id) : null
            const conflicts = getConflicts(cell, day, slot)
            const hasConflict = conflicts.length > 0
            const tooltipText = conflicts.map(c => {
              const cs = subjects?.find(s => s.id === c.subject_id)
              const ct = teachers?.find(t => t.id === c.teacher_id)
              return `${cs?.name ?? '?'} (${ct?.code ?? '?'})`
            }).join(', ') + '와 겹침'

            return (
              <div
                key={day}
                onClick={() => onCellClick?.(day, slot, cell)}
                className="relative group flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:bg-blue-50 transition-colors"
              >
                {cell ? (
                  <>
                    <span className={`text-[13px] font-semibold ${hasConflict ? 'text-red-600' : 'text-gray-900'}`}>
                      {subject?.name ?? '—'}
                    </span>
                    <span className={`text-[11px] ${hasConflict ? 'text-red-400' : 'text-gray-400'}`}>
                      {cell.label}
                    </span>
                    {hasConflict && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 hidden group-hover:block bg-gray-900 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap">
                        {tooltipText}
                      </div>
                    )}
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
  )
}

function EditCellModal({ modal, teachers, subjects, gradeConfigs, grade, onSave, onClose, saving }) {
  const { day, slot, classLabel, teacherView, defaultTeacherId } = modal
  const DAY_LABELS = ['월', '화', '수', '목', '금']
  const needsGradeClass = teacherView && !modal.grade

  const [teacherId, setTeacherId] = useState(modal.current?.teacher_id || defaultTeacherId || '')
  const [subjectId, setSubjectId] = useState(modal.current?.subject_id || '')
  const [formGrade, setFormGrade] = useState(grade || 1)
  const [formClass, setFormClass] = useState(1)

  const numClasses = gradeConfigs?.find(g => g.grade === formGrade)?.num_classes || 1
  const effectiveGrade = needsGradeClass ? formGrade : grade
  const gradeSubjects = subjects.filter(s => s.grade === effectiveGrade)

  function handleGradeChange(g) {
    setFormGrade(g)
    setFormClass(1)
    setSubjectId('')
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[400px] rounded-sm border border-gray-200 p-6">
        <h2 className="text-[16px] font-bold mb-1">{DAY_LABELS[day]}요일 {slot + 1}교시 편집</h2>
        {classLabel && <p className="text-[12px] text-gray-400 mb-4">{classLabel}</p>}
        <div className="flex flex-col gap-3 mb-5">
          {needsGradeClass && (
            <>
              <div>
                <label className="text-[12px] font-semibold text-gray-600 block mb-1">학년</label>
                <select
                  value={formGrade}
                  onChange={e => handleGradeChange(Number(e.target.value))}
                  className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
                >
                  {[1,2,3,4,5,6].map(g => <option key={g} value={g}>{g}학년</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-gray-600 block mb-1">반</label>
                <select
                  value={formClass}
                  onChange={e => setFormClass(Number(e.target.value))}
                  className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
                >
                  {Array.from({ length: numClasses }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}반</option>)}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="text-[12px] font-semibold text-gray-600 block mb-1">교사</label>
            <select
              value={teacherId}
              onChange={e => setTeacherId(e.target.value)}
              className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
            >
              <option value="">없음 (미배정)</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-gray-600 block mb-1">과목</label>
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
            >
              <option value="">없음</option>
              {gradeSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
          <button
            onClick={() => onSave(teacherId, subjectId, needsGradeClass ? formGrade : null, needsGradeClass ? formClass : null)}
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
