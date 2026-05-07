import { useMemo, useState } from 'react'
import { buildSchedule, flattenResult } from '../lib/scheduler'

const DAY_LABELS = ['월', '화', '수', '목', '금']

// 사용자 캡쳐(전담 배정 + 특별실 관리)대로 재현 — 캐시·localStorage 무관
const SCENARIO = {
  gradeConfigs: [
    { grade: 1, num_classes: 3 },
    { grade: 2, num_classes: 4 },
    { grade: 3, num_classes: 2 },
    { grade: 4, num_classes: 2 },
    { grade: 5, num_classes: 2 },
    { grade: 6, num_classes: 1 },
  ].map(g => ({ ...g, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 })),

  subjects: [
    { id: '영어', name: '영어', weekly_hours: 3, is_major: true },
    { id: '통합', name: '통합', weekly_hours: 2, is_major: false },
    { id: '과학', name: '과학', weekly_hours: 2, is_major: true },
    { id: '체육', name: '체육', weekly_hours: 3, is_major: false },
  ],

  teachers: [
    {
      id: '영어전담',
      code: '영어전담',
      teacher_assignments: [
        // 영어: 3-1,3-2 (2h each), 4-1,4-2 (2h each), 5-1,5-2 (3h each), 6-1 (3h)
        { id: 'e-3-1', subject_id: '영어', grade: 3, class_num: 1, weekly_hours: 2 },
        { id: 'e-3-2', subject_id: '영어', grade: 3, class_num: 2, weekly_hours: 2 },
        { id: 'e-4-1', subject_id: '영어', grade: 4, class_num: 1, weekly_hours: 2 },
        { id: 'e-4-2', subject_id: '영어', grade: 4, class_num: 2, weekly_hours: 2 },
        { id: 'e-5-1', subject_id: '영어', grade: 5, class_num: 1, weekly_hours: 3 },
        { id: 'e-5-2', subject_id: '영어', grade: 5, class_num: 2, weekly_hours: 3 },
        { id: 'e-6-1', subject_id: '영어', grade: 6, class_num: 1, weekly_hours: 3 },
        // 통합: 2-4 (2h)
        { id: 'tg-2-4', subject_id: '통합', grade: 2, class_num: 4, weekly_hours: 2 },
      ],
    },
    {
      id: '과학전담',
      code: '과학전담',
      teacher_assignments: [
        // 과학: 3,4,5학년 전체(2반 each, 2h) + 6-1 (2h)
        { id: 's-3-1', subject_id: '과학', grade: 3, class_num: 1, weekly_hours: 2 },
        { id: 's-3-2', subject_id: '과학', grade: 3, class_num: 2, weekly_hours: 2 },
        { id: 's-4-1', subject_id: '과학', grade: 4, class_num: 1, weekly_hours: 2 },
        { id: 's-4-2', subject_id: '과학', grade: 4, class_num: 2, weekly_hours: 2 },
        { id: 's-5-1', subject_id: '과학', grade: 5, class_num: 1, weekly_hours: 2 },
        { id: 's-5-2', subject_id: '과학', grade: 5, class_num: 2, weekly_hours: 2 },
        { id: 's-6-1', subject_id: '과학', grade: 6, class_num: 1, weekly_hours: 2 },
        // 통합: 1학년 전체(3반, 2h each)
        { id: 'tg2-1-1', subject_id: '통합', grade: 1, class_num: 1, weekly_hours: 2 },
        { id: 'tg2-1-2', subject_id: '통합', grade: 1, class_num: 2, weekly_hours: 2 },
        { id: 'tg2-1-3', subject_id: '통합', grade: 1, class_num: 3, weekly_hours: 2 },
      ],
    },
    {
      id: '체육전담',
      code: '체육전담',
      teacher_assignments: [
        // 체육: 3,4학년 전체(2반, 1h each), 5학년 전체(2반, 3h each), 6-1 (3h)
        { id: 'p-3-1', subject_id: '체육', grade: 3, class_num: 1, weekly_hours: 1 },
        { id: 'p-3-2', subject_id: '체육', grade: 3, class_num: 2, weekly_hours: 1 },
        { id: 'p-4-1', subject_id: '체육', grade: 4, class_num: 1, weekly_hours: 1 },
        { id: 'p-4-2', subject_id: '체육', grade: 4, class_num: 2, weekly_hours: 1 },
        { id: 'p-5-1', subject_id: '체육', grade: 5, class_num: 1, weekly_hours: 3 },
        { id: 'p-5-2', subject_id: '체육', grade: 5, class_num: 2, weekly_hours: 3 },
        { id: 'p-6-1', subject_id: '체육', grade: 6, class_num: 1, weekly_hours: 3 },
        // 통합: 2-1, 2-2, 2-3 (2h each)
        { id: 'tg3-2-1', subject_id: '통합', grade: 2, class_num: 1, weekly_hours: 2 },
        { id: 'tg3-2-2', subject_id: '통합', grade: 2, class_num: 2, weekly_hours: 2 },
        { id: 'tg3-2-3', subject_id: '통합', grade: 2, class_num: 3, weekly_hours: 2 },
      ],
    },
  ],
  lunchConfig: { split_lunch: false, lunch_groups: [] },
  rooms: [
    {
      id: 'room-2gym',
      name: '2층 강당',
      subjectNames: ['체육', '통합'],
      teacherIds: ['체육전담'],
    },
    {
      id: 'room-3small',
      name: '3층 소체육실',
      subjectNames: ['통합'],
      teacherIds: ['영어전담', '과학전담'],
    },
    {
      id: 'room-4gym',
      name: '4층 체육관',
      subjectNames: ['체육', '통합'],
      teacherIds: ['체육전담'],
    },
    {
      id: 'room-eng',
      name: '영어실',
      subjectNames: ['영어'],
      teacherIds: ['영어전담'],
    },
    {
      id: 'room-sci',
      name: '과학실',
      subjectNames: ['과학'],
      teacherIds: ['과학전담'],
    },
  ],
  // 2층 강당: 수요일 1-5교시(slot 0-4)만 사용 가능 → 나머지 다 차단
  roomBlockedSlots: [
    ...[0, 1, 3, 4].flatMap(day => [0, 1, 2, 3, 4, 5].map(slot => ({ room_id: 'room-2gym', day_of_week: day, slot }))),
    { room_id: 'room-2gym', day_of_week: 2, slot: 5 }, // 수요일 6교시도 차단
  ],
}

