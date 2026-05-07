import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { subjectsEqualByContent, getDedicatedHoursForGrade, getWeeklyTotalForGrade, getOverflowGrades, getTotalDedicatedHours } from '../lib/planHelpers'
import SubjectPlanComparison from '../components/SubjectPlanComparison'

const GRADES = [1, 2, 3, 4, 5, 6]

export default function SubjectSetup() {
  const { state, updatePlanSubjects, setActivePlanTab, applyPlan, setAssignmentSettings, addPlanSlot, removePlanSlot } = useApp()
  const { subjects, gradeConfigs, assignmentSettings, subjectPlans, teachers } = state
  const { plans, activeTabId, appliedPlanId, appliedAt } = subjectPlans
  const visiblePlans = plans.filter(p => p.visible)
  const [showComparison, setShowComparison] = useState(false)

  const activePlan = plans.find(p => p.id === activeTabId) || plans[0]
  const planSubjects = activePlan.subjects

  const activeGrades = gradeConfigs.filter(g => g.num_classes > 0).map(g => g.grade)
  const gradesToShow = activeGrades.length > 0 ? activeGrades : GRADES

  const isPlanLive = appliedPlanId === activeTabId && subjectsEqualByContent(planSubjects, subjects)
  const appliedPlan = plans.find(p => p.id === appliedPlanId)

  const overflowGrades = getOverflowGrades(planSubjects, gradeConfigs, gradesToShow)
  const hasOverflow = overflowGrades.length > 0
  const isEmpty = planSubjects.length === 0

  const isApplyDisabled = isPlanLive || hasOverflow || isEmpty

  const disabledTitle = hasOverflow
    ? `초과 학년이 있어 적용할 수 없습니다 (${overflowGrades.map(o => `${o.grade}학년 초과 -${o.overBy}시간`).join(', ')})`
    : isEmpty
    ? '과목을 먼저 입력해 주세요.'
    : ''

  const totalDedicated = getTotalDedicatedHours(planSubjects, gradeConfigs)

  let statusLine
  if (!appliedPlanId) {
    statusLine = `현재 편집: ${activePlan.name} · 적용 전`
  } else if (isPlanLive) {
    const time = appliedAt ? ` (${new Date(appliedAt).toLocaleString('ko-KR')})` : ''
    statusLine = `현재 편집: ${activePlan.name} · 적용됨${time}`
  } else {
    statusLine = `현재 편집: ${activePlan.name} · 미적용 (적용된 안: ${appliedPlan?.name || '없음'})`
  }

  function addSubject(grade) {
    updatePlanSubjects(activeTabId, [
      ...planSubjects,
      { id: crypto.randomUUID(), grade, name: '', weekly_hours: 2, is_major: false },
    ])
  }

  function updateSubject(id, field, value) {
    updatePlanSubjects(activeTabId, planSubjects.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function removeSubject(id) {
    updatePlanSubjects(activeTabId, planSubjects.filter(s => s.id !== id))
  }

  function handleApply() {
    if (isApplyDisabled) return
    if (subjectsEqualByContent(planSubjects, subjects)) {
      applyPlan(activeTabId)
      return
    }
    const ok = confirm(
      `${activePlan.name}을 적용합니다.\n` +
      `이전 적용 안과 과목 구성이 달라 다음 데이터가 초기화됩니다:\n` +
      `· 전담 교사 배정\n` +
      `· 전담 시간표\n` +
      `· 특별실 시간표\n` +
      `· 전담 배정 결과\n\n` +
      `계속하시겠습니까?`
    )
    if (!ok) return
    applyPlan(activeTabId)
  }

  function handleOpenCompare() {
    const filledCount = visiblePlans.filter(p => p.subjects.length > 0).length
    if (filledCount === 0) {
      alert('A·B·C안 모두 비어 있습니다. 먼저 과목을 입력하세요.')
      return
    }
    if (filledCount === 1) {
      const onlyPlan = visiblePlans.find(p => p.subjects.length > 0)
      const ok = confirm(`비교할 다른 안이 없습니다. ${onlyPlan.name}을 바로 적용할까요?`)
      if (ok) {
        setActivePlanTab(onlyPlan.id)
        const overflows = getOverflowGrades(onlyPlan.subjects, gradeConfigs, gradesToShow)
        if (overflows.length > 0) {
          alert(`${onlyPlan.name}에 초과 학년이 있어 적용할 수 없습니다 (${overflows.map(o => `${o.grade}학년 초과 -${o.overBy}시간`).join(', ')}).`)
          return
        }
        applyPlan(onlyPlan.id)
      }
      return
    }
    setShowComparison(true)
  }

  function handleApplyFromComparison(planId) {
    const plan = plans.find(p => p.id === planId)
    if (!plan) return
    if (plan.subjects.length === 0) return
    const overflows = getOverflowGrades(plan.subjects, gradeConfigs, gradesToShow)
    if (overflows.length > 0) return
    const isLive = appliedPlanId === planId && subjectsEqualByContent(plan.subjects, subjects)
    if (isLive) {
      setShowComparison(false)
      return
    }
    if (subjectsEqualByContent(plan.subjects, subjects)) {
      applyPlan(planId)
      setShowComparison(false)
      return
    }
    if (!confirm(
      `${plan.name}을 적용합니다.\n` +
      `이전 적용 안과 과목 구성이 달라 다음 데이터가 초기화됩니다:\n` +
      `· 전담 교사 배정\n` +
      `· 전담 시간표\n` +
      `· 특별실 시간표\n` +
      `· 전담 배정 결과\n\n` +
      `계속하시겠습니까?`
    )) return
    applyPlan(planId)
    setShowComparison(false)
  }

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-full">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold">전담 과목 설정</h1>
        <p className="text-[12px] text-gray-400 mt-1">변경 사항은 자동으로 저장됩니다.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="max-w-[720px] bg-white border border-gray-200 rounded-sm p-5 flex flex-col gap-3">
          <div>
            <p className="text-[13px] font-semibold text-gray-700 mb-1">주요 과목 vs 일반 과목</p>
            <p className="text-[12px] text-gray-500 leading-5">
              <span className="font-semibold text-gray-700">주요 과목</span>은 전담 부담이 큰 과목입니다. 한 교사가 주요 과목을 여러 개 맡으면 수업 준비 부담이 집중됩니다.<br />
              <span className="font-semibold text-gray-700">일반 과목</span>은 주요 과목에 추가해 맡을 수 있는 과목입니다.
            </p>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={assignmentSettings.maxMajorSubjectsPerTeacher === 1}
                onChange={e => setAssignmentSettings({
                  ...assignmentSettings,
                  maxMajorSubjectsPerTeacher: e.target.checked ? 1 : 99,
                })}
                className="w-4 h-4"
              />
              <span className="text-[13px] text-gray-700">교사 1명당 주요 과목 1개만 배정</span>
            </label>
            <span className="text-[11px] text-gray-400">
              {assignmentSettings.maxMajorSubjectsPerTeacher === 1
                ? '✓ 한 교사가 영어+과학처럼 주요 과목 2개를 동시에 맡지 않습니다.'
                : '제한 없음 — 주요 과목 여러 개를 한 교사가 맡을 수 있습니다.'}
            </span>
          </div>
        </div>

        {visiblePlans.length === 0 ? (
          <button
            onClick={addPlanSlot}
            className="max-w-[720px] h-11 px-5 border border-dashed border-gray-300 rounded-sm text-[13px] text-gray-400 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-600 transition-colors text-left"
          >
            + 과목 설정 추가
          </button>
        ) : (
          <div className="max-w-[720px] bg-white border border-gray-200 rounded-sm p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {visiblePlans.length > 1 && (
                  <div className="flex border border-gray-200 bg-white rounded-sm w-fit">
                    {visiblePlans.map(p => (
                      <div
                        key={p.id}
                        className={`flex items-center border-r border-gray-200 last:border-r-0 transition-colors ${
                          activeTabId === p.id ? 'bg-black text-white' : 'text-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        <button
                          onClick={() => setActivePlanTab(p.id)}
                          className={`pl-4 pr-2 h-9 text-[13px] ${activeTabId === p.id ? 'font-semibold' : ''}`}
                        >
                          {p.name}
                        </button>
                        <button
                          onClick={() => removePlanSlot(p.id)}
                          title={`${p.name} 삭제`}
                          className={`pr-2 h-9 text-[12px] leading-none transition-opacity ${
                            activeTabId === p.id ? 'opacity-50 hover:opacity-100' : 'opacity-30 hover:opacity-70'
                          }`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {visiblePlans.length < 3 && (
                  <button
                    onClick={addPlanSlot}
                    className="px-3 h-9 text-[12px] border border-dashed border-gray-300 rounded-sm text-gray-400 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-600 transition-colors"
                  >
                    + 과목 설정 추가
                  </button>
                )}
              </div>
              {visiblePlans.length > 1 && <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenCompare}
                  className="px-4 h-9 text-[13px] rounded-sm border border-gray-300 hover:bg-gray-50"
                >
                  📊 비교 보기
                </button>
                <button
                  onClick={handleApply}
                  disabled={isApplyDisabled}
                  title={disabledTitle}
                  className={`px-4 h-9 text-[13px] font-semibold rounded-sm border transition-colors ${
                    isApplyDisabled
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-black text-white border-black hover:bg-gray-800'
                  }`}
                >
                  ✓ {activePlan.name} 적용
                </button>
              </div>}
            </div>
            {visiblePlans.length > 1 && <p className="text-[11px] text-gray-500 px-1">{statusLine}</p>}
          </div>
        )}

        {visiblePlans.length > 0 && gradesToShow.map(grade => (
          <div key={grade} className="bg-white border border-gray-200 rounded-sm p-5 max-w-[720px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-[14px] font-semibold">{grade}학년</span>
                <button
                  onClick={() => addSubject(grade)}
                  className="text-[12px] px-3 h-7 border border-gray-300 rounded-sm hover:bg-gray-50"
                >
                  + 과목 추가
                </button>
              </div>
              {(() => {
                const dedicated = getDedicatedHoursForGrade(planSubjects, grade)
                const weeklyTotal = getWeeklyTotalForGrade(gradeConfigs, grade)
                if (weeklyTotal === 0) {
                  return <span className="text-[12px] text-gray-400">학교 설정 필요</span>
                }
                const homeroom = weeklyTotal - dedicated
                const isOver = dedicated > weeklyTotal
                return (
                  <div className="text-right">
                    <div className={`text-[15px] font-bold ${isOver ? 'text-red-600' : 'text-gray-900'}`}>
                      담임시수: {homeroom} / {weeklyTotal}
                    </div>
                    <div className={`text-[11px] ${isOver ? 'text-red-500' : 'text-gray-400'}`}>
                      {isOver ? `(초과 ${homeroom}시간)` : `(전담 ${dedicated}시간)`}
                    </div>
                  </div>
                )
              })()}
            </div>
            {planSubjects.filter(s => s.grade === grade).length === 0 ? (
              <p className="text-[12px] text-gray-300">과목을 추가하세요</p>
            ) : (
              <div className="flex flex-col gap-2">
                {planSubjects.filter(s => s.grade === grade).map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input
                      placeholder="과목명 (예: 영어)"
                      value={s.name}
                      onChange={e => updateSubject(s.id, 'name', e.target.value)}
                      className="w-[240px] h-9 px-3 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">주당</span>
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]*" value={s.weekly_hours}
                      onChange={e => {
                        const n = parseInt(e.target.value, 10)
                        if (!isNaN(n) && n >= 1 && n <= 10) updateSubject(s.id, 'weekly_hours', n)
                      }}
                      onFocus={e => e.target.select()}
                      className="w-14 h-9 text-center border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">시수</span>
                    <select
                      value={s.is_major ? '주요' : '일반'}
                      onChange={e => updateSubject(s.id, 'is_major', e.target.value === '주요')}
                      className="h-9 px-2 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black bg-white"
                    >
                      <option>일반</option>
                      <option>주요</option>
                    </select>
                    <button
                      onClick={() => removeSubject(s.id)}
                      className="text-[12px] text-red-400 hover:text-red-600 px-2 h-9"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {visiblePlans.length > 0 && totalDedicated > 0 && (
          <div className="max-w-[720px] bg-white border border-gray-200 rounded-sm p-5">
            <p className="text-[12px] font-semibold text-gray-600 mb-3">전담 시수 요약</p>
            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className="text-[11px] text-gray-500 mb-0.5">총 전담시수</div>
                <div className="text-[22px] font-bold text-gray-900">
                  {totalDedicated}<span className="text-[13px] font-normal text-gray-500 ml-1">시간</span>
                </div>
              </div>
              <div className="text-gray-300 text-[20px] font-light">÷</div>
              <div className="text-center">
                <div className="text-[11px] text-gray-500 mb-0.5">전담교사 인원</div>
                <div className="text-[22px] font-bold text-gray-900">
                  {teachers.length}<span className="text-[13px] font-normal text-gray-500 ml-1">명</span>
                </div>
              </div>
              <div className="text-gray-300 text-[20px] font-light">=</div>
              <div className="text-center">
                <div className="text-[11px] text-gray-500 mb-0.5">전담교사 평균 주당시수</div>
                <div className={`text-[22px] font-bold ${teachers.length > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                  {teachers.length > 0
                    ? <>{(totalDedicated / teachers.length).toFixed(1)}<span className="text-[13px] font-normal text-gray-500 ml-1">시간</span></>
                    : '—'}
                </div>
              </div>
              {teachers.length === 0 && (
                <span className="text-[11px] text-gray-400 self-end pb-1">← 학교 설정 &gt; 전담 교사에서 인원 입력</span>
              )}
            </div>
          </div>
        )}
      </div>

      {showComparison && (
        <SubjectPlanComparison
          plans={visiblePlans}
          gradeConfigs={gradeConfigs}
          gradesToShow={gradesToShow}
          appliedPlanId={appliedPlanId}
          liveSubjects={subjects}
          schoolName={state.schoolName}
          teacherCount={teachers.length}
          onClose={() => setShowComparison(false)}
          onApply={handleApplyFromComparison}
        />
      )}
    </div>
  )
}
