'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

// The five register rows the ledger sheet shows — the closing counts for the
// last week of 2026, in the same order the pharmacy signed them off.
const ledgerRows = [
  { date: '07 Oct 26', drug: 'Oxycodone 5mg', inQty: '50', outQty: '32', balance: '18' },
  { date: '07 Oct 26', drug: 'Fentanyl 25µg', inQty: '100', outQty: '85', balance: '15' },
  { date: '06 Oct 26', drug: 'Morphine 10mg', inQty: '75', outQty: '60', balance: '15' },
  { date: '06 Oct 26', drug: 'Hydromorphone 2mg', inQty: '40', outQty: '38', balance: '2' },
  { date: '05 Oct 26', drug: 'Oxycodone 5mg', inQty: '50', outQty: '45', balance: '5' },
]

// The live register strip. Rendered twice so the marquee can loop seamlessly.
const tickerEntries = [
  '07 Oct · Oxycodone 5mg · 50 in',
  '07 Oct · Fentanyl 25µg · 85 out',
  '06 Oct · Morphine 10mg · 60 out',
  '06 Oct · Hydromorphone 2mg · 40 in',
  '05 Oct · Oxycodone 5mg · 45 out',
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
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    const root = document.documentElement

    // Reduced motion: show everything up front and never hide a thing.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add('is-revealed'))
      return () => window.removeEventListener('scroll', onScroll)
    }

    // `reveal-ready` is set from script, never from the markup, so a blocked
    // script can't leave the page blank.
    root.classList.add('reveal-ready')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Toggled both ways, so copy fades in on the way in and back out on
          // the way past.
          entry.target.classList.toggle('is-revealed', entry.isIntersecting)
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
    )
    nodes.forEach((node) => observer.observe(node))

    return () => {
      window.removeEventListener('scroll', onScroll)
      observer.disconnect()
      root.classList.remove('reveal-ready')
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
              <span>Pharma Portal</span>
            </div>
            <p className="eyebrow">PORTAL ACCESS</p>
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
          <a className="wordmark" href="#top" aria-label="Pharma Portal home">
            <span className="wordmark-mark">+</span> Pharma Portal
          </a>
          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#security">Audit trail</a>
            <button className="nav-signin" onClick={() => openAuth('sign-in')}>
              Sign in
            </button>
            <button className="nav-cta" onClick={() => openAuth('sign-up')}>
              Book a demo
            </button>
          </div>
        </nav>

        <div className="ticker">
          <p className="ticker-label">
            <span className="ticker-dot" aria-hidden="true" />
            Live register
          </p>
          <div className="ticker-track" aria-hidden="true">
            <div className="ticker-run">
              {[...tickerEntries, ...tickerEntries].map((entry, index) => (
                <span className="ticker-item" key={`${entry}-${index}`}>
                  {entry}
                </span>
              ))}
            </div>
          </div>
          <p className="ticker-scroll">
            Scroll <span aria-hidden="true">↓</span>
          </p>
        </div>

        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="hero-label" data-reveal>
              § 01 — The register
            </p>
            <h1 className="hero-title" data-reveal>
              <span className="hero-line">Every controlled</span>
              <span className="hero-line">
                substance, <em>COUNTED</em>
              </span>
              <span className="hero-line">and signed.</span>
            </h1>
            <p className="hero-description" data-reveal>
              Built with audit trails and electronic signatures for pharmaceutical and care operations teams.
            </p>
            <div className="hero-actions" data-reveal>
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

            <div className="ledger-chip ledger-chip-count">
              <span className="ledger-chip-label">Counted today</span>
              <span className="ledger-chip-value">128</span>
            </div>
            <p className="ledger-chip ledger-chip-sign">
              <span className="ledger-chip-line">
                <b>JD</b> · 09:42
              </span>
              <span className="ledger-chip-line">
                <b>SM</b> · 09:44
              </span>
            </p>
            <p className="ledger-chip ledger-chip-alert">Discrepancy detected: Oxycodone 5mg, count off by 2</p>
          </div>
        </section>

        <section className="feature-strip" id="how-it-works">
          {features.map(([number, title, copy]) => (
            <article key={number} data-reveal>
              <span className="feature-number">{number}</span>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </section>

        <section className="statement" id="security">
          <p className="eyebrow" data-reveal>
            <span className="eyebrow-line" /> MADE FOR PHARMACY TEAMS
          </p>
          <h2 data-reveal>Your formulary should be as dependable as the care you provide.</h2>
          <button className="text-link" data-reveal onClick={() => openAuth('sign-in')}>
            See the workspace <span>↗</span>
          </button>
        </section>

        <footer>
          <a className="wordmark" href="#top" data-reveal aria-label="Pharma Portal home">
            <span className="wordmark-mark">+</span> Pharma Portal
          </a>
          <span className="footer-credit" data-reveal>
            by Pharma Strategies
          </span>
          <span data-reveal>Clear choices. Better care.</span>
          <span data-reveal>© 2026 Pharma Portal</span>
        </footer>
      </main>
    </div>
  )
}
