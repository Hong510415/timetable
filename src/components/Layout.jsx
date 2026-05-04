import { useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Settings, Calendar, DoorOpen, CalendarCheck, Download, Upload, ClipboardList, BookOpen, RotateCcw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { exportFullWorkbook, importFullWorkbook } from '../lib/excelIO'

const navItems = [
  { path: '/setup', label: '학교 설정', icon: Settings },
  { path: '/subjects', label: '전담 설정', icon: BookOpen },
  { path: '/assignment', label: '전담 배정', icon: ClipboardList },
  { path: '/rooms', label: '특별실 관리', icon: DoorOpen },
  { path: '/timetable', label: '전담 시간표', icon: Calendar },
  { path: '/room-timetable', label: '특별실 시간표', icon: CalendarCheck },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { state, importData, resetAll } = useApp()
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
          <span className="text-base grayscale select-none">🗓️</span>
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
          <div className="h-px bg-gray-100 my-1" />
          <button
            onClick={() => {
              if (confirm('모든 데이터를 초기화합니다. 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) {
                resetAll()
                navigate('/setup')
              }
            }}
            className="flex items-center gap-2 h-9 px-3 border border-red-200 rounded-sm text-[12px] text-red-400 hover:bg-red-50 w-full"
          >
            <RotateCcw size={12} />전체 초기화
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