function checkSandwich(monRows) {
  const subjRange = {}
  for (const r of monRows) {
    if (!subjRange[r.subject_id]) subjRange[r.subject_id] = [r.slot, r.slot]
    else subjRange[r.subject_id][1] = r.slot
  }
  const violations = []
  for (const r of monRows) {
    for (const [otherSj, [minS, maxS]] of Object.entries(subjRange)) {
      if (otherSj === r.subject_id) continue
      if (r.slot > minS && r.slot < maxS) {
        violations.push(`${r.subject_id}@${r.slot} inside ${otherSj}[${minS},${maxS}]`)
      }
    }
  }
  return violations
}

function checkGradeSandwich(monRows) {
  const gradeRange = {}
  for (const r of monRows) {
    if (!gradeRange[r.grade]) gradeRange[r.grade] = [r.slot, r.slot]
    else gradeRange[r.grade][1] = r.slot
  }
  const violations = []
  for (const r of monRows) {
    for (const [otherG, [minS, maxS]] of Object.entries(gradeRange)) {
      if (Number(otherG) === r.grade) continue
      if (r.slot > minS && r.slot < maxS) {
        violations.push(`G${r.grade}@${r.slot} inside G${otherG}[${minS},${maxS}]`)
      }
    }
  }
  return violations
}

