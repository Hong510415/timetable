import { initialState } from '../lib/storage'
import { cloneSubjects, subjectsEqualByContent } from '../lib/planHelpers'

export function reducer(state, action) {
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

    case 'SET_ACTIVE_PLAN_TAB':
      return {
        ...state,
        subjectPlans: { ...state.subjectPlans, activeTabId: action.payload },
      }

    case 'UPDATE_PLAN_SUBJECTS': {
      const { planId, subjects } = action.payload
      return {
        ...state,
        subjectPlans: {
          ...state.subjectPlans,
          plans: state.subjectPlans.plans.map(p =>
            p.id === planId ? { ...p, subjects } : p
          ),
        },
      }
    }

    case 'APPLY_PLAN': {
      const { planId } = action.payload
      const plan = state.subjectPlans.plans.find(p => p.id === planId)
      if (!plan) return state
      const contentMatchesLive = subjectsEqualByContent(plan.subjects, state.subjects)
      // Spec §6.1 step 2: when plan content already matches live state, only update metadata —
      // do NOT clear teacher_assignments / timetableSlots / etc.
      if (contentMatchesLive) {
        return {
          ...state,
          subjectPlans: {
            ...state.subjectPlans,
            activeTabId: planId,
            appliedPlanId: planId,
            appliedAt: new Date().toISOString(),
          },
        }
      }
      return {
        ...state,
        subjects: cloneSubjects(plan.subjects),
        teachers: state.teachers.map(t => ({ ...t, teacher_assignments: [] })),
        timetableSlots: [],
        roomTimetableSlots: [],
        assignmentResult: null,
        subjectPlans: {
          ...state.subjectPlans,
          activeTabId: planId,
          appliedPlanId: planId,
          appliedAt: new Date().toISOString(),
        },
      }
    }

    default: return state
  }
}
