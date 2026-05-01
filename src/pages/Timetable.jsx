import { useEffect, useState } from 'react'
import { Download, RefreshCw, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { buildSchedule, flattenResult } from '../lib/scheduler'
import { exportTimetableByClass, exportTimetableByTeacher } from '../lib/excelExport'
import TimetableGrid from '../components/TimetableGrid'

const GRADES = [1, 2, 3, 4, 5, 6]

export default function Timetable() {
  const [schoolId, setSchoolId] = useState(null)
  const [gradeConfigs, setGradeConfigs] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [lunchConfig, setLunchConfig] = useState(null)
  const [timetableRows, setTimetableRows] = useState([])
  const [generating, setGenerating] = useState(false)
  const [errors, setErrors] = useState([])
  const [tab, setTab] = useState('class') // 'class' | 'teacher'
  const [selectedGrade, setSelectedGrade] = useState(1)
  const [selectedClass, setSelectedClass] = useState(1)
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [scheduleResult, setScheduleResult] = useState(null) // { gradeLunchSlot, totalSlots }
  const [editModal, setEditModal] = useState(null) // { day, slot, grade, classNum, current }
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: school } = await supabase.from('schools').select('id').eq('user_id', user.id).single()
    if (!school) return
    setSchoolId(school.id)

    const [{ data: gc }, { data: subs }, { data: t }, { data: lunch }, { data: rows }] = await Promise.all([
      supabase.from('grade_configs').select('*').eq('school_id', school.id).order('grade'),
      supabase.from('subjects').select('*').eq('school_id', school.id).order('grade'),
      supabase.from('teachers').select('*, teacher_assignments(*)').eq('school_id', school.id),
      supabase.from('lunch_config').select('*').eq('school_id', school.id).single(),
      supabase.from('timetable_slots').select('*, teachers(code), subjects(name)').eq('school_id', school.id),
    ])
    setGradeConfigs(gc || [])
    setSubjects(subs || [])
    setTeachers(t || [])
    setLunchConfig(lunch || { split_lunch: false, lunch_groups: [] })
    setTimetableRows(rows || [])

    if (gc?.length && lunch) {
      const { gradeLunchSlot, totalSlots } = computeSlotMeta(gc, lunch)
      setScheduleResult(prev => ({ ...prev, gradeLunchSlot, totalSlots }))
    }

    if (t?.length) setSelectedTeacher(t[0]?.id || null)
  }

  function computeSlotMeta(gc, lunch) {
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
    setGenerating(true)
    setErrors([])
    try {
      const result = buildSchedule(gradeConfigs, subjects, teachers, lunchConfig || { split_lunch: false, lunch_groups: [] })
      setScheduleResult(result)

      const { rows } = flattenResult(result.result, schoolId, result.gradeLunchSlot, result.totalSlots)
      const flatErrors = (result.errors || []).map(e => `${e.grade}학년 ${e.classNum}반 ${e.unassigned}시수 미배정`)
      setErrors(flatErrors)

      await supabase.from('timetable_slots').delete().eq('school_id', schoolId)
      if (rows.length > 0) {
        const { error } = await supabase.from('timetable_slots').insert(rows)
        if (error) console.error(error)
      }
      await load()
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
        daySlots[d][r.slot] = {
          teacher_id: r.teacher_id,
          subject_id: r.subject_id,
          is_unassigned: r.is_unassigned,
          id: r.id,
        }
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
        const key = `${r.grade}-${r.class_num}`
        daySlots[d][r.slot] = {
          teacher_id: r.teacher_id,
          subject_id: r.subject_id,
          is_unassigned: r.is_unassigned,
          label: `${r.grade}학년 ${r.class_num}반`,
          id: r.id,
        }
      }
    }
    return daySlots
  }

  function openEditModal(day, slot, cell) {
    if (tab === 'class') {
      setEditModal({ day, slot, grade: selectedGrade, classNum: selectedClass, current: cell })
    }
  }

  async function handleEditSave(teacherId, subjectId) {
    if (!editModal) return
    setSaving(true)
    const { day, slot, grade, classNum } = editModal

    const existing = timetableRows.find(r =>
      r.grade === grade && r.class_num === classNum && r.day_of_week === day && r.slot === slot
    )

    if (existing) {
      await supabase.from('timetable_slots').update({
        teacher_id: teacherId || null,
        subject_id: subjectId || null,
        is_unassigned: !teacherId,
      }).eq('id', existing.id)
    } else {
      await supabase.from('timetable_slots').insert({
        school_id: schoolId,
        grade, class_num: classNum,
        day_of_week: day, slot,
        teacher_id: teacherId || null,
        subject_id: subjectId || null,
        is_unassigned: !teacherId,
      })
    }
    setEditModal(null)
    setSaving(false)
    await load()
  }

  const numClasses = gradeConfigs.find(g => g.grade === selectedGrade)?.num_classes || 1
  const gradeLunchSlot = scheduleResult?.gradeLunchSlot || {}
  const totalSlots = scheduleResult?.totalSlots || 6

  const classSlots = getSlotsForClass(selectedGrade, selectedClass)
  const teacherSlots = selectedTeacher ? getSlotsForTeacher(selectedTeacher) : {}

  const gradeLunchForSelected = tab === 'class'
    ? (gradeLunchSlot[selectedGrade] !== undefined ? { [selectedGrade]: gradeLunchSlot[selectedGrade] } : {})
    : gradeLunchSlot

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
          {/* 탭 */}
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
                gradeLunchSlot={gradeLunchForSelected}
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
              />
            </>
          )}
        </>
      )}

      {/* 셀 편집 모달 */}
      {editModal && (
        <EditCellModal
          modal={editModal}
          teachers={teachers}
          subjects={subjects}
          grade={editModal.grade}
          onSave={handleEditSave}
          onClose={() => setEditModal(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

function TeacherTimetableGrid({ slots, totalSlots, gradeLunchSlot }) {
  const DAY_LABELS = ['월', '화', '수', '목', '금']
  const allLunchSlots = Object.values(gradeLunchSlot)

  return (
    <div className="border border-gray-200 rounded-sm overflow-hidden bg-white">
      <div className="flex bg-gray-50">
        <div className="w-[72px] flex-shrink-0 border-r border-gray-200 h-9 flex items-center justify-center text-[11px] font-semibold text-gray-500">교시</div>
        {DAY_LABELS.map(d => (
          <div key={d} className="flex-1 h-9 flex items-center justify-center border-r border-gray-200 last:border-r-0 text-[11px] font-semibold text-gray-500">{d}</div>
        ))}
      </div>
      {Array.from({ length: totalSlots }, (_, slot) => {
        const isLunch = allLunchSlots.includes(slot) && allLunchSlots.length > 0
        return (
          <div key={slot} className={`flex border-t border-gray-100 ${isLunch ? 'h-8 bg-gray-50' : 'h-[62px]'}`}>
            <div className="w-[72px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-400 bg-gray-50">
              {isLunch ? '점심' : `${slot + 1}교시`}
            </div>
            {Array.from({ length: 5 }, (_, day) => {
              if (isLunch) {
                return <div key={day} className="flex-1 border-r border-gray-100 last:border-r-0 flex items-center justify-center text-[11px] text-gray-300">점심시간</div>
              }
              const cell = slots?.[day]?.[slot]
              return (
                <div key={day} className="flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0.5">
                  {cell ? (
                    <>
                      <span className="text-[12px] font-semibold text-gray-900">{cell.label}</span>
                    </>
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

function EditCellModal({ modal, teachers, subjects, grade, onSave, onClose, saving }) {
  const { day, slot } = modal
  const DAY_LABELS = ['월', '화', '수', '목', '금']
  const [teacherId, setTeacherId] = useState(modal.current?.teacher_id || '')
  const [subjectId, setSubjectId] = useState(modal.current?.subject_id || '')

  const gradeSubjects = subjects.filter(s => s.grade === grade)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[400px] rounded-sm border border-gray-200 p-6">
        <h2 className="text-[16px] font-bold mb-4">{DAY_LABELS[day]}요일 {slot + 1}교시 편집</h2>
        <div className="flex flex-col gap-3 mb-5">
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
            onClick={() => onSave(teacherId, subjectId)}
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
