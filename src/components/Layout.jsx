import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Settings, Calendar, DoorOpen, CalendarCheck, Download, Upload, ClipboardList, BookOpen, Menu, X, RotateCcw, FileText, UserPlus } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { exportFullWorkbook, importFullWorkbook } from '../lib/excelIO'

const navItems = [
  { path: '/setup', label: '학교 설정', icon: Settings },
  { path: '/subjects', label: '전담 과목 설정', icon: BookOpen },
  { path: '/assignment', label: '전담 배정', icon: ClipboardList },
  { path: '/external', label: '외부강사 관리', icon: UserPlus },
  { path: '/rooms', label: '특별실 관리', icon: DoorOpen },
  { path: '/timetable', label: '전담 시간표', icon: Calendar },
  { path: '/room-timetable', label: '특별실 시간표', icon: CalendarCheck },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { state, importData, resetAll } = useApp()
  const fileInputRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

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

  function handleNavigate(path) {
    navigate(path)
    setMenuOpen(false)
  }

  function renderNav() {
    return (
      <>
        <nav className="flex flex-col gap-0.5">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = pathname === path
            return (
              <button
                key={path}
                onClick={() => handleNavigate(path)}
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
            title="모든 설정·배정·시간표를 하나의 엑셀 파일로 저장합니다. 백업이나 다른 컴퓨터로 옮길 때 사용하세요."
            onClick={handleExport}
            className="flex items-center gap-2 h-9 px-3 border border-gray-300 rounded-sm text-[12px] text-gray-500 hover:bg-gray-50 w-full"
          >
            <Download size={12} />저장 (엑셀 내보내기)
          </button>
          <button
            title="저장(엑셀 내보내기)으로 만든 파일을 불러와 현재 데이터를 덮어씁니다."
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 h-9 px-3 border border-gray-300 rounded-sm text-[12px] text-gray-500 hover:bg-gray-50 w-full"
          >
            <Upload size={12} />불러오기 (엑셀 가져오기)
          </button>
          <p className="text-[10px] leading-relaxed text-gray-400 px-1">
            🔒 모든 데이터는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.
            기기·브라우저 변경이나 만일의 데이터 손실에 대비해
            <b className="text-gray-500"> 저장(엑셀 내보내기)</b>로 정기적으로 백업하세요.
          </p>
          <a
            href={
              __MANUAL_PDF_DATAURI__
                ? __MANUAL_PDF_DATAURI__ // 오프라인 빌드: HTML에 내장된 PDF (file://에서도 다운로드 가능)
                : (typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'user-manual.pdf' : '/user-manual.pdf')
            }
            download="시간표_자동_작성_사용자_매뉴얼.pdf"
            className="flex items-center gap-2 h-9 px-3 border border-gray-300 rounded-sm text-[12px] text-gray-500 hover:bg-gray-50 w-full"
          >
            <FileText size={12} />사용자 매뉴얼 (PDF)
          </a>
          <div className="h-px bg-gray-100 my-1" />
          <button
            onClick={() => {
              if (confirm('모든 데이터를 초기화합니다. 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) {
                resetAll()
                handleNavigate('/setup')
              }
            }}
            className="flex items-center gap-2 h-9 px-3 border border-red-200 rounded-sm text-[12px] text-red-400 hover:bg-red-50 w-full"
          >
            <RotateCcw size={12} />전체 초기화
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        onChange={handleImport}
        className="hidden"
      />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[220px] bg-white border-r border-gray-200 flex-col py-7 flex-shrink-0">
        <div className="flex items-center gap-2 px-6 pb-4">
          <span className="text-[18px] leading-none">🗓️</span>
          <span className="text-[13px] font-bold text-gray-900">초등학교 전담 시간표 자동 생성 프로그램</span>
        </div>
        <div className="h-px bg-gray-200 mb-3" />
        {renderNav()}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
        <button
          onClick={() => setMenuOpen(true)}
          className="p-1 text-gray-600 hover:text-gray-900"
          aria-label="메뉴 열기"
        >
          <Menu size={20} />
        </button>
        <span className="text-[16px] leading-none">🗓️</span>
        <span className="text-[13px] font-bold text-gray-900">초등학교 전담 시간표 자동 생성 프로그램</span>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[220px] bg-white flex flex-col py-7 shadow-xl">
            <div className="flex items-center justify-between px-6 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[16px] leading-none">🗓️</span>
                <span className="text-[13px] font-bold text-gray-900">초등학교 전담 시간표 자동 생성 프로그램</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="text-gray-400 hover:text-gray-700"
                aria-label="메뉴 닫기"
              >
                <X size={18} />
              </button>
            </div>
            <div className="h-px bg-gray-200 mb-3" />
            {renderNav()}
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-12 md:pt-0">
        {children}
      </main>
    </div>
  )
}
