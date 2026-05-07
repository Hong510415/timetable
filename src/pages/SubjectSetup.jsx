import { useApp } from '../context/AppContext'

const GRADES = [1, 2, 3, 4, 5, 6]

export default function SubjectSetup() {
  const { state, setSubjects, setAssignmentSettings } = useApp()
  const { subjects, gradeConfigs, assignmentSettings } = state

  const activeGrades = gradeConfigs.filter(g => g.num_classes > 0).map(g => g.grade)
  const gradesToShow = activeGrades.length > 0 ? activeGrades : GRADES

  function addSubject(grade) {
    setSubjects([...subjects, { id: crypto.randomUUID(), grade, name: '', weekly_hours: 2, is_major: false }])
  }

  function updateSubject(id, field, value) {
    setSubjects(subjects.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function removeSubject(id) {
    setSubjects(subjects.filter(s => s.id !== id))
  }

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold">전담 과목 설정</h1>
        <p className="text-[12px] text-gray-400 mt-1">변경 사항은 자동으로 저장됩니다.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-white border border-gray-200 rounded-sm p-5 flex flex-col gap-3">
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

        {gradesToShow.map(grade => (
          <div key={grade} className="bg-white border border-gray-200 rounded-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold">{grade}학년</span>
              <button
                onClick={() => addSubject(grade)}
                className="text-[12px] px-3 h-7 border border-gray-300 rounded-sm hover:bg-gray-50"
              >
                + 과목 추가
              </button>
            </div>
            {subjects.filter(s => s.grade === grade).length === 0 ? (
              <p className="text-[12px] text-gray-300">과목을 추가하세요</p>
            ) : (
              <div className="flex flex-col gap-2">
                {subjects.filter(s => s.grade === grade).map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input
                      placeholder="과목명 (예: 영어)"
                      value={s.name}
                      onChange={e => updateSubject(s.id, 'name', e.target.value)}
                      className="flex-1 h-9 px-3 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">주당</span>
                    <input
                      type="number" min={1} max={10} value={s.weekly_hours}
                      onChange={e => updateSubject(s.id, 'weekly_hours', Number(e.target.value))}
                      onClick={e => e.target.select()}
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
      </div>
    </div>
  )
}
