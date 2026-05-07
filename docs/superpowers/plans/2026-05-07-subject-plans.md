# 전담 과목 배정안(A/B/C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-subject editor with 3 sandboxed plans (A/B/C) for HR-committee comparison, plus real-time 담임시수 display, with explicit "apply" pushing the chosen plan to downstream.

**Architecture:** Add `subjectPlans` slice to localStorage state holding 3 independent plan drafts. Existing `state.subjects` becomes the "applied/live" mirror used by all downstream pages — they require zero changes. New helpers in `src/lib/planHelpers.js`. Comparison modal in new component. Move 전담 교사 인원 input to 학교 설정 page.

**Tech Stack:** React 18 + Vite 6 + Tailwind 3, localStorage. Tests: **Vitest + jsdom + React Testing Library** (added in Task 0). xlsx for Excel I/O.

**Spec:** [docs/superpowers/specs/2026-05-07-subject-plans-design.md](../specs/2026-05-07-subject-plans-design.md)

**Worktree:** `C:\Users\a\Desktop\timetable\.claude\worktrees\objective-satoshi-ddf3e5`. Dev server already running at http://localhost:5173 — manual verification steps reference its routes.

**Style note:** No emojis in code/UI except literal characters explicitly listed in spec (`✓`, `📊`, `🖨`).

---

## Task 0: Test infrastructure (Vitest + RTL + jsdom)

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `src/test/setup.js`
- Create: `src/lib/sanity.test.js`

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install --save-dev vitest@^2.1.0 @vitest/ui@^2.1.0 jsdom@^25.0.0 @testing-library/react@^16.0.1 @testing-library/jest-dom@^6.5.0 @testing-library/user-event@^14.5.2
```

Expected: packages added to `package.json` devDependencies, no errors.

- [ ] **Step 2: Add test scripts to `package.json`**

Modify the `scripts` block to:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 3: Configure Vitest in `vite.config.js`**

Replace `vite.config.js` contents with:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
```

- [ ] **Step 4: Create test setup file**

Create `src/test/setup.js`:
```js
import '@testing-library/jest-dom/vitest'

// jsdom does not implement window.confirm — provide a default that auto-accepts.
// Individual tests can override via vi.spyOn(window, 'confirm').mockReturnValue(false).
if (typeof window !== 'undefined') {
  window.confirm = window.confirm || (() => true)
  window.alert = window.alert || (() => {})
  window.print = window.print || (() => {})
}

// crypto.randomUUID is available in jsdom 25+ but verify
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  globalThis.crypto = globalThis.crypto || {}
  globalThis.crypto.randomUUID = () => 'test-uuid-' + Math.random().toString(36).slice(2, 10)
}
```

- [ ] **Step 5: Write a sanity test**

Create `src/lib/sanity.test.js`:
```js
import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('runs basic assertions', () => {
    expect(1 + 1).toBe(2)
  })

  it('has DOM via jsdom', () => {
    const div = document.createElement('div')
    div.textContent = 'hello'
    expect(div.textContent).toBe('hello')
  })

  it('has crypto.randomUUID', () => {
    expect(typeof crypto.randomUUID()).toBe('string')
  })
})
```

- [ ] **Step 6: Run tests to verify infrastructure**

Run:
```bash
npm run test:run
```

Expected: 3 tests pass in `src/lib/sanity.test.js`. No errors.

- [ ] **Step 7: Commit & push**

```bash
git add package.json package-lock.json vite.config.js src/test/setup.js src/lib/sanity.test.js
git commit -m "chore: set up vitest + jsdom + react-testing-library"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 1: Pure helpers — `src/lib/planHelpers.js`

**Files:**
- Create: `src/lib/planHelpers.js`
- Create: `src/lib/planHelpers.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/planHelpers.test.js`:
```js
import { describe, it, expect } from 'vitest'
import {
  cloneSubjects,
  subjectsEqualByContent,
  getDedicatedHoursForGrade,
  getWeeklyTotalForGrade,
  getHomeroomHoursForGrade,
  getOverflowGrades,
  classifySubjectsAcrossPlans,
} from './planHelpers'

