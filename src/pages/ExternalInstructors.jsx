import { Plus, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import ManualModal from '../components/ManualModal'

const DAY_LABELS = ['월', '화', '수', '목', '금']

const MANUAL = [
  {
    title: '외부강사란?',
    items: [
      '학년 단위로 들어오는 외부강사(예: 원어민 영어, 방과후 연계 수업 등)를 등록합니다. 작은 학교처럼 여러 학년(1~2학년 등)을 묶어 맡는 경우 담당 학년을 복수로 선택할 수 있습니다.',
      '등록한 외부강사 수업은 시간표 자동 생성 시 먼저 고정 배치되고, 전담 수업이 그 시간을 피해 배정됩니다.',
      '외부강사 수업은 전담교사 시수 균형 계산에 포함되지 않습니다.',
    ],
  },
  {
    title: '배치 규칙',
    items: [
      '선택한 학년(들)의 모든 학급을 같은 날에 몰아서(중간에 비는 시간 없이) 배치합니다.',
      '학급이 많아 하루에 다 못 들어가면 연속된 날(예: 월·화)에 균등하게 나눠 배치합니다.',
      '학급당 시수가 2시간 이상이면 "연속 수업" 여부를 선택할 수 있습니다.',
      '특별실을 쓰는 경우 "특별실 관리"에서 외부강사를 사용 교사로 지정하면 특별실 충돌도 피해 배치됩니다.',
    ],
  },
  {
    title: '입력 항목',
    items: [
      '강사명 · 담당 학년(복수) · 과목(표시)명 · 학급당 주 시수 · 요일(자동/지정)',
      '요일을 "자동"으로 두면 시스템이 비어 있는 적절한 요일을 선택합니다.',
    ],
  },
]

export default function ExternalInstructors() {
  const { state, setExternalInstructors } = useApp()
  const { externalInstructors, gradeConfigs } = state

  const grades = gradeConfigs.map(g => g.grade)

  function addInstructor() {
    setExternalInstructors([
      ...externalInstructors,
      {
        id: crypto.randomUUID(),
        name: '',
        grades: grades.length ? [grades[0]] : [1],
        subjectName: '',
        hoursPerClass: 1,
        consecutive: false,
        day: 'auto',
      },
    ])
  }

  function update(id, patch) {
    setExternalInstructors(externalInstructors.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  function remove(id) {
    if (!confirm('이 외부강사를 삭제하시겠습니까?')) return
    setExternalInstructors(externalInstructors.filter(e => e.id !== id))
  }

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-full">
      <div className="max-w-[900px] flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-[22px] font-bold">외부강사</h1>
        <div className="flex flex-wrap gap-2">
          <ManualModal title="외부강사" sections={MANUAL} />
          <button
            onClick={addInstructor}
            className="flex items-center gap-2 h-10 px-3 md:px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800 whitespace-nowrap"
          >
            <Plus size={14} />외부강사 추가
          </button>
        </div>
      </div>

      <p className="max-w-[900px] text-[12px] text-gray-400 -mt-3 mb-5 break-keep">④ (선택) 학년 단위로 들어오는 외부강사를 등록하세요. 여러 학년을 묶어 맡으면 담당 학년을 복수 선택하세요. 특별실을 쓰면 다음 "특별실 관리"에서 외부강사를 사용 교사로 지정하세요. 시간표 자동 생성 시 먼저 고정 배치되고 전담 수업이 그 시간을 피하며, 전담교사 시수 균형에는 포함되지 않습니다.</p>

      {externalInstructors.length === 0 ? (
        <div className="text-center py-20 text-gray-300 text-[14px]">
          외부강사가 없으면 비워 두세요. 필요하면 "외부강사 추가"를 누르세요.
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-[900px]">
          {externalInstructors.map(e => (
            <div key={e.id} className="bg-white border border-gray-200 rounded-sm p-4 flex flex-wrap items-end gap-3">
              <Field label="강사명">
                <input
                  value={e.name}
                  placeholder="예: 원어민영어"
                  onChange={ev => update(e.id, { name: ev.target.value })}
                  className="w-32 h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black"
                />
              </Field>

              <Field label="담당 학년 (복수 선택)">
                <div className="h-9 flex items-center gap-1.5 flex-wrap">
                  {grades.map(g => {
                    const on = (e.grades || []).includes(g)
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          const cur = e.grades || []
                          const next = on ? cur.filter(x => x !== g) : [...cur, g].sort((a, b) => a - b)
                          update(e.id, { grades: next })
                        }}
                        className={`px-2 h-7 rounded-sm text-[12px] border transition-colors ${on ? 'bg-black text-white border-black font-semibold' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                      >
                        {g}
                      </button>
                    )
                  })}
                </div>
              </Field>

              <Field label="과목(표시)명">
                <input
                  value={e.subjectName}
                  placeholder="예: 영어회화"
                  onChange={ev => update(e.id, { subjectName: ev.target.value })}
                  className="w-28 h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black"
                />
              </Field>

              <Field label="학급당 시수">
                <input
                  type="number" min={1} max={10}
                  value={e.hoursPerClass}
                  onClick={ev => ev.target.select()}
                  onChange={ev => update(e.id, { hoursPerClass: Math.max(1, Math.floor(Number(ev.target.value)) || 1) })}
                  className="w-16 h-9 text-center border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black"
                />
              </Field>

              {e.hoursPerClass >= 2 && (
                <Field label="연속 수업">
                  <label className="h-9 flex items-center gap-1.5 text-[12px] text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!e.consecutive}
                      onChange={ev => update(e.id, { consecutive: ev.target.checked })}
                    />
                    같은 날 연속
                  </label>
                </Field>
              )}

              <Field label="요일">
                <select
                  value={e.day}
                  onChange={ev => update(e.id, { day: ev.target.value === 'auto' ? 'auto' : Number(ev.target.value) })}
                  className="w-24 h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black bg-white"
                >
                  <option value="auto">자동</option>
                  {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}요일</option>)}
                </select>
              </Field>

              <button
                onClick={() => remove(e.id)}
                className="h-9 flex items-center text-gray-300 hover:text-red-500 transition-colors ml-auto"
                title="삭제"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-gray-500">{label}</span>
      {children}
    </div>
  )
}
