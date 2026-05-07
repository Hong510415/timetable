import { createContext, useContext, useEffect, useReducer } from 'react'
import { loadFromStorage, saveToStorage } from '../lib/storage'
import { reducer } from './reducer'

const AppContext = createContext(null)

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
    setActivePlanTab: (tabId) => dispatch({ type: 'SET_ACTIVE_PLAN_TAB', payload: tabId }),
    updatePlanSubjects: (planId, subjects) => dispatch({ type: 'UPDATE_PLAN_SUBJECTS', payload: { planId, subjects } }),
    applyPlan: (planId) => dispatch({ type: 'APPLY_PLAN', payload: { planId } }),
  }

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
