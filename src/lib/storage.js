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
}

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    return { ...initialState, ...JSON.parse(raw) }
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
