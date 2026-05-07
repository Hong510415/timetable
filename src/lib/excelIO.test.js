import { describe, it, expect, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { initialState } from './storage'

// XLSX.writeFile is non-configurable on the namespace, so we mock the xlsx
// module to wrap writeFile with a capturable proxy. The mock factory
// replaces only writeFile and forwards everything else.
let capturedWorkbook = null
vi.mock('xlsx', async () => {
  const actual = await vi.importActual('xlsx')
  return {
    ...actual,
    writeFile: (wb) => { capturedWorkbook = wb },
  }
})

const { exportFullWorkbook, importFullWorkbook } = await import('./excelIO')

function exportToBuffer(state) {
  capturedWorkbook = null
  exportFullWorkbook(state)
  return XLSX.write(capturedWorkbook, { type: 'array', bookType: 'xlsx' })
}

function bufferToFile(buffer, filename = 'test.xlsx') {
  // jsdom's File does not implement arrayBuffer(); provide a minimal stub.
  return {
    name: filename,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    arrayBuffer: async () => buffer,
  }
}

describe('excelIO round-trip — subjectPlans', () => {
  it('preserves all 3 plans and meta on export+import', async () => {
    const state = {
      ...initialState,
      schoolName: 'TEST',
      subjects: [{ id: 'live', grade: 1, name: '영어', weekly_hours: 3, is_major: true }],
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [{ id: 'a1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
          { id: 'plan2', name: 'B안', subjects: [{ id: 'b1', grade: 2, name: '음악', weekly_hours: 2, is_major: false }] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan2',
        appliedPlanId: 'plan1',
        appliedAt: '2026-05-07T12:00:00.000Z',
      },
    }
    const buffer = exportToBuffer(state)
    const imported = await importFullWorkbook(bufferToFile(buffer))

    expect(imported.subjectPlans.plans[0].subjects).toHaveLength(1)
    expect(imported.subjectPlans.plans[0].subjects[0].name).toBe('영어')
    expect(imported.subjectPlans.plans[1].subjects).toHaveLength(1)
    expect(imported.subjectPlans.plans[1].subjects[0].name).toBe('음악')
    expect(imported.subjectPlans.plans[2].subjects).toEqual([])
    expect(imported.subjectPlans.activeTabId).toBe('plan2')
    expect(imported.subjectPlans.appliedPlanId).toBe('plan1')
    expect(imported.subjectPlans.appliedAt).toBe('2026-05-07T12:00:00.000Z')
  })

  it('migrates legacy import (no plan sheets) — copies subjects to plan1', async () => {
    // Build a workbook that lacks subjectPlans sheets
    const state = { ...initialState, schoolName: 'OLD', subjects: [
      { id: 'x', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
    ]}
    // Use exportFullWorkbook to get a normal workbook, then strip the plan sheets
    const buffer = exportToBuffer(state)
    const wb = XLSX.read(buffer, { type: 'array' })
    delete wb.Sheets['과목설정_A안']
    delete wb.Sheets['과목설정_B안']
    delete wb.Sheets['과목설정_C안']
    delete wb.Sheets['과목안메타']
    wb.SheetNames = wb.SheetNames.filter(n => !n.startsWith('과목설정_') && n !== '과목안메타')
    const stripped = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

    const imported = await importFullWorkbook(bufferToFile(stripped))
    expect(imported.subjectPlans.plans[0].subjects).toHaveLength(1)
    expect(imported.subjectPlans.plans[0].subjects[0].name).toBe('영어')
    expect(imported.subjectPlans.plans[1].subjects).toEqual([])
    expect(imported.subjectPlans.plans[2].subjects).toEqual([])
    expect(imported.subjectPlans.appliedPlanId).toBe('plan1')
  })
})
