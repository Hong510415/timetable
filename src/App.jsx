import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import SchoolSetup from './pages/SchoolSetup'
import SubjectSetup from './pages/SubjectSetup'
import Timetable from './pages/Timetable'
import RoomManagement from './pages/RoomManagement'
import Assignment from './pages/Assignment'
import RoomTimetable from './pages/RoomTimetable'
import SchedulerDebug from './pages/SchedulerDebug'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AppProvider>
  )
}
