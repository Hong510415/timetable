import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function TeacherManagement() {
  const { state, setTeachers } = useApp()
  const { teachers, subjects } = state
  const [newCode, setNewCode] = useState('')

  function handleAdd() {
    const code = newCode.trim()
    if (!code) return alert('교사 명칭을 입력하세요')
    if (teachers.some(t => t.code === code)) return alert('이미 존재하는 명칭입니다')
    setTeachers([...teachers, { id: crypto.randomUUID(), code, teacher_assignments: [] }])
    setNewCode('')
  }

  function handleDelete(teacherId) {
    if (!confirm('이 교사를 삭제하시겠습니까?')) return
    setTeachers(teachers.filter(t => t.id !== teacherId))
  }

  function getSubjectName(subjectId) {
    return subjects.find(s => s.id === subjectId)?.name || ''
  }

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold">전담 교사 관리</h1>
        <p className="text-[13px] text-gray-400 mt-1">전담 교사를 추가하세요. 학급·과목 배정은 전담 배정 탭에서 자동으로 처리됩니다.</p>
      </div>

      <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-sm mb-5 text-[12px] text-gray-500">
        💡 권장 명칭 형식: [주담당학년][과목] &nbsp; 예) 34영어, 56체육, 전체음악
      </div>

      <div className="flex gap-2 mb-6">
        <input
          placeholder="교사 명칭 (예: 34영어)"
          value={newCode}
          onChange={e => setNewCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black w-64"
        />
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 h-10 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800"
        >
          <Plus size={14} />교사 추가
        </button>
      </div>

      {teachers.length === 0 ? (
        <div className="text-center py-20 text-gray-300 text-[14px]">
          교사를 추가하세요
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
          <div className="flex bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500">
            <div className="flex-1 px-5 py-2.5">교사 명칭</div>
            <div className="w-[200px] px-5 py-2.5">담당 과목 (배정 후)</div>
            <div className="w-[80px] px-3 py-2.5 text-center">주당시수</div>
            <div className="w-[60px]" />
          </div>
          {teachers.map(teacher => {
            const assignedSubjects = [...new Set(teacher.teacher_assignments.map(a => getSubjectName(a.subject_id)).filter(Boolean))]
            const totalHours = teacher.teacher_assignments.reduce((sum, a) => sum + (a.weekly_hours || 0), 0)
            return (
              <div key={teacher.id} className="flex items-center border-b border-gray-100 last:border-b-0 h-12">
                <div className="flex-1 px-5 text-[13px] font-semibold">{teacher.code}</div>
                <div className="w-[200px] px-5 text-[12px] text-gray-500">
                  {assignedSubjects.length > 0 ? assignedSubjects.join(' · ') : <span className="text-gray-300">미배정</span>}
                </div>
                <div className="w-[80px] px-3 text-center text-[13px] font-bold text-gray-700">
                  {totalHours > 0 ? `${totalHours}h` : <span className="text-gray-300">-</span>}
                </div>
                <div className="w-[60px] flex items-center justify-center">
                  <button
                    onClick={() => handleDelete(teacher.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
