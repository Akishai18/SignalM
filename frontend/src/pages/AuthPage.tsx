import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/contexts/AuthContext'

// ── Zod schemas ────────────────────────────────────────────────────────────────

const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const signUpSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type SignInForm = z.infer<typeof signInSchema>
type SignUpForm = z.infer<typeof signUpSchema>

// ── Shared field styles ────────────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#00e5a0] focus:outline-none focus:ring-1 focus:ring-[#00e5a0]"

// ── Google SVG (kept for easy re-enable later) ─────────────────────────────────

function _GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}

// ── Icon helpers ───────────────────────────────────────────────────────────────

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const { signIn, signUp, signInWithGoogle, sendPasswordReset } = useAuth()
  const navigate = useNavigate()

  const signInForm = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const forgotSchema = z.object({ email: z.string().email('Enter a valid email') })
  type ForgotForm = z.infer<typeof forgotSchema>
  const forgotForm = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  const signUpForm = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  const handleSignIn = async (data: SignInForm) => {
    setIsSubmitting(true)
    setServerError(null)
    const error = await signIn(data.email, data.password)
    if (error) { setServerError(error.message); setIsSubmitting(false) }
    else navigate('/', { replace: true })
  }

  const handleSignUp = async (data: SignUpForm) => {
    setIsSubmitting(true)
    setServerError(null)
    const error = await signUp(data.email, data.password)
    if (error) { setServerError(error.message); setIsSubmitting(false) }
    else { setSignUpSuccess(true); setIsSubmitting(false) }
  }

  const handleForgot = async (data: { email: string }) => {
    setIsSubmitting(true)
    setServerError(null)
    const error = await sendPasswordReset(data.email)
    if (error) { setServerError(error.message); setIsSubmitting(false) }
    else { setForgotSent(true); setIsSubmitting(false) }
  }

  const switchMode = (m: 'signin' | 'signup' | 'forgot') => {
    setMode(m)
    setServerError(null)
    setSignUpSuccess(false)
    setForgotSent(false)
    signInForm.reset()
    signUpForm.reset()
    forgotForm.reset()
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="relative hidden w-[60%] flex-col overflow-hidden bg-[#07090f] lg:flex">

        {/* Ambient glow blobs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* Large bottom-left bloom */}
          <div style={{
            position: 'absolute', bottom: '-10%', left: '-5%',
            width: '55%', height: '55%',
            background: 'radial-gradient(ellipse, rgba(0,229,160,0.07) 0%, transparent 70%)',
          }} />
          {/* Mid-right secondary bloom */}
          <div style={{
            position: 'absolute', top: '20%', right: '-5%',
            width: '40%', height: '50%',
            background: 'radial-gradient(ellipse, rgba(0,180,216,0.05) 0%, transparent 70%)',
          }} />
          {/* Diagonal cyan streak */}
          <div style={{
            position: 'absolute', top: '-10%', left: '56%',
            width: '2px', height: '130%',
            background: 'linear-gradient(to bottom, transparent 0%, #00e5a0 35%, #00b4d8 65%, transparent 100%)',
            transform: 'rotate(20deg)', opacity: 0.55, filter: 'blur(0.5px)',
          }} />
          {/* Diagonal gold streak */}
          <div style={{
            position: 'absolute', top: '-10%', left: '61%',
            width: '1px', height: '130%',
            background: 'linear-gradient(to bottom, transparent 0%, #f0a500 42%, #ffd166 68%, transparent 100%)',
            transform: 'rotate(20deg)', opacity: 0.4,
          }} />
          {/* Wide diffuse glow behind streaks */}
          <div style={{
            position: 'absolute', top: '-10%', left: '50%',
            width: '120px', height: '130%',
            background: 'linear-gradient(to bottom, transparent, rgba(0,229,160,0.03) 40%, transparent)',
            transform: 'rotate(20deg)',
          }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col px-12 pt-0 pb-4">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div style={{ filter: 'drop-shadow(0 0 10px rgba(0,229,160,0.55)) drop-shadow(0 0 24px rgba(0,229,160,0.25))' }}>
              <img src="/logo.png" alt="SignalM" className="h-12 w-12 object-contain" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white mt-3">SignalM</span>
          </div>

          {/* Hero copy */}
          <div className="mt-auto pb-4">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-gray-300">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00e5a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Market Intelligence Platform
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight text-white">
              Decode market
              <br />
              <span style={{
                color: '#00e5a0',
                textShadow: '0 0 30px rgba(0,229,160,0.4), 0 0 60px rgba(0,229,160,0.15)',
              }}>
                regimes.
              </span>
            </h1>

            <p className="mt-5 max-w-sm text-base leading-relaxed text-gray-400">
              Analyze volatility, correlations, and latent factors driving
              the S&P 500 — all in one diagnostic toolkit.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              {[
                { label: 'Volatility Regimes', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
                { label: 'Correlation Analysis', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
                { label: 'Factor Decomposition', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
                  <span className="text-[#00e5a0]">{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto flex gap-6 text-xs text-gray-600">
            <a href="#" className="hover:text-gray-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div className="relative flex w-full flex-col items-center justify-center bg-[#f0f0f0] px-8 lg:w-[40%]">

        {/* Subtle neon edge bleed from the left */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 hidden lg:block"
          aria-hidden="true"
          style={{
            width: '180px',
            background: 'linear-gradient(to right, rgba(0,229,160,0.04), transparent)',
          }}
        />

        <div className="relative z-10 w-full max-w-[360px]">

          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div style={{ filter: 'drop-shadow(0 0 8px rgba(0,229,160,0.5))' }}>
              <img src="/logo.png" alt="SignalM" className="h-9 w-9 object-contain" />
            </div>
            <span className="text-base font-semibold tracking-tight text-gray-900">SignalM</span>
          </div>

          {signUpSuccess ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#00e5a0]/15">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00e5a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
              <p className="mt-2 text-sm text-gray-500">
                We sent a confirmation link to your inbox. Click it to activate your account.
              </p>
              <button onClick={() => switchMode('signin')} className="mt-6 text-sm font-medium text-[#00b894] hover:underline">
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900">
                {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {mode === 'signin'
                  ? 'Enter your credentials to access the dashboard'
                  : mode === 'signup'
                  ? 'Sign up to start analyzing market regimes'
                  : "Enter your email and we'll send you a reset link"}
              </p>

              <div className="mt-8 space-y-5">

                {/* ── Forgot password ── */}
                {mode === 'forgot' ? (
                  forgotSent ? (
                    <div className="py-4 text-center">
                      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#00e5a0]/15">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00e5a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-800">Check your inbox</p>
                      <p className="mt-1 text-sm text-gray-500">We sent a password reset link to your email.</p>
                      <button onClick={() => switchMode('signin')} className="mt-5 text-sm font-medium text-[#00b894] hover:underline">
                        Back to sign in
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={forgotForm.handleSubmit(handleForgot)} noValidate>
                      <div className="mb-5">
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><EmailIcon /></span>
                          <input type="email" placeholder="name@company.com" {...forgotForm.register('email')} className={inputCls} />
                        </div>
                        {forgotForm.formState.errors.email && <p className="mt-1 text-xs text-red-500">{forgotForm.formState.errors.email.message}</p>}
                      </div>
                      {serverError && <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{serverError}</p>}
                      <SubmitButton loading={isSubmitting} label="Send reset link" />
                      <p className="pt-1 text-center text-sm text-gray-500">
                        <button type="button" onClick={() => switchMode('signin')} className="font-medium text-[#00b894] hover:underline">Back to sign in</button>
                      </p>
                    </form>
                  )

                ) : mode === 'signin' ? (
                  /* ── Sign in ── */
                  <form onSubmit={signInForm.handleSubmit(handleSignIn)} noValidate>
                    <div className="mb-4">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><EmailIcon /></span>
                        <input type="email" placeholder="name@company.com" {...signInForm.register('email')} className={inputCls} />
                      </div>
                      {signInForm.formState.errors.email && <p className="mt-1 text-xs text-red-500">{signInForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="mb-5">
                      <div className="flex items-center justify-between">
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
                        <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-medium text-[#00b894] hover:underline">Forgot password?</button>
                      </div>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><LockIcon /></span>
                        <input type="password" placeholder="••••••••" {...signInForm.register('password')} className={inputCls} />
                      </div>
                      {signInForm.formState.errors.password && <p className="mt-1 text-xs text-red-500">{signInForm.formState.errors.password.message}</p>}
                    </div>
                    {serverError && <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{serverError}</p>}
                    <SubmitButton loading={isSubmitting} label="Sign In" />
                  </form>

                ) : (
                  /* ── Sign up ── */
                  <form onSubmit={signUpForm.handleSubmit(handleSignUp)} noValidate>
                    <div className="mb-4">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><EmailIcon /></span>
                        <input type="email" placeholder="name@company.com" {...signUpForm.register('email')} className={inputCls} />
                      </div>
                      {signUpForm.formState.errors.email && <p className="mt-1 text-xs text-red-500">{signUpForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="mb-4">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><LockIcon /></span>
                        <input type="password" placeholder="••••••••" {...signUpForm.register('password')} className={inputCls} />
                      </div>
                      {signUpForm.formState.errors.password && <p className="mt-1 text-xs text-red-500">{signUpForm.formState.errors.password.message}</p>}
                    </div>
                    <div className="mb-5">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><LockIcon /></span>
                        <input type="password" placeholder="••••••••" {...signUpForm.register('confirmPassword')} className={inputCls} />
                      </div>
                      {signUpForm.formState.errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{signUpForm.formState.errors.confirmPassword.message}</p>}
                    </div>
                    {serverError && <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{serverError}</p>}
                    <SubmitButton loading={isSubmitting} label="Create Account" />
                  </form>
                )}

                {/* Mode switch */}
                {mode !== 'forgot' && (
                  <p className="text-center text-sm text-gray-500">
                    {mode === 'signin' ? (
                      <>Don't have an account?{' '}
                        <button onClick={() => switchMode('signup')} className="font-medium text-[#00b894] hover:underline">Sign up</button>
                      </>
                    ) : (
                      <>Already have an account?{' '}
                        <button onClick={() => switchMode('signin')} className="font-medium text-[#00b894] hover:underline">Sign in</button>
                      </>
                    )}
                  </p>
                )}

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared submit button ───────────────────────────────────────────────────────

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-gray-900 transition-opacity disabled:opacity-60"
      style={{ background: 'linear-gradient(to right, #00e5a0, #00ff88)' }}
    >
      {loading
        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
        : <>{label} <span className="text-base">→</span></>
      }
    </button>
  )
}
