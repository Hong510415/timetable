import * as XLSX from 'xlsx'

const DAYS = ['월', '화', '수', '목', '금']

export function exportTimetableByClass(slots, gradeConfigs, teachers, subjects, lunchConfig) {
  const wb = XLSX.utils.book_new()
  const splitLunch = lunchConfig?.split_lunch || false
  const totalSlots = splitLunch ? 7 : 6
  const gradeLunchSlot = {}
  if (splitLunch) {
    for (const g of (lunchConfig.lunch_groups || [])) {
      for (const grade of g.grades) gradeLunchSlot[grade] = g.slot
    }
  }

  for (const gc of gradeConfigs) {
    for (let cls = 1; cls <= gc.num_classes; cls++) {
      const rows = [['교시', '월', '화', '수', '목', '금']]
      for (let slot = 0; slot < totalSlots; slot++) {
        const lunchSlot = gradeLunchSlot[gc.grade]
        const isLunch = lunchSlot === slot
        const label = isLunch ? '점심' : `${slot + 1}교시`
        const row = [label]
        for (let day = 0; day < 5; day++) {
          if (isLunch) { row.push('점심시간'); continue }
          const cell = slots.find(s => s.grade === gc.grade && s.class_num === cls && s.day === day && s.slot === slot)
          const teacher = cell?.teacher_id ? teachers.find(t => t.id === cell.teacher_id) : null
          const subject = cell?.subject_id ? subjects.find(s => s.id === cell.subject_id) : null
          row.push(teacher && subject ? `${subject.name}(${teacher.code})` : '')
        }
        rows.push(row)
      }
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(wb, ws, `${gc.grade}학년${cls}반`)
    }
  }
  XLSX.writeFile(wb, '전담시간표.xlsx')
}

export function exportTimetableByTeacher(slots, teachers, subjects, lunchConfig) {
  const wb = XLSX.utils.book_new()
  const totalSlots = lunchConfig?.split_lunch ? 7 : 6

  for (const teacher of teachers) {
    const rows = [['교시', '월', '화', '수', '목', '금']]
    for (let slot = 0; slot < totalSlots; slot++) {
      const row = [`${slot + 1}교시`]
      for (let day = 0; day < 5; day++) {
        const cell = slots.find(s => s.teacher_id === teacher.id && s.day === day && s.slot === slot)
        const subject = cell?.subject_id ? subjects.find(s => s.id === cell.subject_id) : null
        row.push(subject ? `${cell.grade}학년${cell.class_num}반 ${subject.name}` : '')
      }
      rows.push(row)
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, teacher.code)
  }
  XLSX.writeFile(wb, '교사별시간표.xlsx')
}

export function exportRoomTimetable(slots, rooms) {
  const wb = XLSX.utils.book_new()
  for (const room of rooms) {
    const rows = [['교시', '월', '화', '수', '목', '금']]
    for (let slot = 0; slot < 6; slot++) {
      const row = [`${slot + 1}교시`]
      for (let day = 0; day < 5; day++) {
        const cell = slots.find(s => s.room_id === room.id && s.day === day && s.slot === slot)
        if (!cell) { row.push(''); continue }
        row.push(cell.assignment_type === 'dedicated'
          ? `전담(${cell.grade}학년${cell.class_num}반)`
          : `${cell.grade}학년${cell.class_num}반`)
      }
      rows.push(row)
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, room.name)
  }
  XLSX.writeFile(wb, '특별실시간표.xlsx')
}