export default function SchedulerDebug() {
  const [seed, setSeed] = useState(0)

  const result = useMemo(() => {
    void seed
    return buildSchedule(
      SCENARIO.gradeConfigs,
      SCENARIO.subjects,
      SCENARIO.teachers,
      SCENARIO.lunchConfig,
      SCENARIO.rooms,
      SCENARIO.roomBlockedSlots,
    )
  }, [seed])

  const { rows } = flattenResult(result.result, result.gradeLunchSlot, result.totalSlots)

  const byTeacher = {}
  for (const r of rows) {
    if (!byTeacher[r.teacher_id]) byTeacher[r.teacher_id] = []
    byTeacher[r.teacher_id].push(r)
  }

  // 교사별 총 시수 (요일 분포 검증용)
  const teacherTotal = {}
  for (const t of SCENARIO.teachers) {
    teacherTotal[t.id] = t.teacher_assignments.reduce((sum, a) => sum + a.weekly_hours, 0)
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[18px] font-bold">Scheduler Debug — 사용자 실제 시나리오 재현</h1>
        <button
          onClick={() => setSeed(s => s + 1)}
          className="h-9 px-4 bg-black text-white text-[13px] font-semibold rounded-sm"
        >
          다시 생성
        </button>
      </div>

      <p className="text-[13px] text-gray-600 mb-4">
        전담 배정/특별실 관리 캡쳐대로 재현. localStorage·시간표 페이지 상태와 무관.
        sandwich + 요일 부하 자동 검사.
      </p>

      {result.errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-sm text-[12px]">
          <strong>미배정:</strong>{' '}
          {result.errors.map((e, i) => (
            <span key={i}>{e.grade}-{e.classNum} {e.subjectId} {e.unassigned}h{i < result.errors.length - 1 ? ', ' : ''}</span>
          ))}
        </div>
      )}

      {Object.entries(byTeacher).map(([teacherId, teacherRows]) => {
        const totalSlots = result.totalSlots
        const T = teacherTotal[teacherId]
        const ceilT = Math.ceil(T / 5)

        // 요일별 부하
        const dayLoads = [0, 0, 0, 0, 0]
        for (const r of teacherRows) dayLoads[r.day_of_week]++

        const maxLoad = Math.max(...dayLoads)
        const minLoad = Math.min(...dayLoads)
        const balanceOK = maxLoad - minLoad <= 2

        // sandwich 검사
        const sandwichViolations = []
        for (let d = 0; d < 5; d++) {
          const dayRows = teacherRows.filter(r => r.day_of_week === d).sort((a, b) => a.slot - b.slot)
          const subjV = checkSandwich(dayRows)
          const grV = checkGradeSandwich(dayRows)
          if (subjV.length || grV.length) {
            sandwichViolations.push(`${DAY_LABELS[d]}: ${[...subjV.map(v => `과목 ${v}`), ...grV.map(v => `학년 ${v}`)].join(', ')}`)
          }
        }

        return (
          <div key={teacherId} className="mb-6">
            <div className="flex items-baseline gap-3 mb-2 flex-wrap">
              <h2 className="text-[15px] font-bold">{teacherId}</h2>
              <span className="text-[12px] text-gray-500">{teacherRows.length}/{T}h</span>
              <span className="text-[12px] text-gray-500">
                요일 부하 [{dayLoads.join(', ')}] (cap=ceil(T/5)={ceilT})
              </span>
              {balanceOK ? (
                <span className="text-[12px] text-green-600 font-semibold">✓ 편차 ≤ 2</span>
              ) : (
                <span className="text-[12px] text-red-600 font-semibold">❌ 편차 {maxLoad - minLoad}</span>
              )}
              {sandwichViolations.length > 0 ? (
                <span className="text-[12px] text-red-600 font-semibold">❌ SANDWICH: {sandwichViolations.join(' | ')}</span>
              ) : (
                <span className="text-[12px] text-green-600">✓ sandwich 없음</span>
              )}
            </div>

            <div className="border border-gray-200 rounded-sm overflow-hidden bg-white">
              <div className="flex bg-gray-50">
                <div className="w-[60px] flex-shrink-0 border-r border-gray-200 h-9 flex items-center justify-center text-[11px] font-semibold text-gray-500">교시</div>
                {DAY_LABELS.map(d => (
                  <div key={d} className="flex-1 h-9 flex items-center justify-center border-r border-gray-200 last:border-r-0 text-[11px] font-semibold text-gray-500">{d}</div>
                ))}
              </div>
              {Array.from({ length: totalSlots }, (_, slot) => (
                <div key={slot} className="flex border-t border-gray-100 h-14">
                  <div className="w-[60px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-400 bg-gray-50">{slot + 1}교시</div>
                  {DAY_LABELS.map((_, day) => {
                    const cell = teacherRows.find(r => r.day_of_week === day && r.slot === slot)
                    const room = cell?.room_id ? SCENARIO.rooms.find(r => r.id === cell.room_id) : null
                    return (
                      <div key={day} className="flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center">
                        {cell ? (
                          <>
                            <span className="text-[12px] font-semibold text-gray-900">{cell.subject_id}</span>
                            <span className="text-[10px] text-gray-500">{cell.grade}-{cell.class_num}</span>
                            {room && <span className="text-[9px] text-blue-500">{room.name}</span>}
                          </>
                        ) : (
                          <span className="text-[12px] text-gray-200">—</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
