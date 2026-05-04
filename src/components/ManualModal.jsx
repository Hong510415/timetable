import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

export default function ManualModal({ title, sections }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-8 px-3 border border-gray-300 rounded-sm text-[12px] text-gray-500 hover:bg-gray-50"
      >
        <HelpCircle size={13} />
        매뉴얼
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[520px] max-h-[80vh] rounded-sm border border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[15px] font-bold">{title} 매뉴얼</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4 flex flex-col gap-5">
              {sections.map((section, i) => (
                <div key={i}>
                  <p className="text-[13px] font-semibold text-gray-800 mb-1.5">{section.title}</p>
                  <ul className="flex flex-col gap-1">
                    {section.items.map((item, j) => (
                      <li key={j} className="text-[12px] text-gray-600 flex gap-2">
                        <span className="text-gray-300 flex-shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
