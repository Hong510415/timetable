import React, { useState } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { runAssignmentAlgorithm, assignmentsToTeacherAssignments } from '../lib/assignmentAlgorithm'
import ManualModal from '../components/ManualModal'

const MANUAL = [
  {
    title: '자동 배정',
    items: [
      '"자동 배정 실행" 버튼을 누르면 과목·학년·반과 교사 수 정보를 바탕으로 교사별 담당이 자동 분배됩니다.',
      '주요 과목(전담 과목 설정에서 체크) 1인 제한 옵션을 켜면, 한 교사에게 주요 과목이 1개만 배정됩니다.',
      '학년·반별 시수 합계, 교사별 목표 시수를 자동 계산해서 균등 분배를 시도합니다.',
    ],
  },
  {
    title: '수동 편집',
    items: [
      '자동 배정 후 표에서 각 행을 직접 수정할 수 있습니다 (학년·반·시수 변경, 행 삭제 등).',
      '"+ 과목 설정 추가" 버튼으로 새 행을 추가할 수도 있습니다.',
      '시수 부족·초과 등 균형 문제가 있으면 경고가 표시됩니다.',
    ],
  },
  {
    title: '시간표에 적용',
    items: [
      '"시간표에 적용" 버튼을 눌러야 배정 결과가 시간표 자동 생성에 반영됩니다.',
      '⚠ 재적용 시 기존에 생성된 시간표가 초기화됩니다.',
    ],
  },
]

