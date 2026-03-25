import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ready, setReady] = useState(false)
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Supabase puts the recovery token in the URL hash — exchanging it sets the session
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    // If we already have a session (e.g. PKCE flow resolved), show the form
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
  }, [])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    setServerError(null)
    const error = await updatePassword(data.password)
    if (error) {
      setServerError(error.message)
      setIsSubmitting(false)
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f0f0f0] px-4">
      <div className="w-full max-w-[360px]">

        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <img src="/logo.png" alt="SignalM" className="h-8 w-8 object-contain" style={{ filter: 'drop-shadow(0 0 6px rgba(0,229,160,0.5))' }} />
          <span className="text-base font-semibold tracking-tight text-gray-900">SignalM</span>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-gray-200 bg-white px-8 py-8 shadow-sm">

          {!ready ? (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00e5a0] border-t-transparent mb-3" />
              <p className="text-sm text-gray-500">Verifying reset link…</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Set new password</h2>
              <p className="text-sm text-gray-500 mb-7">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* New password */}
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">New password</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      {...register('password')}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#00e5a0] focus:outline-none focus:ring-1 focus:ring-[#00e5a0]"
                    />
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                  )}
                </div>

                {/* Confirm password */}
                <div className="mb-6">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      {...register('confirmPassword')}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#00e5a0] focus:outline-none focus:ring-1 focus:ring-[#00e5a0]"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
                  )}
                </div>

                {serverError && (
                  <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 border border-red-100">{serverError}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-gray-900 transition-opacity disabled:opacity-60"
                  style={{ background: 'linear-gradient(to right, #00e5a0, #00ff88)' }}
                >
                  {isSubmitting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
                  ) : (
                    <>Update password <span className="text-base">→</span></>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
