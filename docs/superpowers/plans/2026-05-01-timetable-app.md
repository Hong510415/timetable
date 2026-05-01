# 시간표 자동 작성 앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 초등학교 전담수업 시간표 및 특별실 시간표를 자동 생성하는 웹 앱 구축

**Architecture:** React + Vite SPA, Supabase(Auth + PostgreSQL), 알고리즘은 브라우저에서 실행 후 결과를 DB 저장. 사이드바 레이아웃 기반 5개 페이지.

**Tech Stack:** React 18, Vite, Tailwind CSS v3, Supabase JS v2, xlsx, Lucide React

---

## 파일 구조

```
src/
  main.jsx
  App.jsx
  lib/
    supabase.js          - Supabase 클라이언트
    scheduler.js         - 전담 시간표 자동 생성 알고리즘
    roomScheduler.js     - 특별실 자동 배정 알고리즘
    excelExport.js       - 엑셀 다운로드 함수
  pages/
    Login.jsx            - 로그인/회원가입
    SchoolSetup.jsx      - 학교 설정 (3개 탭)
    TeacherManagement.jsx- 전담 교사 관리
    Timetable.jsx        - 전담 시간표 보기/수정
    RoomManagement.jsx   - 특별실 관리
    RoomTimetable.jsx    - 특별실 시간표 보기/수정
  components/
    Layout.jsx           - 사이드바 + 메인 래퍼
    TimetableGrid.jsx    - 재사용 시간표 그리드
```

---

## Task 1: 프로젝트 초기 설정

**Files:**
- Create: `package.json`, `vite.config.js`, `tailwind.config.js`, `src/main.jsx`, `src/App.jsx`, `src/index.css`

- [ ] **Step 1: React + Vite 프로젝트 생성**

```bash
cd C:\Users\a\Desktop\timetable
npm create vite@latest . -- --template react
```
`y`로 덮어쓰기 확인 (docs 폴더는 유지됨)

- [ ] **Step 2: 의존성 설치**

```bash
npm install
npm install @supabase/supabase-js xlsx lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: Tailwind 설정**

`tailwind.config.js` 수정:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 4: index.css 교체**

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif; }
```

- [ ] **Step 5: 개발 서버 실행 확인**

```bash
npm run dev
```
브라우저에서 `http://localhost:5173` 열어서 React 기본 화면 확인

- [ ] **Step 6: 불필요한 기본 파일 삭제**

```bash
rm src/App.css src/assets/react.svg public/vite.svg
```

---

## Task 2: Supabase 프로젝트 설정 및 DB 스키마

**Files:**
- Create: `src/lib/supabase.js`, `.env.local`

- [ ] **Step 1: Supabase 프로젝트 생성**

1. https://supabase.com 접속 → 로그인 → "New project"
2. 프로젝트 이름: `timetable-app`, 비밀번호 설정, 지역: `Northeast Asia (Seoul)`
3. 생성 완료까지 대기 (약 2분)

- [ ] **Step 2: DB 스키마 생성 (SQL Editor에 복사 후 실행)**

Supabase 대시보드 → SQL Editor → New query:

```sql
-- 학교 정보
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '우리 학교',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 학년별 설정 (학급 수, 요일별 교시 수)
CREATE TABLE grade_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
  num_classes INTEGER NOT NULL DEFAULT 1,
  periods_mon INTEGER NOT NULL DEFAULT 5,
  periods_tue INTEGER NOT NULL DEFAULT 5,
  periods_wed INTEGER NOT NULL DEFAULT 5,
  periods_thu INTEGER NOT NULL DEFAULT 5,
  periods_fri INTEGER NOT NULL DEFAULT 4,
  UNIQUE(school_id, grade)
);

-- 점심시간 설정
CREATE TABLE lunch_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE UNIQUE,
  split_lunch BOOLEAN NOT NULL DEFAULT FALSE,
  lunch_groups JSONB DEFAULT '[]'
  -- 예: [{"grades":[1,6],"slot":3}, {"grades":[2,5],"slot":4}, {"grades":[3,4],"slot":5}]
  -- slot은 0-based 절대 슬롯 인덱스
);

-- 전담 과목 (학년별)
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
  name TEXT NOT NULL,
  weekly_hours INTEGER NOT NULL DEFAULT 1
);

-- 전담 교사
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  code TEXT NOT NULL
);

-- 교사별 담당 학급 배정
CREATE TABLE teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL,
  class_num INTEGER NOT NULL,
  weekly_hours INTEGER NOT NULL DEFAULT 1
);

-- 생성된 전담 시간표 슬롯
CREATE TABLE timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL,
  class_num INTEGER NOT NULL,
  day INTEGER NOT NULL CHECK (day BETWEEN 0 AND 4),
  slot INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 6),
  teacher_id UUID REFERENCES teachers(id),
  subject_id UUID REFERENCES subjects(id),
  is_unassigned BOOLEAN DEFAULT FALSE
);

-- 특별실
CREATE TABLE special_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES teachers(id)
);

-- 특별실 차단 슬롯 (방과후 등)
CREATE TABLE room_blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES special_rooms(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  slot INTEGER NOT NULL
);

-- 특별실 시간표 슬롯
CREATE TABLE room_timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  room_id UUID REFERENCES special_rooms(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  grade INTEGER,
  class_num INTEGER,
  assignment_type TEXT CHECK (assignment_type IN ('dedicated', 'class'))
);

-- RLS 활성화
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lunch_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_timetable_slots ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 학교 데이터만 접근
CREATE POLICY "own_school" ON schools FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own_school" ON grade_configs FOR ALL USING (
  school_id IN (SELECT id FROM schools WHERE user_id = auth.uid())
);
CREATE POLICY "own_school" ON lunch_config FOR ALL USING (
  school_id IN (SELECT id FROM schools WHERE user_id = auth.uid())
);
CREATE POLICY "own_school" ON subjects FOR ALL USING (
  school_id IN (SELECT id FROM schools WHERE user_id = auth.uid())
);
CREATE POLICY "own_school" ON teachers FOR ALL USING (
  school_id IN (SELECT id FROM schools WHERE user_id = auth.uid())
);
CREATE POLICY "own_school" ON teacher_assignments FOR ALL USING (
  teacher_id IN (SELECT t.id FROM teachers t JOIN schools s ON t.school_id = s.id WHERE s.user_id = auth.uid())
);
CREATE POLICY "own_school" ON timetable_slots FOR ALL USING (
  school_id IN (SELECT id FROM schools WHERE user_id = auth.uid())
);
CREATE POLICY "own_school" ON special_rooms FOR ALL USING (
  school_id IN (SELECT id FROM schools WHERE user_id = auth.uid())
);
CREATE POLICY "own_school" ON room_blocked_slots FOR ALL USING (
  room_id IN (SELECT r.id FROM special_rooms r JOIN schools s ON r.school_id = s.id WHERE s.user_id = auth.uid())
);
CREATE POLICY "own_school" ON room_timetable_slots FOR ALL USING (
  school_id IN (SELECT id FROM schools WHERE user_id = auth.uid())
);
```

- [ ] **Step 3: API 키 확인**

Supabase 대시보드 → Settings → API:
- `Project URL` 복사
- `anon / public` key 복사

- [ ] **Step 4: 환경변수 파일 생성**

`.env.local` (프로젝트 루트):
```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxx...
```

- [ ] **Step 5: Supabase 클라이언트 생성**

