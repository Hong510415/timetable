import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

describe('SubjectPlanComparison', () => {
  it('renders modal with both tables when at least 2 plans non-empty', () => {
    render(
      <SubjectPlanComparison
        plans={plansAllFilled}
        gradeConfigs={gradeConfigs}
        gradesToShow={gradesToShow}
        appliedPlanId="plan1"
        liveSubjects={plansAllFilled[0].subjects}
        onClose={() => {}}
        onApply={() => {}}
        schoolName="테스트초"
      />
    )
    expect(screen.getByText(/학년별 담임시수 비교/)).toBeInTheDocument()
    expect(screen.getByText(/학년별 과목 구성/)).toBeInTheDocument()
  })

  it('shows homeroom hours and dedicated total per plan', () => {
    render(
      <SubjectPlanComparison
        plans={plansAllFilled}
        gradeConfigs={gradeConfigs}
        gradesToShow={gradesToShow}
        appliedPlanId="plan1"
        liveSubjects={plansAllFilled[0].subjects}
        onClose={() => {}}
        onApply={() => {}}
        schoolName="테스트초"
      />
    )
    // weeklyTotal 25, A안 dedicated 3, homeroom 22
    expect(screen.getByText('22 (-3)')).toBeInTheDocument()
    // B안 dedicated 4, homeroom 21
    expect(screen.getByText('21 (-4)')).toBeInTheDocument()
  })

  it('disables [A안 적용] when A안 is currently applied and unchanged', () => {
    render(
      <SubjectPlanComparison
        plans={plansAllFilled}
        gradeConfigs={gradeConfigs}
        gradesToShow={gradesToShow}
        appliedPlanId="plan1"
        liveSubjects={plansAllFilled[0].subjects}
        onClose={() => {}}
        onApply={() => {}}
        schoolName="테스트초"
      />
    )
    expect(screen.getByRole('button', { name: 'A안 적용' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'B안 적용' })).not.toBeDisabled()
  })

  it('disables apply button for a plan with overflow', () => {
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
      />
    )
    expect(screen.getByRole('button', { name: 'B안 적용' })).toBeDisabled()
  })

  it('calls onApply with planId when apply button clicked', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(
      <SubjectPlanComparison
        plans={plansAllFilled}
        gradeConfigs={gradeConfigs}
        gradesToShow={gradesToShow}
        appliedPlanId="plan1"
        liveSubjects={plansAllFilled[0].subjects}
        onClose={() => {}}
        onApply={onApply}
        schoolName="테스트초"
      />
    )
    await user.click(screen.getByRole('button', { name: 'B안 적용' }))
    expect(onApply).toHaveBeenCalledWith('plan2')
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <SubjectPlanComparison
        plans={plansAllFilled}
        gradeConfigs={gradeConfigs}
        gradesToShow={gradesToShow}
        appliedPlanId="plan1"
        liveSubjects={plansAllFilled[0].subjects}
        onClose={onClose}
        onApply={() => {}}
        schoolName="테스트초"
      />
    )
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
      />
    )
    expect(screen.getAllByText('(과목 없음)').length).toBeGreaterThan(0)
  })
})
