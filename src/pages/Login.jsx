import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login')
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
      if (error) setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.user) {
        await supabase.from('schools').insert({
          user_id: data.user.id,
          name: schoolName.trim() || '우리 학교',
        })
        setMessage('가입 완료! 로그인해주세요.')
        setMode('login')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-[420px] border border-gray-200 rounded-sm p-12">
        <div className="flex items-center gap-2 mb-6 pb-6 border-b border-gray-100">
          <div className="w-5 h-5 bg-black flex-shrink-0" />
          <span className="text-[15px] font-bold">시간표 자동 작성</span>
        </div>

        <h1 className="text-[26px] font-bold mb-1">
          {mode === 'login' ? '로그인' : '회원가입'}
        </h1>
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
            className="h-12 bg-black text-white text-[14px] font-semibold rounded-sm mt-2 disabled:opacity-50 hover:bg-gray-800 transition-colors"
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
            className="font-semibold text-black hover:underline"
          >
            {mode === 'login' ? '회원가입' : '로그인'}
          </button>
        </div>
      </div>
    </div>
  )
}
