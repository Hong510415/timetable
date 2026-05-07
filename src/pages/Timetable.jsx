import { useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { buildSchedule, flattenResult } from '../lib/scheduler'
import { exportTimetableByClass, exportTimetableByTeacher } from '../lib/excelExport'
import TimetableGrid from '../components/TimetableGrid'
import ManualModal from '../components/ManualModal'

const MANUAL = [
  {
    title: '시간표 자동 생성',
    items: [
      '자동 생성 버튼을 누르면 배정된 교사 정보를 바탕으로 시간표를 생성합니다.',
      '과목별로 같은 요일 연속 수업 허용 여부와 하루 최대 배정 수를 설정할 수 있습니다.',
      '같은 학년 수업은 라운드 로빈 방식으로 배정됩니다 (1반 1회차 → 2반 1회차 → 1반 2회차 순).',
    ],
  },
  {
    title: '보기 전환',
    items: [
      '학급별 보기: 학년·반을 선택해 해당 학급의 전담 시간표를 확인합니다.',
      '교사별 보기: 교사를 선택해 해당 교사의 주간 수업 현황을 확인합니다.',
      '교사별 보기에서 빈 칸에 마우스를 올리면 그 시간에 수업 중인 학급 목록이 표시됩니다.',
    ],
  },
  {
    title: '수동 수정',
    items: [
      '셀을 클릭하면 해당 시간의 교사·과목을 직접 수정할 수 있습니다.',
      '수정 시 교사 중복이 발생하면 빨간색으로 표시됩니다.',
    ],
  },
  {
    title: '미배정 오류',
    items: [
      '교사 시간이 부족하거나 제약 조건이 너무 많으면 일부 수업이 미배정될 수 있습니다.',
      '미배정 발생 시 오류 목록이 표시됩니다. 교사 수업 시수나 연속 수업 설정을 조정해보세요.',
    ],
  },
  {
    title: '엑셀 내보내기',
    items: [
      '학급별 엑셀: 학급 단위로 시간표를 내보냅니다.',
      '교사별 엑셀: 교사 단위로 시간표를 내보냅니다.',
    ],
  },
  {
    title: '점심시간 분리 배정',
    items: ['점심시간 분리 배정 시 특별실 시간표, 전담교사 시간표는 7교시 형식으로 제시됩니다.'],
  },
]

const GRADES = [1, 2, 3, 4, 5, 6]

export default function Timetable() {
  const { state, setTimetableSlots } = useApp()
  const { gradeConfigs, subjects, teachers, lunchConfig, timetableSlots: timetableRows, rooms, roomBlockedSlots } = state

  const [generating, setGenerating] = useState(false)
  const [errors, setErrors] = useState([])
  const [tab, setTab] = useState('teacher')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateOptions, setGenerateOptions] = useState({ subjectSettings: {} })
  const [selectedClasses, setSelectedClasses] = useState([{ grade: 1, classNum: 1 }])

  function toggleSelectedClass(grade, classNum) {
    setSelectedClasses(prev => {
      const i = prev.findIndex(c => c.grade === grade && c.classNum === classNum)
      if (i >= 0) return prev.filter((_, idx) => idx !== i)
      return [...prev, { grade, classNum }].sort((a, b) => a.grade - b.grade || a.classNum - b.classNum)
    })
  }

  function selectAllInGrade(grade) {
    const cfg = gradeConfigs.find(g => g.grade === grade)
    if (!cfg) return
    setSelectedClasses(prev => {
      const others = prev.filter(c => c.grade !== grade)
      const all = Array.from({ length: cfg.num_classes }, (_, i) => ({ grade, classNum: i + 1 }))
      return [...others, ...all].sort((a, b) => a.grade - b.grade || a.classNum - b.classNum)
    })
  }

  function deselectAllClasses() {
    setSelectedClasses([])
  }
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

  function handleGenerate() {
    if (!gradeConfigs.length || !subjects.length || !teachers.length) {
      return alert('학급 정보, 전담 과목, 교사 정보를 먼저 설정하세요.')
    }
    const hasAssignments = teachers.some(t => t.teacher_assignments?.length > 0)
    if (!hasAssignments) {
      return alert('전담 배정 탭에서 배정을 실행하고 "시간표에 적용"을 먼저 해주세요.')
    }
    const uniqueNames = [...new Set(subjects.map(s => s.name))]
    const current = generateOptions.subjectSettings || {}
    const updated = {}
    for (const name of uniqueNames) {
      updated[name] = current[name] || { allow: false, maxCount: 2 }
    }
    setGenerateOptions({ subjectSettings: updated })
    setShowGenerateModal(true)
  }

  async function executeGenerate() {
    setShowGenerateModal(false)
    setGenerating(true)
    setErrors([])
    try {
      const result = buildSchedule(gradeConfigs, subjects, teachers, lunchConfig || { split_lunch: false, lunch_groups: [] }, rooms, roomBlockedSlots, generateOptions)
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
        daySlots[d][r.slot] = { teacher_id: r.teacher_id, subject_id: r.subject_id, is_unassigned: r.is_unassigned, room_id: r.room_id, id: r.id }
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
        daySlots[d][r.slot] = { teacher_id: r.teacher_id, subject_id: r.subject_id, is_unassigned: r.is_unassigned, label: `${r.grade}학년 ${r.class_num}반`, grade: r.grade, class_num: r.class_num, room_id: r.room_id, id: r.id }
      }
    }
    return daySlots
  }

  function openEditModal(day, slot, cell, ctx = {}) {
    if (tab === 'class') {
      setEditModal({ day, slot, grade: ctx.grade, classNum: ctx.classNum, current: cell, rowId: cell?.id || null })
    } else if (tab === 'teacher') {
      setEditModal({ day, slot, grade: cell?.grade || null, classNum: cell?.class_num || null, current: cell, classLabel: cell?.label || null, teacherView: true, defaultTeacherId: ctx.defaultTeacherId || selectedTeacher, rowId: cell?.id || null })
    }
  }

  function handleEditSave(teacherId, subjectId, grade, classNum, roomId) {
    if (!editModal) return
    setSaving(true)
    const g = grade ?? editModal.grade
    const cn = classNum ?? editModal.classNum
    if (!g || !cn) { setSaving(false); return }

    let updated
    if (editModal.rowId) {
      updated = timetableRows.map(r =>
        r.id === editModal.rowId
          ? { ...r, teacher_id: teacherId || null, subject_id: subjectId || null, room_id: roomId || null, is_unassigned: !teacherId }
          : r
      )
    } else {
      updated = timetableRows.filter(r => !(
        r.grade === g && r.class_num === cn && r.day_of_week === editModal.day && r.slot === editModal.slot
      ))
      if (teacherId) {
        updated.push({ id: crypto.randomUUID(), grade: g, class_num: cn, day_of_week: editModal.day, slot: editModal.slot, teacher_id: teacherId, subject_id: subjectId, room_id: roomId || null, is_unassigned: false })
      }
    }

    setTimetableSlots(updated)
    setEditModal(null)
    setSaving(false)
  }

  const { gradeLunchSlot } = computeSlotMeta(gradeConfigs, lunchConfig)
  const splitLunch = lunchConfig?.split_lunch || false
  const totalSlots = splitLunch ? 7 : 6

  const teacherSlots = selectedTeacher ? getSlotsForTeacher(selectedTeacher) : {}

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-full">
      <div className="max-w-[1100px] flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">전담 시간표</h1>
        <div className="flex gap-2">
          <ManualModal title="전담 시간표" sections={MANUAL} />
          <button
            onClick={() => exportTimetableByTeacher(timetableRows, teachers, subjects, gradeConfigs, gradeLunchSlot, totalSlots)}
            className="flex items-center gap-2 h-10 px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50"
          >
            <Download size={14} />교사별 엑셀
          </button>
          <button
            onClick={() => exportTimetableByClass(timetableRows, gradeConfigs, teachers, subjects, gradeLunchSlot, totalSlots)}
            className="flex items-center gap-2 h-10 px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50"
          >
            <Download size={14} />학급별 엑셀
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
        <div className="max-w-[1100px] mb-4 p-3 bg-red-50 border border-red-200 rounded-sm text-[12px] text-red-600">
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
            {[{ key: 'teacher', label: '교사별 보기' }, { key: 'class', label: '학급별 보기' }].map(t => (
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
              <div className="max-w-[1100px] mb-5 bg-white border border-gray-200 rounded-sm p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-gray-500">선택된 학급 ({selectedClasses.length})</span>
                  <button onClick={deselectAllClasses} className="text-[11px] px-2 h-6 border border-gray-300 rounded-sm hover:bg-gray-50">전체 해제</button>
                </div>
                {GRADES.map(g => {
                  const cfg = gradeConfigs.find(c => c.grade === g)
                  if (!cfg || !cfg.num_classes) return null
                  const allSelected = Array.from({ length: cfg.num_classes }).every((_, i) =>
                    selectedClasses.some(c => c.grade === g && c.classNum === i + 1)
                  )
                  return (
                    <div key={g} className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12px] font-semibold text-gray-700 w-[44px]">{g}학년</span>
                      <button
                        onClick={() => allSelected ? setSelectedClasses(prev => prev.filter(c => c.grade !== g)) : selectAllInGrade(g)}
                        className="text-[11px] px-2 h-6 border border-gray-300 rounded-sm text-gray-500 hover:bg-gray-50"
                      >
                        {allSelected ? '학년 해제' : '학년 전체'}
                      </button>
                      {Array.from({ length: cfg.num_classes }, (_, i) => i + 1).map(cn => {
                        const sel = selectedClasses.some(c => c.grade === g && c.classNum === cn)
                        return (
                          <button
                            key={cn}
                            onClick={() => toggleSelectedClass(g, cn)}
                            className={`text-[11px] px-2 h-6 rounded-sm border transition-colors ${
                              sel ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {cn}반
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {selectedClasses.length === 0 ? (
                <div className="max-w-[1100px] text-center py-12 text-gray-300 text-[13px]">학급을 선택하세요</div>
              ) : (
                <div className="max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {selectedClasses.map(({ grade, classNum }) => (
                    <div key={`${grade}-${classNum}`} className="flex flex-col gap-1">
                      <div className="px-1 text-[13px] font-bold text-gray-800">{grade}학년 {classNum}반</div>
                      <TimetableGrid
                        slots={getSlotsForClass(grade, classNum)}
                        totalSlots={totalSlots}
                        gradeLunchSlot={gradeLunchSlot}
                        teachers={teachers}
                        subjects={subjects}
                        rooms={rooms}
                        timetableRows={timetableRows}
                        onCellClick={(day, slot, cell) => openEditModal(day, slot, cell, { grade, classNum })}
                        grade={grade}
                        classNum={classNum}
                        compact
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'teacher' && (
            <div className="max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-4">
              {teachers.map(t => {
                const ts = getSlotsForTeacher(t.id)
                const scheduled = timetableRows.filter(r => r.teacher_id === t.id && !r.is_unassigned).length
                const target = (t.teacher_assignments || []).reduce((s, a) => s + (a.weekly_hours || 0) * 1, 0)
                return (
                  <div key={t.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2 px-1">
                      <span className="text-[13px] font-bold text-gray-800">{t.code}</span>
                      <span className={`text-[11px] ${scheduled < target ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                        {scheduled} / {target}h{scheduled < target ? ` (부족 ${target - scheduled}h)` : ''}
                      </span>
                    </div>
                    <TeacherTimetableGrid
                      slots={ts}
                      totalSlots={totalSlots}
                      gradeLunchSlot={gradeLunchSlot}
                      subjects={subjects}
                      timetableRows={timetableRows}
                      teachers={teachers}
                      rooms={rooms}
                      compact
                      onCellClick={(day, slot, cell) => openEditModal(day, slot, cell, { defaultTeacherId: t.id })}
                    />
                  </div>
                )
              })}
            </div>
          )}

          <UnassignedStats
            teachers={teachers}
            subjects={subjects}
            timetableRows={timetableRows}
            filterClasses={tab === 'class' ? selectedClasses : null}
          />
        </>
      )}

      {editModal && (
        <EditCellModal
          modal={editModal}
          teachers={teachers}
          subjects={subjects}
          gradeConfigs={gradeConfigs}
          rooms={rooms}
          grade={editModal.grade}
          onSave={handleEditSave}
          onClose={() => setEditModal(null)}
          saving={saving}
        />
      )}

      {showGenerateModal && (
        <GenerateOptionsModal
          options={generateOptions}
          onChange={setGenerateOptions}
          subjects={subjects}
          onConfirm={executeGenerate}
          onClose={() => setShowGenerateModal(false)}
        />
      )}
    </div>
  )
}

function UnassignedStats({ teachers, subjects, timetableRows, filterClasses }) {
  // 교사별 (과목, 학년-반)별 목표 vs 배정 시수
  const filterSet = filterClasses ? new Set(filterClasses.map(c => `${c.grade}-${c.classNum}`)) : null
  const rows = []
  for (const t of teachers) {
    for (const a of (t.teacher_assignments || [])) {
      if (filterSet && !filterSet.has(`${a.grade}-${a.class_num}`)) continue
      const target = a.weekly_hours || 0
      const scheduled = timetableRows.filter(r =>
        r.teacher_id === t.id &&
        r.subject_id === a.subject_id &&
        r.grade === a.grade &&
        r.class_num === a.class_num &&
        !r.is_unassigned
      ).length
      const deficit = target - scheduled
      const subj = subjects.find(s => s.id === a.subject_id)
      rows.push({
        teacherCode: t.code,
        subjectName: subj?.name || '?',
        grade: a.grade,
        classNum: a.class_num,
        target,
        scheduled,
        deficit,
      })
    }
  }
  // 부족한 것만 우선
  rows.sort((a, b) => b.deficit - a.deficit || a.teacherCode.localeCompare(b.teacherCode))
  const deficitRows = rows.filter(r => r.deficit > 0)
  if (deficitRows.length === 0) return null

  const isClassView = filterClasses != null
  const isSingleClass = isClassView && filterClasses.length === 1
  const gridStyle = isSingleClass
    ? { gridTemplateColumns: '1fr 1fr 70px 70px 70px' }
    : { gridTemplateColumns: '1fr 1fr 110px 60px 60px 60px' }

  return (
    <div className="mt-6 max-w-[540px] bg-white border border-gray-200 rounded-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[12px] font-semibold text-gray-700">
        미배정 시수 ({deficitRows.length}건){isSingleClass ? ` — ${filterClasses[0].grade}학년 ${filterClasses[0].classNum}반` : ''}
      </div>
      <div className="grid bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500" style={gridStyle}>
        <div className="px-3 py-2 border-r border-gray-200">교사</div>
        <div className="px-3 py-2 border-r border-gray-200">과목</div>
        {!isSingleClass && <div className="px-3 py-2 border-r border-gray-200">학년 · 반</div>}
        <div className="px-3 py-2 border-r border-gray-200 text-center">목표</div>
        <div className="px-3 py-2 border-r border-gray-200 text-center">배정</div>
        <div className="px-3 py-2 text-center">부족</div>
      </div>
      {deficitRows.map((r, i) => (
        <div key={i} className="grid border-b border-gray-100 last:border-b-0 text-[12px]" style={gridStyle}>
          <div className="px-3 py-2 border-r border-gray-100 font-semibold">{r.teacherCode}</div>
          <div className="px-3 py-2 border-r border-gray-100">{r.subjectName}</div>
          {!isSingleClass && <div className="px-3 py-2 border-r border-gray-100">{r.grade}학년 {r.classNum}반</div>}
          <div className="px-3 py-2 border-r border-gray-100 text-center text-gray-600">{r.target}h</div>
          <div className="px-3 py-2 border-r border-gray-100 text-center text-gray-600">{r.scheduled}h</div>
          <div className="px-3 py-2 text-center font-bold text-red-600">−{r.deficit}h</div>
        </div>
      ))}
    </div>
  )
}

function TeacherTimetableGrid({ slots, totalSlots, gradeLunchSlot, subjects, timetableRows, teachers, rooms, compact, onCellClick }) {
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
        <div key={slot} className={`flex border-t border-gray-100 ${compact ? 'h-[44px]' : 'h-[62px]'}`}>
          <div className={`w-[72px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-400 bg-gray-50`}>
            {slot + 1}교시
          </div>
          {Array.from({ length: 5 }, (_, day) => {
            const cell = slots?.[day]?.[slot]
            const subject = cell?.subject_id ? subjects?.find(s => s.id === cell.subject_id) : null
            const room = cell?.room_id ? rooms?.find(r => r.id === cell.room_id) : null
            const conflicts = getConflicts(cell, day, slot)
            const hasConflict = conflicts.length > 0
            const tooltipText = conflicts.map(c => {
              const cs = subjects?.find(s => s.id === c.subject_id)
              const ct = teachers?.find(t => t.id === c.teacher_id)
              return `${cs?.name ?? '?'} (${ct?.code ?? '?'})`
            }).join(', ') + '와 겹침'

            const classesAtSlot = !cell
              ? (timetableRows || []).filter(r =>
                  r.day_of_week === day && r.slot === slot && r.teacher_id && !r.is_unassigned
                )
              : []

            return (
              <div
                key={day}
                onClick={() => onCellClick?.(day, slot, cell)}
                className="relative group flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0 cursor-pointer hover:bg-blue-50 transition-colors"
              >
                {cell ? (
                  <>
                    <span className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-semibold ${hasConflict ? 'text-red-600' : 'text-gray-900'}`}>
                      {subject?.name ?? '—'}
                    </span>
                    <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} ${hasConflict ? 'text-red-400' : 'text-gray-400'}`}>
                      {cell.label}
                    </span>
                    {room && (
                      <span className="text-[10px] text-blue-500">{room.name}</span>
                    )}
                    {hasConflict && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 hidden group-hover:block bg-gray-900 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap">
                        {tooltipText}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[12px] text-gray-200 group-hover:hidden">—</span>
                    {classesAtSlot.length > 0 ? (
                      <div className="hidden group-hover:flex flex-col items-center gap-0.5 w-full px-1">
                        {classesAtSlot.map(r => {
                          const subj = subjects?.find(s => s.id === r.subject_id)
                          return (
                            <span key={r.id} className="text-[10px] text-gray-500 leading-tight text-center">
                              {r.grade}학년 {r.class_num}반 {subj?.name ?? '?'}
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="hidden group-hover:block text-[12px] text-gray-300">—</span>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function GenerateOptionsModal({ options, onChange, subjects, onConfirm, onClose }) {
  const subjectInfo = {}
  for (const s of subjects) {
    if (!subjectInfo[s.name]) subjectInfo[s.name] = { name: s.name, maxWeeklyHours: 0 }
    if (s.weekly_hours > subjectInfo[s.name].maxWeeklyHours) {
      subjectInfo[s.name].maxWeeklyHours = s.weekly_hours
    }
  }
  const uniqueSubjects = Object.values(subjectInfo)

  function updateSubject(name, field, value) {
    onChange({
      ...options,
      subjectSettings: {
        ...options.subjectSettings,
        [name]: { ...(options.subjectSettings[name] || { allow: false, maxCount: 2 }), [field]: value },
      },
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[520px] rounded-sm border border-gray-200 p-6">
        <h2 className="text-[16px] font-bold mb-4">시간표 자동 생성 설정</h2>

        <div className="mb-1 flex text-[11px] font-semibold text-gray-400">
          <div className="w-[100px]">과목</div>
          <div className="w-[110px] text-center">같은 요일 배정</div>
          <div className="flex-1 pl-4">
            하루 최대 수
            <span className="ml-1 text-gray-300 font-normal">(가능 시 연속 배치)</span>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-gray-100 mb-4">
          {uniqueSubjects.map(subj => {
            const settings = options.subjectSettings[subj.name] || { allow: false, maxCount: 2 }
            const maxButtons = Math.min(subj.maxWeeklyHours, 5)
            const buttons = []
            for (let i = 2; i <= maxButtons; i++) buttons.push(i)

            return (
              <div key={subj.name} className="flex items-center py-2.5 gap-3">
                <div className="w-[100px] text-[13px] font-semibold text-gray-800 truncate">{subj.name}</div>
                <div className="w-[110px] flex gap-1">
                  {[{ val: false, label: '불가' }, { val: true, label: '가능' }].map(opt => (
                    <button
                      key={String(opt.val)}
                      onClick={() => updateSubject(subj.name, 'allow', opt.val)}
                      className={`flex-1 h-7 rounded-sm text-[12px] font-semibold border transition-colors
                        ${settings.allow === opt.val ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                    >{opt.label}</button>
                  ))}
                </div>
                <div className="flex-1 pl-4 flex gap-1">
                  {buttons.map(n => (
                    <button
                      key={n}
                      onClick={() => settings.allow && updateSubject(subj.name, 'maxCount', n)}
                      disabled={!settings.allow}
                      className={`w-8 h-7 rounded-sm text-[12px] font-semibold border transition-colors
                        ${settings.allow && settings.maxCount === n ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-400 bg-white'}
                        ${!settings.allow ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    >{n}</button>
                  ))}
                  {buttons.length === 0 && <span className="text-[12px] text-gray-300 leading-7">—</span>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
          <button onClick={onConfirm} className="h-9 px-5 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800">생성</button>
        </div>
      </div>
    </div>
  )
}

function EditCellModal({ modal, teachers, subjects, gradeConfigs, rooms, grade, onSave, onClose, saving }) {
  const { day, slot, classLabel, teacherView, defaultTeacherId } = modal
  const DAY_LABELS = ['월', '화', '수', '목', '금']
  const needsGradeClass = teacherView && !modal.grade

  const [teacherId, setTeacherId] = useState(modal.current?.teacher_id || defaultTeacherId || '')
  const [subjectId, setSubjectId] = useState(modal.current?.subject_id || '')
  const [roomId, setRoomId] = useState(modal.current?.room_id || '')
  const [formGrade, setFormGrade] = useState(grade || 1)
  const [formClass, setFormClass] = useState(1)

  const numClasses = gradeConfigs?.find(g => g.grade === formGrade)?.num_classes || 1
  const effectiveGrade = needsGradeClass ? formGrade : grade
  const gradeSubjects = subjects.filter(s => s.grade === effectiveGrade)

  // 선택된 과목·교사에 사용 가능한 특별실 목록
  const selectedSubject = subjects.find(s => s.id === subjectId)
  const eligibleRooms = (rooms || []).filter(r => {
    if (!selectedSubject) return false
    if (!r.subjectNames?.includes(selectedSubject.name)) return false
    if (Array.isArray(r.teacherIds) && r.teacherIds.length > 0 && teacherId) {
      if (!r.teacherIds.includes(teacherId)) return false
    }
    return true
  })

  function handleGradeChange(g) {
    setFormGrade(g)
    setFormClass(1)
    setSubjectId('')
    setRoomId('')
  }

  function handleSubjectChange(sid) {
    setSubjectId(sid)
    setRoomId('')
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
              onChange={e => handleSubjectChange(e.target.value)}
              className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
            >
              <option value="">없음</option>
              {gradeSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {selectedSubject && (
            <div>
              <label className="text-[12px] font-semibold text-gray-600 block mb-1">특별실</label>
              <select
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
              >
                <option value="">없음 (일반 교실)</option>
                {eligibleRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {eligibleRooms.length === 0 && (
                <p className="text-[11px] text-gray-400 mt-1">이 과목·교사에 등록된 특별실이 없습니다</p>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
          <button
            onClick={() => onSave(teacherId, subjectId, needsGradeClass ? formGrade : null, needsGradeClass ? formClass : null, roomId || null)}
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