`src/lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

---

## Task 3: 앱 구조 및 라우팅 설정

**Files:**
- Modify: `src/App.jsx`, `src/main.jsx`
- Create: `src/components/Layout.jsx`, `src/pages/Login.jsx`, `src/pages/SchoolSetup.jsx`, `src/pages/TeacherManagement.jsx`, `src/pages/Timetable.jsx`, `src/pages/RoomManagement.jsx`, `src/pages/RoomTimetable.jsx`

- [ ] **Step 1: 페이지 빈 파일 생성**

각 파일에 최소 컴포넌트 작성 (나중에 채움):

`src/pages/SchoolSetup.jsx`:
```jsx
export default function SchoolSetup() {
  return <div className="p-10"><h1 className="text-2xl font-bold">학교 설정</h1></div>
}
```

같은 방식으로 나머지 5개 페이지 파일 생성:
- `src/pages/TeacherManagement.jsx` → `<h1>전담 교사 관리</h1>`
- `src/pages/Timetable.jsx` → `<h1>전담 시간표</h1>`
- `src/pages/RoomManagement.jsx` → `<h1>특별실 관리</h1>`
- `src/pages/RoomTimetable.jsx` → `<h1>특별실 시간표</h1>`
- `src/pages/Login.jsx` → `<h1>로그인</h1>`

- [ ] **Step 2: Layout 컴포넌트 작성**

`src/components/Layout.jsx`:
```jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { Settings, Users, Calendar, DoorOpen, CalendarCheck, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

const navItems = [
  { path: '/setup', label: '학교 설정', icon: Settings },
  { path: '/teachers', label: '전담 교사 관리', icon: Users },
  { path: '/timetable', label: '전담 시간표', icon: Calendar },
  { path: '/rooms', label: '특별실 관리', icon: DoorOpen },
  { path: '/room-timetable', label: '특별실 시간표', icon: CalendarCheck },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 사이드바 */}
      <aside className="w-[220px] bg-white border-r border-gray-200 flex flex-col py-7 flex-shrink-0">
        {/* 로고 */}
        <div className="flex items-center gap-2 px-6 pb-4">
          <div className="w-4 h-4 bg-black flex-shrink-0" />
          <span className="text-[13px] font-bold text-gray-900">시간표 자동 작성</span>
        </div>
        <div className="h-px bg-gray-200 mb-3" />

        {/* 네비게이션 */}
        <nav className="flex flex-col gap-1">
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

        {/* 로그아웃 */}
        <div className="mt-auto px-6">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-[12px] text-gray-400 hover:text-gray-600"
          >
            <LogOut size={13} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: App.jsx 라우팅 설정**

```bash
npm install react-router-dom
```

`src/App.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import SchoolSetup from './pages/SchoolSetup'
import TeacherManagement from './pages/TeacherManagement'
import Timetable from './pages/Timetable'
import RoomManagement from './pages/RoomManagement'
import RoomTimetable from './pages/RoomTimetable'

function ProtectedRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">로딩 중...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/setup" /> : <Login />} />
        <Route path="/setup" element={<ProtectedRoute session={session}><SchoolSetup /></ProtectedRoute>} />
        <Route path="/teachers" element={<ProtectedRoute session={session}><TeacherManagement /></ProtectedRoute>} />
        <Route path="/timetable" element={<ProtectedRoute session={session}><Timetable /></ProtectedRoute>} />
        <Route path="/rooms" element={<ProtectedRoute session={session}><RoomManagement /></ProtectedRoute>} />
        <Route path="/room-timetable" element={<ProtectedRoute session={session}><RoomTimetable /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={session ? "/setup" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: 브라우저에서 라우팅 확인**

`npm run dev` 후 `/login`, `/setup` 경로 이동 확인

---

## Task 4: 로그인 / 회원가입 페이지

**Files:**
- Modify: `src/pages/Login.jsx`

- [ ] **Step 1: 로그인 페이지 작성**

`src/pages/Login.jsx`:
```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.user) {
        // 학교 레코드 생성
        await supabase.from('schools').insert({ user_id: data.user.id, name: schoolName || '우리 학교' })
        setMessage('가입 완료! 이메일을 확인해 주세요.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-[420px] border border-gray-200 rounded-sm p-12">
        {/* 로고 */}
        <div className="flex items-center gap-2 mb-6 pb-6 border-b border-gray-100">
          <div className="w-5 h-5 bg-black flex-shrink-0" />
          <span className="text-[15px] font-bold">시간표 자동 작성</span>
        </div>

        <h1 className="text-[26px] font-bold mb-1">{mode === 'login' ? '로그인' : '회원가입'}</h1>
        <p className="text-[13px] text-gray-400 mb-7">
          {mode === 'login' ? '학교 담당자 계정으로 로그인하세요' : '새 학교 계정을 만드세요'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-gray-600">학교명</label>
              <input
                type="text"
                placeholder="○○초등학교"
                value={schoolName}
                onChange={e => setSchoolName(e.target.value)}
                className="h-11 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600">이메일</label>
            <input
              type="email"
              placeholder="school@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="h-11 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600">비밀번호</label>
            <input
              type="password"
              placeholder="6자 이상"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black"
            />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
          {message && <p className="text-[12px] text-green-600">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-12 bg-black text-white text-[14px] font-semibold rounded-sm mt-2 disabled:opacity-50"
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        <div className="flex justify-center gap-1 mt-5 text-[12px]">
          <span className="text-gray-400">
            {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
          </span>
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}
            className="font-semibold text-black"
          >
            {mode === 'login' ? '회원가입' : '로그인'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Supabase 이메일 확인 OFF 설정 (개발 편의)**

Supabase 대시보드 → Authentication → Settings → Email → "Confirm email" 끄기

- [ ] **Step 3: 로그인/회원가입 동작 확인**

`npm run dev` → 회원가입 → 자동 로그인 → `/setup` 이동 확인

---

## Task 5: 학교 설정 — 학급 수 & 수업 시수

**Files:**
- Modify: `src/pages/SchoolSetup.jsx`

- [ ] **Step 1: SchoolSetup 페이지 작성 (탭 1, 2)**

`src/pages/SchoolSetup.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const DAYS = ['월', '화', '수', '목', '금']
const GRADES = [1, 2, 3, 4, 5, 6]
const DAY_KEYS = ['periods_mon', 'periods_tue', 'periods_wed', 'periods_thu', 'periods_fri']

const defaultGrade = (grade) => ({
  grade, num_classes: 4,
  periods_mon: 5, periods_tue: 5, periods_wed: 5, periods_thu: 5, periods_fri: 4
})

export default function SchoolSetup() {
  const [tab, setTab] = useState('grade')
  const [gradeConfigs, setGradeConfigs] = useState(GRADES.map(defaultGrade))
  const [lunchConfig, setLunchConfig] = useState({ split_lunch: false, lunch_groups: [] })
  const [schoolId, setSchoolId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: school } = await supabase.from('schools').select('id').eq('user_id', user.id).single()
      if (!school) return
      setSchoolId(school.id)

      const { data: configs } = await supabase.from('grade_configs').select('*').eq('school_id', school.id)
      if (configs?.length) setGradeConfigs(GRADES.map(g => configs.find(c => c.grade === g) || defaultGrade(g)))

      const { data: lunch } = await supabase.from('lunch_config').select('*').eq('school_id', school.id).single()
      if (lunch) setLunchConfig(lunch)
    }
    load()
  }, [])

  async function handleSave() {
    if (!schoolId) return
    setSaving(true)
    // 학년별 설정 저장
    for (const config of gradeConfigs) {
      await supabase.from('grade_configs').upsert({ ...config, school_id: schoolId }, { onConflict: 'school_id,grade' })
    }
    // 점심 설정 저장
    await supabase.from('lunch_config').upsert({ ...lunchConfig, school_id: schoolId }, { onConflict: 'school_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function updateGrade(grade, field, value) {
    setGradeConfigs(prev => prev.map(c => c.grade === grade ? { ...c, [field]: Number(value) } : c))
  }

  function toggleLunchGrade(gradeNum, slotIdx) {
    setLunchConfig(prev => {
      const groups = [...prev.lunch_groups]
      const existing = groups.find(g => g.slot === slotIdx)
      if (existing) {
        const grades = existing.grades.includes(gradeNum)
          ? existing.grades.filter(g => g !== gradeNum)
          : [...existing.grades, gradeNum]
        return { ...prev, lunch_groups: groups.map(g => g.slot === slotIdx ? { ...g, grades } : g) }
      } else {
        return { ...prev, lunch_groups: [...groups, { slot: slotIdx, grades: [gradeNum] }] }
      }
    })
  }

  function isGradeInSlot(grade, slot) {
    return lunchConfig.lunch_groups.some(g => g.slot === slot && g.grades.includes(grade))
  }

  const tabs = [
    { key: 'grade', label: '학급 정보' },
    { key: 'lunch', label: '점심시간 설정' },
  ]

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">학교 설정</h1>
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

      {/* 탭 1: 학급 정보 */}
      {tab === 'grade' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7 flex flex-col gap-6">
          {/* 학급 수 */}
          <div>
            <h2 className="text-[14px] font-semibold mb-1">학년별 학급 수</h2>
            <p className="text-[12px] text-gray-400 mb-4">각 학년의 학급 수를 입력하세요.</p>
            <div className="flex gap-3">
              {gradeConfigs.map(({ grade, num_classes }) => (
                <div key={grade} className="flex flex-col items-center gap-2">
                  <label className="text-[12px] font-semibold text-gray-500">{grade}학년</label>
                  <input
                    type="number" min={1} max={20} value={num_classes}
                    onChange={e => updateGrade(grade, 'num_classes', e.target.value)}
                    className="w-[72px] h-10 text-center border border-gray-300 rounded-sm text-[14px] font-semibold outline-none focus:border-black"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* 요일별 수업 시수 */}
          <div>
            <h2 className="text-[14px] font-semibold mb-1">학년별 요일별 수업 시수</h2>
            <p className="text-[12px] text-gray-400 mb-4">하루 최대 수업 시수를 입력하세요.</p>
            <div className="border border-gray-200 rounded-sm overflow-hidden">
              {/* 헤더 */}
              <div className="flex bg-gray-50 border-b border-gray-200">
                <div className="w-[72px] flex-shrink-0 px-3 py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200">학년</div>
                {DAYS.map(d => (
                  <div key={d} className="flex-1 text-center py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">{d}</div>
                ))}
              </div>
              {/* 행 */}
              {gradeConfigs.map(config => (
                <div key={config.grade} className="flex border-b border-gray-100 last:border-b-0">
                  <div className="w-[72px] flex-shrink-0 px-3 flex items-center text-[12px] text-gray-600 border-r border-gray-200">{config.grade}학년</div>
                  {DAY_KEYS.map(key => (
                    <div key={key} className="flex-1 border-r border-gray-100 last:border-r-0 flex items-center justify-center py-1">
                      <input
                        type="number" min={1} max={7} value={config[key]}
                        onChange={e => updateGrade(config.grade, key, e.target.value)}
                        className="w-10 h-8 text-center text-[12px] border border-gray-200 rounded-sm outline-none focus:border-black"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 탭 2: 점심시간 설정 */}
      {tab === 'lunch' && (
        <div className="bg-white border border-gray-200 rounded-sm p-7 flex flex-col gap-6">
          <div>
            <h2 className="text-[14px] font-semibold mb-4">점심시간 분리 배정</h2>
            <div className="flex gap-4 mb-6">
              {[
                { value: false, label: '일반 (전 학년 동시 점심)' },
                { value: true, label: '분리 배정 (학년별 점심 시간 다름)' },
              ].map(opt => (
                <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" checked={lunchConfig.split_lunch === opt.value}
                    onChange={() => setLunchConfig(prev => ({ ...prev, split_lunch: opt.value }))}
                  />
                  <span className="text-[13px]">{opt.label}</span>
                </label>
              ))}
            </div>

            {lunchConfig.split_lunch && (
              <div>
                <p className="text-[12px] text-gray-500 mb-4">
                  각 학년의 점심 위치를 선택하세요. 슬롯 번호는 절대 시간 순서입니다.<br />
                  예: 슬롯 3 = 3교시 후 점심 / 슬롯 4 = 4교시 후 점심 / 슬롯 5 = 5교시 후 점심
                </p>
                <div className="border border-gray-200 rounded-sm overflow-hidden">
                  <div className="flex bg-gray-50 border-b border-gray-200">
                    <div className="w-[80px] px-3 py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200">학년</div>
                    {[3, 4, 5].map(slot => (
                      <div key={slot} className="flex-1 text-center py-2 text-[11px] font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">
                        슬롯 {slot} 후 점심
                      </div>
                    ))}
                  </div>
                  {GRADES.map(grade => (
                    <div key={grade} className="flex border-b border-gray-100 last:border-b-0">
                      <div className="w-[80px] px-3 py-2 text-[12px] border-r border-gray-200">{grade}학년</div>
                      {[3, 4, 5].map(slot => (
                        <div key={slot} className="flex-1 flex items-center justify-center border-r border-gray-100 last:border-r-0 py-2">
                          <input type="checkbox" checked={isGradeInSlot(grade, slot)} onChange={() => toggleLunchGrade(grade, slot)} />
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

      {/* 저장 버튼 */}
      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-5 bg-black text-white text-[13px] font-semibold rounded-sm disabled:opacity-50"
        >
          {saved ? '저장됨 ✓' : saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 브라우저에서 확인**

로그인 후 학교 설정 페이지 접속 → 학급 수 수정 → 저장 → 새로고침 후 유지 확인

---

## Task 6: 전담 과목 설정 탭

**Files:**
- Modify: `src/pages/SchoolSetup.jsx` (탭 추가)

- [ ] **Step 1: 과목 관련 state 및 로드 추가**

`SchoolSetup.jsx` 상단 state에 추가:
```jsx
const [subjects, setSubjects] = useState([]) // [{grade, name, weekly_hours}]
```

`load()` 함수에 추가:
```js
const { data: subs } = await supabase.from('subjects').select('*').eq('school_id', school.id).order('grade')
if (subs) setSubjects(subs)
```

- [ ] **Step 2: 과목 저장 함수**

`handleSave()` 함수에 추가 (기존 학년 저장 후):
```js
// 과목: 기존 삭제 후 재삽입
await supabase.from('subjects').delete().eq('school_id', schoolId)
if (subjects.length > 0) {
  await supabase.from('subjects').insert(subjects.map(s => ({ ...s, school_id: schoolId })))
}
```

- [ ] **Step 3: 과목 탭 UI 추가**

`tabs` 배열에 항목 추가:
```js
{ key: 'subjects', label: '전담 과목 설정' }
```

탭 3 UI 추가 (`{tab === 'lunch' && ...}` 아래에):
```jsx
{tab === 'subjects' && (
  <div className="bg-white border border-gray-200 rounded-sm p-7 flex flex-col gap-4">
    <div>
      <h2 className="text-[14px] font-semibold mb-1">학년별 전담 과목 및 주당 시수</h2>
      <p className="text-[12px] text-gray-400 mb-4">각 학년에서 전담 교사가 가르치는 과목과 주당 시수를 입력하세요.</p>
    </div>
    {GRADES.map(grade => (
      <div key={grade} className="border border-gray-200 rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold">{grade}학년</span>
          <button
            onClick={() => setSubjects(prev => [...prev, { grade, name: '', weekly_hours: 2 }])}
            className="text-[12px] px-3 h-7 border border-gray-300 rounded-sm hover:bg-gray-50"
          >
            + 과목 추가
          </button>
        </div>
        {subjects.filter(s => s.grade === grade).length === 0 && (
          <p className="text-[12px] text-gray-300">과목을 추가하세요</p>
        )}
        <div className="flex flex-col gap-2">
          {subjects.map((s, i) => s.grade !== grade ? null : (
            <div key={i} className="flex items-center gap-2">
              <input
                placeholder="과목명 (예: 영어)"
                value={s.name}
                onChange={e => setSubjects(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                className="flex-1 h-9 px-3 border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
              />
              <span className="text-[12px] text-gray-400">주당</span>
              <input
                type="number" min={1} max={10} value={s.weekly_hours}
                onChange={e => setSubjects(prev => prev.map((x, j) => j === i ? { ...x, weekly_hours: Number(e.target.value) } : x))}
                className="w-14 h-9 text-center border border-gray-200 rounded-sm text-[13px] outline-none focus:border-black"
              />
              <span className="text-[12px] text-gray-400">시수</span>
              <button
                onClick={() => setSubjects(prev => prev.filter((_, j) => j !== i))}
                className="text-[12px] text-red-400 hover:text-red-600 px-2"
              >삭제</button>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: 확인**

전담 과목 탭 → 1학년에 "영어" 주 2시수 추가 → 저장 → 새로고침 후 유지 확인

---

## Task 7: 전담 교사 관리 페이지

**Files:**
- Modify: `src/pages/TeacherManagement.jsx`

- [ ] **Step 1: 교사 목록 + 추가 모달 작성**

`src/pages/TeacherManagement.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { Plus, X, Trash2, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function TeacherManagement() {
  const [schoolId, setSchoolId] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [gradeConfigs, setGradeConfigs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState(null)
  const [form, setForm] = useState({ code: '', assignments: [] })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: school } = await supabase.from('schools').select('id').eq('user_id', user.id).single()
    if (!school) return
    setSchoolId(school.id)

    const [{ data: t }, { data: s }, { data: g }] = await Promise.all([
      supabase.from('teachers').select('*, teacher_assignments(*, subjects(name))').eq('school_id', school.id),
      supabase.from('subjects').select('*').eq('school_id', school.id).order('grade'),
      supabase.from('grade_configs').select('*').eq('school_id', school.id).order('grade'),
    ])
    setTeachers(t || [])
    setSubjects(s || [])
    setGradeConfigs(g || [])
  }

  function openAdd() {
    setEditingTeacher(null)
    setForm({ code: '', assignments: [] })
    setShowModal(true)
  }

  function openEdit(teacher) {
    setEditingTeacher(teacher)
    setForm({
      code: teacher.code,
      assignments: teacher.teacher_assignments.map(a => ({
        subject_id: a.subject_id,
        grade: a.grade,
        class_num: a.class_num,
        weekly_hours: a.weekly_hours,
      }))
    })
    setShowModal(true)
  }

  async function handleDelete(teacherId) {
    if (!confirm('이 교사를 삭제하시겠습니까?')) return
    await supabase.from('teachers').delete().eq('id', teacherId)
    load()
  }

  async function handleSave() {
    if (!form.code.trim()) return alert('교사 명칭을 입력하세요')
    if (editingTeacher) {
      await supabase.from('teachers').update({ code: form.code }).eq('id', editingTeacher.id)
      await supabase.from('teacher_assignments').delete().eq('teacher_id', editingTeacher.id)
      if (form.assignments.length > 0) {
        await supabase.from('teacher_assignments').insert(
          form.assignments.map(a => ({ ...a, teacher_id: editingTeacher.id }))
        )
      }
    } else {
      const { data: newTeacher } = await supabase.from('teachers').insert({ code: form.code, school_id: schoolId }).select().single()
      if (newTeacher && form.assignments.length > 0) {
        await supabase.from('teacher_assignments').insert(
          form.assignments.map(a => ({ ...a, teacher_id: newTeacher.id }))
        )
      }
    }
    setShowModal(false)
    load()
  }

  function addAssignment() {
    setForm(prev => ({ ...prev, assignments: [...prev.assignments, { subject_id: '', grade: 1, class_num: 1, weekly_hours: 2 }] }))
  }

  function updateAssignment(i, field, value) {
    setForm(prev => ({ ...prev, assignments: prev.assignments.map((a, j) => j === i ? { ...a, [field]: value } : a) }))
  }

  function removeAssignment(i) {
    setForm(prev => ({ ...prev, assignments: prev.assignments.filter((_, j) => j !== i) }))
  }

  const maxClasses = (grade) => gradeConfigs.find(g => g.grade === grade)?.num_classes || 6

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">전담 교사 관리</h1>
        <button onClick={openAdd} className="flex items-center gap-2 h-10 px-4 bg-black text-white text-[13px] font-semibold rounded-sm">
          <Plus size={14} />교사 추가
        </button>
      </div>

      {/* 안내 */}
      <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-sm mb-5 text-[12px] text-gray-500">
        권장 명칭 형식: [주담당학년][과목]  예) 34영어, 56체육, 전체음악
      </div>

      {/* 교사 목록 */}
      {teachers.length === 0 ? (
        <p className="text-[13px] text-gray-400 mt-10 text-center">교사를 추가하세요</p>
      ) : (
        <div className="flex flex-col gap-3">
          {teachers.map(teacher => (
            <div key={teacher.id} className="bg-white border border-gray-200 rounded-sm p-5 flex items-center gap-4">
              <div className="h-9 px-3 bg-black text-white text-[13px] font-bold flex items-center rounded-sm flex-shrink-0">
                {teacher.code}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-gray-900 mb-1">
                  {teacher.teacher_assignments.map(a => a.subjects?.name).filter(Boolean).join(' · ') || '담당 과목 없음'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {teacher.teacher_assignments.map((a, i) => (
                    <span key={i} className="text-[11px] text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">
                      {a.grade}학년 {a.class_num}반 · 주 {a.weekly_hours}시수
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(teacher)} className="h-8 px-3 border border-gray-300 rounded-sm text-[12px] hover:bg-gray-50 flex items-center gap-1">
                  <Edit2 size={12} />편집
                </button>
                <button onClick={() => handleDelete(teacher.id)} className="h-8 px-3 border border-red-200 rounded-sm text-[12px] text-red-500 hover:bg-red-50 flex items-center gap-1">
                  <Trash2 size={12} />삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가/편집 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[600px] max-h-[80vh] overflow-y-auto rounded-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[18px] font-bold">{editingTeacher ? '교사 편집' : '교사 추가'}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="mb-5">
              <label className="text-[12px] font-semibold text-gray-600 block mb-1.5">교사 명칭</label>
              <input
                placeholder="예: 34영어"
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                className="w-full h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black"
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-semibold text-gray-600">담당 학급 배정</label>
                <button onClick={addAssignment} className="text-[12px] px-3 h-7 border border-gray-300 rounded-sm hover:bg-gray-50">+ 추가</button>
              </div>
              {form.assignments.length === 0 && <p className="text-[12px] text-gray-300 py-2">담당 학급을 추가하세요</p>}
              <div className="flex flex-col gap-2">
                {form.assignments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-sm">
                    <select
                      value={a.subject_id}
                      onChange={e => updateAssignment(i, 'subject_id', e.target.value)}
                      className="flex-1 h-9 px-2 border border-gray-200 rounded-sm text-[12px] outline-none"
                    >
                      <option value="">과목 선택</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.grade}학년 {s.name}</option>)}
                    </select>
                    <select
                      value={a.grade}
                      onChange={e => updateAssignment(i, 'grade', Number(e.target.value))}
                      className="w-20 h-9 px-2 border border-gray-200 rounded-sm text-[12px] outline-none"
                    >
                      {[1,2,3,4,5,6].map(g => <option key={g} value={g}>{g}학년</option>)}
                    </select>
                    <select
                      value={a.class_num}
                      onChange={e => updateAssignment(i, 'class_num', Number(e.target.value))}
                      className="w-20 h-9 px-2 border border-gray-200 rounded-sm text-[12px] outline-none"
                    >
                      {Array.from({ length: maxClasses(a.grade) }, (_, k) => k + 1).map(c => (
                        <option key={c} value={c}>{c}반</option>
                      ))}
                    </select>
                    <span className="text-[12px] text-gray-400">주</span>
                    <input
                      type="number" min={1} max={10} value={a.weekly_hours}
                      onChange={e => updateAssignment(i, 'weekly_hours', Number(e.target.value))}
                      className="w-14 h-9 text-center border border-gray-200 rounded-sm text-[12px] outline-none"
                    />
                    <span className="text-[12px] text-gray-400">시수</span>
                    <button onClick={() => removeAssignment(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="h-10 px-4 border border-gray-300 rounded-sm text-[13px]">취소</button>
              <button onClick={handleSave} className="h-10 px-5 bg-black text-white text-[13px] font-semibold rounded-sm">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 교사 추가/편집/삭제 동작 확인**

교사 추가 → 과목 배정 → 저장 → 목록 표시 확인

---

## Task 8: 시간표 자동 생성 알고리즘

**Files:**
- Create: `src/lib/scheduler.js`

- [ ] **Step 1: 스케줄러 작성**

`src/lib/scheduler.js`:
```js
/**
 * 전담 시간표 자동 생성 알고리즘
 *
 * 슬롯 구조:
 * - 일반 학교: slot 0~5 = 1~6교시
 * - 분리 배정: slot 0~6 = 7개 절대 시간 슬롯 (학년별 점심 슬롯 포함)
 *
 * lunchConfig.lunch_groups 예시:
 * [{grades:[1,6], slot:3}, {grades:[2,5], slot:4}, {grades:[3,4], slot:5}]
 */

export function buildSchedule(gradeConfigs, subjects, teachers, lunchConfig) {
  const splitLunch = lunchConfig?.split_lunch || false
  const lunchGroups = lunchConfig?.lunch_groups || []
  const totalSlots = splitLunch ? 7 : 6

  // 학년별 점심 슬롯 인덱스 계산
  const gradeLunchSlot = {} // grade -> slot index (0-based)
  if (splitLunch) {
    for (const group of lunchGroups) {
      for (const grade of group.grades) {
        gradeLunchSlot[grade] = group.slot
      }
    }
  }

  // 점심 구간 슬롯 인덱스 목록 (교사 점심 제약에 사용)
  const lunchZoneSlots = splitLunch ? [...new Set(lunchGroups.map(g => g.slot))] : []

  // 학년·반의 사용 가능한 슬롯 목록 생성
  // gradeClassSlots[grade][classNum][day] = Set<slotIdx>
  const gradeClassSlots = {}
  for (const gc of gradeConfigs) {
    const { grade, num_classes } = gc
    const dayPeriods = [gc.periods_mon, gc.periods_tue, gc.periods_wed, gc.periods_thu, gc.periods_fri]
    gradeClassSlots[grade] = {}
    for (let cls = 1; cls <= num_classes; cls++) {
      gradeClassSlots[grade][cls] = dayPeriods.map((periods, day) => {
        const slots = new Set()
        let count = 0
        for (let s = 0; s < totalSlots; s++) {
          if (splitLunch && gradeLunchSlot[grade] === s) continue // 점심 건너뜀
          if (count < periods) { slots.add(s); count++ }
        }
        return slots
      })
    }
  }

  // 배정해야 할 작업 목록
  // assignments: [{teacherId, subjectId, grade, classNum, periodsLeft}]
  const assignmentList = []
  for (const teacher of teachers) {
    for (const a of teacher.assignments) {
      if (a.weekly_hours > 0) {
        assignmentList.push({
          teacherId: teacher.id,
          subjectId: a.subject_id,
          grade: a.grade,
          classNum: a.class_num,
          periodsLeft: a.weekly_hours,
        })
      }
    }
  }

  // 결과 시간표
  // result[grade][classNum][day][slot] = {teacherId, subjectId} | null
  const result = {}
  for (const gc of gradeConfigs) {
    result[gc.grade] = {}
    for (let cls = 1; cls <= gc.num_classes; cls++) {
      result[gc.grade][cls] = Array.from({ length: 5 }, () => Array(totalSlots).fill(null))
    }
  }

  // 교사별 점유 슬롯 추적
  // teacherOccupied[teacherId][day] = Set<slotIdx>
  const teacherOccupied = {}
  for (const teacher of teachers) {
    teacherOccupied[teacher.id] = Array.from({ length: 5 }, () => new Set())
  }

  // 에러 목록
  const errors = []

  // 각 배정 항목에 대해 슬롯 찾기
  for (const item of assignmentList) {
    const { teacherId, subjectId, grade, classNum } = item
    let remaining = item.periodsLeft

    // 요일 순서를 무작위로 섞어 고르게 분산
    const dayOrder = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5)

    for (const day of dayOrder) {
      if (remaining <= 0) break
      const classAvailable = gradeClassSlots[grade]?.[classNum]?.[day]
      if (!classAvailable) continue

      for (let slot = 0; slot < totalSlots; slot++) {
        if (remaining <= 0) break
        // 학급 슬롯 가용성 확인
        if (!classAvailable.has(slot)) continue
        // 교사 슬롯 가용성 확인
        if (teacherOccupied[teacherId][day].has(slot)) continue
        // 교사 점심 보장 (분리 배정 학교)
        if (splitLunch && lunchZoneSlots.includes(slot)) {
          const occupiedLunchZone = lunchZoneSlots.filter(ls => teacherOccupied[teacherId][day].has(ls))
          if (occupiedLunchZone.length >= lunchZoneSlots.length - 1) continue // 나머지 모두 점령됨 → 이 슬롯 불가
        }

        // 배정
        result[grade][classNum][day][slot] = { teacherId, subjectId }
        teacherOccupied[teacherId][day].add(slot)
        classAvailable.delete(slot)
        remaining--
        break
      }
    }

    if (remaining > 0) {
      errors.push({ grade, classNum, teacherId, subjectId, unassigned: remaining })
    }
  }

  return { result, errors, gradeLunchSlot, totalSlots }
}

/** 시간표 결과를 DB 저장용 flat 배열로 변환 */
export function flattenResult(scheduleResult, schoolId) {
  const { result, errors, gradeLunchSlot, totalSlots } = scheduleResult
  const rows = []

  for (const [gradeStr, classes] of Object.entries(result)) {
    const grade = Number(gradeStr)
    const lunchSlot = gradeLunchSlot[grade]

    for (const [classStr, days] of Object.entries(classes)) {
      const classNum = Number(classStr)

      for (let day = 0; day < 5; day++) {
        for (let slot = 0; slot < totalSlots; slot++) {
          const cell = days[day][slot]
          const isLunch = lunchSlot === slot

          rows.push({
            school_id: schoolId,
            grade, class_num: classNum, day, slot,
            teacher_id: cell?.teacherId || null,
            subject_id: cell?.subjectId || null,
            is_unassigned: !cell && !isLunch,
          })
        }
      }
    }
  }

  return { rows, errors }
}
```

---

## Task 9: 전담 시간표 UI

**Files:**
- Modify: `src/pages/Timetable.jsx`
- Create: `src/components/TimetableGrid.jsx`

- [ ] **Step 1: TimetableGrid 컴포넌트**

`src/components/TimetableGrid.jsx`:
```jsx
const DAY_LABELS = ['월', '화', '수', '목', '금']

export default function TimetableGrid({ slots, totalSlots, gradeLunchSlot, teachers, subjects, onCellClick }) {
  function getSlotLabel(slot, grade) {
    if (!gradeLunchSlot) {
      return `${slot + 1}교시`
    }
    const lunchSlot = gradeLunchSlot[grade]
    if (slot === lunchSlot) return '점심'
    const before = Object.values(gradeLunchSlot).filter(ls => ls <= slot && ls !== slot)
    const period = slot - (lunchSlot !== undefined && slot > lunchSlot ? 1 : 0)
    return `${period + 1}교시`
  }

  function isLunch(slot, grade) {
    return gradeLunchSlot && gradeLunchSlot[grade] === slot
  }

  return (
    <div className="border border-gray-200 rounded-sm overflow-hidden">
      {/* 헤더 행 */}
      <div className="flex bg-gray-50">
        <div className="w-[72px] flex-shrink-0 border-r border-gray-200 h-9 flex items-center justify-center text-[11px] font-semibold text-gray-500">교시</div>
        {DAY_LABELS.map(d => (
          <div key={d} className="flex-1 h-9 flex items-center justify-center border-r border-gray-200 last:border-r-0 text-[11px] font-semibold text-gray-500">{d}</div>
        ))}
      </div>

      {/* 슬롯 행 */}
      {Array.from({ length: totalSlots }, (_, slot) => {
        const lunch = isLunch(slot, Object.keys(gradeLunchSlot || {})[0])
        return (
          <div key={slot} className={`flex ${lunch ? 'h-8 bg-gray-50' : 'h-[62px]'}`}>
            <div className="w-[72px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-400 bg-gray-50">
              {lunch ? '점심' : `${slot + 1}교시`}
            </div>
            {Array.from({ length: 5 }, (_, day) => {
              if (lunch) {
                return <div key={day} className="flex-1 border-r border-gray-100 last:border-r-0 flex items-center justify-center text-[11px] text-gray-300">점심시간</div>
              }
              const cell = slots?.[day]?.[slot]
              const teacher = cell?.teacher_id ? teachers.find(t => t.id === cell.teacher_id) : null
              const subject = cell?.subject_id ? subjects.find(s => s.id === cell.subject_id) : null
              const unassigned = cell?.is_unassigned

              return (
                <div
                  key={day}
                  onClick={() => onCellClick && onCellClick(day, slot, cell)}
                  className={`flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors
                    ${unassigned ? 'bg-red-500' : 'hover:bg-gray-50'}`}
                >
                  {teacher && subject ? (
                    <>
                      <span className={`text-[13px] font-semibold ${unassigned ? 'text-white' : 'text-gray-900'}`}>{subject.name}</span>
                      <span className={`text-[10px] ${unassigned ? 'text-red-200' : 'text-gray-400'}`}>{teacher.code}</span>
                    </>
                  ) : unassigned ? (
                    <span className="text-[11px] font-semibold text-white">미배정</span>
                  ) : (
                    <span className="text-[12px] text-gray-200">—</span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Timetable 페이지 작성**

`src/pages/Timetable.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { Download, Zap, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { buildSchedule, flattenResult } from '../lib/scheduler'
import TimetableGrid from '../components/TimetableGrid'

export default function Timetable() {
  const [schoolId, setSchoolId] = useState(null)
  const [gradeConfigs, setGradeConfigs] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [lunchConfig, setLunchConfig] = useState(null)
  const [slots, setSlots] = useState([]) // DB에서 로드한 슬롯
  const [viewMode, setViewMode] = useState('class') // 'class' | 'teacher'
  const [selectedGrade, setSelectedGrade] = useState(1)
  const [selectedClass, setSelectedClass] = useState(1)
  const [selectedTeacherId, setSelectedTeacherId] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [errors, setErrors] = useState([])
  const [scheduleResult, setScheduleResult] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: school } = await supabase.from('schools').select('id').eq('user_id', user.id).single()
    if (!school) return
    setSchoolId(school.id)

    const [{ data: gc }, { data: sub }, { data: t }, { data: lc }, { data: sl }] = await Promise.all([
      supabase.from('grade_configs').select('*').eq('school_id', school.id).order('grade'),
      supabase.from('subjects').select('*').eq('school_id', school.id),
      supabase.from('teachers').select('*, teacher_assignments(*)').eq('school_id', school.id),
      supabase.from('lunch_config').select('*').eq('school_id', school.id).single(),
      supabase.from('timetable_slots').select('*').eq('school_id', school.id),
    ])
    setGradeConfigs(gc || [])
    setSubjects(sub || [])
    setTeachers(t || [])
    setLunchConfig(lc || null)
    setSlots(sl || [])
    if (t?.length) setSelectedTeacherId(t[0].id)
    if (gc?.length) { setSelectedGrade(gc[0].grade); setSelectedClass(1) }
  }

  async function handleGenerate() {
    if (!gradeConfigs.length || !teachers.length) return alert('학교 설정과 교사 정보를 먼저 입력하세요.')
    setGenerating(true)
    const result = buildSchedule(gradeConfigs, subjects, teachers, lunchConfig)
    const { rows, errors: errs } = flattenResult(result, schoolId)
    setErrors(errs)
    setScheduleResult(result)
    // DB에 저장
    await supabase.from('timetable_slots').delete().eq('school_id', schoolId)
    if (rows.length > 0) await supabase.from('timetable_slots').insert(rows)
    await load()
    setGenerating(false)
  }

  // 선택된 학급의 슬롯 데이터를 grid 형식으로 변환
  function getClassSlots() {
    const filtered = slots.filter(s => s.grade === selectedGrade && s.class_num === selectedClass)
    const grid = Array.from({ length: 5 }, () => ({}))
    for (const s of filtered) {
      grid[s.day][s.slot] = s
    }
    return grid
  }

  function getTeacherSlots() {
    if (!selectedTeacherId) return Array.from({ length: 5 }, () => ({}))
    const filtered = slots.filter(s => s.teacher_id === selectedTeacherId)
    const grid = Array.from({ length: 5 }, () => ({}))
    for (const s of filtered) {
      if (!grid[s.day][s.slot]) grid[s.day][s.slot] = s
    }
    return grid
  }

  const totalSlots = lunchConfig?.split_lunch ? 7 : 6
  const gradeLunchSlot = {}
  if (lunchConfig?.split_lunch) {
    for (const g of (lunchConfig.lunch_groups || [])) {
      for (const grade of g.grades) gradeLunchSlot[grade] = g.slot
    }
  }

  const selectedGradeConfig = gradeConfigs.find(g => g.grade === selectedGrade)
  const numClasses = selectedGradeConfig?.num_classes || 1

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold">전담 시간표</h1>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 h-9 px-3.5 border border-gray-300 bg-white rounded-sm text-[13px]">
            <Download size={13} />엑셀 다운로드
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 h-9 px-3.5 bg-black text-white text-[13px] font-semibold rounded-sm disabled:opacity-50"
          >
            <Zap size={13} />{generating ? '생성 중...' : '자동 생성'}
          </button>
        </div>
      </div>

      {/* 오류 표시 */}
      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-sm text-[12px] text-red-600">
          미배정 {errors.length}건: {errors.map(e => `${e.grade}학년 ${e.classNum}반 (${e.unassigned}시수)`).join(', ')}
        </div>
      )}

      {/* 뷰 탭 + 선택기 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex border border-gray-200 bg-white rounded-sm">
          {['class', 'teacher'].map((mode, i) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-5 h-9 text-[13px] transition-colors ${viewMode === mode ? 'bg-black text-white font-semibold' : 'text-gray-400'}`}
            >
              {mode === 'class' ? '학급별 보기' : '교사별 보기'}
            </button>
          ))}
        </div>

        {viewMode === 'class' ? (
          <div className="flex gap-2">
            <select value={selectedGrade} onChange={e => { setSelectedGrade(Number(e.target.value)); setSelectedClass(1) }}
              className="h-9 px-3 border border-gray-300 rounded-sm text-[13px] bg-white outline-none">
              {gradeConfigs.map(g => <option key={g.grade} value={g.grade}>{g.grade}학년</option>)}
            </select>
            <select value={selectedClass} onChange={e => setSelectedClass(Number(e.target.value))}
              className="h-9 px-3 border border-gray-300 rounded-sm text-[13px] bg-white outline-none">
              {Array.from({ length: numClasses }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}반</option>)}
            </select>
          </div>
        ) : (
          <select value={selectedTeacherId || ''} onChange={e => setSelectedTeacherId(e.target.value)}
            className="h-9 px-3 border border-gray-300 rounded-sm text-[13px] bg-white outline-none">
            {teachers.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
          </select>
        )}
      </div>

      {/* 시간표 그리드 */}
      <TimetableGrid
        slots={viewMode === 'class' ? getClassSlots() : getTeacherSlots()}
        totalSlots={totalSlots}
        gradeLunchSlot={viewMode === 'class' ? gradeLunchSlot : {}}
        teachers={teachers}
        subjects={subjects}
      />
    </div>
  )
}
```

- [ ] **Step 3: 자동 생성 동작 확인**

시간표 페이지 → "자동 생성" 클릭 → 그리드에 결과 표시 확인

---

## Task 10: 엑셀 다운로드

**Files:**
- Create: `src/lib/excelExport.js`
- Modify: `src/pages/Timetable.jsx`, `src/pages/RoomTimetable.jsx`

- [ ] **Step 1: 엑셀 유틸리티 작성**

`src/lib/excelExport.js`:
```js
import * as XLSX from 'xlsx'

const DAYS = ['월', '화', '수', '목', '금']

export function exportTimetableByClass(slots, gradeConfigs, teachers, subjects, lunchConfig) {
  const wb = XLSX.utils.book_new()
  const splitLunch = lunchConfig?.split_lunch || false
  const totalSlots = splitLunch ? 7 : 6
  const gradeLunchSlot = {}
  if (splitLunch) {
    for (const g of (lunchConfig.lunch_groups || [])) {
      for (const grade of g.grades) gradeLunchSlot[grade] = g.slot
    }
  }

  for (const gc of gradeConfigs) {
    for (let cls = 1; cls <= gc.num_classes; cls++) {
      const rows = [['교시', '월', '화', '수', '목', '금']]
      for (let slot = 0; slot < totalSlots; slot++) {
        const lunchSlot = gradeLunchSlot[gc.grade]
        const isLunch = lunchSlot === slot
        const label = isLunch ? '점심' : `${slot + 1}교시`
        const row = [label]
        for (let day = 0; day < 5; day++) {
          const cell = slots.find(s => s.grade === gc.grade && s.class_num === cls && s.day === day && s.slot === slot)
          if (isLunch) { row.push('점심시간'); continue }
          const teacher = cell?.teacher_id ? teachers.find(t => t.id === cell.teacher_id) : null
          const subject = cell?.subject_id ? subjects.find(s => s.id === cell.subject_id) : null
          row.push(teacher && subject ? `${subject.name}(${teacher.code})` : '')
        }
        rows.push(row)
      }
      const ws = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, `${gc.grade}학년${cls}반`)
    }
  }
  XLSX.writeFile(wb, '전담시간표.xlsx')
}

export function exportTimetableByTeacher(slots, teachers, subjects, lunchConfig) {
  const wb = XLSX.utils.book_new()
  const totalSlots = lunchConfig?.split_lunch ? 7 : 6

  for (const teacher of teachers) {
    const rows = [['교시', '월', '화', '수', '목', '금']]
    for (let slot = 0; slot < totalSlots; slot++) {
      const row = [`${slot + 1}교시`]
      for (let day = 0; day < 5; day++) {
        const cell = slots.find(s => s.teacher_id === teacher.id && s.day === day && s.slot === slot)
        const subject = cell?.subject_id ? subjects.find(s => s.id === cell.subject_id) : null
        row.push(subject ? `${cell.grade}학년${cell.class_num}반 ${subject.name}` : '')
      }
      rows.push(row)
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, teacher.code)
  }
  XLSX.writeFile(wb, '교사별시간표.xlsx')
}

export function exportRoomTimetable(slots, rooms) {
  const wb = XLSX.utils.book_new()
  for (const room of rooms) {
    const rows = [['교시', '월', '화', '수', '목', '금']]
    for (let slot = 0; slot < 6; slot++) {
      const row = [`${slot + 1}교시`]
      for (let day = 0; day < 5; day++) {
        const cell = slots.find(s => s.room_id === room.id && s.day === day && s.slot === slot)
        if (!cell) { row.push(''); continue }
        if (cell.assignment_type === 'dedicated') row.push(`전담`)
        else row.push(`${cell.grade}학년${cell.class_num}반`)
      }
      rows.push(row)
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, room.name)
  }
  XLSX.writeFile(wb, '특별실시간표.xlsx')
}
```

- [ ] **Step 2: Timetable.jsx 엑셀 버튼 연결**

`Timetable.jsx`에 import 추가:
```js
import { exportTimetableByClass, exportTimetableByTeacher } from '../lib/excelExport'
```

엑셀 다운로드 버튼 수정:
```jsx
<button
  onClick={() => viewMode === 'class'
    ? exportTimetableByClass(slots, gradeConfigs, teachers, subjects, lunchConfig)
    : exportTimetableByTeacher(slots, teachers, subjects, lunchConfig)
  }
  className="flex items-center gap-1.5 h-9 px-3.5 border border-gray-300 bg-white rounded-sm text-[13px]"
>
  <Download size={13} />엑셀 다운로드
</button>
```

- [ ] **Step 3: 엑셀 다운로드 확인**

시간표 자동 생성 → 엑셀 다운로드 → 파일 열어서 내용 확인

---

## Task 11: 특별실 관리 페이지

**Files:**
- Modify: `src/pages/RoomManagement.jsx`

- [ ] **Step 1: 특별실 관리 페이지 작성**

`src/pages/RoomManagement.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { Plus, X, Trash2, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'

const DAYS = ['월', '화', '수', '목', '금']

export default function RoomManagement() {
  const [schoolId, setSchoolId] = useState(null)
  const [rooms, setRooms] = useState([])
  const [teachers, setTeachers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [form, setForm] = useState({ name: '', teacher_id: '' })
  const [blockedSlots, setBlockedSlots] = useState({}) // roomId -> [{day, slot}]

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: school } = await supabase.from('schools').select('id').eq('user_id', user.id).single()
    if (!school) return
    setSchoolId(school.id)
    const [{ data: r }, { data: t }, { data: b }] = await Promise.all([
      supabase.from('special_rooms').select('*').eq('school_id', school.id),
      supabase.from('teachers').select('id, code').eq('school_id', school.id),
      supabase.from('room_blocked_slots').select('*'),
    ])
    setRooms(r || [])
    setTeachers(t || [])
    const bMap = {}
    for (const bl of (b || [])) {
      if (!bMap[bl.room_id]) bMap[bl.room_id] = []
      bMap[bl.room_id].push(bl)
    }
    setBlockedSlots(bMap)
  }

  async function handleSaveRoom() {
    if (!form.name.trim()) return alert('특별실 이름을 입력하세요')
    if (editingRoom) {
      await supabase.from('special_rooms').update({ name: form.name, teacher_id: form.teacher_id || null }).eq('id', editingRoom.id)
    } else {
      await supabase.from('special_rooms').insert({ name: form.name, teacher_id: form.teacher_id || null, school_id: schoolId })
    }
    setShowModal(false)
    load()
  }

  async function handleDelete(roomId) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('special_rooms').delete().eq('id', roomId)
    load()
  }

  async function toggleBlock(roomId, day, slot) {
    const existing = (blockedSlots[roomId] || []).find(b => b.day === day && b.slot === slot)
    if (existing) {
      await supabase.from('room_blocked_slots').delete().eq('id', existing.id)
    } else {
      await supabase.from('room_blocked_slots').insert({ room_id: roomId, day, slot })
    }
    load()
  }

  function isBlocked(roomId, day, slot) {
    return (blockedSlots[roomId] || []).some(b => b.day === day && b.slot === slot)
  }

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold">특별실 관리</h1>
        <button onClick={() => { setEditingRoom(null); setForm({ name: '', teacher_id: '' }); setShowModal(true) }}
          className="flex items-center gap-2 h-10 px-4 bg-black text-white text-[13px] font-semibold rounded-sm">
          <Plus size={14} />특별실 추가
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {rooms.map(room => {
          const teacher = teachers.find(t => t.id === room.teacher_id)
          return (
            <div key={room.id} className="bg-white border border-gray-200 rounded-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-[16px] font-bold">{room.name}</span>
                  {teacher && <span className="text-[12px] text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">담당: {teacher.code}</span>}
                  {!teacher && <span className="text-[12px] text-gray-300">담당 교사 없음</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingRoom(room); setForm({ name: room.name, teacher_id: room.teacher_id || '' }); setShowModal(true) }}
                    className="h-8 px-3 border border-gray-300 rounded-sm text-[12px]">편집</button>
                  <button onClick={() => handleDelete(room.id)}
                    className="h-8 px-3 border border-red-200 rounded-sm text-[12px] text-red-500">삭제</button>
                </div>
              </div>

              {/* 차단 슬롯 설정 그리드 */}
              <p className="text-[11px] text-gray-400 mb-2">방과후 등 사용 불가 시간을 클릭해 차단하세요:</p>
              <div className="border border-gray-200 rounded-sm overflow-hidden">
                <div className="flex bg-gray-50">
                  <div className="w-14 border-r border-gray-200 h-8 flex items-center justify-center text-[10px] text-gray-400">교시</div>
                  {DAYS.map(d => <div key={d} className="flex-1 h-8 flex items-center justify-center text-[10px] font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">{d}</div>)}
                </div>
                {Array.from({ length: 6 }, (_, slot) => (
                  <div key={slot} className="flex border-t border-gray-100">
                    <div className="w-14 border-r border-gray-200 h-9 flex items-center justify-center text-[10px] text-gray-400">{slot + 1}교시</div>
                    {Array.from({ length: 5 }, (_, day) => {
                      const blocked = isBlocked(room.id, day, slot)
                      return (
                        <div key={day} onClick={() => toggleBlock(room.id, day, slot)}
                          className={`flex-1 h-9 border-r border-gray-100 last:border-r-0 flex items-center justify-center cursor-pointer transition-colors
                            ${blocked ? 'bg-gray-300' : 'hover:bg-gray-50'}`}>
                          {blocked && <Lock size={11} className="text-gray-500" />}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* 추가/편집 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[400px] rounded-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold">{editingRoom ? '특별실 편집' : '특별실 추가'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[12px] font-semibold text-gray-600 block mb-1.5">특별실 이름</label>
                <input placeholder="예: 음악실, 컴퓨터실" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none focus:border-black" />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-gray-600 block mb-1.5">담당 전담 교사 (선택)</label>
                <select value={form.teacher_id} onChange={e => setForm(p => ({ ...p, teacher_id: e.target.value }))}
                  className="w-full h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none bg-white">
                  <option value="">담당 교사 없음</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="h-10 px-4 border border-gray-300 rounded-sm text-[13px]">취소</button>
              <button onClick={handleSaveRoom} className="h-10 px-5 bg-black text-white text-[13px] font-semibold rounded-sm">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Task 12: 특별실 시간표 자동 배정 & UI

**Files:**
- Create: `src/lib/roomScheduler.js`
- Modify: `src/pages/RoomTimetable.jsx`

- [ ] **Step 1: 특별실 스케줄러 작성**

`src/lib/roomScheduler.js`:
```js
/**
 * 특별실 시간표 자동 배정
 * 1단계: 담당 교사가 있는 특별실 → 전담 시간표 슬롯 그대로 복사
 * 2단계: 빈 슬롯에 학급 배정 (전담 시간 겹치지 않게)
 */
export function buildRoomSchedule(rooms, timetableSlots, blockedSlots, schoolId) {
  const roomSlots = [] // {school_id, room_id, day, slot, grade, class_num, assignment_type}

  for (const room of rooms) {
    // 이 특별실의 차단 슬롯
    const blocked = blockedSlots.filter(b => b.room_id === room.id)

    if (room.teacher_id) {
      // 1단계: 담당 교사의 전담 시간 배정
      const teacherSlots = timetableSlots.filter(s => s.teacher_id === room.teacher_id && !s.is_unassigned)
      for (const ts of teacherSlots) {
        const isBlocked = blocked.some(b => b.day === ts.day && b.slot === ts.slot)
        if (!isBlocked) {
          roomSlots.push({
            school_id: schoolId,
            room_id: room.id,
            day: ts.day,
            slot: ts.slot,
            grade: ts.grade,
            class_num: ts.class_num,
            assignment_type: 'dedicated',
          })
        }
      }
    }

    // 2단계: 빈 시간은 외부에서 수동으로 채울 수 있도록 빈 상태 유지
    // (사용자가 RoomTimetable 페이지에서 학년·반을 선택해 배정)
  }

  return roomSlots
}
```

- [ ] **Step 2: RoomTimetable 페이지 작성**

`src/pages/RoomTimetable.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { Download, Zap, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { buildRoomSchedule } from '../lib/roomScheduler'
import { exportRoomTimetable } from '../lib/excelExport'

const DAYS = ['월', '화', '수', '목', '금']

export default function RoomTimetable() {
  const [schoolId, setSchoolId] = useState(null)
  const [rooms, setRooms] = useState([])
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [roomSlots, setRoomSlots] = useState([])
  const [timetableSlots, setTimetableSlots] = useState([])
  const [blockedSlots, setBlockedSlots] = useState([])
  const [teachers, setTeachers] = useState([])
  const [gradeConfigs, setGradeConfigs] = useState([])
  const [generating, setGenerating] = useState(false)
  // 빈 셀 클릭 시 학급 배정 모달
  const [assignModal, setAssignModal] = useState(null) // {day, slot}
  const [assignGrade, setAssignGrade] = useState(1)
  const [assignClass, setAssignClass] = useState(1)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: school } = await supabase.from('schools').select('id').eq('user_id', user.id).single()
    if (!school) return
    setSchoolId(school.id)
    const [{ data: r }, { data: ts }, { data: bs }, { data: t }, { data: gc }, { data: rts }] = await Promise.all([
      supabase.from('special_rooms').select('*').eq('school_id', school.id),
      supabase.from('timetable_slots').select('*').eq('school_id', school.id),
      supabase.from('room_blocked_slots').select('*'),
      supabase.from('teachers').select('id, code').eq('school_id', school.id),
      supabase.from('grade_configs').select('*').eq('school_id', school.id),
      supabase.from('room_timetable_slots').select('*').eq('school_id', school.id),
    ])
    setRooms(r || [])
    setTimetableSlots(ts || [])
    setBlockedSlots(bs || [])
    setTeachers(t || [])
    setGradeConfigs(gc || [])
    setRoomSlots(rts || [])
    if (r?.length && !selectedRoomId) setSelectedRoomId(r[0].id)
  }

  async function handleGenerate() {
    if (!rooms.length) return alert('특별실을 먼저 등록하세요')
    if (!timetableSlots.length) return alert('전담 시간표를 먼저 생성하세요')
    setGenerating(true)
    const newSlots = buildRoomSchedule(rooms, timetableSlots, blockedSlots, schoolId)
    await supabase.from('room_timetable_slots').delete().eq('school_id', schoolId)
    if (newSlots.length > 0) await supabase.from('room_timetable_slots').insert(newSlots)
    await load()
    setGenerating(false)
  }

  // 빈 셀에 학급 배정
  async function handleAssign() {
    if (!assignModal) return
    const { day, slot } = assignModal
    // 이 학급이 이 시간에 다른 전담 수업 있는지 확인
    const conflict = timetableSlots.find(s => s.grade === assignGrade && s.class_num === assignClass && s.day === day && s.slot === slot && s.teacher_id)
    if (conflict) return alert('해당 학급은 이 시간에 이미 전담 수업이 있습니다.')
    // 이미 다른 특별실에 배정돼 있는지 확인
    const roomConflict = roomSlots.find(s => s.grade === assignGrade && s.class_num === assignClass && s.day === day && s.slot === slot)
    if (roomConflict) return alert('해당 학급은 이 시간에 이미 다른 특별실에 배정되어 있습니다.')

    await supabase.from('room_timetable_slots').insert({
      school_id: schoolId, room_id: selectedRoomId,
      day, slot, grade: assignGrade, class_num: assignClass, assignment_type: 'class'
    })
    setAssignModal(null)
    load()
  }

  async function handleRemoveSlot(day, slot) {
    await supabase.from('room_timetable_slots').delete()
      .eq('room_id', selectedRoomId).eq('day', day).eq('slot', slot)
    load()
  }

  function getCell(day, slot) {
    return roomSlots.find(s => s.room_id === selectedRoomId && s.day === day && s.slot === slot)
  }

  function isBlocked(day, slot) {
    return blockedSlots.some(b => b.room_id === selectedRoomId && b.day === day && b.slot === slot)
  }

  const selectedRoom = rooms.find(r => r.id === selectedRoomId)
  const numClasses = gradeConfigs.find(g => g.grade === assignGrade)?.num_classes || 6

  return (
    <div className="p-10 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold">특별실 시간표</h1>
        <div className="flex gap-2">
          <button onClick={() => exportRoomTimetable(roomSlots, rooms)}
            className="flex items-center gap-1.5 h-9 px-3.5 border border-gray-300 bg-white rounded-sm text-[13px]">
            <Download size={13} />엑셀 다운로드
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 h-9 px-3.5 bg-black text-white text-[13px] font-semibold rounded-sm disabled:opacity-50">
            <Zap size={13} />{generating ? '생성 중...' : '자동 생성'}
          </button>
        </div>
      </div>

      {/* 특별실 선택 + 범례 */}
      <div className="flex items-center justify-between mb-4">
        <select value={selectedRoomId || ''} onChange={e => setSelectedRoomId(e.target.value)}
          className="h-9 px-3 border border-gray-300 rounded-sm text-[13px] bg-white outline-none font-semibold">
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div className="flex gap-4 items-center text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-black rounded-sm inline-block" />전담 배정</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-gray-200 border border-gray-300 rounded-sm inline-block" />학급 배정</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-gray-400 rounded-sm inline-block" />방과후(차단)</span>
        </div>
      </div>

      {/* 시간표 그리드 */}
      <div className="border border-gray-200 rounded-sm overflow-hidden bg-white">
        <div className="flex bg-gray-50">
          <div className="w-[72px] flex-shrink-0 border-r border-gray-200 h-9 flex items-center justify-center text-[11px] font-semibold text-gray-500">교시</div>
          {DAYS.map(d => <div key={d} className="flex-1 h-9 flex items-center justify-center border-r border-gray-200 last:border-r-0 text-[11px] font-semibold text-gray-500">{d}</div>)}
        </div>
        {Array.from({ length: 6 }, (_, slot) => (
          <div key={slot} className="flex h-[62px] border-t border-gray-100">
            <div className="w-[72px] flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-400 bg-gray-50">{slot + 1}교시</div>
            {Array.from({ length: 5 }, (_, day) => {
              const cell = getCell(day, slot)
              const blocked = isBlocked(day, slot)
              return (
                <div key={day}
                  onClick={() => !blocked && !cell && setAssignModal({ day, slot })}
                  className={`flex-1 border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center gap-0.5 transition-colors
                    ${blocked ? 'bg-gray-300 cursor-not-allowed' : cell ? 'cursor-pointer' : 'hover:bg-gray-50 cursor-pointer'}`}
                >
                  {blocked ? (
                    <span className="text-[11px] text-gray-500">방과후</span>
                  ) : cell?.assignment_type === 'dedicated' ? (
                    <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-0.5">
                      <span className="text-[10px] text-gray-400">전담</span>
                      <span className="text-[12px] font-semibold text-white">{cell.grade}학년{cell.class_num}반</span>
                    </div>
                  ) : cell?.assignment_type === 'class' ? (
                    <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center gap-0.5 group">
                      <span className="text-[11px] text-gray-500">학급 배정</span>
                      <span className="text-[13px] font-semibold text-gray-700">{cell.grade}학년{cell.class_num}반</span>
                      <button onClick={e => { e.stopPropagation(); handleRemoveSlot(day, slot) }}
                        className="hidden group-hover:block text-[10px] text-red-400">제거</button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-200">클릭해서 배정</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* 학급 배정 모달 */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[360px] rounded-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold">학급 배정</h3>
              <button onClick={() => setAssignModal(null)}><X size={16} className="text-gray-400" /></button>
            </div>
            <p className="text-[12px] text-gray-500 mb-4">{DAYS[assignModal.day]}요일 {assignModal.slot + 1}교시에 사용할 학급을 선택하세요.</p>
            <div className="flex gap-2 mb-5">
              <select value={assignGrade} onChange={e => { setAssignGrade(Number(e.target.value)); setAssignClass(1) }}
                className="flex-1 h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none">
                {gradeConfigs.map(g => <option key={g.grade} value={g.grade}>{g.grade}학년</option>)}
              </select>
              <select value={assignClass} onChange={e => setAssignClass(Number(e.target.value))}
                className="flex-1 h-10 px-3 border border-gray-300 rounded-sm text-[13px] outline-none">
                {Array.from({ length: numClasses }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}반</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAssignModal(null)} className="h-9 px-4 border border-gray-300 rounded-sm text-[13px]">취소</button>
              <button onClick={handleAssign} className="h-9 px-4 bg-black text-white text-[13px] font-semibold rounded-sm">배정</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 특별실 시간표 동작 확인**

특별실 관리에서 음악실 추가 → 담당 교사 지정 → 특별실 시간표로 이동 → 자동 생성 → 빈 셀 클릭해 학급 배정 확인

---

## Task 13: Vercel 배포

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: GitHub 저장소 생성 및 push**

```bash
git init
git add .
git commit -m "feat: 시간표 자동 작성 앱 초기 버전"
```

GitHub에서 새 저장소 생성 후:
```bash
git remote add origin https://github.com/[username]/timetable-app.git
git push -u origin main
```

- [ ] **Step 2: vercel.json 생성 (SPA 라우팅)**

`vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 3: Vercel 배포**

1. https://vercel.com → GitHub로 로그인
2. "Import Project" → 저장소 선택
3. Environment Variables 추가:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy 클릭
5. 배포된 URL 접속 → 전체 동작 확인

---

## 자기 검토

**스펙 커버리지 확인:**
- [x] 로그인/회원가입 + 학교별 데이터 분리 (Task 2, 4)
- [x] 학년별 학급 수, 요일별 수업 시수 입력 (Task 5)
- [x] 점심시간 분리 배정 설정 (Task 5)
- [x] 학년별 전담 과목 + 주당 시수 (Task 6)
- [x] 전담 교사 등록, 과목 추가(+), 학급별 시수 조정 (Task 7)
- [x] 교사 명칭 자유 부여 (Task 7)
- [x] 학급·교사 겹치지 않는 자동 시간표 (Task 8)
- [x] 교사 점심 보장 제약 (Task 8 - scheduler.js)
- [x] 학급별/교사별 시간표 보기 (Task 9)
- [x] 미배정 빨간 표시 (Task 9)
- [x] 엑셀 다운로드 (Task 10)
- [x] 특별실 등록 + 담당 교사 드롭다운 (Task 11)
- [x] 특별실 차단 슬롯 (방과후) (Task 11)
- [x] 전담 시간표 기반 특별실 자동 배정 (Task 12)
- [x] 빈 특별실 슬롯 수동 학급 배정 (Task 12)
- [x] 특별실 시간표 엑셀 다운로드 (Task 10, 12)
- [x] Vercel 배포 (Task 13)
