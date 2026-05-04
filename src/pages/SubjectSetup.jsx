import { useState } from 'react'
import { useApp } from '../context/AppContext'
import ManualModal from '../components/ManualModal'

const MANUAL = [
  {
    title: '전담 과목',
    items: [
      '전담 수업에 사용할 과목을 추가합니다.',
      '주당 시수: 해당 과목을 일주일에 몇 시간 가르치는지 설정합니다.',
      '담당 학년을 선택해 해당 학년에만 과목이 배정되도록 합니다.',
      '⚠ 과목 삭제 시 해당 과목으로 배정된 교사 정보에도 영향을 줍니다.',
    ],
  },
  {
    title: '전담 교사',
    items: [
      '전담을 담당할 교사 총 인원을 입력합니다.',
      '교사 명칭은 전담 배정 후 지정할 수 있습니다.',
    ],
  },
]

const GRADES = [1, 2, 3, 4, 5, 6]

export default function SubjectSetup() {
  const { state, setSubjects, setTeachers, setAssignmentSettings } = useApp()
  const { subjects, gradeConfigs, teachers, assignmentSettings } = state
  const [tab, setTab] = useState('subjects')

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

  function handleTeacherCountChange(count) {
    const n = Math.max(0, Number(count))
    if (n > teachers.length) {
      const added = Array.from({ length: n - teachers.length }, (_, i) => ({
        id: crypto.randomUUID(),
        code: `교사${teachers.length + i + 1}`,
        teacher_assignments: [],
      }))
      setTeachers([...teachers, ...added])
    } else {
      setTeachers(teachers.slice(0, n))
    }
  }

  const tabs = [
    { key: 'subjects', label: '전담 과목' },
    { key: 'teachers', label: '전담 교사' },
  ]

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold">전담 설정</h1>
          <p className="text-[12px] text-gray-400 mt-1">변경 사항은 자동으로 저장됩니다.</p>
        </div>
        <ManualModal title="전담 설정" sections={MANUAL} />
      </div>

      <div className="flex border border-gray-200 bg-white rounded-sm w-fit mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 h-[42px] text-[13px] transition-colors ${
              tab === t.key ? 'bg-black text-white font-semibold' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'subjects' && (
        <div className="flex flex-col gap-4">
          {/* 주요/일반 안내 + 배정 설정 */}
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
      )}

      {tab === 'teachers' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7">
          <h2 className="text-[14px] font-semibold mb-1">전담 교사 인원</h2>
          <p className="text-[12px] text-gray-400 mb-5">전담 교사 총 인원을 입력하세요. 명칭은 전담 배정 후 지정할 수 있습니다.</p>
          <div className="flex items-center gap-3">
            <input
              type="number" min={0} max={50}
              value={teachers.length}
              onChange={e => handleTeacherCountChange(e.target.value)}
              onClick={e => e.target.select()}
              className="w-24 h-10 text-center border border-gray-300 rounded-sm text-[18px] font-bold outline-none focus:border-black"
            />
            <span className="text-[14px] text-gray-500">명</span>
          </div>
        </div>
      )}
    </div>
  )
}
