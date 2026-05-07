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

  it('shows "과목 설정 추가" button on first launch with no tabs', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /과목 설정 추가/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A안' })).not.toBeInTheDocument()
  })

  it('renders plan tabs after adding slots', () => {
    const stored = {
      gradeConfigs: [], subjects: [], teachers: [], rooms: [], roomBlockedSlots: [],
      timetableSlots: [], roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }, assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] }, schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [] },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null, visiblePlanCount: 3,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    expect(screen.getByRole('button', { name: 'A안' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'B안' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'C안' })).toBeInTheDocument()
  })

  it('shows "적용 전" status when visiblePlanCount > 0', () => {
    const stored = {
      gradeConfigs: [], subjects: [], teachers: [], rooms: [], roomBlockedSlots: [],
      timetableSlots: [], roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }, assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] }, schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [] },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null, visiblePlanCount: 2,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    expect(screen.getByText(/적용 전/)).toBeInTheDocument()
  })

  it('switches active plan tab on click', async () => {
    const user = userEvent.setup()
    const stored = {
      gradeConfigs: [], subjects: [], teachers: [], rooms: [], roomBlockedSlots: [],
      timetableSlots: [], roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }, assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] }, schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [] },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null, visiblePlanCount: 3,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    await user.click(screen.getByRole('button', { name: 'B안' }))
    expect(screen.getByText(/현재 편집: B안/)).toBeInTheDocument()
  })

  it('disables 확정 button when plan is empty', () => {
    const stored = {
      gradeConfigs: [{ grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 }],
      subjects: [], teachers: [], rooms: [], roomBlockedSlots: [], timetableSlots: [], roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }, assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] }, schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [] },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null, visiblePlanCount: 2,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    const applyBtn = screen.getByRole('button', { name: /안 적용/ })
    expect(applyBtn).toBeDisabled()
    expect(applyBtn).toHaveAttribute('title', '과목을 먼저 입력해 주세요.')
  })

  it('disables 확정 button when plan is already applied and unchanged', async () => {
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
        visiblePlanCount: 3,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    const applyBtn = screen.getByRole('button', { name: /안 적용/ })
    expect(applyBtn).toBeDisabled()
  })

  it('does not touch state.subjects when editing a plan input', async () => {
    const user = userEvent.setup()
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
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null, visiblePlanCount: 3,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    const subjectInput = screen.getByDisplayValue('영어')
    await user.clear(subjectInput)
    await user.type(subjectInput, '미술')
    const persisted = JSON.parse(localStorage.getItem('timetable_app_data'))
    expect(persisted.subjects).toEqual(stored.subjects)
    expect(persisted.subjectPlans.plans[0].subjects[0].name).toBe('미술')
  })

  it('applies plan and clears downstream when subjects differ from live', async () => {
    const user = userEvent.setup()
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
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null, visiblePlanCount: 3,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await user.click(screen.getByRole('button', { name: /안 적용/ }))
    confirmSpy.mockRestore()
    const persisted = JSON.parse(localStorage.getItem('timetable_app_data'))
    expect(persisted.subjects[0].name).toBe('영어')
    expect(persisted.teachers[0].teacher_assignments).toEqual([])
    expect(persisted.timetableSlots).toEqual([])
    expect(persisted.subjectPlans.appliedPlanId).toBe('plan1')
    expect(persisted.subjectPlans.appliedAt).not.toBeNull()
  })
})

describe('담임시수 widget', () => {
  it('shows 담임시수 = weekly total - dedicated', () => {
    const stored = {
      gradeConfigs: [
        { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 2, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 3, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 4, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 5, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 6, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      ],
      subjects: [],
      teachers: [], rooms: [], roomBlockedSlots: [], timetableSlots: [], roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }, assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] }, schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [
            { id: 's1', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
            { id: 's2', grade: 1, name: '음악', weekly_hours: 2, is_major: false },
          ]},
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null, visiblePlanCount: 3,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    expect(screen.getByText(/담임시수: 20 \/ 25/)).toBeInTheDocument()
    expect(screen.getByText(/전담 5시간/)).toBeInTheDocument()
  })
})

describe('overflow handling', () => {
  it('disables apply button when a grade exceeds weekly total', () => {
    const stored = {
      gradeConfigs: [
        { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 2, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 3, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 4, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 5, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 6, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      ],
      subjects: [],
      teachers: [], rooms: [], roomBlockedSlots: [], timetableSlots: [], roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }, assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] }, schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [
            { id: 's1', grade: 1, name: '영어', weekly_hours: 30, is_major: true },
          ]},
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null, visiblePlanCount: 3,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    const applyBtn = screen.getByRole('button', { name: /안 적용/ })
    expect(applyBtn).toBeDisabled()
    expect(applyBtn).toHaveAttribute('title', expect.stringMatching(/초과 학년이 있어 적용할 수 없습니다/))
  })
})
