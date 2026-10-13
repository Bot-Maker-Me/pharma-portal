'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessagesSquare } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

// The five register rows the ledger sheet shows — the closing counts for the
// last week of 2026, in the same order the pharmacy signed them off.
const ledgerRows = [
  { date: '07 Oct 26', drug: 'Oxycodone 5mg', inQty: '120', outQty: '96', balance: '24' },
  { date: '07 Oct 26', drug: 'Hydromorphone 2mg', inQty: '60', outQty: '58', balance: '2' },
  { date: '06 Oct 26', drug: 'Morphine 10mg', inQty: '90', outQty: '90', balance: '0' },
  { date: '05 Oct 26', drug: 'Lorazepam 1mg', inQty: '150', outQty: '144', balance: '6' },
  { date: '02 Oct 26', drug: 'Methylphenidate 10mg', inQty: '40', outQty: '40', balance: '0' },
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
    // Section reveals are pure CSS (see globals.css) so nothing can be left
    // invisible if this script never runs.
    const onScroll = () => setHasScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
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
    <div className="site-theme">
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
            <div className="auth-brand">
              <span className="wordmark-mark">+</span>
              <span>formulary</span>
            </div>
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
            <p className="hero-label">§ 01 — The register</p>
            <h1 className="hero-title">
              <span className="hero-line">Every controlled</span>
              <span className="hero-line">
                substance, <em>counted</em>
              </span>
              <span className="hero-line">and signed.</span>
            </h1>
            <p className="hero-description">
              A focused workspace for keeping generic substitutions accurate, accessible, and accountable — from the
              counter to the back office.
            </p>
            <div className="hero-actions">
              <button className="solid-button" onClick={() => openAuth('sign-up')}>
                Book a demo
              </button>
              <Link className="link-button" href="/workspace">
                View all apps <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="ledger-stack">
            <div className="ledger-sheets">
              <div className="ledger-sheet ledger-sheet-back" aria-hidden="true" />
              <div className="ledger-sheet ledger-sheet-front">
                <table className="ledger-table">
                  <colgroup>
                    <col className="ledger-col-date" />
                    <col />
                    <col className="ledger-col-num" />
                    <col className="ledger-col-num" />
                    <col className="ledger-col-bal" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Drug</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Bal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((row) => (
                      <tr key={`${row.date}-${row.drug}`}>
                        <td className="ledger-date">{row.date}</td>
                        <td>{row.drug}</td>
                        <td>{row.inQty}</td>
                        <td>{row.outQty}</td>
                        <td>{row.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <span className="ledger-stamp" aria-hidden="true">
                  VERIFIED
                </span>
              </div>
            </div>

            <p className="ledger-chip ledger-chip-count">Counted today 128</p>
            <p className="ledger-chip ledger-chip-sign">JD · 09:42 / SM · 09:44</p>
            <p className="ledger-chip ledger-chip-alert">Discrepancy detected: Oxycodone 5mg, count off by 2</p>
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
    </div>
  )
}
