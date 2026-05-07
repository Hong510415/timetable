import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubjectPlanComparison from './SubjectPlanComparison'

const gradeConfigs = [
  { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
]
const gradesToShow = [1]

const plansAllFilled = [
  { id: 'plan1', name: 'A안', subjects: [{ id: 'a1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
  { id: 'plan2', name: 'B안', subjects: [{ id: 'b1', grade: 1, name: '영어', weekly_hours: 4, is_major: true }] },
  { id: 'plan3', name: 'C안', subjects: [{ id: 'c1', grade: 1, name: '영어', weekly_hours: 5, is_major: true }] },
]

function renderModal(props = {}) {
  return render(
    <SubjectPlanComparison
      plans={plansAllFilled}
      gradeConfigs={gradeConfigs}
      gradesToShow={gradesToShow}
      appliedPlanId="plan1"
      liveSubjects={plansAllFilled[0].subjects}
      onClose={() => {}}
      onApply={() => {}}
      schoolName="테스트초"
      teacherCount={0}
      {...props}
    />
  )
}

describe('SubjectPlanComparison', () => {
  it('renders modal with both tables when at least 2 plans non-empty', () => {
    renderModal()
    expect(screen.getByText(/학년별 담임시수 비교/)).toBeInTheDocument()
    expect(screen.getByText(/학년별 과목 구성/)).toBeInTheDocument()
  })

  it('shows homeroom hours per plan', () => {
    renderModal()
    // weeklyTotal 25, A안 dedicated 3, homeroom 22
    expect(screen.getByText('22 (-3)')).toBeInTheDocument()
    // B안 dedicated 4, homeroom 21
    expect(screen.getByText('21 (-4)')).toBeInTheDocument()
  })

  it('shows average hours per teacher when teacherCount > 0', () => {
    renderModal({ teacherCount: 2 })
    // gradeConfigs: grade1 num_classes=4
    // A안: 3h × 4 = 12 total → 12/2 = 6.0시간
    // B안: 4h × 4 = 16 total → 16/2 = 8.0시간
    expect(screen.getByText('6.0시간')).toBeInTheDocument()
    expect(screen.getByText('8.0시간')).toBeInTheDocument()
  })

  it('shows — for average when teacherCount is 0', () => {
    renderModal({ teacherCount: 0 })
    expect(screen.getByText('1인당 평균 주당시수')).toBeInTheDocument()
  })

  it('disables [A안 적용] when A안 is currently applied and unchanged', () => {
    renderModal()
    expect(screen.getByRole('button', { name: 'A안 적용' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'B안 적용' })).not.toBeDisabled()
  })

  it('disables 적용 button for a plan with overflow', () => {
    const plans = [
      { id: 'plan1', name: 'A안', subjects: [{ id: 'a1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
      { id: 'plan2', name: 'B안', subjects: [{ id: 'b1', grade: 1, name: '영어', weekly_hours: 30, is_major: true }] },
      { id: 'plan3', name: 'C안', subjects: [] },
    ]
    render(
      <SubjectPlanComparison
        plans={plans}
        gradeConfigs={gradeConfigs}
        gradesToShow={gradesToShow}
        appliedPlanId={null}
        liveSubjects={[]}
        onClose={() => {}}
        onApply={() => {}}
        schoolName="테스트초"
        teacherCount={0}
      />
    )
    expect(screen.getByRole('button', { name: 'B안 적용' })).toBeDisabled()
  })

  it('disables 적용 button for an empty plan', () => {
    const plans = [
      { id: 'plan1', name: 'A안', subjects: [{ id: 'a1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
      { id: 'plan2', name: 'B안', subjects: [] },
      { id: 'plan3', name: 'C안', subjects: [] },
    ]
    render(
      <SubjectPlanComparison
        plans={plans}
        gradeConfigs={gradeConfigs}
        gradesToShow={gradesToShow}
        appliedPlanId={null}
        liveSubjects={[]}
        onClose={() => {}}
        onApply={() => {}}
        schoolName="테스트초"
        teacherCount={0}
      />
    )
    const btn = screen.getByRole('button', { name: 'B안 적용' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', '과목을 먼저 입력해 주세요.')
  })

  it('calls onApply with planId when 적용 button clicked', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    renderModal({ onApply })
    await user.click(screen.getByRole('button', { name: 'B안 적용' }))
    expect(onApply).toHaveBeenCalledWith('plan2')
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal({ onClose })
    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders empty plan cell as "(과목 없음)"', () => {
    const plans = [
      { id: 'plan1', name: 'A안', subjects: [{ id: 'a1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
      { id: 'plan2', name: 'B안', subjects: [] },
      { id: 'plan3', name: 'C안', subjects: [{ id: 'c1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
    ]
    render(
      <SubjectPlanComparison
        plans={plans}
        gradeConfigs={gradeConfigs}
        gradesToShow={gradesToShow}
        appliedPlanId={null}
        liveSubjects={[]}
        onClose={() => {}}
        onApply={() => {}}
        schoolName="테스트초"
        teacherCount={0}
      />
    )
    expect(screen.getAllByText('(과목 없음)').length).toBeGreaterThan(0)
  })
})
