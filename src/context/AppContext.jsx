import { createContext, useContext, useEffect, useReducer } from 'react'
import { initialState, loadFromStorage, saveToStorage } from '../lib/storage'

const AppContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SCHOOL_NAME': return { ...state, schoolName: action.payload }
    case 'SET_GRADE_CONFIGS': return { ...state, gradeConfigs: action.payload }
    case 'SET_LUNCH_CONFIG': return { ...state, lunchConfig: action.payload }
    case 'SET_SUBJECTS': return { ...state, subjects: action.payload }
    case 'SET_TEACHERS': return { ...state, teachers: action.payload }
    case 'SET_ROOMS': return { ...state, rooms: action.payload }
    case 'SET_ROOM_BLOCKED_SLOTS': return { ...state, roomBlockedSlots: action.payload }
    case 'SET_TIMETABLE_SLOTS': return { ...state, timetableSlots: action.payload }
    case 'SET_ROOM_TIMETABLE_SLOTS': return { ...state, roomTimetableSlots: action.payload }
    case 'SET_ASSIGNMENT_SETTINGS': return { ...state, assignmentSettings: action.payload }
    case 'SET_ASSIGNMENT_RESULT': return { ...state, assignmentResult: action.payload }
    case 'IMPORT': return { ...initialState, ...action.payload }
    case 'RESET': return { ...initialState }
    default: return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadFromStorage)

  useEffect(() => {
    saveToStorage(state)
  }, [state])

  const ctx = {
    state,
    setSchoolName: (v) => dispatch({ type: 'SET_SCHOOL_NAME', payload: v }),
    setGradeConfigs: (v) => dispatch({ type: 'SET_GRADE_CONFIGS', payload: v }),
    setLunchConfig: (v) => dispatch({ type: 'SET_LUNCH_CONFIG', payload: v }),
    setSubjects: (v) => dispatch({ type: 'SET_SUBJECTS', payload: v }),
    setTeachers: (v) => dispatch({ type: 'SET_TEACHERS', payload: v }),
    setRooms: (v) => dispatch({ type: 'SET_ROOMS', payload: v }),
    setRoomBlockedSlots: (v) => dispatch({ type: 'SET_ROOM_BLOCKED_SLOTS', payload: v }),
    setTimetableSlots: (v) => dispatch({ type: 'SET_TIMETABLE_SLOTS', payload: v }),
    setRoomTimetableSlots: (v) => dispatch({ type: 'SET_ROOM_TIMETABLE_SLOTS', payload: v }),
    setAssignmentSettings: (v) => dispatch({ type: 'SET_ASSIGNMENT_SETTINGS', payload: v }),
    setAssignmentResult: (v) => dispatch({ type: 'SET_ASSIGNMENT_RESULT', payload: v }),
    importData: (data) => dispatch({ type: 'IMPORT', payload: data }),
    resetAll: () => dispatch({ type: 'RESET' }),
  }

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
