import { useState, useRef, useEffect } from 'react'
import { Download, RefreshCw, ChevronDown } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { buildSchedule, flattenResult } from '../lib/scheduler'
import { exportTimetableByClass, exportTimetableByTeacher } from '../lib/excelExport'
import TimetableGrid from '../components/TimetableGrid'
import ManualModal from '../components/ManualModal'

const MANUAL = [
  {
    title: '시간표 자동 생성',
    items: [
      '자동 생성 버튼을 누르면 내부적으로 20번 탐색 후 최적 결과를 자동 선택합니다.',
      '선택 기준: ① 미배정 최소 → ② 같은 학년+과목 같은 날 클러스터링 최대 → ③ 요일별 시수 격차 최소.',
      '과목별로 "같은 요일 연속 수업 허용 여부"와 "하루 최대 배정 시수"를 설정할 수 있습니다 (자동 생성 모달).',
      '연속 허용 + 주 2시간 → pair (같은 날 2시간 연속)로 묶입니다.',
      '연속 허용 + 주 3시간 → 1시간 + pair(2시간 연속) 구조로 배치됩니다.',
      '교사·학급별 일일 부하가 균등하게 자동 분산됩니다 (요일간 편차 최소화).',
    ],
  },
  {
    title: '자동 배정 규칙 (어떻게 배정되나요?)',
    items: [
      '같은 학년·같은 과목은 되도록 같은 요일에 모읍니다 (교사가 같은 수업 자료를 하루에 준비하도록).',
      '한 학급의 같은 과목이 주 2회 이상이면 서로 다른 요일에 나눠 배치하고, 요일 순서대로(앞 회차가 먼저) 채웁니다.',
      '교사·학급마다 하루 수업량이 특정 요일에 몰리지 않도록 요일별로 고르게 분산합니다.',
      '한 교사의 하루 수업 사이에 다른 학년·과목이 끼어들지 않도록 연속으로 붙여 배치합니다.',
      '특별실을 쓰는 과목은 그 특별실이 비어 있는 시간에만 배정됩니다 (같은 시간 중복 사용 방지).',
      '점심 분리 배정 시 점심시간 슬롯에는 수업이 배정되지 않습니다.',
      '위 규칙을 모두 지키며 20번 탐색해, 미배정이 가장 적고 가장 고르게 묶인 결과를 자동으로 선택합니다.',
    ],
  },
  {
    title: '보기 전환',
    items: [
      '교사별 보기: 교사 단위로 주간 시간표 확인.',
      '학급별 보기: 학년·반을 선택해 해당 학급들의 전담 시간표 확인. 여러 학급 동시 표시 가능 ("전체 선택"·"전체 해제" 지원).',
    ],
  },
  {
    title: '1·2학기 구분 보기 (학기제 ON)',
    items: [
      '학교 설정에서 ‘학기별 배정 사용’을 켜면 보기 버튼 옆에 1학기·2학기 전환 버튼이 나타납니다.',
      '선택한 학기의 수업만 표시됩니다 (연간 과목·외부강사는 항상 표시).',
      '교사별·학급별 엑셀도 현재 보는 학기 기준으로 나눠 다운로드됩니다 (파일명에 학기 표시).',
      '서로 다른 학기(1·2학기) 수업이 같은 시간에 놓여도 중복(빨간색)으로 표시되지 않습니다 — 의도된 학기 짝배치입니다.',
    ],
  },
  {
    title: '셀 교환·입력 (교사별·학급별 보기 동일)',
    items: [
      '교사별 보기와 학급별 보기 모두 같은 방식으로 칸을 눌러 수정합니다.',
      '칸에 마우스를 올리면 사용법 말풍선이 나타납니다.',
      '빈 칸을 클릭하면 바로 입력 모달이 열려 학년·반·과목·특별실을 채울 수 있습니다.',
      '채워진 칸을 클릭하면 파란 테두리로 선택됩니다.',
      '선택 후 다른 칸을 클릭하면 두 칸의 내용이 서로 바뀝니다 (빈 칸이면 이동).',
      '선택한 칸을 다시 클릭하면 편집 모달이 열립니다. (외부강사 칸은 외부강사 편집창)',
      '편집 모달 왼쪽 아래 "삭제" 버튼으로 그 수업을 시간표에서 지울 수 있습니다.',
    ],
  },
  {
    title: '수동 수정',
    items: [
      '교사별 보기에서 같은 셀을 다시 클릭하거나, 학급별 보기에서 셀을 클릭하면 편집 모달이 열립니다.',
      '미배정(빨간 셀)을 클릭해 수동으로 채울 수 있습니다.',
      '수동 편집은 즉시 학급별·특별실 시간표에 동기화됩니다.',
    ],
  },
  {
    title: '빨간색 표시 조건',
    items: [
      '교사 시간 중복: 같은 교사가 같은 시간에 다른 학급 수업 중일 때.',
      '점심시간 슬롯: 해당 학년의 점심시간에 수업이 배정된 경우.',
      '교시 편제 초과: 해당 학년의 해당 요일 수업 시수를 넘긴 슬롯에 배정된 경우.',
      '외부강사 칸도 동일하게 점심·교시 초과·중복 시 빨간색으로 표시됩니다.',
    ],
  },
  {
    title: '외부강사 수업 표시',
    items: [
      '외부강사 수업은 남색 글씨로 표시됩니다 (학급별 보기 + 교사별 보기의 강사별 칸).',
      '외부강사 칸도 전담과 동일하게 클릭해 교환·수정·삭제할 수 있습니다.',
    ],
  },
  {
    title: '미배정 시수 표',
    items: [
      '제약 조건상 자동 배정에 실패한 수업이 있으면 페이지 상단에 빨간 표로 표시됩니다 (학년·반 단위).',
      '외부강사가 다 배정되지 못하면 "외부강사 미배정" 표가 별도로 학년·반 단위로 표시됩니다.',
      '표는 수동 편집과 실시간 동기화되어 수동으로 채우면 자동으로 사라집니다.',
      '미배정이 많으면 교사 시수, 과목별 연속 수업 설정, 특별실 사용 제약을 조정해보세요.',
    ],
  },
  {
    title: '엑셀 내보내기',
    items: [
      '교사별 엑셀: 교사 단위로 시간표를 내보냅니다 (외부강사는 강사별 시트로 포함).',
      '학급별 엑셀: 학급 단위로 시간표를 내보냅니다 (외부강사 수업도 표시).',
      '인쇄는 엑셀로 내려받아 엑셀에서 인쇄하면 됩니다.',
    ],
  },
  {
    title: '작년 시간표 직접 입력 (역입력)',
    items: [
      '자동 생성을 누르지 않아도, 교사·과목을 등록하면 빈 시간표가 바로 나타나 직접 입력할 수 있습니다.',
      '교사별 보기에서 빈 칸을 클릭하면 학년·반·과목·특별실을 골라 수업을 채울 수 있습니다.',
      '작년 시간표를 이렇게 그대로 만들어 둔 뒤, 올해 바뀐 부분만 수정하면 다음 해에도 빠르게 활용할 수 있습니다.',
      '먼저 학교 설정 → 전담 과목 → 전담 배정에 작년 기준 정보를 입력해 두면 칸 입력이 매끄럽습니다.',
    ],
  },
  {
    title: '점심시간 분리 배정',
    items: ['점심시간 분리 배정 시 특별실 시간표, 전담교사 시간표는 7교시 형식으로 제시됩니다.'],
  },
]

const GRADES = [1, 2, 3, 4, 5, 6]

