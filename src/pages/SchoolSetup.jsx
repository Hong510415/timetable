import { useState } from 'react'
import { useApp } from '../context/AppContext'
import ManualModal from '../components/ManualModal'

const MANUAL = [
  {
    title: '학교 이름',
    items: ['학교명을 입력합니다. 엑셀 내보내기 파일명에 사용됩니다.'],
  },
  {
    title: '학년별 학급 수',
    items: ['각 학년의 반 수를 설정합니다.'],
  },
  {
    title: '학년별 요일별 수업 시수',
    items: [
      '요일마다 수업 교시 수를 다르게 설정할 수 있습니다.',
      '설정한 교시 수 안에서 전담 수업이 배정됩니다.',
    ],
  },
  {
    title: '점심시간 분리 배정',
    items: [
      '학년마다 점심 시간이 다른 경우 활성화합니다.',
      '점심시간 분리 배정 시 특별실 시간표, 전담교사 시간표는 7교시 형식으로 제시됩니다.',
    ],
  },
]

const DAYS = ['월', '화', '수', '목', '금']
const GRADES = [1, 2, 3, 4, 5, 6]
const DAY_KEYS = ['periods_mon', 'periods_tue', 'periods_wed', 'periods_thu', 'periods_fri']

export default function SchoolSetup() {
  const { state, setSchoolName, setGradeConfigs, setLunchConfig } = useApp()
  const { schoolName, gradeConfigs, lunchConfig } = state
  const [tab, setTab] = useState('grade')

  function updateGrade(grade, field, value) {
    const num = value === '' ? '' : Number(value)
    setGradeConfigs(gradeConfigs.map(c => c.grade === grade ? { ...c, [field]: num } : c))
  }

  function toggleLunchGrade(gradeNum, slotIdx) {
    const groups = JSON.parse(JSON.stringify(lunchConfig.lunch_groups))
    const existing = groups.find(g => g.slot === slotIdx)
    if (existing) {
      existing.grades = existing.grades.includes(gradeNum)
        ? existing.grades.filter(g => g !== gradeNum)
        : [...existing.grades, gradeNum]
      setLunchConfig({ ...lunchConfig, lunch_groups: groups })
    } else {
      setLunchConfig({ ...lunchConfig, lunch_groups: [...groups, { slot: slotIdx, grades: [gradeNum] }] })
    }
  }

  function isGradeInSlot(grade, slot) {
    return lunchConfig.lunch_groups.some(g => g.slot === slot && g.grades.includes(grade))
  }

  const tabs = [
    { key: 'grade', label: '학급 정보' },
    { key: 'lunch', label: '점심시간 설정' },
  ]

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">학교 설정</h1>
        <ManualModal title="학교 설정" sections={MANUAL} />
      </div>

      <div className="mb-5">
        <label className="text-[12px] font-semibold text-gray-600 block mb-1">학교명</label>
        <input
          value={schoolName}
          onChange={e => setSchoolName(e.target.value)}
          placeholder="예: OO초등학교"
          className="h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black w-64"
        />
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

      {tab === 'grade' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7 flex flex-col gap-6">
          <div>
            <h2 className="text-[14px] font-semibold mb-1">학년별 학급 수</h2>
            <p className="text-[12px] text-gray-400 mb-4">각 학년의 학급 수를 입력하세요.</p>
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
                    onChange={() => setLunchConfig({ ...lunchConfig, split_lunch: opt.value })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {lunchConfig.split_lunch && (
              <div>
                <p className="text-[12px] text-gray-500 mb-4">
                  각 학년의 점심 위치를 체크하세요.<br />
                  3교시 후 점심 = 4교시부터 수업 &nbsp;|&nbsp; 4교시 후 점심 = 5교시부터 수업 &nbsp;|&nbsp; 5교시 후 점심 = 6교시부터 수업
                </p>
                <div className="border border-gray-200 rounded-sm overflow-hidden w-fit">
                  <div className="flex bg-gray-50 border-b border-gray-200">
                    <div className="w-[80px] px-3 py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200">학년</div>
                    {[3, 4, 5].map(slot => (
                      <div key={slot} className="w-[120px] text-center py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">
                        {slot}교시 후 점심
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

    </div>
  )
}
