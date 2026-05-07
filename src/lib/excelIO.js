import * as XLSX from 'xlsx'
import { initialState } from './storage'

export function exportFullWorkbook(state) {
  const wb = XLSX.utils.book_new()

  // 시트1: 학교설정
  const setupRows = [['학교명', state.schoolName], ['']]
  setupRows.push(['학년', '학급수', '월', '화', '수', '목', '금'])
  for (const gc of state.gradeConfigs) {
    setupRows.push([gc.grade, gc.num_classes, gc.periods_mon, gc.periods_tue, gc.periods_wed, gc.periods_thu, gc.periods_fri])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(setupRows), '학교설정')

  // 시트2: 점심설정
  const lunchRows = [['분리점심', state.lunchConfig.split_lunch ? 'Y' : 'N'], ['']]
  lunchRows.push(['학년', '점심슬롯'])
  for (const g of (state.lunchConfig.lunch_groups || [])) {
    for (const grade of g.grades) {
      lunchRows.push([grade, g.slot])
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lunchRows), '점심설정')

  // 시트3: 과목설정
  const subjectRows = [['ID', '학년', '과목명', '주당시수', '구분']]
  for (const s of state.subjects) {
    subjectRows.push([s.id, s.grade, s.name, s.weekly_hours, s.is_major ? '주요' : '일반'])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(subjectRows), '과목설정')

  // 시트3-A/B/C: 안별 과목설정
  for (const plan of (state.subjectPlans?.plans || [])) {
    const rows = [['ID', '학년', '과목명', '주당시수', '구분']]
    for (const s of plan.subjects) {
      rows.push([s.id, s.grade, s.name, s.weekly_hours, s.is_major ? '주요' : '일반'])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `과목설정_${plan.name}`)
  }

  // 시트3-meta: 과목안메타
  const metaRows = [
    ['키', '값'],
    ['activeTabId', state.subjectPlans?.activeTabId || 'plan1'],
    ['appliedPlanId', state.subjectPlans?.appliedPlanId || ''],
    ['appliedAt', state.subjectPlans?.appliedAt || ''],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), '과목안메타')

  // 시트4: 교사목록
  const teacherRows = [['ID', '교사코드']]
  for (const t of state.teachers) {
    teacherRows.push([t.id, t.code])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(teacherRows), '교사목록')

  // 시트5: 전담배정
  const assignRows = [['교사ID', '교사코드', '과목ID', '과목명', '학년', '반', '주당시수']]
  for (const t of state.teachers) {
    for (const a of (t.teacher_assignments || [])) {
      const subj = state.subjects.find(s => s.id === a.subject_id)
      assignRows.push([t.id, t.code, a.subject_id, subj?.name || '', a.grade, a.class_num, a.weekly_hours])
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(assignRows), '전담배정')

  // 시트6: 특별실
  const roomRows = [['ID', '특별실명', '사용과목']]
  for (const r of state.rooms) {
    roomRows.push([r.id, r.name, (r.subjectNames || []).join(',')])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(roomRows), '특별실')

  // 시트7: 특별실차단
  const blockedRows = [['특별실ID', '특별실명', '요일(0=월)', '교시']]
  for (const b of state.roomBlockedSlots) {
    const room = state.rooms.find(r => r.id === b.room_id)
    blockedRows.push([b.room_id, room?.name || '', b.day_of_week, b.slot])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(blockedRows), '특별실차단')

  // 시트8: 시간표
  const ttRows = [['학년', '반', '요일(0=월)', '교시', '교사ID', '교사코드', '과목ID', '과목명', '미배정']]
  for (const slot of state.timetableSlots) {
    const teacher = state.teachers.find(t => t.id === slot.teacher_id)
    const subj = state.subjects.find(s => s.id === slot.subject_id)
    ttRows.push([slot.grade, slot.class_num, slot.day_of_week, slot.slot, slot.teacher_id, teacher?.code || '', slot.subject_id, subj?.name || '', slot.is_unassigned ? 'Y' : 'N'])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ttRows), '시간표')

  // 시트9: 특별실시간표
  const rtRows = [['특별실ID', '특별실명', '학년', '반', '요일(0=월)', '교시']]
  for (const slot of state.roomTimetableSlots) {
    const room = state.rooms.find(r => r.id === slot.room_id)
    rtRows.push([slot.room_id, room?.name || '', slot.grade, slot.class_num, slot.day_of_week, slot.slot])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rtRows), '특별실시간표')

  XLSX.writeFile(wb, `시간표_${state.schoolName || '학교'}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export async function importFullWorkbook(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  function getSheet(name) {
    const ws = wb.Sheets[name]
    if (!ws) return []
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  }

  const state = { ...initialState }

  // 학교설정
  const setupRows = getSheet('학교설정')
  if (setupRows[0]?.[1] !== undefined) state.schoolName = String(setupRows[0][1])
  const gradeRows = setupRows.slice(3)
  if (gradeRows.length > 0) {
    state.gradeConfigs = gradeRows
      .filter(r => r[0])
      .map(r => ({
        grade: Number(r[0]),
        num_classes: Number(r[1]) || 4,
        periods_mon: Number(r[2]) || 5,
        periods_tue: Number(r[3]) || 5,
        periods_wed: Number(r[4]) || 5,
        periods_thu: Number(r[5]) || 5,
        periods_fri: Number(r[6]) || 4,
      }))
  }

  // 점심설정
  const lunchRows = getSheet('점심설정')
  const splitLunch = lunchRows[0]?.[1] === 'Y'
  const lunchGroups = []
  lunchRows.slice(3).filter(r => r[0]).forEach(r => {
    const grade = Number(r[0])
    const slot = Number(r[1])
    const existing = lunchGroups.find(g => g.slot === slot)
    if (existing) existing.grades.push(grade)
    else lunchGroups.push({ slot, grades: [grade] })
  })
  state.lunchConfig = { split_lunch: splitLunch, lunch_groups: lunchGroups }

  // 과목설정
  const subjectRows = getSheet('과목설정').slice(1).filter(r => r[0])
  state.subjects = subjectRows.map(r => ({
    id: String(r[0]) || crypto.randomUUID(),
    grade: Number(r[1]),
    name: String(r[2]),
    weekly_hours: Number(r[3]) || 2,
    is_major: r[4] === '주요',
  }))

  // subjectPlans: 안별 과목설정 + 메타
  function readPlanSheet(planName) {
    const rows = getSheet(`과목설정_${planName}`).slice(1).filter(r => r[0])
    return rows.map(r => ({
      id: String(r[0]) || crypto.randomUUID(),
      grade: Number(r[1]),
      name: String(r[2]),
      weekly_hours: Number(r[3]) || 2,
      is_major: r[4] === '주요',
    }))
  }
  const planNames = [
    { id: 'plan1', name: 'A안' },
    { id: 'plan2', name: 'B안' },
    { id: 'plan3', name: 'C안' },
  ]
  const hasPlanSheets = planNames.some(({ name }) => wb.Sheets[`과목설정_${name}`])
  if (hasPlanSheets) {
    const metaRows = getSheet('과목안메타').slice(1).filter(r => r[0])
    const meta = Object.fromEntries(metaRows.map(r => [String(r[0]), String(r[1] ?? '')]))
    state.subjectPlans = {
      plans: planNames.map(({ id, name }) => ({ id, name, subjects: readPlanSheet(name) })),
      activeTabId: meta.activeTabId || 'plan1',
      appliedPlanId: meta.appliedPlanId || null,
      appliedAt: meta.appliedAt || null,
    }
  } else {
    // Legacy import — clone subjects to plan1
    const cloneSubject = s => ({ ...s })
    state.subjectPlans = {
      plans: [
        { id: 'plan1', name: 'A안', subjects: state.subjects.map(cloneSubject) },
        { id: 'plan2', name: 'B안', subjects: [] },
        { id: 'plan3', name: 'C안', subjects: [] },
      ],
      activeTabId: 'plan1',
      appliedPlanId: state.subjects.length > 0 ? 'plan1' : null,
      appliedAt: null,
    }
  }

  // 교사목록 + 전담배정
  const teacherRows = getSheet('교사목록').slice(1).filter(r => r[0])
  const assignRows = getSheet('전담배정').slice(1).filter(r => r[0])
  state.teachers = teacherRows.map(r => {
    const tid = String(r[0])
    const assignments = assignRows
      .filter(a => String(a[0]) === tid)
      .map(a => ({
        id: crypto.randomUUID(),
        subject_id: String(a[2]),
        grade: Number(a[4]),
        class_num: Number(a[5]),
        weekly_hours: Number(a[6]) || 2,
      }))
    return { id: tid, code: String(r[1]), teacher_assignments: assignments }
  })

  // 특별실
  const roomRows = getSheet('특별실').slice(1).filter(r => r[0])
  state.rooms = roomRows.map(r => ({
    id: String(r[0]),
    name: String(r[1]),
    subjectNames: r[2] ? String(r[2]).split(',').filter(Boolean) : [],
  }))

  // 특별실차단
  const blockedRows = getSheet('특별실차단').slice(1).filter(r => r[0])
  state.roomBlockedSlots = blockedRows.map(r => ({
    id: crypto.randomUUID(),
    room_id: String(r[0]),
    day_of_week: Number(r[2]),
    slot: Number(r[3]),
  }))

  // 시간표
  const ttRows = getSheet('시간표').slice(1).filter(r => r[0] !== '')
  state.timetableSlots = ttRows.map(r => ({
    id: crypto.randomUUID(),
    grade: Number(r[0]),
    class_num: Number(r[1]),
    day_of_week: Number(r[2]),
    slot: Number(r[3]),
    teacher_id: String(r[4]),
    subject_id: String(r[6]),
    is_unassigned: r[8] === 'Y',
  }))

  // 특별실시간표
  const rtRows = getSheet('특별실시간표').slice(1).filter(r => r[0])
  state.roomTimetableSlots = rtRows.map(r => ({
    id: crypto.randomUUID(),
    room_id: String(r[0]),
    grade: Number(r[2]),
    class_num: Number(r[3]),
    day_of_week: Number(r[4]),
    slot: Number(r[5]),
  }))

  // 전담배정 결과 복원: teacher_assignments → assignmentResult
  // 불러오기 후 전담배정 탭에서 배정 결과가 표시되도록 재구성
  const reconstructedAssignments = []
  for (const teacher of state.teachers) {
    const grouped = {}
    for (const a of (teacher.teacher_assignments || [])) {
      const key = `${a.subject_id}_${a.grade}`
      if (!grouped[key]) grouped[key] = { subjectId: a.subject_id, grade: a.grade, classNums: [], hoursPerClass: a.weekly_hours }
      grouped[key].classNums.push(a.class_num)
    }
    for (const g of Object.values(grouped)) {
      const subj = state.subjects.find(s => s.id === g.subjectId)
      reconstructedAssignments.push({
        teacherId: teacher.id,
        teacherCode: teacher.code,
        subjectId: g.subjectId,
        subjectName: subj?.name || '',
        grade: g.grade,
        classNums: g.classNums.sort((a, b) => a - b),
        weeklyHours: g.hoursPerClass * g.classNums.length,
        hoursPerClass: g.hoursPerClass,
        isManual: true,
      })
    }
  }

  if (reconstructedAssignments.length > 0) {
    const totalDedicated = state.subjects.reduce((sum, s) => {
      const gc = state.gradeConfigs.find(g => g.grade === s.grade)
      return sum + (gc ? s.weekly_hours * gc.num_classes : 0)
    }, 0)
    const targetHours = state.teachers.length ? Math.round(totalDedicated / state.teachers.length) : 0
    state.assignmentResult = {
      result: {
        assignments: reconstructedAssignments,
        warnings: [],
        gradeSummary: state.gradeConfigs.map(gc => {
          const weeklyTotal = gc.periods_mon + gc.periods_tue + gc.periods_wed + gc.periods_thu + gc.periods_fri
          const dedicatedHours = state.subjects.filter(s => s.grade === gc.grade).reduce((s2, s) => s2 + s.weekly_hours, 0)
          return { grade: gc.grade, dedicatedHours, homeRoomHours: weeklyTotal - dedicatedHours }
        }),
        teacherSummary: state.teachers.map(t => ({
          teacherId: t.id,
          teacherCode: t.code,
          totalHours: (t.teacher_assignments || []).reduce((s, a) => s + a.weekly_hours, 0),
          targetHours,
        })),
      },
      edited: null,
    }
  }

  return state
}
