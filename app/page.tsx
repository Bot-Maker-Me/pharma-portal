'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessagesSquare } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

const previewRows = [
  ['Alendronate', 'Alendronate', '67'],
  ['Amlodipine', 'Amlodipine', '72'],
  ['Apixaban', 'Apixaban', '72'],
  ['Atorvastatin', 'Atorvastatin', '72'],
  ['Metformin', 'Metformin', '20'],
]

const features = [
  ['01', 'One source of truth', 'Keep preferred and alternate generics clear for every member of the team.'],
  ['02', 'Built for the counter', 'Fast search, dense rows, and keyboard-friendly editing for busy shifts.'],
  ['03', 'Always accountable', 'Every change is time-stamped and attributed to the person who made it.'],
]

export default function Page() {
  const router = useRouter()
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up' | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setHasScrolled(window.scrollY > 24)
    const featureArticles = Array.from(document.querySelectorAll('.feature-strip article'))
    const observer = new IntersectionObserver(
      (items) => {
        items.forEach((item) => {
          if (item.isIntersecting) {
            item.target.classList.add('is-visible')
            observer.unobserve(item.target)
          }
        })
      },
      { threshold: 0.18 },
    )
    featureArticles.forEach((article) => observer.observe(article))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])

  function openAuth(mode: 'sign-in' | 'sign-up') {
    setAuthMode(mode)
    setAuthError('')
  }

  async function handleAuth(event: React.FormEvent) {
    event.preventDefault()
    setAuthError('')
    setAuthBusy(true)

    const supabase = createSupabaseClient()
    if (!supabase) {
      setAuthError('Supabase is not connected yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      setAuthBusy(false)
      return
    }

    const result =
      authMode === 'sign-up'
        ? await supabase.auth.signUp({
            email: authEmail,
            password: authPassword,
            options: {
              emailRedirectTo:
                process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
            },
          })
        : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })

    setAuthBusy(false)

    if (result.error) {
      setAuthError(
        result.error.message.toLowerCase().includes('invalid') ? 'Invalid email or password.' : result.error.message,
      )
      return
    }

    if (authMode === 'sign-up' && !result.data.session) {
      setAuthError('Account created. Check your email to confirm it, then sign in.')
      return
    }

    router.push('/workspace')
    router.refresh()
  }

  return (
    <>
      {authMode && (
        <div
          className="auth-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={authMode === 'sign-up' ? 'Create account' : 'Sign in'}
        >
          <form className="auth-card" onSubmit={handleAuth}>
            <button type="button" className="close-panel" onClick={() => setAuthMode(null)} aria-label="Close">
              ×
            </button>
            <p className="eyebrow">FORMULARY ACCESS</p>
            <h2>{authMode === 'sign-up' ? 'Create your account' : 'Welcome back'}</h2>
            <p className="panel-subtitle">Use your pharmacy account to manage medicines and formulary rules.</p>
            <label>
              Email
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
              />
            </label>
            {authError && (
              <p className="auth-error" role="alert">
                {authError}
              </p>
            )}
            <button className="dark-button" disabled={authBusy}>
              {authBusy ? 'Working…' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setAuthMode(authMode === 'sign-up' ? 'sign-in' : 'sign-up')
                setAuthError('')
              }}
            >
              {authMode === 'sign-up' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </form>
        </div>
      )}

      <main className="site-shell">
        <nav className={`topbar ${hasScrolled ? 'is-scrolled' : ''}`} aria-label="Main navigation">
          <a className="wordmark" href="#top" aria-label="Formulary home">
            <span className="wordmark-mark">+</span> formulary
          </a>
          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#security">Audit trail</a>
            <Link className="nav-chat" href="/chat">
              <MessagesSquare className="nav-chat-icon" aria-hidden="true" />
              Chat with Home
            </Link>
            <button className="nav-signin" onClick={() => openAuth('sign-in')}>
              Sign in
            </button>
            <button className="nav-cta" onClick={() => openAuth('sign-up')}>
              Get started <span aria-hidden="true">↗</span>
            </button>
          </div>
        </nav>

        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" /> FORMULARY MANAGEMENT FOR INDEPENDENT PHARMACIES
            </p>
            <h1>
              Know what your pharmacy <em>prefers.</em>
            </h1>
            <p className="hero-description">
              A focused workspace for keeping generic substitutions accurate, accessible, and accountable — from the
              counter to the back office.
            </p>
            <div className="hero-actions">
              <button className="dark-button large" onClick={() => openAuth('sign-up')}>
                Start your free trial <span aria-hidden="true">↗</span>
              </button>
              <span>No credit card required</span>
            </div>
            <div className="trust-line">
              <span>Designed for the way pharmacies work</span>
              <span>·</span>
              <span>Simple to start</span>
              <span>·</span>
              <span>Ready when you are</span>
            </div>
          </div>

          <div className="preview-frame">
            <div className="preview-top">
              <span className="window-dots">
                <i />
                <i />
                <i />
              </span>
              <span>Northside Pharmacy / Formulary</span>
              <span className="preview-status">
                <b /> Live workspace
              </span>
            </div>
            <div className="preview-inner">
              <div className="preview-heading">
                <div>
                  <span className="mini-label">FORMULARY</span>
                  <strong>Preferred generics</strong>
                </div>
                <span className="preview-search">⌕ Search medicines</span>
              </div>
              <div className="mini-table">
                <div className="mini-row mini-head">
                  <span>Chemical name</span>
                  <span>Preferred generic</span>
                  <span>DIN</span>
                </div>
                {previewRows.map((row) => (
                  <div className="mini-row" key={row[0]}>
                    <span>{row[0]}</span>
                    <span>{row[1]}</span>
                    <span className="din">{row[2]}</span>
                  </div>
                ))}
              </div>
              <div className="preview-footer">
                <span>
                  <b /> 248 medicines
                </span>
                <span>Synced just now</span>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-strip" id="how-it-works">
          {features.map(([number, title, copy]) => (
            <article key={number}>
              <span className="feature-number">{number}</span>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </section>

        <section className="statement" id="security">
          <p className="eyebrow">
            <span className="eyebrow-line" /> MADE FOR PHARMACY TEAMS
          </p>
          <h2>Your formulary should be as dependable as the care you provide.</h2>
          <button className="text-link" onClick={() => openAuth('sign-in')}>
            See the workspace <span>↗</span>
          </button>
        </section>

        <footer>
          <a className="wordmark" href="#top">
            <span className="wordmark-mark">+</span> formulary
          </a>
          <span>Clear choices. Better care.</span>
          <span>© 2026 Formulary</span>
        </footer>
      </main>
    </>
  )
}
