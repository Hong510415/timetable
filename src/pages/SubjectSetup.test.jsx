import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider } from '../context/AppContext'
import SubjectSetup from './SubjectSetup'

function renderPage() {
  return render(<AppProvider><SubjectSetup /></AppProvider>)
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  localStorage.clear()
})

describe('SubjectSetup', () => {
  it('renders the page title', () => {
    renderPage()
    expect(screen.getByText('전담 과목 설정')).toBeInTheDocument()
  })

  it('renders 3 plan tabs (A안, B안, C안)', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'A안' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'B안' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'C안' })).toBeInTheDocument()
  })

  it('shows "적용 전" status on first launch with empty plans', () => {
    renderPage()
    expect(screen.getByText(/적용 전/)).toBeInTheDocument()
  })

  it('switches active plan tab on click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'B안' }))
    // Status line should now mention B안
    expect(screen.getByText(/현재 편집: B안/)).toBeInTheDocument()
  })

  it('disables 적용 button when plan is already applied and unchanged', async () => {
    // Seed: plan1 contains a subject, state.subjects matches, appliedPlanId=plan1
    const seedSubject = { id: 'sx', grade: 1, name: '영어', weekly_hours: 3, is_major: true }
    const stored = {
      gradeConfigs: [
        { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      ],
      subjects: [seedSubject],
      teachers: [],
      rooms: [],
      roomBlockedSlots: [],
      timetableSlots: [],
      roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 },
      assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] },
      schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [{ ...seedSubject }] },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1',
        appliedPlanId: 'plan1',
        appliedAt: new Date().toISOString(),
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    const applyBtn = screen.getByRole('button', { name: /이 안 적용/ })
    expect(applyBtn).toBeDisabled()
  })

  it('does not touch state.subjects when editing a plan input', async () => {
    const user = userEvent.setup()
    // Seed: plan1 already has a subject; state.subjects has different content
    const stored = {
      gradeConfigs: [
        { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 2, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 3, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 4, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 5, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 6, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      ],
      subjects: [{ id: 'live-subj', grade: 1, name: '음악', weekly_hours: 2, is_major: false }],
      teachers: [], rooms: [], roomBlockedSlots: [], timetableSlots: [], roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }, assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] }, schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [{ id: 'plan1-subj', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    // Edit the subject name in plan1
    const subjectInput = screen.getByDisplayValue('영어')
    await user.clear(subjectInput)
    await user.type(subjectInput, '미술')
    // The localStorage state.subjects should be unchanged (still 음악) — the edit went to plan1 only
    const persisted = JSON.parse(localStorage.getItem('timetable_app_data'))
    expect(persisted.subjects).toEqual(stored.subjects)
    expect(persisted.subjectPlans.plans[0].subjects[0].name).toBe('미술')
  })

  it('applies plan and clears downstream when subjects differ from live', async () => {
    const user = userEvent.setup()
    // Seed: state.subjects=[live-X], plan1.subjects=[plan-Y], teachers has assignments, timetable has slots
    const stored = {
      gradeConfigs: [
        { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 2, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 3, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 4, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 5, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 6, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      ],
      subjects: [{ id: 'live-X', grade: 1, name: '음악', weekly_hours: 2, is_major: false }],
      teachers: [{ id: 't1', code: '교사1', teacher_assignments: [{ id: 'a1', subject_id: 'live-X', grade: 1, class_num: 1, weekly_hours: 2 }] }],
      rooms: [], roomBlockedSlots: [],
      timetableSlots: [{ id: 'tt1', grade: 1, class_num: 1, day_of_week: 0, slot: 0, teacher_id: 't1', subject_id: 'live-X' }],
      roomTimetableSlots: [], assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }, assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] }, schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [{ id: 'plan-Y', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    // jsdom's default window.confirm throws "Not implemented" — stub it to return true
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await user.click(screen.getByRole('button', { name: /이 안 적용/ }))
    confirmSpy.mockRestore()
    const persisted = JSON.parse(localStorage.getItem('timetable_app_data'))
    // state.subjects copied from plan1
    expect(persisted.subjects[0].name).toBe('영어')
    // Downstream cleared
    expect(persisted.teachers[0].teacher_assignments).toEqual([])
    expect(persisted.timetableSlots).toEqual([])
    // Metadata updated
    expect(persisted.subjectPlans.appliedPlanId).toBe('plan1')
    expect(persisted.subjectPlans.appliedAt).not.toBeNull()
  })
})