const sampleSubjects = [
  { id: 'a', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
  { id: 'b', grade: 1, name: '음악', weekly_hours: 2, is_major: false },
  { id: 'c', grade: 2, name: '영어', weekly_hours: 3, is_major: true },
]

const gradeConfigs = [
  { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 4 },
  { grade: 2, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
  { grade: 3, num_classes: 0, periods_mon: 0, periods_tue: 0, periods_wed: 0, periods_thu: 0, periods_fri: 0 },
]

describe('cloneSubjects', () => {
  it('returns a new array of new objects (no shared reference)', () => {
    const cloned = cloneSubjects(sampleSubjects)
    expect(cloned).not.toBe(sampleSubjects)
    expect(cloned[0]).not.toBe(sampleSubjects[0])
    expect(cloned[0]).toEqual(sampleSubjects[0])
  })

  it('handles empty array', () => {
    expect(cloneSubjects([])).toEqual([])
  })

  it('treats null/undefined as empty', () => {
    expect(cloneSubjects(null)).toEqual([])
    expect(cloneSubjects(undefined)).toEqual([])
  })
})

describe('subjectsEqualByContent', () => {
  it('returns true for arrays with identical content (any id, any order)', () => {
    const a = [{ id: '1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }]
    const b = [{ id: 'different-id', grade: 1, name: '영어', weekly_hours: 3, is_major: true }]
    expect(subjectsEqualByContent(a, b)).toBe(true)
  })

  it('returns true for differently ordered arrays of identical content', () => {
    const a = [
      { id: '1', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
      { id: '2', grade: 1, name: '음악', weekly_hours: 2, is_major: false },
    ]
    const b = [
      { id: '99', grade: 1, name: '음악', weekly_hours: 2, is_major: false },
      { id: '88', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
    ]
    expect(subjectsEqualByContent(a, b)).toBe(true)
  })

  it('returns false when content differs', () => {
    const a = [{ id: '1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }]
    const b = [{ id: '1', grade: 1, name: '영어', weekly_hours: 4, is_major: true }]
    expect(subjectsEqualByContent(a, b)).toBe(false)
  })

  it('returns false when lengths differ', () => {
    expect(subjectsEqualByContent([{ id: '1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }], [])).toBe(false)
  })

  it('treats null/undefined as empty', () => {
    expect(subjectsEqualByContent(null, [])).toBe(true)
    expect(subjectsEqualByContent(undefined, null)).toBe(true)
  })
})

describe('getDedicatedHoursForGrade', () => {
  it('sums weekly_hours of subjects matching grade', () => {
    expect(getDedicatedHoursForGrade(sampleSubjects, 1)).toBe(5)
    expect(getDedicatedHoursForGrade(sampleSubjects, 2)).toBe(3)
  })

  it('returns 0 for grade with no subjects', () => {
    expect(getDedicatedHoursForGrade(sampleSubjects, 6)).toBe(0)
  })

  it('treats invalid weekly_hours as 0', () => {
    const subs = [{ id: 'x', grade: 1, name: '영어', weekly_hours: '', is_major: false }]
    expect(getDedicatedHoursForGrade(subs, 1)).toBe(0)
  })
})

describe('getWeeklyTotalForGrade', () => {
  it('sums periods_mon..periods_fri for matching grade', () => {
    expect(getWeeklyTotalForGrade(gradeConfigs, 1)).toBe(24)
    expect(getWeeklyTotalForGrade(gradeConfigs, 2)).toBe(25)
  })

  it('returns 0 for unknown grade', () => {
    expect(getWeeklyTotalForGrade(gradeConfigs, 99)).toBe(0)
  })

  it('treats invalid period values as 0', () => {
    const gc = [{ grade: 1, num_classes: 4, periods_mon: '', periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: '' }]
    expect(getWeeklyTotalForGrade(gc, 1)).toBe(15)
  })
})

describe('getHomeroomHoursForGrade', () => {
  it('returns weeklyTotal - dedicated', () => {
    expect(getHomeroomHoursForGrade(sampleSubjects, gradeConfigs, 1)).toBe(19) // 24 - 5
    expect(getHomeroomHoursForGrade(sampleSubjects, gradeConfigs, 2)).toBe(22) // 25 - 3
  })

  it('returns negative when dedicated > weeklyTotal', () => {
    const subs = [{ id: 'x', grade: 1, name: '영어', weekly_hours: 30, is_major: false }]
    expect(getHomeroomHoursForGrade(subs, gradeConfigs, 1)).toBe(-6)
  })
})

describe('getOverflowGrades', () => {
  it('returns grades where dedicated > weeklyTotal', () => {
    const subs = [
      { id: 'a', grade: 1, name: 'x', weekly_hours: 30, is_major: false },
      { id: 'b', grade: 2, name: 'y', weekly_hours: 1, is_major: false },
    ]
    expect(getOverflowGrades(subs, gradeConfigs, [1, 2])).toEqual([
      { grade: 1, dedicated: 30, weeklyTotal: 24, overBy: 6 },
    ])
  })

  it('returns empty array when no overflow', () => {
    expect(getOverflowGrades(sampleSubjects, gradeConfigs, [1, 2])).toEqual([])
  })

  it('only checks grades passed in gradesToCheck', () => {
    const subs = [{ id: 'a', grade: 3, name: 'x', weekly_hours: 99, is_major: false }]
    // grade 3 has weeklyTotal 0 but we don't check it
    expect(getOverflowGrades(subs, gradeConfigs, [1, 2])).toEqual([])
  })
})

describe('classifySubjectsAcrossPlans', () => {
  it('marks subject row as "differs" when only some plans have it', () => {
    const plans = [
      { id: 'plan1', name: 'A안', subjects: [{ id: '1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
      { id: 'plan2', name: 'B안', subjects: [] },
      { id: 'plan3', name: 'C안', subjects: [{ id: '2', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
    ]
    const result = classifySubjectsAcrossPlans(plans, 1)
    // result is a 2D map: result[planIdx] = [{ subject, differs }]
    expect(result[0][0].differs).toBe(true)  // A안 영어 differs because B안 doesn't have it
    expect(result[1]).toEqual([])
    expect(result[2][0].differs).toBe(true)
  })

  it('marks as "same" when all plans share the subject identically (by name+hours+is_major)', () => {
    const sameSubject = (id) => ({ id, grade: 1, name: '영어', weekly_hours: 3, is_major: true })
    const plans = [
      { id: 'plan1', name: 'A안', subjects: [sameSubject('a')] },
      { id: 'plan2', name: 'B안', subjects: [sameSubject('b')] },
      { id: 'plan3', name: 'C안', subjects: [sameSubject('c')] },
    ]
    const result = classifySubjectsAcrossPlans(plans, 1)
    expect(result[0][0].differs).toBe(false)
    expect(result[1][0].differs).toBe(false)
    expect(result[2][0].differs).toBe(false)
  })

  it('marks as "differs" when same name but different weekly_hours', () => {
    const plans = [
      { id: 'plan1', name: 'A안', subjects: [{ id: 'a', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
      { id: 'plan2', name: 'B안', subjects: [{ id: 'b', grade: 1, name: '영어', weekly_hours: 4, is_major: true }] },
      { id: 'plan3', name: 'C안', subjects: [{ id: 'c', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
    ]
    const result = classifySubjectsAcrossPlans(plans, 1)
    expect(result[0][0].differs).toBe(true)
    expect(result[1][0].differs).toBe(true)
    expect(result[2][0].differs).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm run test:run -- src/lib/planHelpers.test.js
```

Expected: All tests fail with "Cannot find module './planHelpers'" or similar import error.

- [ ] **Step 3: Implement helpers**

Create `src/lib/planHelpers.js`:
```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm run test:run -- src/lib/planHelpers.test.js
```

Expected: All tests pass (15+ tests across 7 describe blocks).

- [ ] **Step 5: Commit & push**

```bash
git add src/lib/planHelpers.js src/lib/planHelpers.test.js
git commit -m "feat: add planHelpers (calc + diff classification) with tests"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 2: storage.js — `subjectPlans` + migration

**Files:**
- Modify: `src/lib/storage.js`
- Create: `src/lib/storage.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/lib/storage.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initialState, loadFromStorage } from './storage'

const STORAGE_KEY = 'timetable_app_data'

describe('initialState.subjectPlans', () => {
  it('contains 3 plans named A안, B안, C안 with empty subjects', () => {
    expect(initialState.subjectPlans).toBeDefined()
    expect(initialState.subjectPlans.plans).toHaveLength(3)
    expect(initialState.subjectPlans.plans[0]).toEqual({ id: 'plan1', name: 'A안', subjects: [] })
    expect(initialState.subjectPlans.plans[1]).toEqual({ id: 'plan2', name: 'B안', subjects: [] })
    expect(initialState.subjectPlans.plans[2]).toEqual({ id: 'plan3', name: 'C안', subjects: [] })
  })

  it('starts with activeTabId=plan1, appliedPlanId=null, appliedAt=null', () => {
    expect(initialState.subjectPlans.activeTabId).toBe('plan1')
    expect(initialState.subjectPlans.appliedPlanId).toBeNull()
    expect(initialState.subjectPlans.appliedAt).toBeNull()
  })
})

describe('loadFromStorage migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('returns initialState when storage is empty', () => {
    const loaded = loadFromStorage()
    expect(loaded.subjects).toEqual([])
    expect(loaded.subjectPlans.appliedPlanId).toBeNull()
  })

  it('does not overwrite existing subjectPlans', () => {
    const stored = {
      subjects: [],
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [{ id: 'x', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan2',
        appliedPlanId: 'plan1',
        appliedAt: '2026-05-07T10:00:00.000Z',
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    const loaded = loadFromStorage()
    expect(loaded.subjectPlans.activeTabId).toBe('plan2')
    expect(loaded.subjectPlans.appliedPlanId).toBe('plan1')
    expect(loaded.subjectPlans.plans[0].subjects).toHaveLength(1)
  })

  it('migrates legacy data (no subjectPlans key) — copies subjects to plan1, appliedPlanId=plan1', () => {
    const legacySubjects = [
      { id: 'a', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
      { id: 'b', grade: 2, name: '음악', weekly_hours: 2, is_major: false },
    ]
    const stored = {
      schoolName: '테스트초',
      subjects: legacySubjects,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    const loaded = loadFromStorage()

    expect(loaded.subjectPlans.plans[0].subjects).toHaveLength(2)
    expect(loaded.subjectPlans.plans[0].subjects[0]).toEqual(legacySubjects[0])
    // Plan1 must be a deep copy — different object references
    expect(loaded.subjectPlans.plans[0].subjects[0]).not.toBe(legacySubjects[0])
    expect(loaded.subjectPlans.plans[1].subjects).toEqual([])
    expect(loaded.subjectPlans.plans[2].subjects).toEqual([])
    expect(loaded.subjectPlans.activeTabId).toBe('plan1')
    expect(loaded.subjectPlans.appliedPlanId).toBe('plan1')
    expect(loaded.subjectPlans.appliedAt).toBeNull()
    expect(loaded.subjects).toEqual(legacySubjects) // live mirror preserved
  })

  it('migrates legacy data with empty subjects → appliedPlanId=null', () => {
    const stored = { schoolName: '테스트초', subjects: [] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    const loaded = loadFromStorage()
    expect(loaded.subjectPlans.appliedPlanId).toBeNull()
  })

  it('returns initialState if JSON parse fails', () => {
    localStorage.setItem(STORAGE_KEY, 'not json{{{')
    const loaded = loadFromStorage()
    expect(loaded.subjectPlans.appliedPlanId).toBeNull()
    expect(loaded.subjects).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm run test:run -- src/lib/storage.test.js
```

Expected: All migration tests fail (initialState may pass partially depending on current state).

- [ ] **Step 3: Update `src/lib/storage.js`**

Replace the entire contents of `src/lib/storage.js` with:
```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm run test:run -- src/lib/storage.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Manual verification — fresh load**

Open http://localhost:5173/setup in browser. Open DevTools → Application → Local Storage → `timetable_app_data`. Confirm key contains `subjectPlans` field with 3 plans. If you had pre-existing subjects, plan1.subjects mirrors them.

- [ ] **Step 6: Commit & push**

```bash
git add src/lib/storage.js src/lib/storage.test.js
git commit -m "feat: add subjectPlans state with legacy data migration"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 3: AppContext — extract reducer + add plan actions

**Files:**
- Create: `src/context/reducer.js`
- Create: `src/context/reducer.test.js`
- Modify: `src/context/AppContext.jsx`

- [ ] **Step 1: Write failing tests for new reducer actions**

Create `src/context/reducer.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { reducer } from './reducer'
import { initialState } from '../lib/storage'

function makeStateWithPlan(planId, subjects) {
  return {
    ...initialState,
    subjectPlans: {
      ...initialState.subjectPlans,
      plans: initialState.subjectPlans.plans.map(p =>
        p.id === planId ? { ...p, subjects } : p
      ),
    },
  }
}

describe('SET_ACTIVE_PLAN_TAB', () => {
  it('updates activeTabId', () => {
    const next = reducer(initialState, { type: 'SET_ACTIVE_PLAN_TAB', payload: 'plan2' })
    expect(next.subjectPlans.activeTabId).toBe('plan2')
  })

  it('preserves other subjectPlans fields', () => {
    const next = reducer(initialState, { type: 'SET_ACTIVE_PLAN_TAB', payload: 'plan3' })
    expect(next.subjectPlans.plans).toEqual(initialState.subjectPlans.plans)
    expect(next.subjectPlans.appliedPlanId).toBe(initialState.subjectPlans.appliedPlanId)
  })
})

describe('UPDATE_PLAN_SUBJECTS', () => {
  it('updates only the matching plan subjects', () => {
    const next = reducer(initialState, {
      type: 'UPDATE_PLAN_SUBJECTS',
      payload: { planId: 'plan2', subjects: [{ id: 'x', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
    })
    expect(next.subjectPlans.plans[0].subjects).toEqual([])
    expect(next.subjectPlans.plans[1].subjects).toHaveLength(1)
    expect(next.subjectPlans.plans[2].subjects).toEqual([])
  })

  it('does not touch state.subjects (live data) or downstream state', () => {
    const stateWithDownstream = {
      ...initialState,
      subjects: [{ id: 'live', grade: 1, name: '음악', weekly_hours: 2, is_major: false }],
      teachers: [{ id: 't1', code: '교사1', teacher_assignments: [{ id: 'a', subject_id: 'live', grade: 1, class_num: 1, weekly_hours: 2 }] }],
    }
    const next = reducer(stateWithDownstream, {
      type: 'UPDATE_PLAN_SUBJECTS',
      payload: { planId: 'plan1', subjects: [] },
    })
    expect(next.subjects).toEqual(stateWithDownstream.subjects)
    expect(next.teachers).toEqual(stateWithDownstream.teachers)
  })
})

describe('APPLY_PLAN', () => {
  it('copies plan.subjects to state.subjects (deep copy)', () => {
    const planSubjects = [{ id: 'p', grade: 1, name: '영어', weekly_hours: 4, is_major: true }]
    const state = makeStateWithPlan('plan2', planSubjects)
    const next = reducer(state, { type: 'APPLY_PLAN', payload: { planId: 'plan2' } })
    expect(next.subjects).toEqual(planSubjects)
    expect(next.subjects[0]).not.toBe(planSubjects[0])
  })

  it('clears teacher_assignments but preserves teacher records', () => {
    const state = {
      ...initialState,
      teachers: [
        { id: 't1', code: '교사1', teacher_assignments: [{ id: 'a', subject_id: 's1', grade: 1, class_num: 1, weekly_hours: 2 }] },
        { id: 't2', code: '교사2', teacher_assignments: [] },
      ],
    }
    const next = reducer(state, { type: 'APPLY_PLAN', payload: { planId: 'plan1' } })
    expect(next.teachers).toHaveLength(2)
    expect(next.teachers[0].id).toBe('t1')
    expect(next.teachers[0].code).toBe('교사1')
    expect(next.teachers[0].teacher_assignments).toEqual([])
    expect(next.teachers[1].teacher_assignments).toEqual([])
  })

  it('clears timetableSlots, roomTimetableSlots, assignmentResult', () => {
    const state = {
      ...initialState,
      timetableSlots: [{ id: 'tt1', grade: 1, class_num: 1, day_of_week: 0, slot: 0, teacher_id: 't', subject_id: 's' }],
      roomTimetableSlots: [{ id: 'rt1', room_id: 'r', grade: 1, class_num: 1, day_of_week: 0, slot: 0 }],
      assignmentResult: { result: { assignments: [], warnings: [], gradeSummary: [], teacherSummary: [] }, edited: null },
    }
    const next = reducer(state, { type: 'APPLY_PLAN', payload: { planId: 'plan1' } })
    expect(next.timetableSlots).toEqual([])
    expect(next.roomTimetableSlots).toEqual([])
    expect(next.assignmentResult).toBeNull()
  })

  it('preserves rooms and roomBlockedSlots', () => {
    const state = {
      ...initialState,
      rooms: [{ id: 'r1', name: '음악실', subjectNames: [] }],
      roomBlockedSlots: [{ id: 'b1', room_id: 'r1', day_of_week: 0, slot: 0 }],
    }
    const next = reducer(state, { type: 'APPLY_PLAN', payload: { planId: 'plan1' } })
    expect(next.rooms).toEqual(state.rooms)
    expect(next.roomBlockedSlots).toEqual(state.roomBlockedSlots)
  })

  it('updates appliedPlanId, appliedAt, and activeTabId', () => {
    const before = Date.now()
    const next = reducer(initialState, { type: 'APPLY_PLAN', payload: { planId: 'plan3' } })
    expect(next.subjectPlans.appliedPlanId).toBe('plan3')
    expect(next.subjectPlans.activeTabId).toBe('plan3')
    expect(new Date(next.subjectPlans.appliedAt).getTime()).toBeGreaterThanOrEqual(before)
  })

  it('returns state unchanged when planId does not exist', () => {
    const next = reducer(initialState, { type: 'APPLY_PLAN', payload: { planId: 'plan999' } })
    expect(next).toBe(initialState)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
npm run test:run -- src/context/reducer.test.js
```

Expected: All fail with "Cannot find module './reducer'".

- [ ] **Step 3: Create `src/context/reducer.js`**

```js
import { initialState } from '../lib/storage'
import { cloneSubjects } from '../lib/planHelpers'

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
```

- [ ] **Step 4: Modify `src/context/AppContext.jsx` to use extracted reducer + new helpers**

Replace `src/context/AppContext.jsx` with:
```jsx
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
```

- [ ] **Step 5: Run tests — verify they pass**

Run:
```bash
npm run test:run -- src/context/reducer.test.js
```

Expected: All tests pass.

Also run full test suite to ensure no regressions:
```bash
npm run test:run
```

Expected: All previously-passing tests still pass.

- [ ] **Step 6: Manual verification — page still loads**

Reload http://localhost:5173/setup in browser. Verify the app boots without console errors. Existing functionality (학교 설정, 전담 설정 → 전담 과목 입력) still works.

- [ ] **Step 7: Commit & push**

```bash
git add src/context/reducer.js src/context/reducer.test.js src/context/AppContext.jsx
git commit -m "refactor: extract reducer + add plan actions (SET_ACTIVE_PLAN_TAB, UPDATE_PLAN_SUBJECTS, APPLY_PLAN)"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 4: Move 전담 교사 to 학교 설정 page

**Files:**
- Modify: `src/pages/SchoolSetup.jsx`
- Modify: `src/pages/SubjectSetup.jsx`

- [ ] **Step 1: Update `src/pages/SchoolSetup.jsx` — add 전담 교사 tab**

Replace the contents with:
```jsx
import { useState } from 'react'
import { useApp } from '../context/AppContext'

const DAYS = ['월', '화', '수', '목', '금']
const GRADES = [1, 2, 3, 4, 5, 6]
const DAY_KEYS = ['periods_mon', 'periods_tue', 'periods_wed', 'periods_thu', 'periods_fri']

export default function SchoolSetup() {
  const { state, setSchoolName, setGradeConfigs, setLunchConfig, setTeachers } = useApp()
  const { schoolName, gradeConfigs, lunchConfig, teachers } = state
  const [tab, setTab] = useState('grade')

  function updateGrade(grade, field, value) {
    const num = value === '' ? '' : Number(value)
    setGradeConfigs(gradeConfigs.map(c => c.grade === grade ? { ...c, [field]: num } : c))
  }

  function toggleLunchGrade(gradeNum, slotIdx) {
    const groups = JSON.parse(JSON.stringify(lunchConfig.lunch_groups))
    const existing = groups.find(g => g.slot === slotIdx)
    if (existing) {
      existing.grades = existing.grades.includes(gradeNum)
        ? existing.grades.filter(g => g !== gradeNum)
        : [...existing.grades, gradeNum]
      setLunchConfig({ ...lunchConfig, lunch_groups: groups })
    } else {
      setLunchConfig({ ...lunchConfig, lunch_groups: [...groups, { slot: slotIdx, grades: [gradeNum] }] })
    }
  }

  function isGradeInSlot(grade, slot) {
    return lunchConfig.lunch_groups.some(g => g.slot === slot && g.grades.includes(grade))
  }

  function handleTeacherCountChange(count) {
    const n = Math.max(0, Number(count))
    if (n > teachers.length) {
      const added = Array.from({ length: n - teachers.length }, (_, i) => ({
        id: crypto.randomUUID(),
        code: `교사${teachers.length + i + 1}`,
        teacher_assignments: [],
      }))
      setTeachers([...teachers, ...added])
    } else {
      setTeachers(teachers.slice(0, n))
    }
  }

  const tabs = [
    { key: 'grade', label: '학급 정보' },
    { key: 'lunch', label: '점심시간 설정' },
    { key: 'teachers', label: '전담 교사' },
  ]

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">학교 설정</h1>
      </div>

      <div className="mb-5">
        <label className="text-[12px] font-semibold text-gray-600 block mb-1">학교명</label>
        <input
          value={schoolName}
          onChange={e => setSchoolName(e.target.value)}
          placeholder="예: OO초등학교"
          className="h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black w-64"
        />
      </div>

      <div className="flex border border-gray-200 bg-white rounded-sm w-fit mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 h-[42px] text-[13px] transition-colors ${
              tab === t.key ? 'bg-black text-white font-semibold' : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'grade' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7 flex flex-col gap-6">
          <div>
            <h2 className="text-[14px] font-semibold mb-1">학년별 학급 수</h2>
            <p className="text-[12px] text-gray-400 mb-4">각 학년의 학급 수를 입력하세요.</p>
            <div className="flex gap-3 flex-wrap">
              {gradeConfigs.map(({ grade, num_classes }) => (
                <div key={grade} className="flex flex-col items-center gap-2">
                  <label className="text-[12px] font-semibold text-gray-500">{grade}학년</label>
                  <input
                    type="number" min={1} max={20} value={num_classes}
                    onChange={e => updateGrade(grade, 'num_classes', e.target.value)}
                    onClick={e => e.target.select()}
                    onFocus={e => e.target.select()}
                    className="w-[72px] h-10 text-center border border-gray-300 rounded-sm text-[14px] font-semibold outline-none focus:border-black"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          <div>
            <h2 className="text-[14px] font-semibold mb-1">학년별 요일별 수업 시수</h2>
            <p className="text-[12px] text-gray-400 mb-4">하루 최대 수업 시수를 입력하세요.</p>
            <div className="border border-gray-200 rounded-sm overflow-hidden">
              <div className="flex bg-gray-50 border-b border-gray-200">
                <div className="w-[80px] flex-shrink-0 px-3 py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200">학년</div>
                {DAYS.map(d => (
                  <div key={d} className="flex-1 text-center py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200">{d}</div>
                ))}
                <div className="w-[80px] flex-shrink-0 text-center py-2 text-[11px] font-semibold text-gray-500 bg-gray-100">합계</div>
              </div>
              {gradeConfigs.map(config => {
                const weekTotal = DAY_KEYS.reduce((sum, key) => sum + (Number(config[key]) || 0), 0)
                return (
                  <div key={config.grade} className="flex border-b border-gray-100 last:border-b-0">
                    <div className="w-[80px] flex-shrink-0 px-3 flex items-center text-[12px] text-gray-600 border-r border-gray-200">{config.grade}학년</div>
                    {DAY_KEYS.map(key => (
                      <div key={key} className="flex-1 border-r border-gray-100 flex items-center justify-center py-1.5">
                        <input
                          type="number" min={1} max={7} value={config[key]}
                          onChange={e => updateGrade(config.grade, key, e.target.value)}
                          onClick={e => e.target.select()}
                          onFocus={e => e.target.select()}
                          className="w-12 h-8 text-center text-[12px] border border-gray-200 rounded-sm outline-none focus:border-black"
                        />
                      </div>
                    ))}
                    <div className="w-[80px] flex-shrink-0 flex items-center justify-center text-[13px] font-semibold text-gray-700 bg-gray-50">
                      {weekTotal}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'lunch' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7 flex flex-col gap-6">
          <div>
            <h2 className="text-[14px] font-semibold mb-4">점심시간 분리 배정</h2>
            <div className="flex gap-6 mb-6">
              {[
                { value: false, label: '일반 (전 학년 동시 점심)' },
                { value: true, label: '분리 배정 (학년별 점심 시간 다름)' },
              ].map(opt => (
                <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer text-[13px]">
                  <input
                    type="radio"
                    checked={lunchConfig.split_lunch === opt.value}
                    onChange={() => setLunchConfig({ ...lunchConfig, split_lunch: opt.value })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {lunchConfig.split_lunch && (
              <div>
                <p className="text-[12px] text-gray-500 mb-4">
                  각 학년의 점심 위치를 체크하세요.<br />
                  3교시 후 점심 = 4교시부터 수업 &nbsp;|&nbsp; 4교시 후 점심 = 5교시부터 수업 &nbsp;|&nbsp; 5교시 후 점심 = 6교시부터 수업
                </p>
                <div className="border border-gray-200 rounded-sm overflow-hidden w-fit">
                  <div className="flex bg-gray-50 border-b border-gray-200">
                    <div className="w-[80px] px-3 py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200">학년</div>
                    {[3, 4, 5].map(slot => (
                      <div key={slot} className="w-[120px] text-center py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">
                        {slot}교시 후 점심
                      </div>
                    ))}
                  </div>
                  {GRADES.map(grade => (
                    <div key={grade} className="flex border-b border-gray-100 last:border-b-0">
                      <div className="w-[80px] px-3 py-2.5 text-[12px] border-r border-gray-200">{grade}학년</div>
                      {[3, 4, 5].map(slot => (
                        <div key={slot} className="w-[120px] flex items-center justify-center border-r border-gray-100 last:border-r-0 py-2">
                          <input
                            type="checkbox"
                            checked={isGradeInSlot(grade, slot)}
                            onChange={() => toggleLunchGrade(grade, slot)}
                            className="w-4 h-4"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'teachers' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7">
          <h2 className="text-[14px] font-semibold mb-1">전담 교사 인원</h2>
          <p className="text-[12px] text-gray-400 mb-5">전담 교사 총 인원을 입력하세요. 명칭은 전담 배정 후 지정할 수 있습니다.</p>
          <div className="flex items-center gap-3">
            <input
              type="number" min={0} max={50}
              value={teachers.length}
              onChange={e => handleTeacherCountChange(e.target.value)}
              onClick={e => e.target.select()}
              className="w-24 h-10 text-center border border-gray-300 rounded-sm text-[18px] font-bold outline-none focus:border-black"
            />
            <span className="text-[14px] text-gray-500">명</span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `src/pages/SubjectSetup.jsx` — remove teachers tab, change page title**

Replace the contents with:
```jsx
import { useApp } from '../context/AppContext'

const GRADES = [1, 2, 3, 4, 5, 6]

export default function SubjectSetup() {
  const { state, setSubjects, setAssignmentSettings } = useApp()
  const { subjects, gradeConfigs, assignmentSettings } = state

  const activeGrades = gradeConfigs.filter(g => g.num_classes > 0).map(g => g.grade)
  const gradesToShow = activeGrades.length > 0 ? activeGrades : GRADES

  function addSubject(grade) {
    setSubjects([...subjects, { id: crypto.randomUUID(), grade, name: '', weekly_hours: 2, is_major: false }])
  }

  function updateSubject(id, field, value) {
    setSubjects(subjects.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function removeSubject(id) {
    setSubjects(subjects.filter(s => s.id !== id))
  }

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold">전담 과목 설정</h1>
        <p className="text-[12px] text-gray-400 mt-1">변경 사항은 자동으로 저장됩니다.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-white border border-gray-200 rounded-sm p-5 flex flex-col gap-3">
          <div>
            <p className="text-[13px] font-semibold text-gray-700 mb-1">주요 과목 vs 일반 과목</p>
            <p className="text-[12px] text-gray-500 leading-5">
              <span className="font-semibold text-gray-700">주요 과목</span>은 전담 부담이 큰 과목입니다. 한 교사가 주요 과목을 여러 개 맡으면 수업 준비 부담이 집중됩니다.<br />
              <span className="font-semibold text-gray-700">일반 과목</span>은 주요 과목에 추가해 맡을 수 있는 과목입니다.
            </p>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={assignmentSettings.maxMajorSubjectsPerTeacher === 1}
                onChange={e => setAssignmentSettings({
                  ...assignmentSettings,
                  maxMajorSubjectsPerTeacher: e.target.checked ? 1 : 99,
                })}
                className="w-4 h-4"
              />
              <span className="text-[13px] text-gray-700">교사 1명당 주요 과목 1개만 배정</span>
            </label>
            <span className="text-[11px] text-gray-400">
              {assignmentSettings.maxMajorSubjectsPerTeacher === 1
                ? '✓ 한 교사가 영어+과학처럼 주요 과목 2개를 동시에 맡지 않습니다.'
                : '제한 없음 — 주요 과목 여러 개를 한 교사가 맡을 수 있습니다.'}
            </span>
          </div>
        </div>

        {gradesToShow.map(grade => (
          <div key={grade} className="bg-white border border-gray-200 rounded-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold">{grade}학년</span>
              <button
                onClick={() => addSubject(grade)}
                className="text-[12px] px-3 h-7 border border-gray-300 rounded-sm hover:bg-gray-50"
              >
                + 과목 추가
              </button>
            </div>
            {subjects.filter(s => s.grade === grade).length === 0 ? (
              <p className="text-[12px] text-gray-300">과목을 추가하세요</p>
            ) : (
              <div className="flex flex-col gap-2">
                {subjects.filter(s => s.grade === grade).map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input
                      placeholder="과목명 (예: 영어)"
                      value={s.name}
                      onChange={e => updateSubject(s.id, 'name', e.target.value)}
                      className="flex-1 h-9 px-3 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">주당</span>
                    <input
                      type="number" min={1} max={10} value={s.weekly_hours}
                      onChange={e => updateSubject(s.id, 'weekly_hours', Number(e.target.value))}
                      onClick={e => e.target.select()}
                      className="w-14 h-9 text-center border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">시수</span>
                    <select
                      value={s.is_major ? '주요' : '일반'}
                      onChange={e => updateSubject(s.id, 'is_major', e.target.value === '주요')}
                      className="h-9 px-2 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black bg-white"
                    >
                      <option>일반</option>
                      <option>주요</option>
                    </select>
                    <button
                      onClick={() => removeSubject(s.id)}
                      className="text-[12px] text-red-400 hover:text-red-600 px-2 h-9"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

> NOTE: This task intentionally keeps SubjectSetup using `state.subjects` (live data, not plans). The plan-aware editing comes in Task 5. This step is just about removing the teacher tab UI and updating the page title — keeping behavior identical otherwise.

- [ ] **Step 3: Manual verification**

Open http://localhost:5173/setup. Click `전담 교사` tab — verify it shows the teacher count input. Change the count, verify it persists on page reload (check localStorage in DevTools).

Open http://localhost:5173/subjects. Verify:
- Page title says "전담 과목 설정"
- No tab UI at the top (no `전담 과목 / 전담 교사` tabs)
- Existing subject editing works as before

- [ ] **Step 4: Commit & push**

```bash
git add src/pages/SchoolSetup.jsx src/pages/SubjectSetup.jsx
git commit -m "refactor: move 전담 교사 인원 to 학교 설정 page"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 5: SubjectSetup — plan tab bar + active-plan editing + 적용 button

**Files:**
- Modify: `src/pages/SubjectSetup.jsx`

> Goal: edits go to active plan (not state.subjects). Apply button copies active plan to state.subjects + clears downstream.

- [ ] **Step 1: Replace `src/pages/SubjectSetup.jsx`**

```jsx
import { useApp } from '../context/AppContext'
import { subjectsEqualByContent } from '../lib/planHelpers'

const GRADES = [1, 2, 3, 4, 5, 6]

export default function SubjectSetup() {
  const { state, updatePlanSubjects, setActivePlanTab, applyPlan, setAssignmentSettings } = useApp()
  const { subjects, gradeConfigs, assignmentSettings, subjectPlans } = state
  const { plans, activeTabId, appliedPlanId, appliedAt } = subjectPlans

  const activePlan = plans.find(p => p.id === activeTabId) || plans[0]
  const planSubjects = activePlan.subjects

  const activeGrades = gradeConfigs.filter(g => g.num_classes > 0).map(g => g.grade)
  const gradesToShow = activeGrades.length > 0 ? activeGrades : GRADES

  const isPlanLive = appliedPlanId === activeTabId && subjectsEqualByContent(planSubjects, subjects)
  const appliedPlan = plans.find(p => p.id === appliedPlanId)

  let statusLine
  if (!appliedPlanId) {
    statusLine = `현재 편집: ${activePlan.name} · 적용 전`
  } else if (isPlanLive) {
    const time = appliedAt ? ` (${new Date(appliedAt).toLocaleString('ko-KR')})` : ''
    statusLine = `현재 편집: ${activePlan.name} · 적용됨${time}`
  } else {
    statusLine = `현재 편집: ${activePlan.name} · 미적용 (적용된 안: ${appliedPlan?.name || '없음'})`
  }

  function addSubject(grade) {
    updatePlanSubjects(activeTabId, [
      ...planSubjects,
      { id: crypto.randomUUID(), grade, name: '', weekly_hours: 2, is_major: false },
    ])
  }

  function updateSubject(id, field, value) {
    updatePlanSubjects(activeTabId, planSubjects.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function removeSubject(id) {
    updatePlanSubjects(activeTabId, planSubjects.filter(s => s.id !== id))
  }

  function handleApply() {
    if (isPlanLive) return
    if (planSubjects.length === 0) {
      const ok = confirm(
        `이 안에는 등록된 과목이 없습니다.\n` +
        `적용 시 전담 과목·배정·시간표가 모두 초기화됩니다.\n\n` +
        `계속하시겠습니까?`
      )
      if (!ok) return
    } else {
      const ok = confirm(
        `${activePlan.name}을 적용합니다.\n` +
        `이전 적용 안과 과목 구성이 달라 다음 데이터가 초기화됩니다:\n` +
        `· 전담 교사 배정\n` +
        `· 전담 시간표\n` +
        `· 특별실 시간표\n` +
        `· 전담 배정 결과\n\n` +
        `계속하시겠습니까?`
      )
      if (!ok) return
    }
    applyPlan(activeTabId)
  }

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold">전담 과목 설정</h1>
        <p className="text-[12px] text-gray-400 mt-1">변경 사항은 자동으로 저장됩니다.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-white border border-gray-200 rounded-sm p-5 flex flex-col gap-3">
          <div>
            <p className="text-[13px] font-semibold text-gray-700 mb-1">주요 과목 vs 일반 과목</p>
            <p className="text-[12px] text-gray-500 leading-5">
              <span className="font-semibold text-gray-700">주요 과목</span>은 전담 부담이 큰 과목입니다. 한 교사가 주요 과목을 여러 개 맡으면 수업 준비 부담이 집중됩니다.<br />
              <span className="font-semibold text-gray-700">일반 과목</span>은 주요 과목에 추가해 맡을 수 있는 과목입니다.
            </p>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={assignmentSettings.maxMajorSubjectsPerTeacher === 1}
                onChange={e => setAssignmentSettings({
                  ...assignmentSettings,
                  maxMajorSubjectsPerTeacher: e.target.checked ? 1 : 99,
                })}
                className="w-4 h-4"
              />
              <span className="text-[13px] text-gray-700">교사 1명당 주요 과목 1개만 배정</span>
            </label>
            <span className="text-[11px] text-gray-400">
              {assignmentSettings.maxMajorSubjectsPerTeacher === 1
                ? '✓ 한 교사가 영어+과학처럼 주요 과목 2개를 동시에 맡지 않습니다.'
                : '제한 없음 — 주요 과목 여러 개를 한 교사가 맡을 수 있습니다.'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex border border-gray-200 bg-white rounded-sm w-fit">
              {plans.map(p => (
                <button
                  key={p.id}
                  onClick={() => setActivePlanTab(p.id)}
                  className={`px-5 h-9 text-[13px] transition-colors ${
                    activeTabId === p.id ? 'bg-black text-white font-semibold' : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button
              onClick={handleApply}
              disabled={isPlanLive}
              className={`px-4 h-9 text-[13px] font-semibold rounded-sm border transition-colors ${
                isPlanLive
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-black text-white border-black hover:bg-gray-800'
              }`}
            >
              ✓ 이 안 적용
            </button>
          </div>
          <p className="text-[11px] text-gray-500 px-1">{statusLine}</p>
        </div>

        {gradesToShow.map(grade => (
          <div key={grade} className="bg-white border border-gray-200 rounded-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold">{grade}학년</span>
              <button
                onClick={() => addSubject(grade)}
                className="text-[12px] px-3 h-7 border border-gray-300 rounded-sm hover:bg-gray-50"
              >
                + 과목 추가
              </button>
            </div>
            {planSubjects.filter(s => s.grade === grade).length === 0 ? (
              <p className="text-[12px] text-gray-300">과목을 추가하세요</p>
            ) : (
              <div className="flex flex-col gap-2">
                {planSubjects.filter(s => s.grade === grade).map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input
                      placeholder="과목명 (예: 영어)"
                      value={s.name}
                      onChange={e => updateSubject(s.id, 'name', e.target.value)}
                      className="flex-1 h-9 px-3 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">주당</span>
                    <input
                      type="number" min={1} max={10} value={s.weekly_hours}
                      onChange={e => updateSubject(s.id, 'weekly_hours', Number(e.target.value))}
                      onClick={e => e.target.select()}
                      className="w-14 h-9 text-center border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">시수</span>
                    <select
                      value={s.is_major ? '주요' : '일반'}
                      onChange={e => updateSubject(s.id, 'is_major', e.target.value === '주요')}
                      className="h-9 px-2 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black bg-white"
                    >
                      <option>일반</option>
                      <option>주요</option>
                    </select>
                    <button
                      onClick={() => removeSubject(s.id)}
                      className="text-[12px] text-red-400 hover:text-red-600 px-2 h-9"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write smoke test**

Create `src/pages/SubjectSetup.test.jsx`:
```jsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider } from '../context/AppContext'
import SubjectSetup from './SubjectSetup'

function renderPage() {
  return render(<AppProvider><SubjectSetup /></AppProvider>)
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  localStorage.clear()
})

describe('SubjectSetup', () => {
  it('renders the page title', () => {
    renderPage()
    expect(screen.getByText('전담 과목 설정')).toBeInTheDocument()
  })

  it('renders 3 plan tabs (A안, B안, C안)', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'A안' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'B안' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'C안' })).toBeInTheDocument()
  })

  it('shows "적용 전" status on first launch with empty plans', () => {
    renderPage()
    expect(screen.getByText(/적용 전/)).toBeInTheDocument()
  })

  it('switches active plan tab on click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'B안' }))
    // Status line should now mention B안
    expect(screen.getByText(/현재 편집: B안/)).toBeInTheDocument()
  })

  it('disables 적용 button when plan is already applied and unchanged', async () => {
    // Seed: plan1 contains a subject, state.subjects matches, appliedPlanId=plan1
    const seedSubject = { id: 'sx', grade: 1, name: '영어', weekly_hours: 3, is_major: true }
    const stored = {
      gradeConfigs: [
        { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      ],
      subjects: [seedSubject],
      teachers: [],
      rooms: [],
      roomBlockedSlots: [],
      timetableSlots: [],
      roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 },
      assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] },
      schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [{ ...seedSubject }] },
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1',
        appliedPlanId: 'plan1',
        appliedAt: new Date().toISOString(),
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    const applyBtn = screen.getByRole('button', { name: /이 안 적용/ })
    expect(applyBtn).toBeDisabled()
  })
})
```

- [ ] **Step 3: Run all tests**

```bash
npm run test:run
```

Expected: All previous tests still pass; 5 new SubjectSetup smoke tests pass.

- [ ] **Step 4: Manual verification**

Open http://localhost:5173/subjects. Verify:
- Page shows `A안 / B안 / C안` tab bar with `✓ 이 안 적용` button on the right.
- Status line says `현재 편집: A안 · 적용됨 (...)` if you had existing data, or `적용 전` if fresh.
- Clicking `B안` switches active tab; status line updates to `현재 편집: B안 · 미적용 ...`.
- Adding a subject in B안 does NOT affect 전담 시간표 or 전담 배정 pages (open `/timetable` to confirm — should still be empty for B안 changes).
- Clicking `✓ 이 안 적용` on B안 → confirm dialog → accepting copies B안's subjects to state.subjects, clears teacher_assignments, etc. Reload `/subjects` and verify B안 status shows "적용됨".

- [ ] **Step 5: Commit & push**

```bash
git add src/pages/SubjectSetup.jsx src/pages/SubjectSetup.test.jsx
git commit -m "feat: add A/B/C plan tabs + apply button to subject setup"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 6: 담임시수 widget per grade card

**Files:**
- Modify: `src/pages/SubjectSetup.jsx`

- [ ] **Step 1: Update SubjectSetup grade card header**

In `src/pages/SubjectSetup.jsx`, add an import:
```jsx
import { subjectsEqualByContent, getDedicatedHoursForGrade, getWeeklyTotalForGrade } from '../lib/planHelpers'
```

Replace the `<div className="flex items-center justify-between mb-3">` block inside the grade card map with:
```jsx
<div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-3">
    <span className="text-[14px] font-semibold">{grade}학년</span>
    <button
      onClick={() => addSubject(grade)}
      className="text-[12px] px-3 h-7 border border-gray-300 rounded-sm hover:bg-gray-50"
    >
      + 과목 추가
    </button>
  </div>
  {(() => {
    const dedicated = getDedicatedHoursForGrade(planSubjects, grade)
    const weeklyTotal = getWeeklyTotalForGrade(gradeConfigs, grade)
    if (weeklyTotal === 0) {
      return <span className="text-[12px] text-gray-400">학교 설정 필요</span>
    }
    const homeroom = weeklyTotal - dedicated
    const isOver = dedicated > weeklyTotal
    return (
      <div className="text-right">
        <div className={`text-[15px] font-bold ${isOver ? 'text-red-600' : 'text-gray-900'}`}>
          담임시수: {homeroom} / {weeklyTotal}
        </div>
        <div className={`text-[11px] ${isOver ? 'text-red-500' : 'text-gray-400'}`}>
          {isOver ? `(초과 ${homeroom})` : `(전담 ${dedicated}시간)`}
        </div>
      </div>
    )
  })()}
</div>
```

> The `+ 과목 추가` button moves to be inline with the grade label so the right side is reserved for the widget.

- [ ] **Step 2: Manual verification**

Open http://localhost:5173/subjects.
- Each grade card shows `담임시수: N / M (전담 K시간)` on the right.
- Add subjects to a grade — watch the numbers update live.
- Add too many subjects to push dedicated > weeklyTotal — widget turns red, shows `(초과 -X)`.
- Switch tabs (A → B) — widget recalculates per tab.

- [ ] **Step 3: Add a smoke test for the widget**

Append to `src/pages/SubjectSetup.test.jsx`:
```jsx
describe('담임시수 widget', () => {
  it('shows 담임시수 = weekly total - dedicated', () => {
    const stored = {
      gradeConfigs: [
        { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 2, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 3, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 4, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 5, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 6, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      ],
      subjects: [],
      teachers: [], rooms: [], roomBlockedSlots: [], timetableSlots: [], roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }, assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] }, schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [
            { id: 's1', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
            { id: 's2', grade: 1, name: '음악', weekly_hours: 2, is_major: false },
          ]},
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    // weeklyTotal=25, dedicated=5 → homeroom=20
    expect(screen.getByText(/담임시수: 20 \/ 25/)).toBeInTheDocument()
    expect(screen.getByText(/전담 5시간/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 5: Commit & push**

```bash
git add src/pages/SubjectSetup.jsx src/pages/SubjectSetup.test.jsx
git commit -m "feat: show real-time 담임시수 widget per grade card"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 7: Narrow grade card + compact subject row

**Files:**
- Modify: `src/pages/SubjectSetup.jsx`

- [ ] **Step 1: Update grade card width and subject name input width**

In `src/pages/SubjectSetup.jsx`, change the grade card rendering. Find the line:
```jsx
{gradesToShow.map(grade => (
  <div key={grade} className="bg-white border border-gray-200 rounded-sm p-5">
```

Replace with:
```jsx
{gradesToShow.map(grade => (
  <div key={grade} className="bg-white border border-gray-200 rounded-sm p-5 max-w-[720px]">
```

Then find the subject name input:
```jsx
<input
  placeholder="과목명 (예: 영어)"
  value={s.name}
  onChange={e => updateSubject(s.id, 'name', e.target.value)}
  className="flex-1 h-9 px-3 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
/>
```

Replace with:
```jsx
<input
  placeholder="과목명 (예: 영어)"
  value={s.name}
  onChange={e => updateSubject(s.id, 'name', e.target.value)}
  className="w-[240px] h-9 px-3 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
/>
```

> Width chosen to balance readability of long Korean subject names with horizontal compactness. Card max-width 720px keeps 담임시수 widget visually anchored.

Also apply the same `max-w-[720px]` to the info box (주요/일반 안내) and the tab/action bar so they line up. Find:
```jsx
<div className="bg-white border border-gray-200 rounded-sm p-5 flex flex-col gap-3">
  <div>
    <p className="text-[13px] font-semibold text-gray-700 mb-1">주요 과목 vs 일반 과목</p>
```

Change className to `max-w-[720px] bg-white border border-gray-200 rounded-sm p-5 flex flex-col gap-3`.

Find:
```jsx
<div className="bg-white border border-gray-200 rounded-sm p-3 flex flex-col gap-2">
  <div className="flex items-center justify-between">
    <div className="flex border border-gray-200 bg-white rounded-sm w-fit">
```

Change the outer div to `max-w-[720px] bg-white border border-gray-200 rounded-sm p-3 flex flex-col gap-2`.

- [ ] **Step 2: Manual verification**

Open http://localhost:5173/subjects. Verify:
- Grade cards are narrower (cap at ~720px), no longer stretching across the full content area.
- Subject name input is fixed width (~240px), not stretching.
- 담임시수 widget on right is comfortably anchored, not floating in empty space.
- Tab bar and info box are also at the same max-width — visually aligned.

- [ ] **Step 3: Commit & push**

```bash
git add src/pages/SubjectSetup.jsx
git commit -m "style: tighten subject card width and subject name input"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 8: Overflow detection — disable apply button on overflow

**Files:**
- Modify: `src/pages/SubjectSetup.jsx`

- [ ] **Step 1: Update apply button disabled logic and tooltip**

In `src/pages/SubjectSetup.jsx`:

Add `getOverflowGrades` to the import from planHelpers:
```jsx
import { subjectsEqualByContent, getDedicatedHoursForGrade, getWeeklyTotalForGrade, getOverflowGrades } from '../lib/planHelpers'
```

Inside the component (after `appliedPlan = ...`), add:
```jsx
const overflowGrades = getOverflowGrades(planSubjects, gradeConfigs, gradesToShow)
const hasOverflow = overflowGrades.length > 0
const overflowMsg = hasOverflow
  ? `초과 학년이 있어 적용할 수 없습니다 (${overflowGrades.map(o => `${o.grade}학년 초과 -${o.overBy}시간`).join(', ')})`
  : ''

const isApplyDisabled = isPlanLive || hasOverflow
```

Change the apply button to:
```jsx
<button
  onClick={handleApply}
  disabled={isApplyDisabled}
  title={hasOverflow ? overflowMsg : ''}
  className={`px-4 h-9 text-[13px] font-semibold rounded-sm border transition-colors ${
    isApplyDisabled
      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
      : 'bg-black text-white border-black hover:bg-gray-800'
  }`}
>
  ✓ 이 안 적용
</button>
```

Also guard `handleApply` against overflow:
```jsx
function handleApply() {
  if (isApplyDisabled) return
  // ... existing code ...
}
```

(Replace the existing `if (isPlanLive) return` with `if (isApplyDisabled) return`.)

- [ ] **Step 2: Add a smoke test for the overflow case**

Append to `src/pages/SubjectSetup.test.jsx`:
```jsx
describe('overflow handling', () => {
  it('disables apply button when a grade exceeds weekly total', () => {
    const stored = {
      gradeConfigs: [
        { grade: 1, num_classes: 4, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 2, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 3, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 4, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 5, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
        { grade: 6, num_classes: 0, periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 5 },
      ],
      subjects: [],
      teachers: [], rooms: [], roomBlockedSlots: [], timetableSlots: [], roomTimetableSlots: [],
      assignmentSettings: { maxMajorSubjectsPerTeacher: 1 }, assignmentResult: null,
      lunchConfig: { split_lunch: false, lunch_groups: [] }, schoolName: '',
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [
            { id: 's1', grade: 1, name: '영어', weekly_hours: 30, is_major: true },
          ]},
          { id: 'plan2', name: 'B안', subjects: [] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan1', appliedPlanId: null, appliedAt: null,
      },
    }
    localStorage.setItem('timetable_app_data', JSON.stringify(stored))
    renderPage()
    const applyBtn = screen.getByRole('button', { name: /이 안 적용/ })
    expect(applyBtn).toBeDisabled()
    expect(applyBtn).toHaveAttribute('title', expect.stringMatching(/초과 학년이 있어 적용할 수 없습니다/))
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 4: Manual verification**

Open http://localhost:5173/subjects. Add subjects until any grade's dedicated > weekly total — observe:
- Widget turns red, shows `(초과 -N)`.
- `✓ 이 안 적용` button becomes gray/disabled.
- Hover button → tooltip: `초과 학년이 있어 적용할 수 없습니다 (1학년 초과 -N시간, ...)`.
- Reduce a subject's hours → button re-enables.

- [ ] **Step 5: Commit & push**

```bash
git add src/pages/SubjectSetup.jsx src/pages/SubjectSetup.test.jsx
git commit -m "feat: block apply when any grade exceeds weekly total"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 9: Comparison modal — `SubjectPlanComparison.jsx`

**Files:**
- Create: `src/components/SubjectPlanComparison.jsx`
- Create: `src/components/SubjectPlanComparison.test.jsx`
- Modify: `src/pages/SubjectSetup.jsx`

- [ ] **Step 1: Write failing tests for the modal**

Create `src/components/SubjectPlanComparison.test.jsx`:
```jsx
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
  { id: 'plan3', name: 'C안', subjects: [{ id: 'c1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test:run -- src/components/SubjectPlanComparison.test.jsx
```

Expected: All fail with module-not-found.

- [ ] **Step 3: Create the modal component**

Create `src/components/SubjectPlanComparison.jsx`:
```jsx
import {
  getDedicatedHoursForGrade,
  getWeeklyTotalForGrade,
  getOverflowGrades,
  classifySubjectsAcrossPlans,
  subjectsEqualByContent,
} from '../lib/planHelpers'

export default function SubjectPlanComparison({
  plans,
  gradeConfigs,
  gradesToShow,
  appliedPlanId,
  liveSubjects,
  onClose,
  onApply,
  schoolName,
}) {
  const printDate = new Date().toLocaleDateString('ko-KR')

  function totalDedicated(planSubjects) {
    return planSubjects.reduce((sum, s) => sum + (Number(s.weekly_hours) || 0), 0)
  }

  function isApplyDisabledForPlan(plan) {
    const overflows = getOverflowGrades(plan.subjects, gradeConfigs, gradesToShow)
    if (overflows.length > 0) return { disabled: true, reason: 'overflow', overflows }
    const isLive = appliedPlanId === plan.id && subjectsEqualByContent(plan.subjects, liveSubjects)
    if (isLive) return { disabled: true, reason: 'live' }
    return { disabled: false }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:bg-transparent print:relative print:inset-auto print:block">
      <div className="bg-white rounded-sm shadow-2xl w-[90vw] h-[90vh] max-w-[1400px] flex flex-col print:w-auto print:h-auto print:max-w-full print:shadow-none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 print:hidden">
          <h2 className="text-[18px] font-bold">전담 배정안 비교</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-[12px] px-3 h-8 border border-gray-300 rounded-sm hover:bg-gray-50"
          >
            닫기
          </button>
        </div>

        <div className="hidden print:block px-6 pt-4 text-right text-[11px] text-gray-600">
          {schoolName || '학교'} · {printDate} 출력
        </div>

        <div className="flex-1 overflow-auto p-6 flex flex-col gap-8 print:overflow-visible">
          <section>
            <h3 className="text-[14px] font-semibold mb-3">학년별 담임시수 비교</h3>
            <div className="border border-gray-200 rounded-sm overflow-hidden">
              <div className="grid grid-cols-[80px_100px_repeat(3,1fr)] bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500">
                <div className="px-3 py-2 border-r border-gray-200">학년</div>
                <div className="px-3 py-2 text-center border-r border-gray-200">주당총합</div>
                {plans.map(p => (
                  <div key={p.id} className="px-3 py-2 text-center border-r border-gray-200 last:border-r-0">{p.name}</div>
                ))}
              </div>
              {gradesToShow.map(grade => {
                const weeklyTotal = getWeeklyTotalForGrade(gradeConfigs, grade)
                return (
                  <div key={grade} className="grid grid-cols-[80px_100px_repeat(3,1fr)] border-b border-gray-100 text-[12px]">
                    <div className="px-3 py-2 border-r border-gray-200">{grade}학년</div>
                    <div className="px-3 py-2 text-center border-r border-gray-200">{weeklyTotal}</div>
                    {plans.map(p => {
                      const dedicated = getDedicatedHoursForGrade(p.subjects, grade)
                      const homeroom = weeklyTotal - dedicated
                      const isOver = dedicated > weeklyTotal
                      const cellText = p.subjects.length === 0
                        ? '—'
                        : `${homeroom} (${-dedicated})`
                      return (
                        <div
                          key={p.id}
                          className={`px-3 py-2 text-center border-r border-gray-100 last:border-r-0 ${isOver ? 'text-red-600 font-semibold' : ''}`}
                        >
                          {cellText}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              <div className="grid grid-cols-[80px_100px_repeat(3,1fr)] bg-gray-50 text-[12px] font-semibold">
                <div className="px-3 py-2 border-r border-gray-200">전담 합계</div>
                <div className="px-3 py-2 border-r border-gray-200" />
                {plans.map(p => (
                  <div key={p.id} className="px-3 py-2 text-center border-r border-gray-200 last:border-r-0">
                    {p.subjects.length === 0 ? '—' : `${totalDedicated(p.subjects)}시간`}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[14px] font-semibold mb-3">학년별 과목 구성</h3>
            <div className="border border-gray-200 rounded-sm overflow-hidden">
              <div className="grid grid-cols-[80px_repeat(3,1fr)] bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500">
                <div className="px-3 py-2 border-r border-gray-200">학년</div>
                {plans.map(p => (
                  <div key={p.id} className="px-3 py-2 text-center border-r border-gray-200 last:border-r-0">{p.name}</div>
                ))}
              </div>
              {gradesToShow.map(grade => {
                const classified = classifySubjectsAcrossPlans(plans, grade)
                return (
                  <div key={grade} className="grid grid-cols-[80px_repeat(3,1fr)] border-b border-gray-100 text-[12px]">
                    <div className="px-3 py-2 border-r border-gray-200">{grade}학년</div>
                    {classified.map((arr, idx) => (
                      <div key={plans[idx].id} className="px-3 py-2 border-r border-gray-100 last:border-r-0">
                        {arr.length === 0 ? (
                          <span className="text-gray-300">(과목 없음)</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {arr.map(({ subject, differs }) => (
                              <span key={subject.id} className={differs ? 'font-bold text-gray-900' : 'text-gray-600'}>
                                {subject.name || '(이름 없음)'} {subject.weekly_hours}시간 ({subject.is_major ? '주요' : '일반'})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between print:hidden">
          <div className="text-[12px] text-gray-500">
            현재 적용: {plans.find(p => p.id === appliedPlanId)?.name || '없음'}
          </div>
          <div className="flex items-center gap-2">
            {plans.map(p => {
              const { disabled, reason, overflows } = isApplyDisabledForPlan(p)
              const title = reason === 'overflow'
                ? `초과 학년이 있어 적용할 수 없습니다 (${overflows.map(o => `${o.grade}학년 초과 -${o.overBy}시간`).join(', ')})`
                : ''
              return (
                <button
                  key={p.id}
                  onClick={() => onApply(p.id)}
                  disabled={disabled}
                  title={title}
                  className={`px-3 h-9 text-[12px] font-semibold rounded-sm border transition-colors ${
                    disabled
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-black text-white border-black hover:bg-gray-800'
                  }`}
                >
                  {p.name} 적용
                </button>
              )
            })}
            <button
              onClick={() => window.print()}
              className="px-3 h-9 text-[12px] border border-gray-300 rounded-sm hover:bg-gray-50"
            >
              🖨 인쇄 / PDF 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire `📊 비교 보기` button into SubjectSetup**

In `src/pages/SubjectSetup.jsx`:

Add imports:
```jsx
import { useState } from 'react'
import SubjectPlanComparison from '../components/SubjectPlanComparison'
```

Inside the component, add state and handler:
```jsx
const [showComparison, setShowComparison] = useState(false)

function handleOpenCompare() {
  const filledCount = plans.filter(p => p.subjects.length > 0).length
  if (filledCount === 0) {
    alert('A·B·C안 모두 비어 있습니다. 먼저 과목을 입력하세요.')
    return
  }
  if (filledCount === 1) {
    const onlyPlan = plans.find(p => p.subjects.length > 0)
    const ok = confirm(`비교할 다른 안이 없습니다. ${onlyPlan.name}을 바로 적용할까요?`)
    if (ok) {
      // Reuse handleApply logic by switching active tab first
      setActivePlanTab(onlyPlan.id)
      // Apply via reducer; downstream warnings are skipped here per spec ("바로 적용")
      const overflows = getOverflowGrades(onlyPlan.subjects, gradeConfigs, gradesToShow)
      if (overflows.length > 0) {
        alert(`${onlyPlan.name}에 초과 학년이 있어 적용할 수 없습니다 (${overflows.map(o => `${o.grade}학년 초과 -${o.overBy}시간`).join(', ')}).`)
        return
      }
      applyPlan(onlyPlan.id)
    }
    return
  }
  setShowComparison(true)
}

function handleApplyFromComparison(planId) {
  const plan = plans.find(p => p.id === planId)
  if (!plan) return
  const overflows = getOverflowGrades(plan.subjects, gradeConfigs, gradesToShow)
  if (overflows.length > 0) return  // button is disabled but defensive
  // Show same confirm as inline apply
  const isLive = appliedPlanId === planId && subjectsEqualByContent(plan.subjects, subjects)
  if (isLive) {
    setShowComparison(false)
    return
  }
  if (plan.subjects.length === 0) {
    if (!confirm(
      `이 안에는 등록된 과목이 없습니다.\n` +
      `적용 시 전담 과목·배정·시간표가 모두 초기화됩니다.\n\n` +
      `계속하시겠습니까?`
    )) return
  } else {
    if (!confirm(
      `${plan.name}을 적용합니다.\n` +
      `이전 적용 안과 과목 구성이 달라 다음 데이터가 초기화됩니다:\n` +
      `· 전담 교사 배정\n` +
      `· 전담 시간표\n` +
      `· 특별실 시간표\n` +
      `· 전담 배정 결과\n\n` +
      `계속하시겠습니까?`
    )) return
  }
  applyPlan(planId)
  setShowComparison(false)
}
```

Add a `📊 비교 보기` button between the tab bar and the apply button. Replace the right-side cluster:
```jsx
<button
  onClick={handleApply}
  disabled={isApplyDisabled}
  title={hasOverflow ? overflowMsg : ''}
  className={`px-4 h-9 text-[13px] font-semibold rounded-sm border transition-colors ${
    isApplyDisabled
      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
      : 'bg-black text-white border-black hover:bg-gray-800'
  }`}
>
  ✓ 이 안 적용
</button>
```

with:
```jsx
<div className="flex items-center gap-2">
  <button
    onClick={handleOpenCompare}
    className="px-4 h-9 text-[13px] rounded-sm border border-gray-300 hover:bg-gray-50"
  >
    📊 비교 보기
  </button>
  <button
    onClick={handleApply}
    disabled={isApplyDisabled}
    title={hasOverflow ? overflowMsg : ''}
    className={`px-4 h-9 text-[13px] font-semibold rounded-sm border transition-colors ${
      isApplyDisabled
        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
        : 'bg-black text-white border-black hover:bg-gray-800'
    }`}
  >
    ✓ 이 안 적용
  </button>
</div>
```

Render the modal at the end of the outer `<div>`:
```jsx
{showComparison && (
  <SubjectPlanComparison
    plans={plans}
    gradeConfigs={gradeConfigs}
    gradesToShow={gradesToShow}
    appliedPlanId={appliedPlanId}
    liveSubjects={subjects}
    schoolName={state.schoolName}
    onClose={() => setShowComparison(false)}
    onApply={handleApplyFromComparison}
  />
)}
```

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 6: Manual verification**

Open http://localhost:5173/subjects.
- Fill A안, B안, C안 with different subject sets.
- Click `📊 비교 보기` → modal opens with both tables.
- Differences in 과목 구성 표 are bolded (e.g. weekly_hours difference).
- Click `B안 적용` → confirm dialog → accepting closes modal, switches active to B안, status line says "적용됨".
- Empty B안 case: clear B안 subjects, open compare → B안 column shows "(과목 없음)", `B안 적용` button is enabled (apply confirms first with empty-warning).
- Single-plan case: clear A안 and B안, leaving only C안 with subjects → click compare → `"비교할 다른 안이 없습니다. C안을 바로 적용할까요?"` confirm → accept applies C안.
- Empty case: clear all 3 plans → click compare → alert "모두 비어 있습니다".

- [ ] **Step 7: Commit & push**

```bash
git add src/components/SubjectPlanComparison.jsx src/components/SubjectPlanComparison.test.jsx src/pages/SubjectSetup.jsx
git commit -m "feat: comparison modal with side-by-side plan diff view"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 10: Print stylesheet for comparison modal

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Append print styles**

Read the current `src/index.css` to confirm Tailwind directives are present, then append at the end:
```css
@media print {
  /* Hide page chrome (sidebar, header, etc.) when printing the comparison modal */
  body * {
    visibility: hidden;
  }
  .print-modal-root,
  .print-modal-root * {
    visibility: visible;
  }
  .print-modal-root {
    position: absolute;
    inset: 0;
    background: white !important;
  }
}
```

> NOTE: Tailwind's `print:` variants on the modal markup (added in Task 9) already handle most cases. The explicit body-hide rule above ensures the layout sidebar disappears when printing from the comparison modal.

- [ ] **Step 2: Add `print-modal-root` class to the modal outer div**

In `src/components/SubjectPlanComparison.jsx`, change the outermost div:
```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:bg-transparent print:relative print:inset-auto print:block">
```
to:
```jsx
<div className="print-modal-root fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:bg-transparent print:relative print:inset-auto print:block">
```

- [ ] **Step 3: Manual verification**

Open http://localhost:5173/subjects with at least 2 plans filled. Open compare modal → click `🖨 인쇄 / PDF 저장`. In the print preview:
- Sidebar/page header are hidden.
- Modal header (close button) and footer (apply buttons, print button) are hidden.
- The two tables (담임시수, 과목 구성) are visible.
- Top-right shows "{학교명} · YYYY-MM-DD 출력".

- [ ] **Step 4: Commit & push**

```bash
git add src/index.css src/components/SubjectPlanComparison.jsx
git commit -m "style: add print stylesheet for comparison modal"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 11: Excel export/import — `subjectPlans` sheets

**Files:**
- Modify: `src/lib/excelIO.js`
- Create: `src/lib/excelIO.test.js`

- [ ] **Step 1: Write failing tests for round-trip**

Create `src/lib/excelIO.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { initialState } from './storage'
import { exportFullWorkbook, importFullWorkbook } from './excelIO'
import * as XLSX from 'xlsx'

// exportFullWorkbook calls XLSX.writeFile which downloads a file.
// For testing, monkey-patch XLSX.writeFile to capture the workbook.
// Then convert it to a Blob for importFullWorkbook to read back.

function exportToBuffer(state) {
  let captured = null
  const origWriteFile = XLSX.writeFile
  XLSX.writeFile = (wb) => { captured = wb }
  try {
    exportFullWorkbook(state)
  } finally {
    XLSX.writeFile = origWriteFile
  }
  return XLSX.write(captured, { type: 'array', bookType: 'xlsx' })
}

function bufferToFile(buffer, filename = 'test.xlsx') {
  return new File([buffer], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

describe('excelIO round-trip — subjectPlans', () => {
  it('preserves all 3 plans and meta on export+import', async () => {
    const state = {
      ...initialState,
      schoolName: 'TEST',
      subjects: [{ id: 'live', grade: 1, name: '영어', weekly_hours: 3, is_major: true }],
      subjectPlans: {
        plans: [
          { id: 'plan1', name: 'A안', subjects: [{ id: 'a1', grade: 1, name: '영어', weekly_hours: 3, is_major: true }] },
          { id: 'plan2', name: 'B안', subjects: [{ id: 'b1', grade: 2, name: '음악', weekly_hours: 2, is_major: false }] },
          { id: 'plan3', name: 'C안', subjects: [] },
        ],
        activeTabId: 'plan2',
        appliedPlanId: 'plan1',
        appliedAt: '2026-05-07T12:00:00.000Z',
      },
    }
    const buffer = exportToBuffer(state)
    const imported = await importFullWorkbook(bufferToFile(buffer))

    expect(imported.subjectPlans.plans[0].subjects).toHaveLength(1)
    expect(imported.subjectPlans.plans[0].subjects[0].name).toBe('영어')
    expect(imported.subjectPlans.plans[1].subjects).toHaveLength(1)
    expect(imported.subjectPlans.plans[1].subjects[0].name).toBe('음악')
    expect(imported.subjectPlans.plans[2].subjects).toEqual([])
    expect(imported.subjectPlans.activeTabId).toBe('plan2')
    expect(imported.subjectPlans.appliedPlanId).toBe('plan1')
    expect(imported.subjectPlans.appliedAt).toBe('2026-05-07T12:00:00.000Z')
  })

  it('migrates legacy import (no plan sheets) — copies subjects to plan1', async () => {
    // Build a workbook that lacks subjectPlans sheets
    const state = { ...initialState, schoolName: 'OLD', subjects: [
      { id: 'x', grade: 1, name: '영어', weekly_hours: 3, is_major: true },
    ]}
    // Use exportFullWorkbook to get a normal workbook, then strip the plan sheets
    const buffer = exportToBuffer(state)
    const wb = XLSX.read(buffer, { type: 'array' })
    delete wb.Sheets['과목설정_A안']
    delete wb.Sheets['과목설정_B안']
    delete wb.Sheets['과목설정_C안']
    delete wb.Sheets['과목안메타']
    wb.SheetNames = wb.SheetNames.filter(n => !n.startsWith('과목설정_') && n !== '과목안메타')
    const stripped = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

    const imported = await importFullWorkbook(bufferToFile(stripped))
    expect(imported.subjectPlans.plans[0].subjects).toHaveLength(1)
    expect(imported.subjectPlans.plans[0].subjects[0].name).toBe('영어')
    expect(imported.subjectPlans.plans[1].subjects).toEqual([])
    expect(imported.subjectPlans.plans[2].subjects).toEqual([])
    expect(imported.subjectPlans.appliedPlanId).toBe('plan1')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test:run -- src/lib/excelIO.test.js
```

Expected: tests fail because export doesn't write plan sheets.

- [ ] **Step 3: Update `src/lib/excelIO.js`**

In `src/lib/excelIO.js`, after the existing `// 시트3: 과목설정` block (around line 30) but before `// 시트4: 교사목록`, add:
```js
  // 시트3-A/B/C: 안별 과목설정
  for (const plan of (state.subjectPlans?.plans || [])) {
    const rows = [['ID', '학년', '과목명', '주당시수', '구분']]
    for (const s of plan.subjects) {
      rows.push([s.id, s.grade, s.name, s.weekly_hours, s.is_major ? '주요' : '일반'])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `과목설정_${plan.name}`)
  }

  // 시트3-meta: 과목안메타
  const metaRows = [
    ['키', '값'],
    ['activeTabId', state.subjectPlans?.activeTabId || 'plan1'],
    ['appliedPlanId', state.subjectPlans?.appliedPlanId || ''],
    ['appliedAt', state.subjectPlans?.appliedAt || ''],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), '과목안메타')
```

In `importFullWorkbook`, after the existing `// 과목설정` block (around line 128, where `state.subjects = subjectRows.map(...)`), add:
```js
  // subjectPlans: 안별 과목설정 + 메타
  function readPlanSheet(planName) {
    const rows = getSheet(`과목설정_${planName}`).slice(1).filter(r => r[0])
    return rows.map(r => ({
      id: String(r[0]) || crypto.randomUUID(),
      grade: Number(r[1]),
      name: String(r[2]),
      weekly_hours: Number(r[3]) || 2,
      is_major: r[4] === '주요',
    }))
  }
  const planNames = [
    { id: 'plan1', name: 'A안' },
    { id: 'plan2', name: 'B안' },
    { id: 'plan3', name: 'C안' },
  ]
  const hasPlanSheets = planNames.some(({ name }) => wb.Sheets[`과목설정_${name}`])
  if (hasPlanSheets) {
    const metaRows = getSheet('과목안메타').slice(1).filter(r => r[0])
    const meta = Object.fromEntries(metaRows.map(r => [String(r[0]), String(r[1] ?? '')]))
    state.subjectPlans = {
      plans: planNames.map(({ id, name }) => ({ id, name, subjects: readPlanSheet(name) })),
      activeTabId: meta.activeTabId || 'plan1',
      appliedPlanId: meta.appliedPlanId || null,
      appliedAt: meta.appliedAt || null,
    }
  } else {
    // Legacy import — clone subjects to plan1
    const cloneSubject = s => ({ ...s })
    state.subjectPlans = {
      plans: [
        { id: 'plan1', name: 'A안', subjects: state.subjects.map(cloneSubject) },
        { id: 'plan2', name: 'B안', subjects: [] },
        { id: 'plan3', name: 'C안', subjects: [] },
      ],
      activeTabId: 'plan1',
      appliedPlanId: state.subjects.length > 0 ? 'plan1' : null,
      appliedAt: null,
    }
  }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test:run -- src/lib/excelIO.test.js
```

Expected: 2 round-trip tests pass.

Run full suite:
```bash
npm run test:run
```

Expected: all pass.

- [ ] **Step 5: Manual verification**

Open http://localhost:5173/. Fill in A안, B안, C안 with different subjects. Click `저장 (엑셀 내보내기)` (left sidebar). Open the resulting `.xlsx` in Excel — confirm sheets `과목설정_A안`, `과목설정_B안`, `과목설정_C안`, `과목안메타` exist with correct rows.

Click `불러오기 (엑셀 가져오기)` and select the file you just exported → confirm overwrite → reload `/subjects` → verify A/B/C plans look identical to before.

- [ ] **Step 6: Commit & push**

```bash
git add src/lib/excelIO.js src/lib/excelIO.test.js
git commit -m "feat: include subjectPlans in excel export/import with legacy migration"
git push origin claude/objective-satoshi-ddf3e5
```

---

## Task 12: Final smoke walkthrough

**Files:** None (manual end-to-end walkthrough).

- [ ] **Step 1: Run full test suite one last time**

```bash
npm run test:run
```

Expected: all tests pass, no warnings.

- [ ] **Step 2: Run a fresh-user smoke walkthrough**

Clear localStorage in browser DevTools (`localStorage.clear()` in console), refresh http://localhost:5173:

1. **학교 설정** — fill학교명, set 1학년 num_classes=4, 월~금=5,5,5,5,5 (total 25). Click `전담 교사` tab → set count to 2.
2. **전담 과목 설정** — open `/subjects`, currently A안 active and 적용 전.
   - Add 1학년 영어 3시간 주요. Status should still say "적용 전" (or "현재 편집: A안 · 미적용").
   - Click `✓ 이 안 적용` — confirm. Status changes to "적용됨".
3. **B안 작성** — switch tab to B안, add 1학년 영어 4시간 주요.
4. **C안 작성** — switch to C안, leave empty.
5. **비교 보기** — click `📊 비교 보기` → modal opens.
   - Verify A안 row shows `22 (-3)`, B안 shows `21 (-4)`, C안 shows `—`.
   - Verify `과목 구성` 표에서 영어 시수가 다르므로 A안/B안 셀이 굵게.
   - Click `B안 적용` → confirm → modal closes → status updates.
6. **이후 단계 영향 확인** — open `/assignment`. Confirm 전담 배정 카드들이 B안의 과목 구성으로 표시됨. (apply triggered initialization, so assignments are empty until user re-runs auto-assign.)
7. **Print** — re-open 비교 보기 → `🖨 인쇄 / PDF 저장` → preview shows clean two-table layout with `학교명 · 날짜 출력` top-right.
8. **Excel round-trip** — click 저장 → re-open the file → verify all 3 plan sheets present.
9. **Legacy migration smoke** — `localStorage.clear()`, then in console:
   ```js
   localStorage.setItem('timetable_app_data', JSON.stringify({
     schoolName: '레거시초', subjects: [{ id:'x', grade:1, name:'영어', weekly_hours:3, is_major:true }]
   }))
   ```
   Reload → open `/subjects` → A안 should contain 영어 3시간 주요, status "적용됨".

- [ ] **Step 3: Commit walkthrough completion (no code changes)**

If any small fixes were needed during walkthrough, commit them now. If clean, skip this step.

---

## Verification Summary

After all tasks:
- [ ] `npm run test:run` passes
- [ ] http://localhost:5173/setup → 3 tabs (학급 정보 / 점심시간 설정 / 전담 교사) functional
- [ ] http://localhost:5173/subjects → page title "전담 과목 설정", A/B/C 탭 + 비교 보기 + 적용 버튼 functional
- [ ] 담임시수 widget per grade card, real-time updates
- [ ] Overflow blocks apply with tooltip
- [ ] 비교 모달 — 0/1/2+ filled plan branches handled
- [ ] Print preview clean
- [ ] Excel export/import round-trips all 3 plans
- [ ] Legacy data migrates to plan1 transparently
- [ ] Downstream pages (Assignment, Timetable, Room*) unchanged but reflect last-applied plan
