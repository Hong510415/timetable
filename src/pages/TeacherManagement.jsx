import { useEffect, useState } from 'react'
import { Plus, X, Trash2, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function TeacherManagement() {
  const [schoolId, setSchoolId] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [gradeConfigs, setGradeConfigs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState(null)
  const [form, setForm] = useState({ code: '', assignments: [] })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: school } = await supabase.from('schools').select('id').eq('user_id', user.id).single()
    if (!school) return
    setSchoolId(school.id)

    const [{ data: t }, { data: s }, { data: g }] = await Promise.all([
      supabase.from('teachers').select('*, teacher_assignments(*, subjects(name, grade))').eq('school_id', school.id),
      supabase.from('subjects').select('*').eq('school_id', school.id).order('grade'),
      supabase.from('grade_configs').select('*').eq('school_id', school.id).order('grade'),
    ])
    setTeachers(t || [])
    setSubjects(s || [])
    setGradeConfigs(g || [])
  }

  function openAdd() {
    setEditingTeacher(null)
    setForm({ code: '', assignments: [] })
    setShowModal(true)
  }

  function openEdit(teacher) {
    setEditingTeacher(teacher)
    setForm({
      code: teacher.code,
      assignments: teacher.teacher_assignments.map(a => ({
        subject_id: a.subject_id,
        grade: a.grade,
        class_num: a.class_num,
        weekly_hours: a.weekly_hours,
      })),
    })
    setShowModal(true)
  }

  async function handleDelete(teacherId) {
    if (!confirm('이 교사를 삭제하시겠습니까?')) return
    await supabase.from('teachers').delete().eq('id', teacherId)
    load()
  }

  async function handleSave() {
    if (!form.code.trim()) return alert('교사 명칭을 입력하세요')

    if (editingTeacher) {
      await supabase.from('teachers').update({ code: form.code }).eq('id', editingTeacher.id)
      await supabase.from('teacher_assignments').delete().eq('teacher_id', editingTeacher.id)
      if (form.assignments.length > 0) {
        await supabase.from('teacher_assignments').insert(
          form.assignments.map(a => ({ ...a, teacher_id: editingTeacher.id }))
        )
      }
    } else {
      const { data: newTeacher } = await supabase
        .from('teachers')
        .insert({ code: form.code, school_id: schoolId })
        .select().single()
      if (newTeacher && form.assignments.length > 0) {
        await supabase.from('teacher_assignments').insert(
          form.assignments.map(a => ({ ...a, teacher_id: newTeacher.id }))
        )
      }
    }
    setShowModal(false)
    load()
  }

  function addAssignment() {
    setForm(prev => ({
      ...prev,
      assignments: [...prev.assignments, { subject_id: '', grade: 1, class_num: 1, weekly_hours: 2 }],
    }))
  }

  function updateAssignment(i, field, value) {
    setForm(prev => ({
      ...prev,
      assignments: prev.assignments.map((a, j) => j === i ? { ...a, [field]: value } : a),
    }))
  }

  function removeAssignment(i) {
    setForm(prev => ({ ...prev, assignments: prev.assignments.filter((_, j) => j !== i) }))
  }

  const maxClasses = (grade) => gradeConfigs.find(g => g.grade === grade)?.num_classes || 6

  // 중복 없는 과목명 목록
  const uniqueSubjectNames = [...new Set(subjects.map(s => s.name))]

  // 과목명 + 학년으로 subject_id 찾기
  function findSubjectId(name, grade) {
    return subjects.find(s => s.name === name && s.grade === grade)?.id || ''
  }

  // assignment에서 과목명 역추적
  function getSubjectName(subjectId) {
    return subjects.find(s => s.id === subjectId)?.name || ''
  }

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">전담 교사 관리</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 h-10 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800 transition-colors"
        >
          <Plus size={14} />교사 추가
        </button>
      </div>

      <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-sm mb-5 text-[12px] text-gray-500">
        💡 권장 명칭 형식: [주담당학년][과목] &nbsp; 예) 34영어, 56체육, 전체음악
      </div>

      {teachers.length === 0 ? (
        <div className="text-center py-20 text-gray-300 text-[14px]">
          교사를 추가하세요
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {teachers.map(teacher => (
            <div key={teacher.id} className="bg-white border border-gray-200 rounded-sm p-5 flex items-center gap-4">
              <div className="h-9 px-3 bg-black text-white text-[13px] font-bold flex items-center rounded-sm flex-shrink-0">
                {teacher.code}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-gray-900 mb-1.5">
                  {[...new Set(teacher.teacher_assignments.map(a => a.subjects?.name).filter(Boolean))].join(' · ') || '담당 과목 없음'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {teacher.teacher_assignments.map((a, i) => (
                    <span key={i} className="text-[11px] text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">
                      {a.grade}학년 {a.class_num}반 · 주 {a.weekly_hours}시수
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(teacher)}
                  className="h-8 px-3 border border-gray-300 rounded-sm text-[12px] hover:bg-gray-50 flex items-center gap-1"
                >
                  <Edit2 size={12} />편집
                </button>
                <button
                  onClick={() => handleDelete(teacher.id)}
                  className="h-8 px-3 border border-red-200 rounded-sm text-[12px] text-red-500 hover:bg-red-50 flex items-center gap-1"
                >
                  <Trash2 size={12} />삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가/편집 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[620px] max-h-[85vh] overflow-y-auto rounded-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[18px] font-bold">{editingTeacher ? '교사 편집' : '교사 추가'}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="mb-5">
              <label className="text-[12px] font-semibold text-gray-600 block mb-1.5">교사 명칭</label>
              <input
                placeholder="예: 34영어"
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                className="w-full h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black"
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-semibold text-gray-600">담당 학급 배정</label>
                <button onClick={addAssignment} className="text-[12px] px-3 h-7 border border-gray-300 rounded-sm hover:bg-gray-50">
                  + 학급 추가
                </button>
              </div>
              {form.assignments.length === 0 && (
                <p className="text-[12px] text-gray-300 py-3">담당 학급을 추가하세요</p>
              )}
              <div className="flex flex-col gap-2">
                {form.assignments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-sm flex-wrap">
                    <select
                      value={getSubjectName(a.subject_id)}
                      onChange={e => {
                        const name = e.target.value
                        const sid = findSubjectId(name, a.grade)
                        setForm(prev => ({
                          ...prev,
                          assignments: prev.assignments.map((x, j) => j === i ? { ...x, subject_id: sid, _subjectName: name } : x)
                        }))
                      }}
                      className="flex-1 min-w-[120px] h-9 px-2 border border-gray-200 rounded-sm text-[12px] outline-none bg-white"
                    >
                      <option value="">과목 선택</option>
                      {uniqueSubjectNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <select
                      value={a.grade}
                      onChange={e => {
                        const grade = Number(e.target.value)
                        const name = getSubjectName(a.subject_id) || a._subjectName || ''
                        const sid = findSubjectId(name, grade)
                        setForm(prev => ({
                          ...prev,
                          assignments: prev.assignments.map((x, j) => j === i ? { ...x, grade, class_num: 1, subject_id: sid } : x)
                        }))
                      }}
                      className="w-20 h-9 px-2 border border-gray-200 rounded-sm text-[12px] outline-none bg-white"
                    >
                      {[1,2,3,4,5,6].map(g => <option key={g} value={g}>{g}학년</option>)}
                    </select>
                    <select
                      value={a.class_num}
                      onChange={e => updateAssignment(i, 'class_num', Number(e.target.value))}
                      className="w-20 h-9 px-2 border border-gray-200 rounded-sm text-[12px] outline-none bg-white"
                    >
                      {Array.from({ length: maxClasses(a.grade) }, (_, k) => k + 1).map(c => (
                        <option key={c} value={c}>{c}반</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] text-gray-400">주</span>
                      <input
                        type="number" min={1} max={10} value={a.weekly_hours}
                        onChange={e => updateAssignment(i, 'weekly_hours', Number(e.target.value))}
                        className="w-14 h-9 text-center border border-gray-200 rounded-sm text-[12px] outline-none bg-white"
                      />
                      <span className="text-[12px] text-gray-400">시수</span>
                    </div>
                    <button onClick={() => removeAssignment(i)} className="text-red-400 hover:text-red-600 ml-1">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="h-10 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
              <button onClick={handleSave} className="h-10 px-5 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
