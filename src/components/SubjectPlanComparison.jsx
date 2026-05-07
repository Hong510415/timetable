import {
  getDedicatedHoursForGrade,
  getWeeklyTotalForGrade,
  getOverflowGrades,
  classifySubjectsAcrossPlans,
  subjectsEqualByContent,
} from '../lib/planHelpers'

export default function SubjectPlanComparison({
  plans,
  gradeConfigs,
  gradesToShow,
  appliedPlanId,
  liveSubjects,
  onClose,
  onApply,
  schoolName,
  teacherCount = 0,
}) {
  const printDate = new Date().toLocaleDateString('ko-KR')

  function totalDedicated(planSubjects) {
    return planSubjects.reduce((sum, s) => sum + (Number(s.weekly_hours) || 0), 0)
  }

  function isApplyDisabledForPlan(plan) {
    if (plan.subjects.length === 0) return { disabled: true, reason: 'empty' }
    const overflows = getOverflowGrades(plan.subjects, gradeConfigs, gradesToShow)
    if (overflows.length > 0) return { disabled: true, reason: 'overflow', overflows }
    const isLive = appliedPlanId === plan.id && subjectsEqualByContent(plan.subjects, liveSubjects)
    if (isLive) return { disabled: true, reason: 'live' }
    return { disabled: false }
  }

  return (
    <div className="print-modal-root fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:bg-transparent print:relative print:inset-auto print:block">
      <div className="bg-white rounded-sm shadow-2xl w-[90vw] h-[90vh] max-w-[1400px] flex flex-col print:w-auto print:h-auto print:max-w-full print:shadow-none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 print:hidden">
          <h2 className="text-[18px] font-bold">전담 배정안 비교</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-[12px] px-3 h-8 border border-gray-300 rounded-sm hover:bg-gray-50"
          >
            닫기
          </button>
        </div>

        <div className="hidden print:block px-6 pt-4 text-right text-[11px] text-gray-600">
          {schoolName || '학교'} · {printDate} 출력
        </div>

        <div className="flex-1 overflow-auto p-6 flex flex-col gap-8 print:overflow-visible">
          <section>
            <h3 className="text-[14px] font-semibold mb-3">학년별 담임시수 비교</h3>
            <div className="border border-gray-200 rounded-sm overflow-hidden">
              <div className="grid grid-cols-[80px_100px_repeat(3,1fr)] bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500">
                <div className="px-3 py-2 border-r border-gray-200">학년</div>
                <div className="px-3 py-2 text-center border-r border-gray-200">주당총합</div>
                {plans.map(p => (
                  <div key={p.id} className="px-3 py-2 text-center border-r border-gray-200 last:border-r-0">{p.name}</div>
                ))}
              </div>
              {gradesToShow.map(grade => {
                const weeklyTotal = getWeeklyTotalForGrade(gradeConfigs, grade)
                return (
                  <div key={grade} className="grid grid-cols-[80px_100px_repeat(3,1fr)] border-b border-gray-100 text-[12px]">
                    <div className="px-3 py-2 border-r border-gray-200">{grade}학년</div>
                    <div className="px-3 py-2 text-center border-r border-gray-200">{weeklyTotal}</div>
                    {plans.map(p => {
                      const dedicated = getDedicatedHoursForGrade(p.subjects, grade)
                      const homeroom = weeklyTotal - dedicated
                      const isOver = dedicated > weeklyTotal
                      const cellText = p.subjects.length === 0
                        ? '—'
                        : `${homeroom} (${-dedicated})`
                      return (
                        <div
                          key={p.id}
                          className={`px-3 py-2 text-center border-r border-gray-100 last:border-r-0 ${isOver ? 'text-red-600 font-semibold' : ''}`}
                        >
                          {cellText}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              <div className="grid grid-cols-[80px_100px_repeat(3,1fr)] bg-gray-50 text-[12px] font-semibold border-t border-gray-200">
                <div className="px-3 py-2 border-r border-gray-200 col-span-2 text-gray-600">1인당 평균 주당시수</div>
                {plans.map(p => {
                  const total = totalDedicated(p.subjects)
                  const avg = p.subjects.length > 0 && teacherCount > 0
                    ? (total / teacherCount).toFixed(1)
                    : null
                  return (
                    <div key={p.id} className="px-3 py-2 text-center border-r border-gray-100 last:border-r-0">
                      {avg !== null ? `${avg}시간` : '—'}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[14px] font-semibold mb-3">학년별 과목 구성</h3>
            <div className="border border-gray-200 rounded-sm overflow-hidden">
              <div className="grid grid-cols-[80px_repeat(3,1fr)] bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500">
                <div className="px-3 py-2 border-r border-gray-200">학년</div>
                {plans.map(p => (
                  <div key={p.id} className="px-3 py-2 text-center border-r border-gray-200 last:border-r-0">{p.name}</div>
                ))}
              </div>
              {gradesToShow.map(grade => {
                const classified = classifySubjectsAcrossPlans(plans, grade)
                return (
                  <div key={grade} className="grid grid-cols-[80px_repeat(3,1fr)] border-b border-gray-100 text-[12px]">
                    <div className="px-3 py-2 border-r border-gray-200">{grade}학년</div>
                    {classified.map((arr, idx) => (
                      <div key={plans[idx].id} className="px-3 py-2 border-r border-gray-100 last:border-r-0">
                        {arr.length === 0 ? (
                          <span className="text-gray-300">(과목 없음)</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {arr.map(({ subject, differs }) => (
                              <span key={subject.id} className={differs ? 'font-bold text-gray-900' : 'text-gray-600'}>
                                {subject.name || '(이름 없음)'} {subject.weekly_hours}시간 ({subject.is_major ? '주요' : '일반'})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between print:hidden">
          <div className="text-[12px] text-gray-500">
            현재 확정: {plans.find(p => p.id === appliedPlanId)?.name || '없음'}
          </div>
          <div className="flex items-center gap-2">
            {plans.map(p => {
              const { disabled, reason, overflows } = isApplyDisabledForPlan(p)
              const title = reason === 'overflow'
                ? `초과 학년이 있어 확정할 수 없습니다 (${overflows.map(o => `${o.grade}학년 초과 -${o.overBy}시간`).join(', ')})`
                : reason === 'empty'
                ? '과목을 먼저 입력해 주세요.'
                : ''
              return (
                <button
                  key={p.id}
                  onClick={() => onApply(p.id)}
                  disabled={disabled}
                  title={title}
                  className={`px-3 h-9 text-[12px] font-semibold rounded-sm border transition-colors ${
                    disabled
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-black text-white border-black hover:bg-gray-800'
                  }`}
                >
                  {p.name} 확정
                </button>
              )
            })}
            <button
              onClick={() => window.print()}
              className="px-3 h-9 text-[12px] border border-gray-300 rounded-sm hover:bg-gray-50"
            >
              🖨 인쇄 / PDF 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
