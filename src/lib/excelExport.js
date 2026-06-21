import * as XLSX from 'xlsx'

const DAYS = ['월', '화', '수', '목', '금']

function getSlotLabel(slot, lunchSlot) {
  if (lunchSlot !== undefined && slot === lunchSlot) return '점심'
  if (lunchSlot !== undefined && slot > lunchSlot) return `${slot}교시`
  return `${slot + 1}교시`
}

export function exportTimetableByClass(slots, gradeConfigs, teachers, subjects, gradeLunchSlot, totalSlots) {
  const wb = XLSX.utils.book_new()

  for (const gc of gradeConfigs) {
    const lunchSlot = gradeLunchSlot?.[gc.grade]

    for (let cls = 1; cls <= gc.num_classes; cls++) {
      const rows = [['교시', ...DAYS]]

      for (let slot = 0; slot < totalSlots; slot++) {
        const isLunch = lunchSlot !== undefined && lunchSlot === slot
        const label = getSlotLabel(slot, lunchSlot)
        const row = [label]

        for (let day = 0; day < 5; day++) {
          if (isLunch) { row.push('점심시간'); continue }
          const cell = slots.find(s =>
            s.grade === gc.grade && s.class_num === cls &&
            s.day_of_week === day && s.slot === slot
          )
          if (cell?.is_external) {
            row.push(`${cell.subject_name || '외부강사'}(${cell.external_name || '외부강사'})`)
            continue
          }
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

  XLSX.writeFile(wb, '학급별전담시간표.xlsx')
}

export function exportTimetableByTeacher(slots, teachers, subjects, gradeConfigs, gradeLunchSlot, totalSlots, externalInstructors = []) {
  const wb = XLSX.utils.book_new()

  for (const teacher of teachers) {
    const rows = [['교시', ...DAYS]]

    for (let slot = 0; slot < totalSlots; slot++) {
      const row = [`${slot + 1}교시`]
      for (let day = 0; day < 5; day++) {
        const cell = slots.find(s =>
          s.teacher_id === teacher.id &&
          s.day_of_week === day && s.slot === slot
        )
        const subject = cell?.subject_id ? subjects.find(s => s.id === cell.subject_id) : null
        row.push(subject ? `${cell.grade}학년${cell.class_num}반 ${subject.name}` : '')
      }
      rows.push(row)
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, teacher.code)
  }

  // 외부강사 시트 (강사별)
  for (const inst of externalInstructors) {
    const instRows = slots.filter(s => s.is_external && s.external_id === inst.id)
    if (instRows.length === 0) continue
    const rows = [['교시', ...DAYS]]
    for (let slot = 0; slot < totalSlots; slot++) {
      const row = [`${slot + 1}교시`]
      for (let day = 0; day < 5; day++) {
        const cell = instRows.find(s => s.day_of_week === day && s.slot === slot)
        row.push(cell ? `${cell.grade}학년${cell.class_num}반 ${cell.subject_name || ''}` : '')
      }
      rows.push(row)
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    const sheetName = `(외부)${inst.name || '외부강사'}`.slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  XLSX.writeFile(wb, '교사별전담시간표.xlsx')
}

export function exportRoomTimetable(rooms, roomSlots, gradeConfigs, gradeLunchSlot, totalSlots) {
  const wb = XLSX.utils.book_new()
  const slots = totalSlots || 6

  for (const room of rooms) {
    const rows = [['교시', ...DAYS]]
    for (let slot = 0; slot < slots; slot++) {
      const row = [`${slot + 1}교시`]
      for (let day = 0; day < 5; day++) {
        const cell = roomSlots.find(s => s.room_id === room.id && s.day_of_week === day && s.slot === slot)
        row.push(cell ? `${cell.grade}학년${cell.class_num}반` : '')
      }
      rows.push(row)
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, room.name)
  }
  XLSX.writeFile(wb, '특별실시간표.xlsx')
}
