import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const DAYS = ['월', '화', '수', '목', '금']
const GRADES = [1, 2, 3, 4, 5, 6]
const DAY_KEYS = ['periods_mon', 'periods_tue', 'periods_wed', 'periods_thu', 'periods_fri']

const defaultGrade = (grade) => ({
  grade, num_classes: 4,
  periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 4,
})

export default function SchoolSetup() {
  const [tab, setTab] = useState('grade')
  const [gradeConfigs, setGradeConfigs] = useState(GRADES.map(defaultGrade))
  const [lunchConfig, setLunchConfig] = useState({ split_lunch: false, lunch_groups: [] })
  const [subjects, setSubjects] = useState([])
  const [schoolId, setSchoolId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: school } = await supabase.from('schools').select('id').eq('user_id', user.id).single()
    if (!school) return
    setSchoolId(school.id)

    const [{ data: configs }, { data: lunch }, { data: subs }] = await Promise.all([
      supabase.from('grade_configs').select('*').eq('school_id', school.id).order('grade'),
      supabase.from('lunch_config').select('*').eq('school_id', school.id).single(),
      supabase.from('subjects').select('*').eq('school_id', school.id).order('grade'),
    ])

    if (configs?.length) setGradeConfigs(GRADES.map(g => configs.find(c => c.grade === g) || defaultGrade(g)))
    if (lunch) setLunchConfig({ split_lunch: lunch.split_lunch, lunch_groups: lunch.lunch_groups || [] })
    if (subs) setSubjects(subs)
  }

  async function handleSave() {
    if (!schoolId) return
    setSaving(true)

    await Promise.all(gradeConfigs.map(config =>
      supabase.from('grade_configs').upsert({ ...config, school_id: schoolId }, { onConflict: 'school_id,grade' })
    ))

    await supabase.from('lunch_config').upsert(
      { split_lunch: lunchConfig.split_lunch, lunch_groups: lunchConfig.lunch_groups, school_id: schoolId },
      { onConflict: 'school_id' }
    )

    await supabase.from('subjects').delete().eq('school_id', schoolId)
    if (subjects.length > 0) {
      await supabase.from('subjects').insert(subjects.map(s => {
        const { id, ...rest } = s
        return { ...rest, school_id: schoolId }
      }))
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function updateGrade(grade, field, value) {
    const num = value === '' ? '' : Number(value)
    setGradeConfigs(prev => prev.map(c => c.grade === grade ? { ...c, [field]: num } : c))
  }

  function toggleLunchGrade(gradeNum, slotIdx) {
    setLunchConfig(prev => {
      const groups = JSON.parse(JSON.stringify(prev.lunch_groups))
      const existing = groups.find(g => g.slot === slotIdx)
      if (existing) {
        existing.grades = existing.grades.includes(gradeNum)
          ? existing.grades.filter(g => g !== gradeNum)
          : [...existing.grades, gradeNum]
        return { ...prev, lunch_groups: groups }
      }
      return { ...prev, lunch_groups: [...groups, { slot: slotIdx, grades: [gradeNum] }] }
    })
  }

  function isGradeInSlot(grade, slot) {
    return lunchConfig.lunch_groups.some(g => g.slot === slot && g.grades.includes(grade))
  }

  const tabs = [
    { key: 'grade', label: '학급 정보' },
    { key: 'lunch', label: '점심시간 설정' },
    { key: 'subjects', label: '전담 과목 설정' },
  ]

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">학교 설정</h1>
      </div>

      {/* 탭 */}
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

      {/* 탭 1: 학급 정보 */}
      {tab === 'grade' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7 flex flex-col gap-6">
          <div>
            <h2 className="text-[14px] font-semibold mb-1">학년별 학급 수</h2>
            <p className="text-[12px] text-gray-400 mb-4">각 학년의 학급 수를 입력하세요. 시간표 작성의 기준이 됩니다.</p>
            <div className="flex gap-3 flex-wrap">
              {gradeConfigs.map(({ grade, num_classes }) => (
                <div key={grade} className="flex flex-col items-center gap-2">
                  <label className="text-[12px] font-semibold text-gray-500">{grade}학년</label>
                  <input
                    type="number" min={1} max={20} value={num_classes}
                    onChange={e => updateGrade(grade, 'num_classes', e.target.value)}
                    onClick={e => e.target.select()}
                    onFocus={e => e.target.select()}
                    className="w-[72px] h-10 text-center border border-gray-300 rounded-sm text-[14px] font-semibold outline-none focus:border-black"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          <div>
            <h2 className="text-[14px] font-semibold mb-1">학년별 요일별 수업 시수</h2>
            <p className="text-[12px] text-gray-400 mb-4">하루 최대 수업 시수를 입력하세요.</p>
            <div className="border border-gray-200 rounded-sm overflow-hidden">
              <div className="flex bg-gray-50 border-b border-gray-200">
                <div className="w-[80px] flex-shrink-0 px-3 py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200">학년</div>
                {DAYS.map(d => (
                  <div key={d} className="flex-1 text-center py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">{d}</div>
                ))}
              </div>
              {gradeConfigs.map(config => (
                <div key={config.grade} className="flex border-b border-gray-100 last:border-b-0">
                  <div className="w-[80px] flex-shrink-0 px-3 flex items-center text-[12px] text-gray-600 border-r border-gray-200">{config.grade}학년</div>
                  {DAY_KEYS.map(key => (
                    <div key={key} className="flex-1 border-r border-gray-100 last:border-r-0 flex items-center justify-center py-1.5">
                      <input
                        type="number" min={1} max={7} value={config[key]}
                        onChange={e => updateGrade(config.grade, key, e.target.value)}
                        onClick={e => e.target.select()}
                        onFocus={e => e.target.select()}
                        className="w-12 h-8 text-center text-[12px] border border-gray-200 rounded-sm outline-none focus:border-black"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 탭 2: 점심시간 설정 */}
      {tab === 'lunch' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7 flex flex-col gap-6">
          <div>
            <h2 className="text-[14px] font-semibold mb-4">점심시간 분리 배정</h2>
            <div className="flex gap-6 mb-6">
              {[
                { value: false, label: '일반 (전 학년 동시 점심)' },
                { value: true, label: '분리 배정 (학년별 점심 시간 다름)' },
              ].map(opt => (
                <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer text-[13px]">
                  <input
                    type="radio"
                    checked={lunchConfig.split_lunch === opt.value}
                    onChange={() => setLunchConfig(prev => ({ ...prev, split_lunch: opt.value }))}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {lunchConfig.split_lunch && (
              <div>
                <p className="text-[12px] text-gray-500 mb-4">
                  각 학년의 점심 위치를 체크하세요.<br />
                  슬롯 3 = 3교시 후 점심 &nbsp;|&nbsp; 슬롯 4 = 4교시 후 점심 &nbsp;|&nbsp; 슬롯 5 = 5교시 후 점심
                </p>
                <div className="border border-gray-200 rounded-sm overflow-hidden w-fit">
                  <div className="flex bg-gray-50 border-b border-gray-200">
                    <div className="w-[80px] px-3 py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200">학년</div>
                    {[3, 4, 5].map(slot => (
                      <div key={slot} className="w-[120px] text-center py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">
                        슬롯 {slot} 후 점심
                      </div>
                    ))}
                  </div>
                  {GRADES.map(grade => (
                    <div key={grade} className="flex border-b border-gray-100 last:border-b-0">
                      <div className="w-[80px] px-3 py-2.5 text-[12px] border-r border-gray-200">{grade}학년</div>
                      {[3, 4, 5].map(slot => (
                        <div key={slot} className="w-[120px] flex items-center justify-center border-r border-gray-100 last:border-r-0 py-2">
                          <input
                            type="checkbox"
                            checked={isGradeInSlot(grade, slot)}
                            onChange={() => toggleLunchGrade(grade, slot)}
                            className="w-4 h-4"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 탭 3: 전담 과목 설정 */}
      {tab === 'subjects' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7 flex flex-col gap-4">
          <div>
            <h2 className="text-[14px] font-semibold mb-1">학년별 전담 과목 및 주당 시수</h2>
            <p className="text-[12px] text-gray-400 mb-4">전담 교사가 가르치는 과목과 주당 시수를 입력하세요.</p>
          </div>
          {GRADES.map(grade => (
            <div key={grade} className="border border-gray-200 rounded-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-semibold">{grade}학년</span>
                <button
                  onClick={() => setSubjects(prev => [...prev, { grade, name: '', weekly_hours: 2 }])}
                  className="text-[12px] px-3 h-7 border border-gray-300 rounded-sm hover:bg-gray-50"
                >
                  + 과목 추가
                </button>
              </div>
              {subjects.filter(s => s.grade === grade).length === 0 && (
                <p className="text-[12px] text-gray-300">과목을 추가하세요</p>
              )}
              <div className="flex flex-col gap-2">
                {subjects.map((s, i) => s.grade !== grade ? null : (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      placeholder="과목명 (예: 영어)"
                      value={s.name}
                      onChange={e => setSubjects(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      className="flex-1 h-9 px-3 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">주당</span>
                    <input
                      type="number" min={1} max={10} value={s.weekly_hours}
                      onChange={e => setSubjects(prev => prev.map((x, j) => j === i ? { ...x, weekly_hours: Number(e.target.value) } : x))}
                      className="w-14 h-9 text-center border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">시수</span>
                    <button
                      onClick={() => setSubjects(prev => prev.filter((_, j) => j !== i))}
                      className="text-[12px] text-red-400 hover:text-red-600 px-2"
                    >삭제</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 저장 버튼 */}
      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-5 bg-black text-white text-[13px] font-semibold rounded-sm disabled:opacity-50 hover:bg-gray-800 transition-colors"
        >
          {saved ? '저장됨 ✓' : saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
