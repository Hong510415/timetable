import { initialState } from '../lib/storage'
import { cloneSubjects, subjectsEqualByContent } from '../lib/planHelpers'

function syncIfSinglePlan(state, newPlans, planId, subjects) {
  // 1개 플랜만 visible이고 그게 활성/업데이트된 플랜이면 live state.subjects도 동기화
  const visible = newPlans.filter(p => p.visible)
  const updatedPlan = newPlans.find(p => p.id === planId)
  if (visible.length === 1 && updatedPlan?.visible) {
    return {
      ...state,
      subjects: cloneSubjects(subjects),
      subjectPlans: {
        ...state.subjectPlans,
        plans: newPlans,
        appliedPlanId: planId,
        appliedAt: new Date().toISOString(),
      },
    }
  }
  return {
    ...state,
    subjectPlans: { ...state.subjectPlans, plans: newPlans },
  }
}

// 모든 액션 후 invariant 보장:
// 1개 플랜만 visible이고 state.subjects가 그 플랜 subjects와 어긋나면 동기화 (auto-apply 모드)
// 콘텐츠가 이미 일치하면 appliedPlanId 등 메타데이터는 손대지 않음.
function ensureSinglePlanSync(state) {
  if (!state?.subjectPlans?.plans) return state
  const visible = state.subjectPlans.plans.filter(p => p.visible)
  if (visible.length !== 1) return state
  const only = visible[0]
  if (subjectsEqualByContent(state.subjects, only.subjects)) return state
  return {
    ...state,
    subjects: cloneSubjects(only.subjects),
    subjectPlans: {
      ...state.subjectPlans,
      appliedPlanId: only.id,
    },
  }
}

export function reducer(state, action) {
  return ensureSinglePlanSync(rawReducer(state, action))
}

function rawReducer(state, action) {
  switch (action.type) {
    case 'SET_SCHOOL_NAME': return { ...state, schoolName: action.payload }
    case 'SET_GRADE_CONFIGS': return { ...state, gradeConfigs: action.payload }
    case 'SET_LUNCH_CONFIG': return { ...state, lunchConfig: action.payload }
    case 'SET_SEMESTER_MODE': return { ...state, semesterMode: action.payload }
    case 'SET_SUBJECTS': return { ...state, subjects: action.payload }
    case 'SET_TEACHERS': return { ...state, teachers: action.payload }
    case 'SET_ROOMS': return { ...state, rooms: action.payload }
    case 'SET_ROOM_BLOCKED_SLOTS': return { ...state, roomBlockedSlots: action.payload }
    case 'SET_EXTERNAL_INSTRUCTORS': return { ...state, externalInstructors: action.payload }
    case 'SET_TIMETABLE_SLOTS': return { ...state, timetableSlots: action.payload }
    case 'SET_ROOM_TIMETABLE_SLOTS': return { ...state, roomTimetableSlots: action.payload }
    case 'SET_ASSIGNMENT_SETTINGS': return { ...state, assignmentSettings: action.payload }
    case 'SET_ASSIGNMENT_RESULT': return { ...state, assignmentResult: action.payload }
    case 'IMPORT': return { ...initialState, ...action.payload }
    case 'RESET': return { ...initialState }

    case 'SET_ACTIVE_PLAN_TAB':
      return {
        ...state,
        subjectPlans: { ...state.subjectPlans, activeTabId: action.payload },
      }

    case 'UPDATE_PLAN_SUBJECTS': {
      const { planId, subjects } = action.payload
      const newPlans = state.subjectPlans.plans.map(p =>
        p.id === planId ? { ...p, subjects } : p
      )
      return syncIfSinglePlan(state, newPlans, planId, subjects)
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

    case 'ADD_PLAN_SLOT': {
      const plans = state.subjectPlans.plans
      const firstInvisibleIdx = plans.findIndex(p => !p.visible)
      if (firstInvisibleIdx === -1) return state
      return {
        ...state,
        subjectPlans: {
          ...state.subjectPlans,
          plans: plans.map((p, i) => i === firstInvisibleIdx ? { ...p, visible: true } : p),
          ...(firstInvisibleIdx === 0 ? { activeTabId: 'plan1' } : {}),
        },
      }
    }

    case 'REMOVE_PLAN_SLOT': {
      const { planId } = action.payload
      const plans = state.subjectPlans.plans
      const target = plans.find(p => p.id === planId)
      if (!target || !target.visible) return state
      const newPlans = plans.map(p =>
        p.id === planId ? { ...p, visible: false, subjects: [] } : p
      )
      const remaining = newPlans.filter(p => p.visible)
      const newActiveTabId = state.subjectPlans.activeTabId === planId
        ? (remaining[0]?.id ?? 'plan1')
        : state.subjectPlans.activeTabId
      const newAppliedPlanId = state.subjectPlans.appliedPlanId === planId
        ? null
        : state.subjectPlans.appliedPlanId
      return {
        ...state,
        subjectPlans: {
          ...state.subjectPlans,
          plans: newPlans,
          activeTabId: newActiveTabId,
          appliedPlanId: newAppliedPlanId,
        },
      }
    }

    default: return state
  }
}
