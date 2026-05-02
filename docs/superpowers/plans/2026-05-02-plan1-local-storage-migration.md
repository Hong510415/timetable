# Local Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase와 로그인을 완전히 제거하고, 모든 데이터를 localStorage에 저장하며 엑셀로 내보내기/가져오기가 가능한 `local` 브랜치를 만든다.

**Architecture:** AppContext(React Context)가 전역 상태를 보유하고, 매 변경마다 localStorage에 자동 저장된다. 각 페이지는 Supabase 쿼리 대신 Context에서 읽고 쓴다. 엑셀 내보내기/가져오기는 전체 앱 상태를 하나의 워크북으로 직렬화/역직렬화한다.

**Tech Stack:** React 18, Vite, TailwindCSS, xlsx (기존), crypto.randomUUID() (ID 생성)

---

## 파일 구조

### 신규 생성
- `src/lib/storage.js` — 초기 상태 정의, localStorage 읽기/쓰기 헬퍼
- `src/context/AppContext.jsx` — 전역 상태 + localStorage 자동 저장 + Context Provider/Hook
- `src/lib/excelIO.js` — 전체 워크북 내보내기 + 가져오기 파싱

### 수정
- `src/App.jsx` — 로그인/인증 제거, AppProvider 래핑, 라우팅 단순화
- `src/components/Layout.jsx` — 로그아웃 제거, 내보내기/가져오기 버튼 추가
- `src/pages/SchoolSetup.jsx` — Supabase → Context
- `src/pages/TeacherManagement.jsx` — Supabase → Context
- `src/pages/Timetable.jsx` — Supabase → Context
- `src/pages/RoomManagement.jsx` — Supabase → Context
- `src/pages/RoomTimetable.jsx` — Supabase → Context
- `src/lib/scheduler.js` — flattenResult에서 school_id 제거
- `src/lib/roomScheduler.js` — school_id 파라미터 제거

### 삭제
- `src/lib/supabase.js`
- `src/pages/Login.jsx`

---

## Task 1: local 브랜치 생성

**Files:** git 작업

- [ ] **Step 1: local 브랜치 생성 및 이동**

```bash
cd c:\Users\a\Desktop\timetable
git checkout -b local
```

Expected: `Switched to a new branch 'local'`

- [ ] **Step 2: 브랜치 확인**

```bash
git branch
```

Expected: `* local` 와 `  main` 이 보임

---

## Task 2: storage.js 생성 (초기 상태 + localStorage 헬퍼)

**Files:**
- Create: `src/lib/storage.js`

- [ ] **Step 1: storage.js 작성**

```js
// src/lib/storage.js
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
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/storage.js
git commit -m "feat: add storage.js with initial state and localStorage helpers"
```

---

## Task 3: AppContext.jsx 생성 (전역 상태 관리)

**Files:**
- Create: `src/context/AppContext.jsx`

- [ ] **Step 1: AppContext.jsx 작성**

```jsx
// src/context/AppContext.jsx
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
    case 'IMPORT': return { ...initialState, ...action.payload }
    default: return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadFromStorage)

  // 상태 변경마다 localStorage 자동 저장
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
    importData: (data) => dispatch({ type: 'IMPORT', payload: data }),
  }

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/context/AppContext.jsx
git commit -m "feat: add AppContext with localStorage auto-save"
```

---

