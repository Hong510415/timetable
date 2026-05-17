import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import SchoolSetup from './pages/SchoolSetup'
import SubjectSetup from './pages/SubjectSetup'
import Timetable from './pages/Timetable'
import RoomManagement from './pages/RoomManagement'
import Assignment from './pages/Assignment'
import RoomTimetable from './pages/RoomTimetable'
import SchedulerDebug from './pages/SchedulerDebug'

// file:// 프로토콜(오프라인 더블클릭 실행)에서는 HashRouter 사용 — BrowserRouter는
// /setup 같은 경로를 file:///C:/setup 으로 해석하려 해서 실패함.
const Router =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? HashRouter
    : BrowserRouter

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/setup" element={<Layout><SchoolSetup /></Layout>} />
          <Route path="/subjects" element={<Layout><SubjectSetup /></Layout>} />
          <Route path="/assignment" element={<Layout><Assignment /></Layout>} />
          <Route path="/timetable" element={<Layout><Timetable /></Layout>} />
          <Route path="/rooms" element={<Layout><RoomManagement /></Layout>} />
          <Route path="/room-timetable" element={<Layout><RoomTimetable /></Layout>} />
          <Route path="/scheduler-debug" element={<SchedulerDebug />} />
          <Route path="*" element={<Navigate to="/setup" />} />
        </Routes>
      </Router>
    </AppProvider>
  )
}
