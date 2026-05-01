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
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        로딩 중...
      </div>
    )
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
        <Route path="*" element={<Navigate to={session ? '/setup' : '/login'} />} />
      </Routes>
    </BrowserRouter>
  )
}