## Task 4: App.jsx 수정 (로그인 제거, AppProvider 추가)

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: App.jsx 전체 교체**

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import SchoolSetup from './pages/SchoolSetup'
import TeacherManagement from './pages/TeacherManagement'
import Timetable from './pages/Timetable'
import RoomManagement from './pages/RoomManagement'
import RoomTimetable from './pages/RoomTimetable'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<Layout><SchoolSetup /></Layout>} />
          <Route path="/teachers" element={<Layout><TeacherManagement /></Layout>} />
          <Route path="/timetable" element={<Layout><Timetable /></Layout>} />
          <Route path="/rooms" element={<Layout><RoomManagement /></Layout>} />
          <Route path="/room-timetable" element={<Layout><RoomTimetable /></Layout>} />
          <Route path="*" element={<Navigate to="/setup" />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/App.jsx
git commit -m "feat: remove auth/login, wrap app with AppProvider"
```

---

## Task 5: Layout.jsx 수정 (로그아웃 제거, 내보내기/가져오기 버튼 추가)

**Files:**
- Modify: `src/components/Layout.jsx`

- [ ] **Step 1: Layout.jsx 전체 교체**

```jsx
// src/components/Layout.jsx
import { useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Settings, Users, Calendar, DoorOpen, CalendarCheck, Download, Upload } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { exportFullWorkbook, importFullWorkbook } from '../lib/excelIO'

const navItems = [
  { path: '/setup', label: '학교 설정', icon: Settings },
  { path: '/teachers', label: '전담 교사 관리', icon: Users },
  { path: '/rooms', label: '특별실 관리', icon: DoorOpen },
  { path: '/timetable', label: '전담 시간표', icon: Calendar },
  { path: '/room-timetable', label: '특별실 시간표', icon: CalendarCheck },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { state, importData } = useApp()
  const fileInputRef = useRef(null)

  function handleExport() {
    exportFullWorkbook(state)
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('현재 데이터를 불러온 파일로 덮어씁니다. 계속하시겠습니까?')) {
      e.target.value = ''
      return
    }
    try {
      const data = await importFullWorkbook(file)
      importData(data)
      alert('불러오기 완료')
    } catch (err) {
      alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message)
    }
    e.target.value = ''
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-[220px] bg-white border-r border-gray-200 flex flex-col py-7 flex-shrink-0">
        <div className="flex items-center gap-2 px-6 pb-4">
          <div className="w-4 h-4 bg-black flex-shrink-0" />
          <span className="text-[13px] font-bold text-gray-900">시간표 자동 작성</span>
        </div>
        <div className="h-px bg-gray-200 mb-3" />

        <nav className="flex flex-col gap-0.5">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = pathname === path
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex items-center gap-2.5 px-6 h-10 text-[13px] text-left w-full transition-colors ${
                  active ? 'bg-black text-white font-semibold' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto px-4 flex flex-col gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 h-9 px-3 border border-gray-300 rounded-sm text-[12px] text-gray-500 hover:bg-gray-50 w-full"
          >
            <Download size={12} />저장 (엑셀 내보내기)
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 h-9 px-3 border border-gray-300 rounded-sm text-[12px] text-gray-500 hover:bg-gray-50 w-full"
          >
            <Upload size={12} />불러오기 (엑셀 가져오기)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/Layout.jsx
git commit -m "feat: add excel import/export buttons, remove logout"
```

---

## Task 6: excelIO.js 생성 (전체 내보내기 + 가져오기)

**Files:**
- Create: `src/lib/excelIO.js`

- [ ] **Step 1: excelIO.js 작성**

```js
// src/lib/excelIO.js
import * as XLSX from 'xlsx'
import { initialState } from './storage'

const DAY_KEYS = ['periods_mon', 'periods_tue', 'periods_wed', 'periods_thu', 'periods_fri']
const DAY_LABELS = ['월', '화', '수', '목', '금']

export function exportFullWorkbook(state) {
  const wb = XLSX.utils.book_new()

  // 시트1: 학교설정
  const setupRows = [['학교명', state.schoolName], ['']]
  setupRows.push(['학년', '학급수', '월', '화', '수', '목', '금'])
  for (const gc of state.gradeConfigs) {
    setupRows.push([gc.grade, gc.num_classes, gc.periods_mon, gc.periods_tue, gc.periods_wed, gc.periods_thu, gc.periods_fri])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(setupRows), '학교설정')

  // 시트2: 점심설정
  const lunchRows = [['분리점심', state.lunchConfig.split_lunch ? 'Y' : 'N'], ['']]
  lunchRows.push(['학년', '점심슬롯'])
  for (const g of (state.lunchConfig.lunch_groups || [])) {
    for (const grade of g.grades) {
      lunchRows.push([grade, g.slot])
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lunchRows), '점심설정')

  // 시트3: 과목설정
  const subjectRows = [['ID', '학년', '과목명', '주당시수', '구분']]
  for (const s of state.subjects) {
    subjectRows.push([s.id, s.grade, s.name, s.weekly_hours, s.is_major ? '주요' : '일반'])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(subjectRows), '과목설정')

  // 시트4: 교사목록
  const teacherRows = [['ID', '교사코드']]
  for (const t of state.teachers) {
    teacherRows.push([t.id, t.code])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(teacherRows), '교사목록')

  // 시트5: 전담배정
  const assignRows = [['교사ID', '교사코드', '과목ID', '과목명', '학년', '반', '주당시수']]
  for (const t of state.teachers) {
    for (const a of (t.teacher_assignments || [])) {
      const subj = state.subjects.find(s => s.id === a.subject_id)
      assignRows.push([t.id, t.code, a.subject_id, subj?.name || '', a.grade, a.class_num, a.weekly_hours])
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(assignRows), '전담배정')

  // 시트6: 특별실
  const roomRows = [['ID', '특별실명']]
  for (const r of state.rooms) {
    roomRows.push([r.id, r.name])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(roomRows), '특별실')

  // 시트7: 특별실차단
  const blockedRows = [['특별실ID', '특별실명', '요일(0=월)', '교시']]
  for (const b of state.roomBlockedSlots) {
    const room = state.rooms.find(r => r.id === b.room_id)
    blockedRows.push([b.room_id, room?.name || '', b.day_of_week, b.slot])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(blockedRows), '특별실차단')

  // 시트8: 시간표
  const ttRows = [['학년', '반', '요일(0=월)', '교시', '교사ID', '교사코드', '과목ID', '과목명', '미배정']]
  for (const slot of state.timetableSlots) {
    const teacher = state.teachers.find(t => t.id === slot.teacher_id)
    const subj = state.subjects.find(s => s.id === slot.subject_id)
    ttRows.push([slot.grade, slot.class_num, slot.day_of_week, slot.slot, slot.teacher_id, teacher?.code || '', slot.subject_id, subj?.name || '', slot.is_unassigned ? 'Y' : 'N'])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ttRows), '시간표')

  // 시트9: 특별실시간표
  const rtRows = [['특별실ID', '특별실명', '학년', '반', '요일(0=월)', '교시']]
  for (const slot of state.roomTimetableSlots) {
    const room = state.rooms.find(r => r.id === slot.room_id)
    rtRows.push([slot.room_id, room?.name || '', slot.grade, slot.class_num, slot.day_of_week, slot.slot])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rtRows), '특별실시간표')

  XLSX.writeFile(wb, `시간표_${state.schoolName || '학교'}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export async function importFullWorkbook(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  function getSheet(name) {
    const ws = wb.Sheets[name]
    if (!ws) return []
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  }

  const state = { ...initialState }

  // 학교설정
  const setupRows = getSheet('학교설정')
  if (setupRows[0]?.[1] !== undefined) state.schoolName = String(setupRows[0][1])
  const gradeRows = setupRows.slice(3) // 헤더 3행 건너뜀
  if (gradeRows.length > 0) {
    state.gradeConfigs = gradeRows
      .filter(r => r[0])
      .map(r => ({
        grade: Number(r[0]),
        num_classes: Number(r[1]) || 4,
        periods_mon: Number(r[2]) || 5,
        periods_tue: Number(r[3]) || 5,
        periods_wed: Number(r[4]) || 5,
        periods_thu: Number(r[5]) || 5,
        periods_fri: Number(r[6]) || 4,
      }))
  }

  // 점심설정
  const lunchRows = getSheet('점심설정')
  const splitLunch = lunchRows[0]?.[1] === 'Y'
  const lunchGroups = []
  lunchRows.slice(3).filter(r => r[0]).forEach(r => {
    const grade = Number(r[0])
    const slot = Number(r[1])
    const existing = lunchGroups.find(g => g.slot === slot)
    if (existing) existing.grades.push(grade)
    else lunchGroups.push({ slot, grades: [grade] })
  })
  state.lunchConfig = { split_lunch: splitLunch, lunch_groups: lunchGroups }

  // 과목설정
  const subjectRows = getSheet('과목설정').slice(1).filter(r => r[0])
  state.subjects = subjectRows.map(r => ({
    id: String(r[0]) || crypto.randomUUID(),
    grade: Number(r[1]),
    name: String(r[2]),
    weekly_hours: Number(r[3]) || 2,
    is_major: r[4] === '주요',
  }))

  // 교사목록 + 전담배정
  const teacherRows = getSheet('교사목록').slice(1).filter(r => r[0])
  const assignRows = getSheet('전담배정').slice(1).filter(r => r[0])
  state.teachers = teacherRows.map(r => {
    const tid = String(r[0])
    const assignments = assignRows
      .filter(a => String(a[0]) === tid)
      .map(a => ({
        id: crypto.randomUUID(),
        subject_id: String(a[2]),
        grade: Number(a[4]),
        class_num: Number(a[5]),
        weekly_hours: Number(a[6]) || 2,
      }))
    return { id: tid, code: String(r[1]), teacher_assignments: assignments }
  })

  // 특별실
  const roomRows = getSheet('특별실').slice(1).filter(r => r[0])
  state.rooms = roomRows.map(r => ({ id: String(r[0]), name: String(r[1]) }))

  // 특별실차단
  const blockedRows = getSheet('특별실차단').slice(1).filter(r => r[0])
  state.roomBlockedSlots = blockedRows.map(r => ({
    id: crypto.randomUUID(),
    room_id: String(r[0]),
    day_of_week: Number(r[2]),
    slot: Number(r[3]),
  }))

  // 시간표
  const ttRows = getSheet('시간표').slice(1).filter(r => r[0] !== '')
  state.timetableSlots = ttRows.map(r => ({
    id: crypto.randomUUID(),
    grade: Number(r[0]),
    class_num: Number(r[1]),
    day_of_week: Number(r[2]),
    slot: Number(r[3]),
    teacher_id: String(r[4]),
    subject_id: String(r[6]),
    is_unassigned: r[8] === 'Y',
  }))

  // 특별실시간표
  const rtRows = getSheet('특별실시간표').slice(1).filter(r => r[0])
  state.roomTimetableSlots = rtRows.map(r => ({
    id: crypto.randomUUID(),
    room_id: String(r[0]),
    grade: Number(r[2]),
    class_num: Number(r[3]),
    day_of_week: Number(r[4]),
    slot: Number(r[5]),
  }))

  return state
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/excelIO.js
git commit -m "feat: add full workbook excel export and import"
```

---

## Task 7: scheduler.js 수정 (school_id 제거)

**Files:**
- Modify: `src/lib/scheduler.js`

- [ ] **Step 1: flattenResult에서 school_id 파라미터와 필드 제거**

`src/lib/scheduler.js`의 `flattenResult` 함수를 찾아서:

```js
// 변경 전
export function flattenResult(result, schoolId, gradeLunchSlot, totalSlots) {
  ...
  rows.push({
    school_id: schoolId,
    grade,
    ...
  })
  ...
}

// 변경 후
export function flattenResult(result, gradeLunchSlot, totalSlots) {
  ...
  rows.push({
    grade,
    class_num: classNum,
    day_of_week: day,
    slot,
    teacher_id: cell.teacherId,
    subject_id: cell.subjectId,
    is_unassigned: false,
  })
  ...
}
```

- [ ] **Step 2: roomScheduler.js에서 school_id 제거**

`src/lib/roomScheduler.js`의 `buildRoomSchedule` 함수:

```js
// 변경 전
export function buildRoomSchedule(room, timetableSlots, blockedSlots, schoolId, teacherIds, subjectIds = null) {
  ...
  roomSlots.push({
    school_id: schoolId,
    room_id: room.id,
    ...
  })
}

// 변경 후
export function buildRoomSchedule(room, timetableSlots, blockedSlots, teacherIds, subjectIds = null) {
  ...
  roomSlots.push({
    room_id: room.id,
    day_of_week: ts.day_of_week,
    slot: ts.slot,
    grade: ts.grade,
    class_num: ts.class_num,
  })
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/scheduler.js src/lib/roomScheduler.js
git commit -m "feat: remove school_id from scheduler and roomScheduler"
```

---

## Task 8: SchoolSetup.jsx 마이그레이션

**Files:**
- Modify: `src/pages/SchoolSetup.jsx`

- [ ] **Step 1: SchoolSetup.jsx 전체 교체**

```jsx
// src/pages/SchoolSetup.jsx
import { useState } from 'react'
import { useApp } from '../context/AppContext'

const DAYS = ['월', '화', '수', '목', '금']
const GRADES = [1, 2, 3, 4, 5, 6]
const DAY_KEYS = ['periods_mon', 'periods_tue', 'periods_wed', 'periods_thu', 'periods_fri']

export default function SchoolSetup() {
  const { state, setSchoolName, setGradeConfigs, setLunchConfig, setSubjects } = useApp()
  const { schoolName, gradeConfigs, lunchConfig, subjects } = state
  const [tab, setTab] = useState('grade')
  const [saved, setSaved] = useState(false)

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

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tabs = [
    { key: 'grade', label: '학급 정보' },
    { key: 'lunch', label: '점심시간 설정' },
    { key: 'subjects', label: '전담 과목 설정' },
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

      {/* 탭 */}
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
                  <div key={d} className="flex-1 text-center py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">{d}</div>
                ))}
              </div>
              {gradeConfigs.map(config => (
                <div key={config.grade} className="flex border-b border-gray-100 last:border-b-0">
                  <div className="w-[80px] flex-shrink-0 px-3 flex items-center text-[12px] text-gray-600 border-r border-gray-200">{config.grade}학년</div>
                  {DAY_KEYS.map(key => (
                    <div key={key} className="flex-1 border-r border-gray-100 last:border-r-0 flex items-center justify-center py-1.5">
                      <input
                        type="number" min={1} max={7} value={config[key]}
                        onChange={e => updateGrade(config.grade, key, e.target.value)}
                        onClick={e => e.target.select()}
                        onFocus={e => e.target.select()}
                        className="w-12 h-8 text-center text-[12px] border border-gray-200 rounded-sm outline-none focus:border-black"
                      />
                    </div>
                  ))}
                </div>
              ))}
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

      {tab === 'subjects' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7 flex flex-col gap-4">
          <div>
            <h2 className="text-[14px] font-semibold mb-1">학년별 전담 과목 및 주당 시수</h2>
            <p className="text-[12px] text-gray-400 mb-4">전담 교사가 가르치는 과목과 주당 시수를 입력하세요.</p>
          </div>
          {GRADES.map(grade => (
            <div key={grade} className="border border-gray-200 rounded-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-semibold">{grade}학년</span>
                <button
                  onClick={() => setSubjects([...subjects, { id: crypto.randomUUID(), grade, name: '', weekly_hours: 2, is_major: false }])}
                  className="text-[12px] px-3 h-7 border border-gray-300 rounded-sm hover:bg-gray-50"
                >+ 과목 추가</button>
              </div>
              {subjects.filter(s => s.grade === grade).length === 0 && (
                <p className="text-[12px] text-gray-300">과목을 추가하세요</p>
              )}
              <div className="flex flex-col gap-2">
                {subjects.map((s, i) => s.grade !== grade ? null : (
                  <div key={s.id} className="flex items-center gap-2">
                    <input
                      placeholder="과목명 (예: 영어)"
                      value={s.name}
                      onChange={e => setSubjects(subjects.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      className="flex-1 h-9 px-3 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">주당</span>
                    <input
                      type="number" min={1} max={10} value={s.weekly_hours}
                      onChange={e => setSubjects(subjects.map((x, j) => j === i ? { ...x, weekly_hours: Number(e.target.value) } : x))}
                      className="w-14 h-9 text-center border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
                    />
                    <span className="text-[12px] text-gray-400">시수</span>
                    <button
                      onClick={() => setSubjects(subjects.filter((_, j) => j !== i))}
                      className="text-[12px] text-red-400 hover:text-red-600 px-2"
                    >삭제</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          className="h-10 px-5 bg-black text-white text-[13px] font-semibold rounded-sm hover:bg-gray-800"
        >
          {saved ? '저장됨 ✓' : '저장'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/SchoolSetup.jsx
git commit -m "feat: migrate SchoolSetup to AppContext"
```

---

## Task 9: TeacherManagement.jsx 마이그레이션

**Files:**
- Modify: `src/pages/TeacherManagement.jsx`

- [ ] **Step 1: import 및 load 함수 교체**

파일 상단의 import와 상태 초기화 부분을 교체한다:

```jsx
// 변경 전
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
...
const [schoolId, setSchoolId] = useState(null)
const [teachers, setTeachers] = useState([])
const [subjects, setSubjects] = useState([])
const [gradeConfigs, setGradeConfigs] = useState([])
...
useEffect(() => { load() }, [])
async function load() { /* supabase 쿼리 */ }

// 변경 후
import { useState } from 'react'
import { useApp } from '../context/AppContext'
...
const { state, setTeachers } = useApp()
const { teachers, subjects, gradeConfigs } = state
```

- [ ] **Step 2: handleDelete 교체**

```jsx
// 변경 전
async function handleDelete(teacherId) {
  if (!confirm('이 교사를 삭제하시겠습니까?')) return
  await supabase.from('teachers').delete().eq('id', teacherId)
  load()
}

// 변경 후
function handleDelete(teacherId) {
  if (!confirm('이 교사를 삭제하시겠습니까?')) return
  setTeachers(teachers.filter(t => t.id !== teacherId))
}
```

- [ ] **Step 3: handleSave 교체**

```jsx
// 변경 전
async function handleSave() {
  if (!form.code.trim()) return alert('교사 명칭을 입력하세요')
  // supabase upsert 로직 ...
  setShowModal(false)
  load()
}

// 변경 후
function handleSave() {
  if (!form.code.trim()) return alert('교사 명칭을 입력하세요')
  const assignments = form.assignments.map(a => {
    const name = getSubjectName(a.subject_id) || a._subjectName || ''
    const sid = findSubjectId(name, a.grade) || a.subject_id
    const { _subjectName, ...rest } = a
    return { ...rest, subject_id: sid }
  })
  if (editingTeacher) {
    setTeachers(teachers.map(t =>
      t.id === editingTeacher.id
        ? { ...t, code: form.code, teacher_assignments: assignments }
        : t
    ))
  } else {
    setTeachers([...teachers, {
      id: crypto.randomUUID(),
      code: form.code,
      teacher_assignments: assignments,
    }])
  }
  setShowModal(false)
}
```

- [ ] **Step 4: addAssignment에서 id 추가**

```jsx
// 변경 전
function addAssignment() {
  setForm(prev => ({
    ...prev,
    assignments: [...prev.assignments, { subject_id: '', grade: 1, class_num: 1, weekly_hours: 2 }],
  }))
}

// 변경 후
function addAssignment() {
  setForm(prev => ({
    ...prev,
    assignments: [...prev.assignments, { id: crypto.randomUUID(), subject_id: '', grade: 1, class_num: 1, weekly_hours: 2 }],
  }))
}
```

- [ ] **Step 5: 커밋**

```bash
git add src/pages/TeacherManagement.jsx
git commit -m "feat: migrate TeacherManagement to AppContext"
```

---

## Task 10: RoomManagement.jsx 마이그레이션

**Files:**
- Modify: `src/pages/RoomManagement.jsx`

- [ ] **Step 1: import 및 상태 교체**

```jsx
// 변경 전
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
...
const [schoolId, setSchoolId] = useState(null)
const [rooms, setRooms] = useState([])
const [totalSlots, setTotalSlots] = useState(6)
const [blockedSlots, setBlockedSlots] = useState({})
useEffect(() => { load() }, [])
async function load() { /* supabase */ }

// 변경 후
import { useState } from 'react'
import { useApp } from '../context/AppContext'
...
const { state, setRooms, setRoomBlockedSlots } = useApp()
const { rooms, lunchConfig, roomBlockedSlots } = state
const hasSplit = lunchConfig?.split_lunch && lunchConfig?.lunch_groups?.length > 0
const totalSlots = hasSplit ? 7 : 6

// blockedSlots를 roomId → Set<"day-slot"> 형태로 변환 (표시용)
const blockedMap = {}
for (const b of roomBlockedSlots) {
  if (!blockedMap[b.room_id]) blockedMap[b.room_id] = new Set()
  blockedMap[b.room_id].add(`${b.day_of_week}-${b.slot}`)
}
```

- [ ] **Step 2: handleDelete, handleSave, toggleBlocked 교체**

```jsx
function handleDelete(roomId) {
  if (!confirm('이 특별실을 삭제하시겠습니까?')) return
  setRooms(rooms.filter(r => r.id !== roomId))
  setRoomBlockedSlots(roomBlockedSlots.filter(b => b.room_id !== roomId))
}

function handleSave() {
  if (!form.name.trim()) return alert('특별실 이름을 입력하세요')
  if (editingRoom) {
    setRooms(rooms.map(r => r.id === editingRoom.id ? { ...r, name: form.name } : r))
  } else {
    setRooms([...rooms, { id: crypto.randomUUID(), name: form.name }])
  }
  setShowModal(false)
}

function toggleBlocked(roomId, day, slot) {
  const key = `${day}-${slot}`
  const exists = roomBlockedSlots.find(b => b.room_id === roomId && b.day_of_week === day && b.slot === slot)
  if (exists) {
    setRoomBlockedSlots(roomBlockedSlots.filter(b => !(b.room_id === roomId && b.day_of_week === day && b.slot === slot)))
  } else {
    setRoomBlockedSlots([...roomBlockedSlots, { id: crypto.randomUUID(), room_id: roomId, day_of_week: day, slot }])
  }
}
```

- [ ] **Step 3: JSX에서 `blockedSlots[room.id]` → `blockedMap[room.id]` 로 교체**

JSX 내 `blockedSlots[room.id]?.has(...)` 를 `blockedMap[room.id]?.has(...)` 로 변경.

- [ ] **Step 4: 커밋**

```bash
git add src/pages/RoomManagement.jsx
git commit -m "feat: migrate RoomManagement to AppContext"
```

---

## Task 11: Timetable.jsx 마이그레이션

**Files:**
- Modify: `src/pages/Timetable.jsx`

- [ ] **Step 1: import 교체**

```jsx
// 변경 전
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
...

// 변경 후
import { useState } from 'react'
import { useApp } from '../context/AppContext'
...
```

- [ ] **Step 2: 상태 및 load 함수 교체**

```jsx
// 변경 전
const [schoolId, setSchoolId] = useState(null)
const [gradeConfigs, setGradeConfigs] = useState([])
const [subjects, setSubjects] = useState([])
const [teachers, setTeachers] = useState([])
const [lunchConfig, setLunchConfig] = useState(null)
const [timetableRows, setTimetableRows] = useState([])
const [roomBlockedSlots, setRoomBlockedSlots] = useState([])
...
useEffect(() => { load() }, [])
async function load() { /* supabase 쿼리 */ }

// 변경 후
const { state, setTimetableSlots } = useApp()
const { gradeConfigs, subjects, teachers, lunchConfig, timetableSlots: timetableRows, roomBlockedSlots } = state
```

- [ ] **Step 3: handleGenerate에서 schoolId 제거, flattenResult 호출 수정**

`handleGenerate` 함수 내에서:

```jsx
// 변경 전
const { rows } = flattenResult(scheduleResult.result, schoolId, scheduleResult.gradeLunchSlot, scheduleResult.totalSlots)
await supabase.from('timetable_slots').delete().eq('school_id', schoolId)
await supabase.from('timetable_slots').insert(rows)
setTimetableRows(rows)

// 변경 후
const { rows } = flattenResult(scheduleResult.result, scheduleResult.gradeLunchSlot, scheduleResult.totalSlots)
// 각 행에 id 추가
const rowsWithId = rows.map(r => ({ ...r, id: crypto.randomUUID() }))
setTimetableSlots(rowsWithId)
setTimetableRows(rowsWithId)
```

- [ ] **Step 4: handleEditSave에서 Supabase 제거**

```jsx
// 변경 전
async function handleEditSave(teacherId, subjectId) {
  ...
  await supabase.from('timetable_slots').update({...}).eq('id', existing.id)
  ...
  await supabase.from('timetable_slots').insert({...})
  ...
  const { data: rows } = await supabase.from('timetable_slots').select('*').eq('school_id', schoolId)
  setTimetableRows(rows || [])
}

// 변경 후
function handleEditSave(teacherId, subjectId) {
  if (!editModal) return
  const { day, slot, grade, classNum } = editModal
  const updated = timetableRows.map(r => {
    if (r.grade === grade && r.class_num === classNum && r.day_of_week === day && r.slot === slot) {
      return { ...r, teacher_id: teacherId || null, subject_id: subjectId || null, is_unassigned: !teacherId }
    }
    return r
  })
  // 해당 슬롯이 없으면 추가
  const exists = timetableRows.find(r => r.grade === grade && r.class_num === classNum && r.day_of_week === day && r.slot === slot)
  if (!exists && teacherId) {
    updated.push({ id: crypto.randomUUID(), grade, class_num: classNum, day_of_week: day, slot, teacher_id: teacherId, subject_id: subjectId, is_unassigned: false })
  }
  setTimetableSlots(updated)
  setEditModal(null)
}
```

- [ ] **Step 5: 커밋**

```bash
git add src/pages/Timetable.jsx
git commit -m "feat: migrate Timetable to AppContext"
```

---

## Task 12: RoomTimetable.jsx 마이그레이션

**Files:**
- Modify: `src/pages/RoomTimetable.jsx`

- [ ] **Step 1: import 및 상태 교체**

```jsx
// 변경 전
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
...
const [schoolId, setSchoolId] = useState(null)
useEffect(() => { load() }, [])
async function load() { /* supabase */ }

// 변경 후
import { useState } from 'react'
import { useApp } from '../context/AppContext'
...
const { state, setRoomTimetableSlots } = useApp()
const { rooms, gradeConfigs, lunchConfig, timetableSlots, roomBlockedSlots, teachers, subjects } = state

// roomSlots = state에서 현재 selectedRoom의 슬롯
const roomSlots = state.roomTimetableSlots.filter(s => s.room_id === selectedRoom)
```

- [ ] **Step 2: loadRoomSlots 제거, handleGenerate 수정**

```jsx
// handleGenerate
async function handleGenerate() {
  if (!selectedRoom) return
  if (selectedTeachers.length === 0) return alert('시간표를 생성할 교사를 선택하세요.')
  if (!timetableSlots.length) return alert('전담 시간표를 먼저 생성하세요.')
  setGenerating(true)

  const subjectIdFilter = selectedSubjects.length > 0
    ? subjects.filter(s => selectedSubjects.includes(s.name)).map(s => s.id)
    : null

  const roomBlocked = roomBlockedSlots.filter(b => b.room_id === selectedRoom)
  const rows = buildRoomSchedule(
    rooms.find(r => r.id === selectedRoom), timetableSlots, roomBlocked,
    selectedTeachers, subjectIdFilter
  )

  // 기존 해당 방 슬롯 제거 후 새 슬롯 추가
  const otherRoomSlots = state.roomTimetableSlots.filter(s => s.room_id !== selectedRoom)
  const newSlots = rows.map(r => ({ ...r, id: crypto.randomUUID() }))
  setRoomTimetableSlots([...otherRoomSlots, ...newSlots])
  setGenerating(false)
}
```

- [ ] **Step 3: handleEditSave 수정**

```jsx
function handleEditSave(grade, classNum) {
  if (!editModal) return
  setSaving(true)
  const { day, slot } = editModal
  const existing = state.roomTimetableSlots.find(r => r.room_id === selectedRoom && r.day_of_week === day && r.slot === slot)
  let updated = [...state.roomTimetableSlots]
  if (existing) {
    if (grade && classNum) {
      updated = updated.map(r => r.id === existing.id ? { ...r, grade, class_num: classNum } : r)
    } else {
      updated = updated.filter(r => r.id !== existing.id)
    }
  } else if (grade && classNum) {
    updated.push({ id: crypto.randomUUID(), room_id: selectedRoom, day_of_week: day, slot, grade, class_num: classNum })
  }
  setRoomTimetableSlots(updated)
  setEditModal(null)
  setSaving(false)
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/pages/RoomTimetable.jsx
git commit -m "feat: migrate RoomTimetable to AppContext"
```

---

## Task 13: 파일 삭제 및 최종 정리

**Files:**
- Delete: `src/lib/supabase.js`
- Delete: `src/pages/Login.jsx`
- Modify: `package.json` (supabase 패키지 제거)

- [ ] **Step 1: 파일 삭제**

```bash
rm src/lib/supabase.js
rm src/pages/Login.jsx
```

- [ ] **Step 2: @supabase/supabase-js 패키지 제거**

```bash
npm uninstall @supabase/supabase-js
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build
```

Expected: 오류 없이 `dist/` 폴더 생성. Supabase import 관련 오류가 남아있으면 해당 파일에서 제거.

- [ ] **Step 4: 로컬에서 앱 실행 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속. 다음을 확인:
- 로그인 화면 없이 바로 학교 설정 탭으로 이동
- 학교 설정 입력 후 새로고침해도 데이터 유지 (localStorage)
- 교사 추가/삭제 동작
- 엑셀 내보내기 버튼 클릭 시 xlsx 파일 다운로드

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete Supabase removal, local branch ready"
```

- [ ] **Step 6: local 브랜치 원격 푸시**

```bash
git push -u origin local
```

---

## Task 14: Vercel에 local 브랜치 새 프로젝트로 배포

- [ ] **Step 1:** Vercel 대시보드에서 "Add New Project" 클릭
- [ ] **Step 2:** 동일 GitHub 레포 (`Hong510415/timetable`) 연결
- [ ] **Step 3:** "Branch" 설정을 `local`로 변경
- [ ] **Step 4:** 프로젝트명 `timetable-local` 으로 설정
- [ ] **Step 5:** 환경변수 없음 (Supabase 제거했으므로) — 그대로 배포
- [ ] **Step 6:** 배포 완료 후 URL 확인 및 기능 테스트