export default function Timetable() {
  const { state, setTimetableSlots } = useApp()
  const { gradeConfigs, subjects, teachers, lunchConfig, timetableSlots: timetableRows, rooms, roomBlockedSlots, externalInstructors, semesterMode } = state

  const [generating, setGenerating] = useState(false)
  const [swapCell, setSwapCell] = useState(null) // { teacherId, day, slot, rowId }
  // (이전 errors state 제거 — 미배정 표시는 UnassignedStats가 timetableRows에서 직접 계산해서 실시간 동기화됨)
  const [tab, setTab] = useState('teacher')
  const [semesterView, setSemesterView] = useState('1') // 1·2학기 보기 (학기제 ON일 때)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateOptions, setGenerateOptions] = useState({ subjectSettings: {} })
  const [selectedClasses, setSelectedClasses] = useState([])
  const [extEdit, setExtEdit] = useState(null) // { instId, day, slot, current }

  function toggleSelectedClass(grade, classNum) {
    setSelectedClasses(prev => {
      const i = prev.findIndex(c => c.grade === grade && c.classNum === classNum)
      if (i >= 0) return prev.filter((_, idx) => idx !== i)
      return [...prev, { grade, classNum }].sort((a, b) => a.grade - b.grade || a.classNum - b.classNum)
    })
  }

  function selectAllInGrade(grade) {
    const cfg = gradeConfigs.find(g => g.grade === grade)
    if (!cfg) return
    setSelectedClasses(prev => {
      const others = prev.filter(c => c.grade !== grade)
      const all = Array.from({ length: cfg.num_classes }, (_, i) => ({ grade, classNum: i + 1 }))
      return [...others, ...all].sort((a, b) => a.grade - b.grade || a.classNum - b.classNum)
    })
  }

  function deselectAllClasses() {
    setSelectedClasses([])
  }

  function selectAllClasses() {
    const all = []
    for (const cfg of gradeConfigs) {
      for (let i = 1; i <= cfg.num_classes; i++) all.push({ grade: cfg.grade, classNum: i })
    }
    setSelectedClasses(all.sort((a, b) => a.grade - b.grade || a.classNum - b.classNum))
  }
  const [selectedTeacher, setSelectedTeacher] = useState(teachers[0]?.id || null)
  const [editModal, setEditModal] = useState(null)
  const [saving, setSaving] = useState(false)

  function computeSlotMeta(gc, lunch) {
    if (!gc?.length) return { gradeLunchSlot: {}, totalSlots: 6 }
    const maxPeriods = Math.max(...gc.map(c => Math.max(c.periods_mon, c.periods_tue, c.periods_wed, c.periods_thu, c.periods_fri)))
    if (!lunch?.split_lunch || !lunch?.lunch_groups?.length) {
      return { gradeLunchSlot: {}, totalSlots: maxPeriods }
    }
    const gradeLunchSlot = {}
    for (const g of lunch.lunch_groups) {
      for (const grade of g.grades) {
        gradeLunchSlot[grade] = g.slot
      }
    }
    return { gradeLunchSlot, totalSlots: maxPeriods + 1 }
  }

  function handleGenerate() {
    if (!gradeConfigs.length || !subjects.length || !teachers.length) {
      return alert('학급 정보, 전담 과목, 교사 정보를 먼저 설정하세요.')
    }
    const hasAssignments = teachers.some(t => t.teacher_assignments?.length > 0)
    if (!hasAssignments) {
      return alert('전담 배정 탭에서 배정을 실행하고 "시간표에 적용"을 먼저 해주세요.')
    }
    const uniqueNames = [...new Set(subjects.map(s => s.name))]
    const current = generateOptions.subjectSettings || {}
    const updated = {}
    for (const name of uniqueNames) {
      updated[name] = current[name] || { allow: false, maxCount: 2 }
    }
    setGenerateOptions({ subjectSettings: updated })
    setShowGenerateModal(true)
  }

  async function executeGenerate() {
    setShowGenerateModal(false)
    setGenerating(true)
    try {
      const RUNS = 20
      const lunchCfg = lunchConfig || { split_lunch: false, lunch_groups: [] }
      let best = null
      let bestScore = -Infinity

      for (let i = 0; i < RUNS; i++) {
        // 각 반복이 UI를 블로킹하지 않도록 5회마다 yield
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 0))

        const result = buildSchedule(gradeConfigs, subjects, teachers, lunchCfg, rooms, roomBlockedSlots, { ...generateOptions, externalInstructors })
        const { rows } = flattenResult(result.result, result.gradeLunchSlot, result.totalSlots)

        // 점수 계산: 미배정 적을수록 좋고, 같은 학년+과목이 같은 날에 묶일수록 좋음
        const unassigned = result.errors.reduce((s, e) => s + e.unassigned, 0)

        // 클러스터링 점수: (teacher, grade, subject) 그룹별로 같은 날에 묶인 반 쌍 수
        const groupDays = {}
        for (const row of rows) {
          if (row.is_unassigned || row.is_external) continue
          const key = `${row.teacher_id}__${row.grade}__${row.subject_id}`
          if (!groupDays[key]) groupDays[key] = {}
          if (!groupDays[key][row.class_num]) groupDays[key][row.class_num] = new Set()
          groupDays[key][row.class_num].add(row.day_of_week)
        }
        let clusterScore = 0
        for (const daysByClass of Object.values(groupDays)) {
          const classes = Object.values(daysByClass)
          for (let a = 0; a < classes.length; a++) {
            for (let b = a + 1; b < classes.length; b++) {
              // 두 반이 공유하는 요일 수만큼 보너스
              for (const d of classes[a]) {
                if (classes[b].has(d)) clusterScore++
              }
            }
          }
        }

        // 교사별 요일 시수 격차 합산 (작을수록 좋음)
        const teacherDayCounts = {}
        for (const row of rows) {
          if (row.is_unassigned) continue
          if (!teacherDayCounts[row.teacher_id]) teacherDayCounts[row.teacher_id] = [0,0,0,0,0]
          teacherDayCounts[row.teacher_id][row.day_of_week]++
        }
        let balancePenalty = 0
        for (const counts of Object.values(teacherDayCounts)) {
          const filled = counts.filter(c => c > 0)
          if (filled.length >= 2) balancePenalty += Math.max(...filled) - Math.min(...filled)
        }

        // 1순위: 미배정 최소 / 2순위: 클러스터링 최대 / 3순위: 요일 격차 최소
        const score = -unassigned * 10000 + clusterScore - balancePenalty * 3
        if (score > bestScore) {
          bestScore = score
          best = { rows, result }
        }
      }

      const rowsWithId = best.rows.map(r => ({ ...r, id: crypto.randomUUID() }))
      setTimetableSlots(rowsWithId)
    } catch (e) {
      console.error(e)
      alert('시간표 생성 중 오류가 발생했습니다.')
    }
    setGenerating(false)
  }

  // 학기 필터: 학기제 OFF면 모두, ON이면 연간+선택 학기(외부강사는 항상)
  const passesSem = (r) => !semesterMode || !r.semester || r.semester === 'year' || r.semester === semesterView || r.is_external

  function getSlotsForClass(grade, classNum) {
    const daySlots = {}
    for (let d = 0; d < 5; d++) {
      daySlots[d] = {}
      const relevant = timetableRows.filter(r => r.grade === grade && r.class_num === classNum && r.day_of_week === d && passesSem(r))
      for (const r of relevant) {
        daySlots[d][r.slot] = { teacher_id: r.teacher_id, subject_id: r.subject_id, is_unassigned: r.is_unassigned, room_id: r.room_id, id: r.id, is_external: r.is_external, external_id: r.external_id, external_name: r.external_name, subject_name: r.subject_name, semester: r.semester, grade: r.grade, class_num: r.class_num }
      }
    }
    return daySlots
  }

  function getSlotsForTeacher(teacherId) {
    const daySlots = {}
    for (let d = 0; d < 5; d++) {
      daySlots[d] = {}
      const relevant = timetableRows.filter(r => r.teacher_id === teacherId && r.day_of_week === d && passesSem(r))
      for (const r of relevant) {
        daySlots[d][r.slot] = { teacher_id: r.teacher_id, subject_id: r.subject_id, is_unassigned: r.is_unassigned, label: `${r.grade}학년 ${r.class_num}반`, grade: r.grade, class_num: r.class_num, room_id: r.room_id, id: r.id, semester: r.semester }
      }
    }
    return daySlots
  }

  function getSlotsForExternal(instId) {
    const daySlots = {}
    for (let d = 0; d < 5; d++) {
      daySlots[d] = {}
      const relevant = timetableRows.filter(r => r.is_external && r.external_id === instId && r.day_of_week === d)
      for (const r of relevant) {
        daySlots[d][r.slot] = { id: r.id, is_external: true, subject_name: r.subject_name, external_name: r.external_name, label: `${r.grade}학년 ${r.class_num}반`, grade: r.grade, class_num: r.class_num, room_id: r.room_id }
      }
    }
    return daySlots
  }

  function handleClassCellClick(grade, classNum, day, slot, cell) {
    const ownerKey = `cls:${grade}_${classNum}`
    if (!swapCell) {
      if (!cell) {
        // 빈 칸 → 입력 모달 (전담)
        openEditModal(day, slot, cell, { grade, classNum })
        return
      }
      setSwapCell({ classKey: ownerKey, day, slot, rowId: cell.id || null })
    } else if (swapCell.classKey === ownerKey && swapCell.day === day && swapCell.slot === slot) {
      // 같은 칸 재클릭 → 수정
      setSwapCell(null)
      if (cell?.is_external) {
        setExtEdit({ instId: cell.external_id, day, slot, current: { id: cell.id, grade, class_num: classNum, subject_name: cell.subject_name } })
      } else {
        openEditModal(day, slot, cell, { grade, classNum })
      }
    } else {
      // 다른 칸 클릭 → 자리 교환(또는 빈 칸이면 이동)
      const idA = swapCell.rowId, idB = cell?.id || null
      const dayA = swapCell.day, slotA = swapCell.slot
      const updated = timetableRows.map(r => {
        if (idA && r.id === idA) return { ...r, day_of_week: day, slot }
        if (idB && r.id === idB) return { ...r, day_of_week: dayA, slot: slotA }
        return r
      })
      setTimetableSlots(updated)
      setSwapCell(null)
    }
  }

  function handleExternalCellClick(instId, day, slot, cell) {
    const ownerKey = `ext:${instId}`
    if (!swapCell) {
      if (!cell) {
        // 빈 칸 클릭 → 입력 모달 (전담과 동일)
        setExtEdit({ instId, day, slot, current: null })
        return
      }
      setSwapCell({ teacherId: ownerKey, day, slot, rowId: cell.id || null })
    } else if (swapCell.teacherId === ownerKey && swapCell.day === day && swapCell.slot === slot) {
      // 같은 칸 재클릭 → 수정 모달 (전담과 동일)
      setSwapCell(null)
      setExtEdit({ instId, day, slot, current: cell })
    } else {
      // 다른 칸 클릭 → 자리 교환(또는 빈 칸이면 이동)
      const idA = swapCell.rowId, idB = cell?.id || null
      const dayA = swapCell.day, slotA = swapCell.slot
      const updated = timetableRows.map(r => {
        if (idA && r.id === idA) return { ...r, day_of_week: day, slot }
        if (idB && r.id === idB) return { ...r, day_of_week: dayA, slot: slotA }
        return r
      })
      setTimetableSlots(updated)
      setSwapCell(null)
    }
  }

  function handleExtEditSave(instId, day, slot, current, { grade, classNum, subjectName }) {
    const inst = externalInstructors.find(e => e.id === instId)
    const row = {
      id: current?.id || crypto.randomUUID(),
      grade, class_num: classNum, day_of_week: day, slot,
      is_external: true, external_id: instId,
      external_name: inst?.name || '외부강사',
      subject_name: subjectName,
      teacher_id: null, subject_id: null, room_id: null, is_unassigned: false,
    }
    setTimetableSlots(
      current
        ? timetableRows.map(r => r.id === current.id ? row : r)
        : [...timetableRows, row]
    )
    setExtEdit(null)
  }

  function handleTeacherCellClick(teacherId, day, slot, cell) {
    if (!swapCell) {
      if (!cell) {
        // 빈 칸 첫 클릭: 바로 입력 모달 (작년 시간표 직접 입력 등)
        openEditModal(day, slot, cell, { defaultTeacherId: teacherId })
        return
      }
      // 채워진 칸 첫 클릭: 교환을 위해 선택
      setSwapCell({ teacherId, day, slot, rowId: cell?.id || null })
    } else if (swapCell.teacherId === teacherId && swapCell.day === day && swapCell.slot === slot) {
      // 같은 셀 재클릭: 선택 해제 + 편집 모달
      setSwapCell(null)
      openEditModal(day, slot, cell, { defaultTeacherId: teacherId })
    } else {
      // 다른 셀 클릭: 교환
      const idA = swapCell.rowId
      const idB = cell?.id || null
      const dayA = swapCell.day, slotA = swapCell.slot
      const dayB = day, slotB = slot

      let updated = timetableRows.map(r => {
        if (idA && r.id === idA) return { ...r, day_of_week: dayB, slot: slotB }
        if (idB && r.id === idB) return { ...r, day_of_week: dayA, slot: slotA }
        return r
      })
      // idA가 있고 idB가 없으면 (빈 셀로 이동) — 이동만
      // idA가 없으면 (빈 셀 → 빈 셀) — 아무것도 안 함
      setTimetableSlots(updated)
      setSwapCell(null)
    }
  }

  function openEditModal(day, slot, cell, ctx = {}) {
    if (cell?.is_external) {
      alert('외부강사 수업입니다. 변경하려면 "외부강사 관리"에서 수정 후 시간표를 다시 생성하세요.')
      return
    }
    if (tab === 'class') {
      setEditModal({ day, slot, grade: ctx.grade, classNum: ctx.classNum, current: cell, rowId: cell?.id || null })
    } else if (tab === 'teacher') {
      setEditModal({ day, slot, grade: cell?.grade || null, classNum: cell?.class_num || null, current: cell, classLabel: cell?.label || null, teacherView: true, defaultTeacherId: ctx.defaultTeacherId || selectedTeacher, rowId: cell?.id || null })
    }
  }

  function handleEditSave(teacherId, subjectId, grade, classNum, roomId) {
    if (!editModal) return
    setSaving(true)
    const g = grade ?? editModal.grade
    const cn = classNum ?? editModal.classNum
    if (!g || !cn) { setSaving(false); return }

    let updated
    if (editModal.rowId) {
      // 교사 또는 과목을 비워서 저장 → 행 삭제 (찌꺼기 행이 빨간 label로 남지 않게)
      if (!teacherId || !subjectId) {
        updated = timetableRows.filter(r => r.id !== editModal.rowId)
      } else {
        updated = timetableRows.map(r =>
          r.id === editModal.rowId
            ? { ...r, teacher_id: teacherId, subject_id: subjectId, room_id: roomId || null, is_unassigned: false, grade: g, class_num: cn }
            : r
        )
      }
    } else {
      // 빈 셀에 새 행 추가 — 다른 교사가 같은 (반·요일·교시)에 가진 행은 보존하여 충돌 표시
      updated = [...timetableRows]
      if (teacherId && subjectId) {
        updated.push({ id: crypto.randomUUID(), grade: g, class_num: cn, day_of_week: editModal.day, slot: editModal.slot, teacher_id: teacherId, subject_id: subjectId, room_id: roomId || null, is_unassigned: false })
      }
    }

    setTimetableSlots(updated)
    setEditModal(null)
    setSaving(false)
  }

  const { gradeLunchSlot } = computeSlotMeta(gradeConfigs, lunchConfig)
  const splitLunch = lunchConfig?.split_lunch || false
  const totalSlots = splitLunch ? 7 : 6

  const teacherSlots = selectedTeacher ? getSlotsForTeacher(selectedTeacher) : {}

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-full">
      <div className="max-w-[1100px] flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-[22px] font-bold">전담 시간표</h1>
        <div className="flex flex-wrap gap-2">
          <ManualModal title="전담 시간표" sections={MANUAL} />
          <button
            title="현재 시간표를 교사 단위 엑셀 파일로 내려받습니다."
            onClick={() => exportTimetableByTeacher(semesterMode ? timetableRows.filter(passesSem) : timetableRows, teachers, subjects, gradeConfigs, gradeLunchSlot, totalSlots, externalInstructors, semesterMode ? `_${semesterView}학기` : '')}
            className="flex items-center gap-2 h-10 px-3 md:px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50 whitespace-nowrap"
          >
            <Download size={14} />교사별 엑셀
          </button>
          <button
            title="현재 시간표를 학급 단위 엑셀 파일로 내려받습니다."
            onClick={() => exportTimetableByClass(semesterMode ? timetableRows.filter(passesSem) : timetableRows, gradeConfigs, teachers, subjects, gradeLunchSlot, totalSlots, semesterMode ? `_${semesterView}학기` : '')}
            className="flex items-center gap-2 h-10 px-3 md:px-4 border border-gray-300 text-[13px] rounded-sm hover:bg-gray-50 whitespace-nowrap"
          >
            <Download size={14} />학급별 엑셀
          </button>
          <button
            title="배정 규칙에 따라 20번 탐색해 가장 좋은 시간표를 자동으로 만듭니다. 기존 결과는 새 결과로 대체됩니다."
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 h-10 px-3 md:px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {generating ? '생성 중...' : '시간표 자동 생성'}
          </button>
        </div>
      </div>

      <p className="max-w-[1100px] text-[12px] text-gray-400 -mt-3 mb-5 break-keep">⑥ "시간표 자동 생성"으로 만들거나, 교사별·학급별 보기에서 빈 칸을 클릭해 직접 입력하세요. 칸을 클릭해 수정·교환할 수 있습니다.</p>

      {/* 미배정 시수 표 — 수동 편집과 실시간 동기화 위해 상단으로 이동 (이전 빨간 경고 블록은 초기 생성 결과만 보여줘서 제거) */}
      {timetableRows.length > 0 && (
        <UnassignedStats
          teachers={teachers}
          subjects={subjects}
          timetableRows={timetableRows}
          filterClasses={tab === 'class' ? selectedClasses : null}
          placement="top"
        />
      )}

      {timetableRows.length > 0 && externalInstructors.length > 0 && (
        <ExternalUnassignedStats
          externalInstructors={externalInstructors}
          gradeConfigs={gradeConfigs}
          timetableRows={timetableRows}
        />
      )}

      {teachers.length === 0 && timetableRows.length === 0 ? (
        <div className="text-center py-20 text-gray-300 text-[14px]">
          먼저 전담 과목·교사를 등록하세요. 등록하면 빈 시간표가 나타나 직접 입력할 수 있습니다.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap mb-5">
            <div className="flex border border-gray-200 bg-white rounded-sm w-fit">
              {[{ key: 'teacher', label: '교사별 보기' }, { key: 'class', label: '학급별 보기' }].map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setSwapCell(null) }}
                  className={`px-5 h-[42px] text-[13px] transition-colors ${tab === t.key ? 'bg-black text-white font-semibold' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {semesterMode && (
              <div className="flex border border-indigo-200 bg-white rounded-sm w-fit">
                {[{ key: '1', label: '1학기' }, { key: '2', label: '2학기' }].map(s => (
                  <button
                    key={s.key}
                    onClick={() => { setSemesterView(s.key); setSwapCell(null) }}
                    className={`px-4 h-[42px] text-[13px] transition-colors ${semesterView === s.key ? 'bg-indigo-600 text-white font-semibold' : 'text-indigo-500 hover:bg-indigo-50'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {tab === 'class' && (
            <>
              <div className="mb-5">
                <ClassPicker
                  gradeConfigs={gradeConfigs}
                  selectedClasses={selectedClasses}
                  onToggle={toggleSelectedClass}
                  onSelectGrade={selectAllInGrade}
                  onDeselectGrade={(g) => setSelectedClasses(prev => prev.filter(c => c.grade !== g))}
                  onDeselectAll={deselectAllClasses}
                  onSelectAll={selectAllClasses}
                />
              </div>

              {selectedClasses.length === 0 ? (
                <div className="max-w-[1100px] text-center py-12 text-gray-300 text-[13px]">학급을 선택하세요</div>
              ) : (
                <div className="max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {selectedClasses.map(({ grade, classNum }) => (
                    <div key={`${grade}-${classNum}`} className="flex flex-col gap-1">
                      <div className="px-1 text-[13px] font-bold text-gray-800">{grade}학년 {classNum}반</div>
                      <TimetableGrid
                        slots={getSlotsForClass(grade, classNum)}
                        totalSlots={totalSlots}
                        gradeLunchSlot={gradeLunchSlot}
                        teachers={teachers}
                        subjects={subjects}
                        rooms={rooms}
                        timetableRows={timetableRows}
                        selectedCell={swapCell?.classKey === `cls:${grade}_${classNum}` ? swapCell : null}
                        onCellClick={(day, slot, cell) => handleClassCellClick(grade, classNum, day, slot, cell)}
                        grade={grade}
                        classNum={classNum}
                        compact
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'teacher' && (
            <div className="max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-4">
              {teachers.map(t => {
                const ts = getSlotsForTeacher(t.id)
                const scheduled = timetableRows.filter(r => r.teacher_id === t.id && !r.is_unassigned).length
                const target = (t.teacher_assignments || []).reduce((s, a) => s + (a.weekly_hours || 0) * 1, 0)
                return (
                  <div key={t.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2 px-1">
                      <span className="text-[13px] font-bold text-gray-800">{t.code}</span>
                      <span className={`text-[11px] ${scheduled < target ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                        {scheduled} / {target}h{scheduled < target ? ` (부족 ${target - scheduled}h)` : ''}
                      </span>
                    </div>
                    <TeacherTimetableGrid
                      slots={ts}
                      totalSlots={totalSlots}
                      gradeLunchSlot={gradeLunchSlot}
                      gradeConfigs={gradeConfigs}
                      subjects={subjects}
                      timetableRows={timetableRows}
                      teachers={teachers}
                      rooms={rooms}
                      compact
                      selectedCell={swapCell?.teacherId === t.id ? swapCell : null}
                      onCellClick={(day, slot, cell) => handleTeacherCellClick(t.id, day, slot, cell)}
                    />
                  </div>
                )
              })}

              {externalInstructors.map(inst => {
                const count = timetableRows.filter(r => r.is_external && r.external_id === inst.id).length
                if (count === 0) return null
                return (
                  <div key={`ext-${inst.id}`} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2 px-1">
                      <span className="text-[13px] font-bold text-indigo-700">{inst.name || '외부강사'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500">외부강사</span>
                      <span className="text-[11px] text-gray-400">{count}h</span>
                    </div>
                    <TeacherTimetableGrid
                      slots={getSlotsForExternal(inst.id)}
                      totalSlots={totalSlots}
                      gradeLunchSlot={gradeLunchSlot}
                      gradeConfigs={gradeConfigs}
                      subjects={subjects}
                      timetableRows={timetableRows}
                      teachers={teachers}
                      rooms={rooms}
                      compact
                      externalGrid
                      selectedCell={swapCell?.teacherId === `ext:${inst.id}` ? swapCell : null}
                      onCellClick={(day, slot, cell) => handleExternalCellClick(inst.id, day, slot, cell)}
                    />
                  </div>
                )
              })}
            </div>
          )}

        </>
      )}

      {editModal && (
        <EditCellModal
          modal={editModal}
          teachers={teachers}
          subjects={subjects}
          gradeConfigs={gradeConfigs}
          rooms={rooms}
          grade={editModal.grade}
          lunchConfig={lunchConfig}
          onSave={handleEditSave}
          onClose={() => setEditModal(null)}
          onDelete={() => {
            if (editModal?.rowId) setTimetableSlots(timetableRows.filter(r => r.id !== editModal.rowId))
            setEditModal(null)
          }}
          saving={saving}
        />
      )}

      {showGenerateModal && (
        <GenerateOptionsModal
          options={generateOptions}
          onChange={setGenerateOptions}
          subjects={subjects}
          onConfirm={executeGenerate}
          onClose={() => setShowGenerateModal(false)}
        />
      )}

      {extEdit && (
        <ExternalEditModal
          modal={extEdit}
          instructor={externalInstructors.find(e => e.id === extEdit.instId)}
          gradeConfigs={gradeConfigs}
          onSave={(payload) => handleExtEditSave(extEdit.instId, extEdit.day, extEdit.slot, extEdit.current, payload)}
          onDelete={() => { if (extEdit.current) setTimetableSlots(timetableRows.filter(r => r.id !== extEdit.current.id)); setExtEdit(null) }}
          onClose={() => setExtEdit(null)}
        />
      )}
    </div>
  )
}

function ExternalEditModal({ modal, instructor, gradeConfigs, onSave, onDelete, onClose }) {
  const DAY_LABELS = ['월', '화', '수', '목', '금']
  const instGrades = (instructor?.grades || []).filter(g => gradeConfigs.some(x => x.grade === g))
  const gradeOptions = instGrades.length ? instGrades : gradeConfigs.map(g => g.grade)
  const cur = modal.current
  const [grade, setGrade] = useState(cur?.grade ?? gradeOptions[0] ?? 1)
  const [classNum, setClassNum] = useState(cur?.class_num ?? 1)
  const [subjectName, setSubjectName] = useState(cur?.subject_name ?? instructor?.subjectName ?? '')
  const numClasses = gradeConfigs.find(g => g.grade === grade)?.num_classes || 1

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-[360px] rounded-sm border border-gray-200" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold">{instructor?.name || '외부강사'} 수업 {cur ? '수정' : '입력'}</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">{DAY_LABELS[modal.day]}요일 {modal.slot + 1}교시</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-[11px] font-semibold text-gray-500 block mb-1">학년</span>
              <select value={grade} onChange={e => { setGrade(Number(e.target.value)); setClassNum(1) }}
                className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black bg-white">
                {gradeOptions.map(g => <option key={g} value={g}>{g}학년</option>)}
              </select>
            </label>
            <label className="flex-1">
              <span className="text-[11px] font-semibold text-gray-500 block mb-1">반</span>
              <select value={classNum} onChange={e => setClassNum(Number(e.target.value))}
                className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black bg-white">
                {Array.from({ length: numClasses }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}반</option>)}
              </select>
            </label>
          </div>
          <label>
            <span className="text-[11px] font-semibold text-gray-500 block mb-1">과목(표시)명</span>
            <input value={subjectName} onChange={e => setSubjectName(e.target.value)}
              className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black" />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
          {cur ? (
            <button onClick={onDelete} className="text-[13px] text-red-500 hover:text-red-600">삭제</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
            <button onClick={() => onSave({ grade, classNum, subjectName })}
              className="h-9 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800">저장</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ClassPicker({ gradeConfigs, selectedClasses, onToggle, onSelectGrade, onDeselectGrade, onDeselectAll, onSelectAll }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // 트리거 라벨
  const summary = selectedClasses.length === 0
    ? '학급을 선택하세요'
    : selectedClasses.length <= 4
    ? selectedClasses.map(c => `${c.grade}-${c.classNum}`).join(', ')
    : `${selectedClasses.length}개 학급 선택됨`

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-9 px-3 min-w-[220px] border border-gray-300 rounded-sm bg-white text-[13px] hover:bg-gray-50"
      >
        <span className={selectedClasses.length === 0 ? 'text-gray-400' : 'text-gray-800'}>{summary}</span>
        <ChevronDown size={14} className="ml-auto text-gray-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 w-[420px] bg-white border border-gray-200 rounded-sm shadow-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-500">학급 선택 ({selectedClasses.length})</span>
            <div className="flex gap-1">
              <button onClick={onSelectAll} className="text-[11px] px-2 h-6 border border-gray-300 rounded-sm hover:bg-gray-50">전체 선택</button>
              <button onClick={onDeselectAll} className="text-[11px] px-2 h-6 border border-gray-300 rounded-sm hover:bg-gray-50">전체 해제</button>
            </div>
          </div>
          {[1,2,3,4,5,6].map(g => {
            const cfg = gradeConfigs.find(c => c.grade === g)
            if (!cfg || !cfg.num_classes) return null
            const allSelected = Array.from({ length: cfg.num_classes }).every((_, i) =>
              selectedClasses.some(c => c.grade === g && c.classNum === i + 1)
            )
            return (
              <div key={g} className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12px] font-semibold text-gray-700 w-[44px] flex-shrink-0">{g}학년</span>
                <button
                  onClick={() => allSelected ? onDeselectGrade(g) : onSelectGrade(g)}
                  className="text-[11px] px-2 h-6 border border-gray-300 rounded-sm text-gray-500 hover:bg-gray-50"
                >
                  {allSelected ? '학년 해제' : '학년 전체'}
                </button>
                {Array.from({ length: cfg.num_classes }, (_, i) => i + 1).map(cn => {
                  const sel = selectedClasses.some(c => c.grade === g && c.classNum === cn)
                  return (
                    <button
                      key={cn}
                      onClick={() => onToggle(g, cn)}
                      className={`text-[11px] px-2 h-6 rounded-sm border transition-colors ${
                        sel ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {cn}반
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function UnassignedStats({ teachers, subjects, timetableRows, filterClasses, placement }) {
  // 교사별 (과목, 학년-반)별 목표 vs 배정 시수
  const filterSet = filterClasses ? new Set(filterClasses.map(c => `${c.grade}-${c.classNum}`)) : null
  const rows = []
  for (const t of teachers) {
    for (const a of (t.teacher_assignments || [])) {
      if (filterSet && !filterSet.has(`${a.grade}-${a.class_num}`)) continue
      const target = a.weekly_hours || 0
      const scheduled = timetableRows.filter(r =>
        r.teacher_id === t.id &&
        r.subject_id === a.subject_id &&
        r.grade === a.grade &&
        r.class_num === a.class_num &&
        !r.is_unassigned
      ).length
      const deficit = target - scheduled  // 양수 = 미배정, 음수 = 과배정
      const subj = subjects.find(s => s.id === a.subject_id)
      rows.push({
        teacherCode: t.code,
        subjectName: subj?.name || '?',
        grade: a.grade,
        classNum: a.class_num,
        target,
        scheduled,
        deficit,
      })
    }
  }

  const deficitRows = rows.filter(r => r.deficit > 0).sort((a, b) => b.deficit - a.deficit || a.teacherCode.localeCompare(b.teacherCode))
  const surplusRows = rows.filter(r => r.deficit < 0).sort((a, b) => a.deficit - b.deficit || a.teacherCode.localeCompare(b.teacherCode))

  if (deficitRows.length === 0 && surplusRows.length === 0) return null

  const isClassView = filterClasses != null
  const isSingleClass = isClassView && filterClasses?.length === 1
  const hasBoth = deficitRows.length > 0 && surplusRows.length > 0

  const gridStyle = isSingleClass
    ? { gridTemplateColumns: '1fr 1fr 70px 70px 70px' }
    : { gridTemplateColumns: '1fr 1fr 110px 60px 60px 60px' }

  function renderTable(tableRows, type) {
    const isDeficit = type === 'deficit'
    const classSuffix = isSingleClass ? ` — ${filterClasses[0].grade}학년 ${filterClasses[0].classNum}반` : ''
    return (
      <div className={`bg-white border rounded-sm overflow-hidden ${hasBoth ? 'flex-1 min-w-0' : 'max-w-[540px]'} ${isDeficit ? 'border-red-200' : 'border-orange-200'}`}>
        <div className={`px-4 py-2.5 border-b text-[12px] font-semibold ${isDeficit ? 'bg-red-50 border-red-200 text-red-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
          {isDeficit ? '미배정 시수' : '과배정 시수'} ({tableRows.length}건){classSuffix}
        </div>
        <div className="grid bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500" style={gridStyle}>
          <div className="px-3 py-2 border-r border-gray-200">교사</div>
          <div className="px-3 py-2 border-r border-gray-200">과목</div>
          {!isSingleClass && <div className="px-3 py-2 border-r border-gray-200">학년 · 반</div>}
          <div className="px-3 py-2 border-r border-gray-200 text-center">목표</div>
          <div className="px-3 py-2 border-r border-gray-200 text-center">배정</div>
          <div className="px-3 py-2 text-center">{isDeficit ? '부족' : '초과'}</div>
        </div>
        {tableRows.map((r, i) => (
          <div key={i} className="grid border-b border-gray-100 last:border-b-0 text-[12px]" style={gridStyle}>
            <div className="px-3 py-2 border-r border-gray-100 font-semibold">{r.teacherCode}</div>
            <div className="px-3 py-2 border-r border-gray-100">{r.subjectName}</div>
            {!isSingleClass && <div className="px-3 py-2 border-r border-gray-100">{r.grade}학년 {r.classNum}반</div>}
            <div className="px-3 py-2 border-r border-gray-100 text-center text-gray-600">{r.target}h</div>
            <div className="px-3 py-2 border-r border-gray-100 text-center text-gray-600">{r.scheduled}h</div>
            <div className={`px-3 py-2 text-center font-bold ${isDeficit ? 'text-red-600' : 'text-orange-600'}`}>
              {isDeficit ? `−${r.deficit}h` : `+${Math.abs(r.deficit)}h`}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`${placement === 'top' ? 'mb-4' : ''} max-w-[1100px]`}>
      <div className={hasBoth ? 'flex gap-4 flex-wrap' : ''}>
        {deficitRows.length > 0 && renderTable(deficitRows, 'deficit')}
        {surplusRows.length > 0 && renderTable(surplusRows, 'surplus')}
      </div>
      {deficitRows.length > 0 && (
        <div className="mt-2 max-w-[760px] text-[11px] text-gray-500 bg-red-50/60 border border-red-100 rounded-sm px-3 py-2 leading-relaxed break-keep">
          <b className="text-red-600">부족 원인</b>: 해당 교사·학급이 요일별 수업이 몰려 빈 시간이 부족하거나, 특별실 사용 시간·과목 연속(하루 최대 시수) 제약에 막힌 경우입니다.
          <br /><b className="text-gray-700">해결 방법</b>: ① 전담 배정에서 교사 수를 늘리거나 담당을 조정 → ② 자동 생성 모달에서 과목 연속·하루 최대 시수 완화 → ③ 특별실 사용 불가 시간 축소 → ④ 위 미배정 학급 칸을 직접 클릭해 수동 배치.
        </div>
      )}
    </div>
  )
}

function ExternalUnassignedStats({ externalInstructors, gradeConfigs, timetableRows }) {
  const rows = []
  for (const inst of externalInstructors) {
    const hpc = Math.max(1, Math.floor(inst.hoursPerClass) || 1)
    const grades = (inst.grades || []).filter(g => gradeConfigs.some(x => x.grade === g))
    for (const g of grades) {
      const numClasses = gradeConfigs.find(gc => gc.grade === g)?.num_classes || 0
      for (let c = 1; c <= numClasses; c++) {
        const scheduled = timetableRows.filter(r =>
          r.is_external && r.external_id === inst.id && r.grade === g && r.class_num === c && !r.is_unassigned
        ).length
        const deficit = hpc - scheduled
        if (deficit > 0) {
          rows.push({ name: inst.name || '외부강사', subjectName: inst.subjectName || '', grade: g, classNum: c, target: hpc, scheduled, deficit })
        }
      }
    }
  }
  if (rows.length === 0) return null

  const gridStyle = { gridTemplateColumns: '1fr 1fr 110px 60px 60px 60px' }
  return (
    <div className="mb-4 max-w-[640px]">
      <div className="bg-white border border-red-200 rounded-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-red-200 bg-red-50 text-[12px] font-semibold text-red-700">
          외부강사 미배정 ({rows.length}건)
        </div>
        <div className="grid bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500" style={gridStyle}>
          <div className="px-3 py-2 border-r border-gray-200">강사</div>
          <div className="px-3 py-2 border-r border-gray-200">과목</div>
          <div className="px-3 py-2 border-r border-gray-200">학년 · 반</div>
          <div className="px-3 py-2 border-r border-gray-200 text-center">목표</div>
          <div className="px-3 py-2 border-r border-gray-200 text-center">배정</div>
          <div className="px-3 py-2 text-center">부족</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid border-b border-gray-100 last:border-b-0 text-[12px]" style={gridStyle}>
            <div className="px-3 py-2 border-r border-gray-100 font-semibold text-indigo-700">{r.name}</div>
            <div className="px-3 py-2 border-r border-gray-100">{r.subjectName}</div>
            <div className="px-3 py-2 border-r border-gray-100">{r.grade}학년 {r.classNum}반</div>
            <div className="px-3 py-2 border-r border-gray-100 text-center text-gray-600">{r.target}h</div>
            <div className="px-3 py-2 border-r border-gray-100 text-center text-gray-600">{r.scheduled}h</div>
            <div className="px-3 py-2 text-center font-bold text-red-600">−{r.deficit}h</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeacherTimetableGrid({ slots, totalSlots, gradeLunchSlot, gradeConfigs, subjects, timetableRows, teachers, rooms, compact, selectedCell, onCellClick, externalGrid }) {
  const DAY_LABELS = ['월', '화', '수', '목', '금']
  const DAY_FIELDS = ['periods_mon', 'periods_tue', 'periods_wed', 'periods_thu', 'periods_fri']

  // 점심 슬롯이거나 해당 학년의 교시 편제를 벗어난 슬롯인지 확인
  function isInvalidSlot(grade, day, slot) {
    if (!grade) return false
    const lunchSlot = gradeLunchSlot?.[grade] ?? -1
    if (lunchSlot !== -1 && slot === lunchSlot) return true
    const gc = gradeConfigs?.find(g => g.grade === grade)
    if (!gc) return false
    const periods = gc[DAY_FIELDS[day]] || 0
    // 점심 슬롯을 제외하고 몇 번째 교시인지 계산
    let validCount = 0
    for (let s = 0; s <= slot; s++) {
      if (s !== lunchSlot) validCount++
    }
    return validCount > periods
  }

  // 학기가 겹치는지: 연간(year)은 모두와 겹치고, 1학기·2학기는 서로 겹치지 않음
  const semOverlap = (a, b) => {
    const sa = a || 'year', sb = b || 'year'
    if (sa === 'year' || sb === 'year') return true
    return sa === sb
  }

  function getConflicts(cell, day, slot) {
    if (!cell || !timetableRows) return []
    // 같은 (학년·반·요일·교시)에 다른 수업(전담 또는 외부강사)이 있으면 충돌
    // 단, 서로 다른 학기(1학기·2학기)는 같은 시간에 놓여도 충돌 아님 (의도된 학기 짝배치)
    return timetableRows.filter(r =>
      !r.is_unassigned &&
      (r.teacher_id || r.is_external) &&
      r.grade === cell.grade &&
      r.class_num === cell.class_num &&
      r.day_of_week === day &&
      r.slot === slot &&
      r.id !== cell.id &&
      semOverlap(r.semester, cell.semester)
    )
  }

  return (
    <div className="border border-gray-200 rounded-sm overflow-hidden bg-white">
      <div className="flex bg-gray-50">
        <div className="w-[72px] flex-shrink-0 border-r border-gray-200 h-9 flex items-center justify-center text-[11px] font-semibold text-gray-500">교시</div>
        {DAY_LABELS.map(d => (
          <div key={d} className="flex-1 h-9 flex items-center justify-center border-r border-gray-200 last:border-r-0 text-[11px] font-semibold text-gray-500">{d}</div>
        ))}
      </div>
      {Array.from({ length: totalSlots }, (_, slot) => (
        <div key={slot} className={`flex border-t border-gray-100 ${compact ? 'h-[44px]' : 'h-[62px]'}`}>
          <div className={`w-[72px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-400 bg-gray-50`}>
            {slot + 1}교시
          </div>
          {Array.from({ length: 5 }, (_, day) => {
            const cell = slots?.[day]?.[slot]
            const subject = cell?.subject_id ? subjects?.find(s => s.id === cell.subject_id) : null
            const room = cell?.room_id ? rooms?.find(r => r.id === cell.room_id) : null
            const conflicts = getConflicts(cell, day, slot)
            const hasConflict = conflicts.length > 0
            const tooltipText = conflicts.map(c => {
              if (c.is_external) return `${c.subject_name || '외부강사'}(${c.external_name || '외부강사'})`
              const cs = subjects?.find(s => s.id === c.subject_id)
              const ct = teachers?.find(t => t.id === c.teacher_id)
              return `${cs?.name ?? '?'} (${ct?.code ?? '?'})`
            }).join(', ') + '와 겹침'

            const classesAtSlot = !cell
              ? (timetableRows || []).filter(r =>
                  r.day_of_week === day && r.slot === slot && r.teacher_id && !r.is_unassigned
                )
              : []
            const isSelected = selectedCell?.day === day && selectedCell?.slot === slot
            const invalidSlot = cell ? isInvalidSlot(cell.grade, day, slot) : false
            const isRed = hasConflict || invalidSlot
            const invalidTooltip = invalidSlot
              ? (gradeLunchSlot?.[cell?.grade] === slot ? '점심시간 슬롯입니다' : '해당 학년의 교시 편제를 벗어난 슬롯입니다')
              : ''

            return (
              <div
                key={day}
                onClick={() => onCellClick?.(day, slot, cell)}
                className={`relative group flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0 cursor-pointer transition-colors
                  ${isSelected ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : 'hover:bg-blue-50'}`}
              >
                {cell?.is_external ? (
                  <>
                    <span className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-semibold ${isRed ? 'text-red-600' : 'text-indigo-700'}`}>
                      {cell.subject_name || '외부강사'}
                    </span>
                    <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} ${isRed ? 'text-red-400' : 'text-indigo-400'}`}>
                      {cell.label}
                    </span>
                    {room && <span className={`text-[10px] ${isRed ? 'text-red-400' : 'text-indigo-400'}`}>{room.name}</span>}
                    {isRed && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 hidden group-hover:block bg-gray-900 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap">
                        {invalidSlot ? invalidTooltip : tooltipText}
                      </div>
                    )}
                  </>
                ) : cell ? (
                  <>
                    <span className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-semibold ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
                      {subject?.name ?? '—'}
                    </span>
                    <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} ${isRed ? 'text-red-400' : 'text-gray-400'}`}>
                      {cell.label}
                    </span>
                    {room && (
                      <span className={`text-[10px] ${isRed ? 'text-red-400' : 'text-blue-500'}`}>{room.name}</span>
                    )}
                    {isRed && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 hidden group-hover:block bg-gray-900 text-white text-[11px] rounded px-2 py-1 whitespace-nowrap">
                        {invalidSlot ? invalidTooltip : tooltipText}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[12px] text-gray-200 group-hover:hidden">—</span>
                    {classesAtSlot.length > 0 ? (
                      <div className="hidden group-hover:flex flex-col items-center gap-0.5 w-full px-1">
                        {classesAtSlot.map(r => {
                          const subj = subjects?.find(s => s.id === r.subject_id)
                          return (
                            <span key={r.id} className="text-[10px] text-gray-500 leading-tight text-center">
                              {r.grade}학년 {r.class_num}반 {subj?.name ?? '?'}
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="hidden group-hover:block text-[12px] text-gray-300">—</span>
                    )}
                  </>
                )}
                {!isRed && (
                  <div className={`pointer-events-none absolute z-20 hidden group-hover:block bg-gray-800/85 text-white text-[11px] rounded px-2 py-1 w-max max-w-[190px] text-center leading-snug shadow-lg break-keep ${slot === 0 ? 'top-full mt-1' : 'bottom-full mb-1'} ${day === 0 ? 'left-0' : day === 4 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                    {cell
                      ? '클릭해 선택한 뒤 다른 칸을 클릭하면 두 수업이 서로 바뀝니다. 같은 칸을 다시 클릭하면 내용을 수정할 수 있어요.'
                      : '클릭하면 이 시간에 수업을 직접 입력할 수 있어요.'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function GenerateOptionsModal({ options, onChange, subjects, onConfirm, onClose }) {
  const subjectInfo = {}
  for (const s of subjects) {
    if (!subjectInfo[s.name]) subjectInfo[s.name] = { name: s.name, maxWeeklyHours: 0 }
    if (s.weekly_hours > subjectInfo[s.name].maxWeeklyHours) {
      subjectInfo[s.name].maxWeeklyHours = s.weekly_hours
    }
  }
  const uniqueSubjects = Object.values(subjectInfo)

  function updateSubject(name, field, value) {
    onChange({
      ...options,
      subjectSettings: {
        ...options.subjectSettings,
        [name]: { ...(options.subjectSettings[name] || { allow: false, maxCount: 2 }), [field]: value },
      },
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[520px] rounded-sm border border-gray-200 p-6">
        <h2 className="text-[16px] font-bold mb-4">시간표 자동 생성 설정</h2>

        <div className="mb-1 flex text-[11px] font-semibold text-gray-400">
          <div className="w-[100px]">과목</div>
          <div className="w-[110px] text-center">같은 요일 배정</div>
          <div className="flex-1 pl-4">
            하루 최대 수
            <span className="ml-1 text-gray-300 font-normal">(가능 시 연속 배치)</span>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-gray-100 mb-4">
          {uniqueSubjects.map(subj => {
            const settings = options.subjectSettings[subj.name] || { allow: false, maxCount: 2 }
            const maxButtons = Math.min(subj.maxWeeklyHours, 5)
            const buttons = []
            for (let i = 2; i <= maxButtons; i++) buttons.push(i)

            return (
              <div key={subj.name} className="flex items-center py-2.5 gap-3">
                <div className="w-[100px] text-[13px] font-semibold text-gray-800 truncate">{subj.name}</div>
                <div className="w-[110px] flex gap-1">
                  {[{ val: false, label: '불가' }, { val: true, label: '가능' }].map(opt => (
                    <button
                      key={String(opt.val)}
                      onClick={() => updateSubject(subj.name, 'allow', opt.val)}
                      className={`flex-1 h-7 rounded-sm text-[12px] font-semibold border transition-colors
                        ${settings.allow === opt.val ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                    >{opt.label}</button>
                  ))}
                </div>
                <div className="flex-1 pl-4 flex gap-1">
                  {buttons.map(n => (
                    <button
                      key={n}
                      onClick={() => settings.allow && updateSubject(subj.name, 'maxCount', n)}
                      disabled={!settings.allow}
                      className={`w-8 h-7 rounded-sm text-[12px] font-semibold border transition-colors
                        ${settings.allow && settings.maxCount === n ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-400 bg-white'}
                        ${!settings.allow ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    >{n}</button>
                  ))}
                  {buttons.length === 0 && <span className="text-[12px] text-gray-300 leading-7">—</span>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
          <button onClick={onConfirm} className="h-9 px-5 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800">생성</button>
        </div>
      </div>
    </div>
  )
}

function EditCellModal({ modal, teachers, subjects, gradeConfigs, rooms, grade, lunchConfig, onSave, onClose, onDelete, saving }) {
  const { day, slot, classLabel, teacherView, defaultTeacherId } = modal
  const DAY_LABELS = ['월', '화', '수', '목', '금']
  const needsGradeClass = teacherView && !modal.grade
  const teacherLocked = teacherView && !!defaultTeacherId
  // 학급별 보기: 학년·반이 사전 결정 + 교사는 과목 선택 시 자동 채워짐
  const classViewMode = !teacherView && !!grade
  // 교사별 보기에서 기존 셀 편집 시 학급 변경 가능 모드
  const showClassSelector = teacherView && !!modal.rowId && !!defaultTeacherId

  const [teacherId, setTeacherId] = useState(modal.current?.teacher_id || defaultTeacherId || '')
  const [subjectId, setSubjectId] = useState(modal.current?.subject_id || '')
  const [roomId, setRoomId] = useState(modal.current?.room_id || '')
  const initialGradeClass = (() => {
    if (grade) return { g: grade, c: 1 }
    if (teacherView && defaultTeacherId) {
      if (modal.grade && modal.classNum) return { g: modal.grade, c: modal.classNum }
      const t = teachers.find(x => x.id === defaultTeacherId)
      const first = (t?.teacher_assignments || [])[0]
      if (first) return { g: first.grade, c: first.class_num }
    }
    return { g: 1, c: 1 }
  })()
  const [formGrade, setFormGrade] = useState(initialGradeClass.g)
  const [formClass, setFormClass] = useState(initialGradeClass.c)

  const lockedTeacher = teacherLocked ? teachers.find(t => t.id === defaultTeacherId) : null
  const numClasses = gradeConfigs?.find(g => g.grade === formGrade)?.num_classes || 1
  const effectiveGrade = (needsGradeClass || showClassSelector) ? formGrade : grade
  const effectiveClass = (needsGradeClass || showClassSelector) ? formClass : modal.classNum

  // showClassSelector 모드: 선택된 과목 이름으로 이 교사 담당 학년·반 목록 파악
  // (같은 이름의 과목이 여러 학년에 있어도 하나로 묶어 처리)
  const selectedSubjectName = showClassSelector ? (subjects.find(s => s.id === subjectId)?.name ?? '') : null
  const assignsForSelectedSubject = (showClassSelector && selectedSubjectName && lockedTeacher)
    ? (lockedTeacher.teacher_assignments || []).filter(a =>
        subjects.find(s => s.id === a.subject_id)?.name === selectedSubjectName
      )
    : []
  const allowedGradesForSubject = [...new Set(assignsForSelectedSubject.map(a => a.grade))].sort((a, b) => a - b)
  const allowedClassesForSubject = [...new Set(assignsForSelectedSubject.filter(a => a.grade === formGrade).map(a => a.class_num))].sort((a, b) => a - b)

  // 허용 과목 산정
  let allowedSubjects
  if (lockedTeacher && showClassSelector) {
    // 교사가 담당하는 모든 과목 — 과목명 기준으로 중복 제거 (3학년 영어·6학년 영어 → 영어 하나)
    // 현재 셀의 subject_id를 우선 대표로 선택해야 select value가 일치함
    const assigns = lockedTeacher.teacher_assignments || []
    const seenNames = new Set()
    const sorted = [...subjects].sort((a, b) => {
      if (a.id === subjectId) return -1
      if (b.id === subjectId) return 1
      return 0
    })
    allowedSubjects = sorted.filter(s => {
      if (seenNames.has(s.name)) return false
      if (assigns.some(a => a.subject_id === s.id)) { seenNames.add(s.name); return true }
      return false
    })
  } else if (lockedTeacher) {
    const assigns = lockedTeacher.teacher_assignments || []
    allowedSubjects = subjects.filter(s =>
      s.grade === effectiveGrade &&
      assigns.some(a => a.subject_id === s.id && a.grade === s.grade && a.class_num === effectiveClass)
    )
  } else if (classViewMode) {
    allowedSubjects = subjects.filter(s =>
      s.grade === effectiveGrade &&
      teachers.some(t =>
        (t.teacher_assignments || []).some(a =>
          a.subject_id === s.id && a.grade === effectiveGrade && a.class_num === effectiveClass
        )
      )
    )
  } else {
    allowedSubjects = subjects.filter(s => s.grade === effectiveGrade)
  }

  // (subject, grade, class) → 담당 교사 ID
  function findTeacherForSubject(sid) {
    if (!sid) return ''
    const t = teachers.find(t =>
      (t.teacher_assignments || []).some(a =>
        a.subject_id === sid && a.grade === effectiveGrade && a.class_num === effectiveClass
      )
    )
    return t?.id || ''
  }

  const autoTeacher = classViewMode && teacherId ? teachers.find(t => t.id === teacherId) : null

  // 잠긴 교사 모드(빈 셀)의 학년·반 옵션
  const allowedGrades = lockedTeacher
    ? [...new Set((lockedTeacher.teacher_assignments || []).map(a => a.grade))].sort((a, b) => a - b)
    : [1, 2, 3, 4, 5, 6]
  const allowedClasses = lockedTeacher
    ? [...new Set((lockedTeacher.teacher_assignments || []).filter(a => a.grade === formGrade).map(a => a.class_num))].sort((a, b) => a - b)
    : Array.from({ length: numClasses }, (_, i) => i + 1)

  // 선택된 과목·교사에 사용 가능한 특별실 목록
  const selectedSubject = subjects.find(s => s.id === subjectId)
  const eligibleRooms = (rooms || []).filter(r => {
    if (!selectedSubject) return false
    if (!r.subjectNames?.includes(selectedSubject.name)) return false
    if (Array.isArray(r.teacherIds) && r.teacherIds.length > 0 && teacherId) {
      if (!r.teacherIds.includes(teacherId)) return false
    }
    return true
  })

  function handleGradeChange(g) {
    setFormGrade(g)
    setFormClass(1)
    setSubjectId('')
    setRoomId('')
  }

  function handleSubjectChange(sid) {
    setSubjectId(sid)
    setRoomId('')
    if (classViewMode) {
      setTeacherId(findTeacherForSubject(sid))
    }
    // showClassSelector 모드: 과목 변경 시 학년·반을 해당 과목명 담당 학급으로 자동 조정
    if (showClassSelector && sid && lockedTeacher) {
      const name = subjects.find(s => s.id === sid)?.name
      const assigns = name
        ? (lockedTeacher.teacher_assignments || []).filter(a => subjects.find(s => s.id === a.subject_id)?.name === name)
        : []
      const grades = [...new Set(assigns.map(a => a.grade))].sort((a, b) => a - b)
      const newGrade = grades.includes(formGrade) ? formGrade : (grades[0] ?? formGrade)
      // 새 학년에 맞는 subject_id로 교체
      const subjForGrade = subjects.find(s => s.name === name && assigns.some(a => a.subject_id === s.id && a.grade === newGrade))
      if (subjForGrade && subjForGrade.id !== sid) setSubjectId(subjForGrade.id)
      const classes = assigns.filter(a => a.grade === newGrade).map(a => a.class_num).sort((a, b) => a - b)
      const newClass = classes.includes(formClass) ? formClass : (classes[0] ?? formClass)
      setFormGrade(newGrade)
      setFormClass(newClass)
    }
  }

  // 점심시간 충돌 감지 (분리 점심 운영 학교에서 해당 학년의 점심 교시와 겹치면 경고)
  const lunchConflict = (() => {
    if (!lunchConfig?.split_lunch) return false
    const targetGrade = effectiveGrade
    for (const group of (lunchConfig.lunch_groups || [])) {
      if (group.grades?.includes(targetGrade) && group.slot === slot) return true
    }
    return false
  })()

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[400px] rounded-sm border border-gray-200 p-6">
        <h2 className={`text-[16px] font-bold mb-1 ${lunchConflict ? 'text-red-600' : ''}`}>{DAY_LABELS[day]}요일 {slot + 1}교시 편집</h2>
        {lunchConflict && (
          <p className="text-[12px] text-red-500 font-semibold mb-2">⚠ {effectiveGrade}학년 점심시간과 겹칩니다</p>
        )}
        {classLabel && !showClassSelector && <p className="text-[12px] text-gray-400 mb-4">{classLabel}</p>}
        {lockedTeacher && (
          <p className="text-[12px] text-gray-500 mb-4">
            교사: <span className="font-semibold text-gray-800">{lockedTeacher.code}</span>
          </p>
        )}
        <div className="flex flex-col gap-3 mb-5">
          {needsGradeClass && (
            <>
              <div>
                <label className="text-[12px] font-semibold text-gray-600 block mb-1">학년</label>
                <select
                  value={formGrade}
                  onChange={e => handleGradeChange(Number(e.target.value))}
                  className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
                >
                  {allowedGrades.map(g => <option key={g} value={g}>{g}학년</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-gray-600 block mb-1">반</label>
                <select
                  value={formClass}
                  onChange={e => { setFormClass(Number(e.target.value)); setSubjectId(''); setRoomId('') }}
                  className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
                >
                  {allowedClasses.map(c => <option key={c} value={c}>{c}반</option>)}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="text-[12px] font-semibold text-gray-600 block mb-1">과목</label>
            <select
              value={subjectId}
              onChange={e => handleSubjectChange(e.target.value)}
              className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
            >
              <option value="" disabled>과목 선택</option>
              {allowedSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {/* 교사별 보기 기존 셀 편집: 과목 선택 후 담당 학급 드롭다운 */}
          {showClassSelector && subjectId && (
            <>
              {allowedGradesForSubject.length > 1 && (
                <div>
                  <label className="text-[12px] font-semibold text-gray-600 block mb-1">학년</label>
                  <select
                    value={formGrade}
                    onChange={e => {
                      const g = Number(e.target.value)
                      const classes = assignsForSelectedSubject.filter(a => a.grade === g).map(a => a.class_num).sort((a, b) => a - b)
                      // 새 학년에 맞는 subject_id로 교체 (3학년 영어 → 6학년 영어)
                      const subjForGrade = subjects.find(s => s.name === selectedSubjectName && s.grade === g &&
                        assignsForSelectedSubject.some(a => a.subject_id === s.id && a.grade === g))
                      if (subjForGrade) setSubjectId(subjForGrade.id)
                      setFormGrade(g)
                      setFormClass(classes[0] ?? 1)
                    }}
                    className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
                  >
                    {allowedGradesForSubject.map(g => <option key={g} value={g}>{g}학년</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[12px] font-semibold text-gray-600 block mb-1">학급</label>
                <select
                  value={formClass}
                  onChange={e => setFormClass(Number(e.target.value))}
                  className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
                >
                  {allowedClassesForSubject.map(c => <option key={c} value={c}>{formGrade}학년 {c}반</option>)}
                </select>
              </div>
            </>
          )}
          {classViewMode ? (
            subjectId && (
              <div>
                <label className="text-[12px] font-semibold text-gray-600 block mb-1">교사 (자동)</label>
                <div className="w-full h-9 px-2 border border-gray-200 rounded-sm text-[13px] bg-gray-50 flex items-center text-gray-700">
                  {autoTeacher?.code || '배정된 교사 없음'}
                </div>
              </div>
            )
          ) : (
            !teacherLocked && (
              <div>
                <label className="text-[12px] font-semibold text-gray-600 block mb-1">교사</label>
                <select
                  value={teacherId}
                  onChange={e => setTeacherId(e.target.value)}
                  className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
                >
                  <option value="">없음 (미배정)</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
                </select>
              </div>
            )
          )}
          {selectedSubject && (
            <div>
              <label className="text-[12px] font-semibold text-gray-600 block mb-1">특별실</label>
              <select
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                className="w-full h-9 px-2 border border-gray-300 rounded-sm text-[13px] outline-none bg-white"
              >
                <option value="">없음 (일반 교실)</option>
                {eligibleRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {eligibleRooms.length === 0 && (
                <p className="text-[11px] text-gray-400 mt-1">이 과목·교사에 등록된 특별실이 없습니다</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          {modal.rowId ? (
            <button onClick={onDelete} className="text-[13px] text-red-500 hover:text-red-600">삭제</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50">취소</button>
            <button
              onClick={() => onSave(teacherId, subjectId, (needsGradeClass || showClassSelector) ? formGrade : null, (needsGradeClass || showClassSelector) ? formClass : null, roomId || null)}
              disabled={saving}
              className="h-9 px-4 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
