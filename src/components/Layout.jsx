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

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
