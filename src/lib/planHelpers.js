const PERIOD_KEYS = ['periods_mon', 'periods_tue', 'periods_wed', 'periods_thu', 'periods_fri']

export function cloneSubjects(subjects) {
  if (!Array.isArray(subjects)) return []
  return subjects.map(s => ({ ...s }))
}

export function subjectsEqualByContent(a, b) {
  const aa = Array.isArray(a) ? a : []
  const bb = Array.isArray(b) ? b : []
  if (aa.length !== bb.length) return false
  const norm = (s) => `${s.grade}|${s.name}|${Number(s.weekly_hours) || 0}|${s.is_major ? 1 : 0}`
  const aSorted = [...aa].map(norm).sort()
  const bSorted = [...bb].map(norm).sort()
  for (let i = 0; i < aSorted.length; i++) {
    if (aSorted[i] !== bSorted[i]) return false
  }
  return true
}

export function getDedicatedHoursForGrade(planSubjects, grade) {
  if (!Array.isArray(planSubjects)) return 0
  return planSubjects
    .filter(s => s.grade === grade)
    .reduce((sum, s) => sum + (Number(s.weekly_hours) || 0), 0)
}

export function getWeeklyTotalForGrade(gradeConfigs, grade) {
  const gc = (gradeConfigs || []).find(g => g.grade === grade)
  if (!gc) return 0
  return PERIOD_KEYS.reduce((sum, k) => sum + (Number(gc[k]) || 0), 0)
}

export function getHomeroomHoursForGrade(planSubjects, gradeConfigs, grade) {
  return getWeeklyTotalForGrade(gradeConfigs, grade) - getDedicatedHoursForGrade(planSubjects, grade)
}

export function getOverflowGrades(planSubjects, gradeConfigs, gradesToCheck) {
  const result = []
  for (const grade of gradesToCheck || []) {
    const dedicated = getDedicatedHoursForGrade(planSubjects, grade)
    const weeklyTotal = getWeeklyTotalForGrade(gradeConfigs, grade)
    if (dedicated > weeklyTotal) {
      result.push({ grade, dedicated, weeklyTotal, overBy: dedicated - weeklyTotal })
    }
  }
  return result
}

export function getTotalDedicatedHours(planSubjects, gradeConfigs) {
  if (!Array.isArray(planSubjects)) return 0
  return planSubjects.reduce((sum, s) => {
    const config = (gradeConfigs || []).find(c => c.grade === s.grade)
    const numClasses = Number(config?.num_classes) || 0
    return sum + (Number(s.weekly_hours) || 0) * numClasses
  }, 0)
}

// classifySubjectsAcrossPlans(plans, grade)
// Returns a 2D array: result[planIndex] = [{ subject, differs }, ...]
// "differs" means this exact subject (by name+hours+is_major) does NOT appear in every other plan.
export function classifySubjectsAcrossPlans(plans, grade) {
  const planSubjectsAtGrade = plans.map(p =>
    (p.subjects || []).filter(s => s.grade === grade)
  )
  const sigOf = (s) => `${s.name}|${Number(s.weekly_hours) || 0}|${s.is_major ? 1 : 0}`
  const sigSetsPerPlan = planSubjectsAtGrade.map(arr => new Set(arr.map(sigOf)))

  return planSubjectsAtGrade.map((arr, idx) =>
    arr.map(s => {
      const sig = sigOf(s)
      // differs if any OTHER plan does not contain this exact signature
      const sharedByAll = sigSetsPerPlan.every(set => set.has(sig))
      return { subject: s, differs: !sharedByAll }
    })
  )
}
