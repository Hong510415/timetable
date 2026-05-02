import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'

const GRADES = [1, 2, 3, 4, 5, 6]

export default function SubjectSetup() {
  const { state, setSubjects, setTeachers } = useApp()
  const { subjects, gradeConfigs, teachers } = state
  const [tab, setTab] = useState('subjects')
  const [newCode, setNewCode] = useState('')

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

  function handleAddTeacher() {
    const code = newCode.trim()
    if (!code) return alert('교사 명칭을 입력하세요')
    if (teachers.some(t => t.code === code)) return alert('이미 존재하는 명칭입니다')
    setTeachers([...teachers, { id: crypto.randomUUID(), code, teacher_assignments: [] }])
    setNewCode('')
  }

  function handleDeleteTeacher(id) {
    if (!confirm('이 교사를 삭제하시겠습니까?')) return
    setTeachers(teachers.filter(t => t.id !== id))
  }

  const tabs = [
    { key: 'subjects', label: '전담 과목' },
    { key: 'teachers', label: '전담 교사' },
  ]

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold">전담 설정</h1>
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
          <p className="text-[12px] text-gray-400 -mt-2">학년별 전담 과목과 주당 시수를 입력하세요.</p>
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
        <div>
          <p className="text-[12px] text-gray-400 -mt-2 mb-5">전담 교사 명칭을 입력하세요. 학급·과목 배정은 전담 배정 탭에서 자동으로 처리됩니다.</p>
          <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-sm mb-5 text-[12px] text-gray-500">
            💡 권장 명칭 형식: [주담당학년][과목] &nbsp; 예) 34영어, 56체육, 전체음악
          </div>
          <div className="flex gap-2 mb-5">
            <input
              placeholder="교사 명칭 (예: 34영어)"
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTeacher()}
              className="h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black w-64"
            />
            <button
              onClick={handleAddTeacher}
              className="flex items-center gap-2 h-10 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800"
            >
              <Plus size={14} />추가
            </button>
          </div>

          {teachers.length === 0 ? (
            <div className="text-center py-16 text-gray-300 text-[14px]">교사를 추가하세요</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
              {teachers.map((teacher, i) => (
                <div key={teacher.id} className="flex items-center h-12 border-b border-gray-100 last:border-b-0 px-5">
                  <span className="text-[12px] text-gray-400 w-8">{i + 1}</span>
                  <span className="flex-1 text-[13px] font-semibold">{teacher.code}</span>
                  <button
                    onClick={() => handleDeleteTeacher(teacher.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
