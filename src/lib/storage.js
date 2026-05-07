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
      { id: 'plan1', name: 'A안', subjects: [] },
      { id: 'plan2', name: 'B안', subjects: [] },
      { id: 'plan3', name: 'C안', subjects: [] },
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
          { id: 'plan1', name: 'A안', subjects: cloneSubjects(liveSubjects) },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1',
        appliedPlanId: liveSubjects.length > 0 ? 'plan1' : null,
        appliedAt: null,
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
