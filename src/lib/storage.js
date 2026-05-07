import { cloneSubjects } from './planHelpers'

const STORAGE_KEY = 'timetable_app_data'

const GRADES = [1, 2, 3, 4, 5, 6]

export const initialState = {
  schoolName: '',
  gradeConfigs: GRADES.map(grade => ({
    grade,
    num_classes: 4,
    periods_mon: 5,
    periods_tue: 5,
    periods_wed: 5,
    periods_thu: 5,
    periods_fri: 4,
  })),
  lunchConfig: { split_lunch: false, lunch_groups: [] },
  subjects: [],
  teachers: [],
  rooms: [],
  roomBlockedSlots: [],
  timetableSlots: [],
  roomTimetableSlots: [],
  assignmentSettings: { maxMajorSubjectsPerTeacher: 1 },
  assignmentResult: null,
  subjectPlans: {
    plans: [
      { id: 'plan1', name: 'A안', subjects: [], visible: true },
      { id: 'plan2', name: 'B안', subjects: [], visible: false },
      { id: 'plan3', name: 'C안', subjects: [], visible: false },
    ],
    activeTabId: 'plan1',
    appliedPlanId: null,
    appliedAt: null,
  },
}

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const stored = JSON.parse(raw)
    const merged = { ...initialState, ...stored }
    if (!stored.subjectPlans) {
      const liveSubjects = merged.subjects || []
      merged.subjectPlans = {
        plans: [
          { id: 'plan1', name: 'A안', subjects: cloneSubjects(liveSubjects), visible: true },
          { id: 'plan2', name: 'B안', subjects: [], visible: true },
          { id: 'plan3', name: 'C안', subjects: [], visible: true },
        ],
        activeTabId: 'plan1',
        appliedPlanId: liveSubjects.length > 0 ? 'plan1' : null,
        appliedAt: null,
      }
    } else {
      const sp = merged.subjectPlans
      const hasVisibleFlags = Array.isArray(sp.plans) && sp.plans.length > 0 && Object.prototype.hasOwnProperty.call(sp.plans[0], 'visible')
      if (!hasVisibleFlags) {
        const count = sp.visiblePlanCount !== undefined ? Math.max(sp.visiblePlanCount, 1) : 3
        const newPlans = sp.plans.map((p, i) => ({ ...p, visible: i < count }))
        const { visiblePlanCount: _removed, ...rest } = sp
        merged.subjectPlans = { ...rest, plans: newPlans }
      }
    }
    // 1개 플랜만 visible이면 state.subjects를 그 플랜과 동기화 (auto-apply 모드)
    const visiblePlans = merged.subjectPlans.plans.filter(p => p.visible)
    if (visiblePlans.length === 1) {
      const onlyPlan = visiblePlans[0]
      merged.subjects = cloneSubjects(onlyPlan.subjects)
      merged.subjectPlans = {
        ...merged.subjectPlans,
        appliedPlanId: onlyPlan.id,
      }
    }
    return merged
  } catch {
    return initialState
  }
}

export function saveToStorage(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}
