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
})