export default function Assignment() {
  const { state, setTeachers, setAssignmentSettings, setAssignmentResult } = useApp()
  const { gradeConfigs, subjects, teachers, assignmentSettings, assignmentResult } = state

  const [running, setRunning] = useState(false)
  const [openPopupId, setOpenPopupId] = useState(null)

  const result = assignmentResult?.result ?? null
  const editedAssignments = assignmentResult?.edited ?? null
  const activeAssignments = editedAssignments ?? result?.assignments ?? []

  function handleRun() {
    if (editedAssignments !== null) {
      if (!confirm('자동 배정을 재실행하면 수동 수정 내용이 초기화됩니다. 계속하시겠습니까?')) return
    }
    setRunning(true)
    setTimeout(() => {
      const r = runAssignmentAlgorithm({ gradeConfigs, subjects, teachers, assignmentSettings })
      setAssignmentResult({ result: r, edited: null })
      setRunning(false)
    }, 0)
  }

  function handleApply() {
    if (!activeAssignments.length) return alert('먼저 자동 배정을 실행하세요.')
    const map = assignmentsToTeacherAssignments(activeAssignments)
    setTeachers(teachers.map(t => ({
      ...t,
      teacher_assignments: map[t.id] || [],
    })))
    alert('적용되었습니다.')
  }

  function addAssignment(teacherId, teacherCode, subjectId, subjectName, grade, classNums, hoursPerClass, isMajor) {
    const existing = activeAssignments.find(a => a.teacherId === teacherId && a.subjectId === subjectId && a.grade === grade)
    let next
    if (existing) {
      const merged = [...new Set([...existing.classNums, ...classNums])].sort((a, b) => a - b)
      next = activeAssignments.map(a =>
        a === existing ? { ...a, classNums: merged, weeklyHours: a.hoursPerClass * merged.length, isManual: true } : a
      )
    } else {
      const newEntry = {
        teacherId, teacherCode, subjectId, subjectName, grade, classNums,
        weeklyHours: hoursPerClass * classNums.length, hoursPerClass,
        isManual: true, isMajor,
      }
      next = [...activeAssignments, newEntry]
    }
    setAssignmentResult({ result, edited: next })
  }

  function updateAssignment(idx, field, value) {
    let next = activeAssignments.map((a, i) => {
      if (i !== idx) return a
      const updated = { ...a, [field]: value, isManual: true }
      if (field === 'classNums') {
        updated.weeklyHours = a.hoursPerClass * value.length
      }
      return updated
    })
    // 반이 0개가 된 행은 삭제
    if (field === 'classNums' && value.length === 0) {
      next = next.filter((_, i) => i !== idx)
    }
    setAssignmentResult({ result, edited: next })
  }

  const warnings = editedAssignments !== null
    ? computeWarnings(editedAssignments, gradeConfigs, subjects, teachers.length)
    : (result?.warnings ?? [])

  const gradeSummary = result?.gradeSummary ?? []

  const totalDedicated = subjects.reduce((sum, s) => {
    const gc = gradeConfigs.find(g => g.grade === s.grade)
    return sum + (gc ? s.weekly_hours * gc.num_classes : 0)
  }, 0)
  const targetHours = teachers.length ? Math.round(totalDedicated / teachers.length) : 0

  if (!subjects.length) {
    return (
      <div className="p-4 md:p-10 bg-gray-50 min-h-full">
        <h1 className="text-[22px] font-bold mb-6">전담 배정</h1>
        <div className="text-center py-20 text-gray-300 text-[14px]">
          전담 과목 설정 탭에서 과목을 먼저 입력하세요.
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-full">
      <div className="max-w-[720px] flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-[22px] font-bold">전담 배정</h1>
        <div className="flex flex-wrap gap-2">
          <ManualModal title="전담 배정" sections={MANUAL} />
          {result && (
            <button
              onClick={handleApply}
              className="h-10 px-3 md:px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50 whitespace-nowrap"
            >
              시간표에 적용
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 h-10 px-3 md:px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
            {running ? '배정 중...' : '자동 배정 실행'}
          </button>
        </div>
      </div>

      <p className="max-w-[720px] text-[12px] text-gray-400 -mt-3 mb-5">③ 어떤 교사가 어떤 과목·학년·반을 맡을지 정하세요. "자동 배정 실행" 후 표에서 직접 수정할 수 있고, "시간표에 적용"을 눌러야 시간표 생성에 반영됩니다.</p>

      {/* 배정 정보 */}
      <div className="max-w-[720px] bg-white border border-gray-200 rounded-sm p-4 mb-5 text-[12px] text-gray-500 flex gap-6 flex-wrap">
        <span>교사 수: <strong className="text-gray-800">{teachers.length}명</strong></span>
        <span>전체 전담시수: <strong className="text-gray-800">{totalDedicated}h</strong></span>
        <span>교사 목표 시수: <strong className="text-gray-800">{targetHours}h</strong></span>
        <span>주요 과목 1개 제한: <strong className="text-gray-800">{assignmentSettings.maxMajorSubjectsPerTeacher === 1 ? '적용' : '미적용'}</strong></span>
      </div>

      {/* 경고 */}
      {warnings.length > 0 && (
        <div className="max-w-[720px] mb-5 flex flex-col gap-2">
          {warnings.map((w, i) => (
            <div key={i} className={`flex items-start gap-2 p-3 rounded-sm text-[12px] border ${
              w.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              {w.message}
            </div>
          ))}
        </div>
      )}

      {result && warnings.length === 0 && (
        <div className="max-w-[720px] flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-sm text-[12px] text-green-700 mb-5">
          <CheckCircle size={14} />
          배정이 균형 기준을 만족합니다.
        </div>
      )}

      {!result && (
        <div className="text-center py-20 text-gray-300 text-[14px]">
          자동 배정 실행 버튼을 눌러 배정을 시작하세요.
        </div>
      )}

      {result && (
        <>
          {/* 배정 결과 테이블 */}
          <div className="max-w-[720px] bg-white border border-gray-200 rounded-sm mb-5 overflow-x-auto">
            <div className="flex bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500">
              <div className="w-[110px] flex-shrink-0 px-4 py-2.5 border-r border-gray-200">교사</div>
              <div className="w-[90px] flex-shrink-0 px-3 py-2.5 border-r border-gray-200">과목</div>
              <div className="w-[60px] flex-shrink-0 px-3 py-2.5 border-r border-gray-200">학년</div>
              <div className="flex-1 px-3 py-2.5 border-r border-gray-200">담당 반</div>
              <div className="w-[80px] flex-shrink-0 px-3 py-2.5 border-r border-gray-200">합계</div>
              <div className="w-[60px] flex-shrink-0 px-3 py-2.5 border-r border-gray-200">편집</div>
              <div className="w-[60px] flex-shrink-0 px-3 py-2.5">삭제</div>
            </div>

            {teachers.map(teacher => {
              const teacherAssigns = activeAssignments
                .filter(a => a.teacherId === teacher.id)
                .slice()
                .sort((a, b) => {
                  const aMajor = subjects.find(s => s.id === a.subjectId)?.is_major ?? false
                  const bMajor = subjects.find(s => s.id === b.subjectId)?.is_major ?? false
                  if (aMajor !== bMajor) return aMajor ? -1 : 1
                  if (a.grade !== b.grade) return a.grade - b.grade
                  return (a.subjectName || '').localeCompare(b.subjectName || '')
                })
              const totalH = teacherAssigns.reduce((s, a) => s + a.weeklyHours, 0)
              const isOver = totalH > targetHours + 3
              const isUnder = totalH < targetHours - 3 && totalH > 0
              return (
                <div key={teacher.id} className={`border-b border-gray-100 last:border-b-0 ${isOver || isUnder ? 'bg-yellow-50' : ''}`}>
                  {teacherAssigns.length === 0 ? (
                    <div className="flex items-center h-10">
                      <div className="w-[110px] flex-shrink-0 px-2 border-r border-gray-100">
                        <input
                          value={teacher.code}
                          onChange={e => setTeachers(teachers.map(t => t.id === teacher.id ? { ...t, code: e.target.value } : t))}
                          className="w-full h-7 px-2 text-[12px] font-semibold border border-transparent rounded-sm hover:border-gray-200 focus:border-black outline-none"
                        />
                      </div>
                      <div className="flex-1 px-3">
                        <AddAssignmentButton
                          teacher={teacher}
                          subjects={subjects}
                          gradeConfigs={gradeConfigs}
                          popupId={`add-${teacher.id}`}
                          openPopupId={openPopupId}
                          setOpenPopupId={setOpenPopupId}
                          onAdd={(subjectId, subjectName, grade, classNums, hoursPerClass, isMajor) =>
                            addAssignment(teacher.id, teacher.code, subjectId, subjectName, grade, classNums, hoursPerClass, isMajor)
                          }
                        />
                      </div>
                      <div className="w-[80px] flex-shrink-0 px-3 text-[12px] font-bold text-gray-400 border-r border-gray-100">0h</div>
                      <div className="w-[60px] flex-shrink-0 border-r border-gray-100" />
                      <div className="w-[60px]" />
                    </div>
                  ) : (
                    <>
                      {teacherAssigns.map((a, localIdx) => {
                        const globalIdx = activeAssignments.indexOf(a)
                        const numClassesForGrade = gradeConfigs.find(g => g.grade === a.grade)?.num_classes ?? 0
                        const isContiguous = a.classNums.length > 1 &&
                          a.classNums.every((c, i) => i === 0 || c === a.classNums[i - 1] + 1)
                        const classDisplay = a.classNums.length === numClassesForGrade
                          ? '전체'
                          : a.classNums.length === 1
                            ? `${a.classNums[0]}반`
                            : isContiguous
                              ? `${a.classNums[0]}~${a.classNums[a.classNums.length - 1]}반`
                              : a.classNums.map(c => `${c}반`).join(', ')
                        return (
                          <div key={localIdx} className="flex items-center h-10 border-b border-gray-50 last:border-b-0">
                            <div className="w-[110px] flex-shrink-0 px-2 border-r border-gray-100">
                              {localIdx === 0 ? (
                                <input
                                  value={teacher.code}
                                  onChange={e => setTeachers(teachers.map(t => t.id === teacher.id ? { ...t, code: e.target.value } : t))}
                                  className="w-full h-7 px-2 text-[12px] font-semibold border border-transparent rounded-sm hover:border-gray-200 focus:border-black outline-none"
                                />
                              ) : ''}
                            </div>
                            <div className="w-[90px] flex-shrink-0 px-3 text-[12px] border-r border-gray-100 flex items-center gap-1">
                              {a.subjectName}
                              {a.isManual && <span className="text-blue-400 text-[10px]">✎</span>}
                            </div>
                            <div className="w-[60px] flex-shrink-0 px-3 text-[12px] border-r border-gray-100">{a.grade}학년</div>
                            <div className="flex-1 px-3 text-[12px] border-r border-gray-100 flex items-center gap-2">
                              <span>{classDisplay} ({a.classNums.length}반)</span>
                              <span className="text-gray-400">{a.weeklyHours}h</span>
                            </div>
                            <div className={`w-[80px] flex-shrink-0 px-3 text-[12px] font-bold border-r border-gray-100 ${localIdx === 0 && (isOver || isUnder) ? 'text-yellow-700' : 'text-gray-900'}`}>
                              {localIdx === 0 ? `${totalH}h` : ''}
                            </div>
                            <div className="w-[60px] flex-shrink-0 px-3 border-r border-gray-100">
                              <EditClassNumsButton
                                assignment={a}
                                gradeConfigs={gradeConfigs}
                                popupId={`edit-${globalIdx}`}
                                openPopupId={openPopupId}
                                setOpenPopupId={setOpenPopupId}
                                onUpdate={(classNums) => updateAssignment(globalIdx, 'classNums', classNums)}
                              />
                            </div>
                            <div className="w-[60px] flex-shrink-0 px-3">
                              <button
                                onClick={() => {
                                  if (confirm(`${a.subjectName} ${a.grade}학년 ${classDisplay} 배정을 삭제할까요?`)) {
                                    updateAssignment(globalIdx, 'classNums', [])
                                  }
                                }}
                                className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex items-center h-9 border-b border-gray-50">
                        <div className="w-[110px] flex-shrink-0 border-r border-gray-100" />
                        <div className="flex-1 px-3">
                          <AddAssignmentButton
                            teacher={teacher}
                            subjects={subjects}
                            gradeConfigs={gradeConfigs}
                            popupId={`add-${teacher.id}`}
                            openPopupId={openPopupId}
                            setOpenPopupId={setOpenPopupId}
                            onAdd={(subjectId, subjectName, grade, classNums, hoursPerClass, isMajor) =>
                              addAssignment(teacher.id, teacher.code, subjectId, subjectName, grade, classNums, hoursPerClass, isMajor)
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* 담임 시수 현황 */}
          <div className="max-w-[720px] bg-white border border-gray-200 rounded-sm p-5">
            <h3 className="text-[13px] font-semibold mb-3">학년별 담임 시수 현황</h3>
            <div className="flex gap-6 flex-wrap">
              {gradeSummary.map(g => (
                <div key={g.grade} className="text-center min-w-[60px]">
                  <div className="text-[11px] text-gray-400 mb-1">{g.grade}학년</div>
                  <div className="text-[18px] font-bold text-gray-900">{g.homeRoomHours}h</div>
                  <div className="text-[10px] text-gray-400">전담 {g.dedicatedHours}h</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function EditClassNumsButton({ assignment, gradeConfigs, popupId, openPopupId, setOpenPopupId, onUpdate }) {
  const btnRef = React.useRef(null)
  const [openUp, setOpenUp] = useState(false)
  const gc = gradeConfigs.find(g => g.grade === assignment.grade)
  const allClasses = gc ? Array.from({ length: gc.num_classes }, (_, i) => i + 1) : []
  const [selected, setSelected] = useState(new Set(assignment.classNums))
  const isOpen = openPopupId === popupId

  function toggle(c) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  function handleDone() {
    const sorted = allClasses.filter(c => selected.has(c))
    onUpdate(sorted)
    setOpenPopupId(null)
  }

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    setOpenUp(!!rect && rect.bottom > window.innerHeight - 220)
    setSelected(new Set(assignment.classNums))
    setOpenPopupId(popupId)
  }

  return (
    <div className="relative">
      <button ref={btnRef} onClick={isOpen ? () => setOpenPopupId(null) : handleOpen}
        className={`text-[11px] ${isOpen ? 'text-gray-700' : 'text-gray-400 hover:text-gray-700'}`}>
        편집
      </button>
      {isOpen && (
      <div className={`absolute right-0 z-20 bg-white border border-gray-200 rounded-sm shadow-lg p-3 min-w-[160px] ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
        <div className="text-[11px] font-semibold text-gray-600 mb-2">{assignment.grade}학년 담당 반 선택</div>
        <div className="flex flex-wrap gap-1 mb-2">
          {allClasses.map(c => (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={`w-7 h-7 text-[11px] rounded-sm border transition-colors ${selected.has(c) ? 'bg-black text-white border-black' : 'border-gray-300 hover:bg-gray-50'}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setOpenPopupId(null)} className="flex-1 h-7 border border-gray-300 rounded-sm text-[11px] hover:bg-gray-50">취소</button>
          <button onClick={handleDone} className="flex-1 h-7 bg-black text-white rounded-sm text-[11px] hover:bg-gray-800">확인</button>
        </div>
      </div>
      )}
    </div>
  )
}

function AddAssignmentButton({ teacher, subjects, gradeConfigs, popupId, openPopupId, setOpenPopupId, onAdd }) {
  const isOpen = openPopupId === popupId
  const [openUp, setOpenUp] = useState(false)
  const btnRef = React.useRef(null)
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [selectedGrade, setSelectedGrade] = useState(null)
  const [selectedClasses, setSelectedClasses] = useState(new Set())

  const uniqueSubjects = [...new Map(subjects.map(s => [s.name, s])).values()]

  function handleSubjectSelect(subj) {
    setSelectedSubject(subj)
    setSelectedGrade(null)
    setSelectedClasses(new Set())
  }

  function handleGradeSelect(subj, grade) {
    setSelectedGrade(grade)
    setSelectedClasses(new Set())
  }

  function toggleClass(c) {
    setSelectedClasses(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  function handleDone() {
    if (!selectedSubject || !selectedGrade || selectedClasses.size === 0) return
    const gc = gradeConfigs.find(g => g.grade === selectedGrade)
    const allClasses = gc ? Array.from({ length: gc.num_classes }, (_, i) => i + 1) : []
    const classNums = allClasses.filter(c => selectedClasses.has(c))
    // subjects에서 해당 학년+과목명 찾아서 hoursPerClass 가져오기
    const subjDef = subjects.find(s => s.name === selectedSubject.name && s.grade === selectedGrade)
    if (!subjDef) return
    onAdd(subjDef.id, subjDef.name, selectedGrade, classNums, subjDef.weekly_hours, subjDef.is_major)
    setOpenPopupId(null)
    setSelectedSubject(null)
    setSelectedGrade(null)
    setSelectedClasses(new Set())
  }

  const gradesForSubject = selectedSubject
    ? subjects.filter(s => s.name === selectedSubject.name).map(s => s.grade).sort()
    : []

  const classesForGrade = selectedGrade
    ? (() => { const gc = gradeConfigs.find(g => g.grade === selectedGrade); return gc ? Array.from({ length: gc.num_classes }, (_, i) => i + 1) : [] })()
    : []

  if (!isOpen) {
    return (
      <button ref={btnRef} onClick={() => {
        const rect = btnRef.current?.getBoundingClientRect()
        setOpenUp(!!rect && rect.bottom > window.innerHeight - 280)
        setOpenPopupId(popupId)
      }} className="text-[11px] text-gray-400 hover:text-gray-700">
        + 과목 추가
      </button>
    )
  }

  return (
    <div className="relative">
      <div className={`absolute left-0 z-20 bg-white border border-gray-200 rounded-sm shadow-lg p-3 min-w-[220px] ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
        <div className="text-[11px] font-semibold text-gray-600 mb-2">과목 추가 — {teacher.code}</div>

        <div className="text-[10px] text-gray-400 mb-1">과목 선택</div>
        <div className="flex flex-wrap gap-1 mb-3">
          {uniqueSubjects.map(s => (
            <button
              key={s.name}
              onClick={() => handleSubjectSelect(s)}
              className={`px-2 h-6 text-[11px] rounded-sm border transition-colors ${selectedSubject?.name === s.name ? 'bg-black text-white border-black' : 'border-gray-300 hover:bg-gray-50'}`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {selectedSubject && (
          <>
            <div className="text-[10px] text-gray-400 mb-1">학년 선택</div>
            <div className="flex flex-wrap gap-1 mb-3">
              {gradesForSubject.map(g => (
                <button
                  key={g}
                  onClick={() => handleGradeSelect(selectedSubject, g)}
                  className={`w-8 h-6 text-[11px] rounded-sm border transition-colors ${selectedGrade === g ? 'bg-black text-white border-black' : 'border-gray-300 hover:bg-gray-50'}`}
                >
                  {g}학년
                </button>
              ))}
            </div>
          </>
        )}

        {selectedGrade && (
          <>
            <div className="text-[10px] text-gray-400 mb-1">반 선택</div>
            <div className="flex flex-wrap gap-1 mb-3">
              {classesForGrade.map(c => (
                <button
                  key={c}
                  onClick={() => toggleClass(c)}
                  className={`w-7 h-7 text-[11px] rounded-sm border transition-colors ${selectedClasses.has(c) ? 'bg-black text-white border-black' : 'border-gray-300 hover:bg-gray-50'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-1">
          <button onClick={() => setOpenPopupId(null)} className="flex-1 h-7 border border-gray-300 rounded-sm text-[11px] hover:bg-gray-50">취소</button>
          <button
            onClick={handleDone}
            disabled={!selectedSubject || !selectedGrade || selectedClasses.size === 0}
            className="flex-1 h-7 bg-black text-white rounded-sm text-[11px] hover:bg-gray-800 disabled:opacity-40"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  )
}

function computeWarnings(assignments, gradeConfigs, subjects, teacherCount) {
  const warnings = []
  const totalDedicated = subjects.reduce((sum, s) => {
    const gc = gradeConfigs.find(g => g.grade === s.grade)
    return sum + (gc ? s.weekly_hours * gc.num_classes : 0)
  }, 0)
  const targetHours = teacherCount ? Math.round(totalDedicated / teacherCount) : 0

  // 중복 배정 체크: 같은 과목+학년+반이 여러 교사에게 배정됐는지 확인
  const classOwners = {} // key: subjectId_grade_classNum → [teacherCode, ...]
  for (const a of assignments) {
    for (const c of a.classNums) {
      const key = `${a.subjectId}_${a.grade}_${c}`
      if (!classOwners[key]) classOwners[key] = { subjectName: a.subjectName, grade: a.grade, classNum: c, teachers: [] }
      classOwners[key].teachers.push(a.teacherCode)
    }
  }
  for (const { subjectName, grade, classNum, teachers } of Object.values(classOwners)) {
    if (teachers.length > 1) {
      warnings.push({
        type: 'error',
        message: `중복: ${subjectName} ${grade}학년 ${classNum}반이 ${teachers.join(', ')}에게 중복 배정되었습니다.`,
      })
    }
  }

  // 누락 수업 체크: 모든 과목×반이 배정됐는지 확인
  for (const subj of subjects) {
    const gc = gradeConfigs.find(g => g.grade === subj.grade)
    if (!gc) continue
    const allClasses = Array.from({ length: gc.num_classes }, (_, i) => i + 1)
    const assignedClasses = assignments
      .filter(a => a.subjectId === subj.id)
      .flatMap(a => a.classNums)
    const missing = allClasses.filter(c => !assignedClasses.includes(c))
    if (missing.length > 0) {
      warnings.push({
        type: 'error',
        message: `누락: ${subj.name} ${subj.grade}학년 ${missing.join(', ')}반이 배정되지 않았습니다.`,
      })
    }
  }

  const teacherHours = {}
  const teacherCodes = {}
  for (const a of assignments) {
    teacherHours[a.teacherId] = (teacherHours[a.teacherId] || 0) + a.weeklyHours
    teacherCodes[a.teacherId] = a.teacherCode
  }
  for (const [tid, hours] of Object.entries(teacherHours)) {
    const code = teacherCodes[tid] || tid
    if (hours > targetHours + 3) warnings.push({ type: 'warning', message: `${code}: 시수 초과 (${hours}h / 목표 ${targetHours}h)` })
    if (hours < targetHours - 3) warnings.push({ type: 'warning', message: `${code}: 시수 부족 (${hours}h / 목표 ${targetHours}h)` })
  }

  const homeRoomHours = gradeConfigs.map(gc => {
    const weeklyTotal = gc.periods_mon + gc.periods_tue + gc.periods_wed + gc.periods_thu + gc.periods_fri
    const dedicated = subjects.filter(s => s.grade === gc.grade).reduce((s, sub) => s + sub.weekly_hours, 0)
    return weeklyTotal - dedicated
  })
  const hrMax = Math.max(...homeRoomHours)
  const hrMin = Math.min(...homeRoomHours)
  if (hrMax - hrMin > 2) {
    warnings.push({ type: 'warning', message: `학년 간 담임 시수 편차 ${hrMax - hrMin}h (최대 ${hrMax}h, 최소 ${hrMin}h)` })
  }

  return warnings
}
