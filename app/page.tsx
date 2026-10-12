'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { read, utils } from 'xlsx'
import { MessagesSquare } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

type Entry = [string, string, string, string, string, string]

const entries: Entry[] = [
  ['Alendronate', 'Alendronate', '67', '', '', 'MINT · PA 67'],
  ['Amlodipine', 'Amlodipine', '72', '', '', 'MINT · PA 72'],
  ['Apixaban', 'Apixaban', '72', '', '', 'MINT · PA 72 · BOGO'],
  ['Atorvastatin', 'Atorvastatin', '72', '', '', 'MINT · PA 72'],
  ['Azithromycin', 'Azithromycin', '55', '', '', 'MINT · PA 55'],
  ['Candesartan', 'Candesartan', '60', '', '', 'MINT · PA 60'],
  ['Celecoxib', 'Celecoxib', '50', '', '', 'MINT · PA 50 · BOGO'],
  ['Cetirizine', 'Cetirizine', '80', '', '', 'MINT · PA 80'],
  ['Ciprofloxacin', 'Ciprofloxacin', '60', '', '', 'MINT · PA 60'],
  ['Dapagliflozin', 'Dapagliflozin', '70', '', '', 'MINT · PA 70'],
  ['Duloxetine', 'Duloxetine', '77', '', '', 'MINT · PA 77'],
  ['Escitalopram', 'Escitalopram', '70', '', '', 'MINT · PA 70'],
  ['Fluoxetine', 'Fluoxetine', '75', '', '', 'MINT · PA 75 · BOGO'],
  ['Gabapentin', 'Gabapentin', '45', '', '', 'MINT · PA 45 · BOGO'],
  ['Letrozole', 'Letrozole', '70', '', '', 'MINT · PA 70'],
  ['Lurasidone', 'Lurasidone', '65', '', '', 'MINT · PA 65 · BOGO'],
  ['Metformin', 'Metformin', '20', '', '', 'MINT · PA 20'],
  ['Olanzapine', 'Olanzapine', '70', '', '', 'MINT · PA 70 · BOGO'],
  ['Pantoprazole', 'Pantoprazole', '65', '', '', 'MINT · PA 65'],
  ['Perindopril', 'Perindopril', '65', '', '', 'MINT · PA 65 · BOGO'],
  ['Pravastatin', 'Pravastatin', '60', '', '', 'MINT · PA 60 · NEW'],
  ['Pregabalin', 'Pregabalin', '60', '', '', 'MINT · PA 60'],
  ['Rosuvastatin', 'Rosuvastatin', '50', '', '', 'MINT · PA 50'],
  ['Sertraline', 'Sertraline', '70', '', '', 'MINT · PA 70'],
  ['Sildenafil 100mg', 'Sildenafil 100mg', '70', '', '', 'MINT · PA 70 · BOGO'],
  ['Tadalafil 5mg, 10mg, 20mg', 'Tadalafil', '70', '', '', 'MINT · PA 70 · BOGO'],
  ['Telmisartan', 'Telmisartan', '40', '', '', 'MINT · PA 40'],
  ['Topiramate', 'Topiramate', '70', '', '', 'MINT · PA 70'],
  ['Ursodiol', 'Ursodiol', '40', '', '', 'MINT · PA 40 · BOGO'],
  ['Zolmitriptan', 'Zolmitriptan', '70', '', '', 'MINT · PA 70'],
  ['Zopiclone', 'Zopiclone', '70', '', '', 'MINT · PA 70'],
]

const sources = [
  ['MINT-142f41.xlsx', 'MINT formulary · September 2026', '30 medicines · PA and BOGO rules'],
  ['PHS-f4741e.xlsx', 'PHS basic formulary', 'Complete list and changes-only sheets'],
]

const features = [
  ['01', 'One source of truth', 'Keep preferred and alternate generics clear for every member of the team.'],
  ['02', 'Built for the counter', 'Fast search, dense rows, and keyboard-friendly editing for busy shifts.'],
  ['03', 'Always accountable', 'Every change is time-stamped and attributed to the person who made it.'],
]

export default function Page() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Entry | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up' | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [importedEntries, setImportedEntries] = useState<Entry[]>([])
  const [importedFile, setImportedFile] = useState('')
  const [activeView, setActiveView] = useState<'formulary' | 'opening' | 'closing' | 'staff' | 'emergency' | 'standards' | 'support' | 'forms' | 'admin'>('formulary')
  const [supportOpen, setSupportOpen] = useState(false)
  const [procedureSubmitted, setProcedureSubmitted] = useState(false)
  const [selectedResource, setSelectedResource] = useState('')
  const [selectedSupportResource, setSelectedSupportResource] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setHasScrolled(window.scrollY > 24)
    const featureArticles = Array.from(document.querySelectorAll('.feature-strip article'))
    const observer = new IntersectionObserver((items) => {
      items.forEach((item) => {
        if (item.isIntersecting) {
          item.target.classList.add('is-visible')
          observer.unobserve(item.target)
        }
      })
    }, { threshold: 0.18 })
    featureArticles.forEach((article) => observer.observe(article))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])

  const allEntries = useMemo(() => [...entries, ...importedEntries], [importedEntries])
  const filtered = useMemo(
    () => allEntries.filter((entry) => entry.join(' ').toLowerCase().includes(query.toLowerCase())),
    [allEntries, query],
  )

  function startFreeTrial() {
    setAuthError('')
    setSignedIn(true)
  }

  async function handleAuth(event: React.FormEvent) {
    event.preventDefault()
    setAuthError('')
    setAuthBusy(true)
    const supabase = createSupabaseClient()
    if (!supabase) {
      setAuthError('Supabase is not connected yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY when you are ready.')
      setAuthBusy(false)
      return
    }
    const result = authMode === 'sign-up'
      ? await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback` } })
      : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
    setAuthBusy(false)
    if (result.error) {
      setAuthError(result.error.message.toLowerCase().includes('invalid') ? 'Invalid email or password.' : result.error.message)
      return
    }
    if (authMode === 'sign-up' && !result.data.session) {
      setAuthError('Account created. Check your email to confirm your account, then sign in.')
      return
    }
    setSignedIn(true)
    setAuthMode(null)
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const workbook = read(await file.arrayBuffer(), { cellDates: true })
    const imported: Entry[] = []
    workbook.SheetNames.forEach((sheetName) => {
      const rows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
      rows.forEach((row) => {
        const values = Object.values(row).map((value) => String(value).trim()).filter(Boolean)
        if (!values.length) return
        const name = values[0]
        imported.push([name, name, values[1] ?? '', values[2] ?? '', values[3] ?? '', `${file.name} · ${sheetName}`])
      })
    })
    setImportedEntries(imported)
    setImportedFile(file.name)
    event.target.value = ''
  }

  return (
    <>
      {authMode && <div className="auth-backdrop" role="dialog" aria-modal="true" aria-label={authMode === 'sign-up' ? 'Create account' : 'Sign in'}><form className="auth-card" onSubmit={handleAuth}><button type="button" className="close-panel" onClick={() => setAuthMode(null)} aria-label="Close">×</button><p className="eyebrow">FORMULARY ACCESS</p><h2>{authMode === 'sign-up' ? 'Create your account' : 'Welcome back'}</h2><p className="panel-subtitle">Use your pharmacy account to manage medicines and formulary rules.</p><label>Email<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} required minLength={8} autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'} /></label>{authError && <p className="auth-error" role="alert">{authError}</p>}<button className="dark-button" disabled={authBusy}>{authBusy ? 'Working…' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}</button><button type="button" className="text-link" onClick={() => { setAuthMode(authMode === 'sign-up' ? 'sign-in' : 'sign-up'); setAuthError('') }}>{authMode === 'sign-up' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}</button></form></div>}
      <main className="site-shell">
      <nav className={`topbar ${hasScrolled ? 'is-scrolled' : ''}`} aria-label="Main navigation">
        <a className="wordmark" href="#top" aria-label="Formulary home"><span className="wordmark-mark">+</span> formulary</a>
        <div className="nav-links">
          {signedIn ? (
            <>
              <Link className="nav-chat" href="/chat">
                <MessagesSquare className="nav-chat-icon" aria-hidden="true" />
                Chat with Home
              </Link>
              <button className="nav-signin" onClick={() => setSignedIn(false)}>Sign out</button>
            </>
          ) : (
            <>
              <a href="#how-it-works">How it works</a>
              <a href="#security">Audit trail</a>
              <button className="nav-signin" onClick={() => { setAuthMode('sign-in'); setAuthError('') }}>Sign in</button>
              <button className="nav-cta" onClick={() => { setAuthMode('sign-in'); setAuthError('') }}>Get started <span aria-hidden="true">↗</span></button>
            </>
          )}
        </div>
      </nav>

      {signedIn ? (
        <section className="app-preview app-preview-full" aria-label="Formulary workspace">
          <aside className="app-sidebar">
            <div className="sidebar-brand"><span className="wordmark-mark">+</span> formulary</div>
            <div className="tenant-label">CURRENT PHARMACY</div>
            <div className="tenant-name">Northside Pharmacy <span>⌄</span></div>
            <div className="sidebar-nav">
              <Link className="sidebar-item sidebar-link" href="/chat"><MessagesSquare className="sidebar-icon" aria-hidden="true" /> <span>Chat with Home</span></Link>
              <button className={`sidebar-item ${activeView === 'formulary' ? 'active' : ''}`} onClick={() => setActiveView('formulary')}>▦ <span>Formulary</span></button>
              <button className={`sidebar-item ${activeView === 'opening' ? 'active' : ''}`} onClick={() => setActiveView('opening')}>□ <span>Opening Procedure</span></button>
              <button className={`sidebar-item ${activeView === 'closing' ? 'active' : ''}`} onClick={() => setActiveView('closing')}>□ <span>Closing Procedure</span></button>
              <button className={`sidebar-item ${activeView === 'staff' ? 'active' : ''}`} onClick={() => setActiveView('staff')}>□ <span>Staff Schedule</span></button>
              <button className={`sidebar-item ${activeView === 'emergency' ? 'active' : ''}`} onClick={() => setActiveView('emergency')}>□ <span>Emergency Contact List</span></button>
              <button className={`sidebar-item ${activeView === 'standards' ? 'active' : ''}`} onClick={() => setActiveView('standards')}>□ <span>Standards of Procedure</span></button>
              <button className={`sidebar-item ${activeView === 'support' ? 'active' : ''}`} onClick={() => setSupportOpen((open) => !open)} aria-expanded={supportOpen}>□ <span>Prescription Data Entry Support Resources</span><span className="nav-chevron">{supportOpen ? '⌃' : '⌄'}</span></button>
              {supportOpen && <div className="sidebar-subnav"><button className={`sidebar-subitem ${selectedSupportResource === 'Rejection and Intervention Codes' ? 'selected' : ''}`} onClick={() => { setActiveView('support'); setSelectedSupportResource('Rejection and Intervention Codes'); setSupportOpen(true) }}>Rejection and Intervention Codes</button><button className={`sidebar-subitem ${selectedSupportResource === 'Diabetic Supplies Pseudo DIN' ? 'selected' : ''}`} onClick={() => { setActiveView('support'); setSelectedSupportResource('Diabetic Supplies Pseudo DIN'); setSupportOpen(true) }}>Diabetic Supplies Pseudo DIN</button><button className={`sidebar-subitem ${selectedSupportResource === 'Early Refill Policy for Private Plans' ? 'selected' : ''}`} onClick={() => { setActiveView('support'); setSelectedSupportResource('Early Refill Policy for Private Plans'); setSupportOpen(true) }}>Early Refill Policy for Private Plans</button><button className={`sidebar-subitem ${selectedSupportResource === 'Compounding Pseudo DIN' ? 'selected' : ''}`} onClick={() => { setActiveView('support'); setSelectedSupportResource('Compounding Pseudo DIN'); setSupportOpen(true) }}>Compounding Pseudo DIN</button><button className={`sidebar-subitem ${selectedSupportResource === 'Meter Billing Information' ? 'selected' : ''}`} onClick={() => { setActiveView('support'); setSelectedSupportResource('Meter Billing Information'); setSupportOpen(true) }}>Meter Billing Information</button><button className={`sidebar-subitem ${selectedSupportResource === 'Third Party Plan Carrier ID' ? 'selected' : ''}`} onClick={() => { setActiveView('support'); setSelectedSupportResource('Third Party Plan Carrier ID'); setSupportOpen(true) }}>Third Party Plan Carrier ID</button></div>}
              <button className={`sidebar-item ${activeView === 'forms' ? 'active' : ''}`} onClick={() => setActiveView('forms')}>□ <span>Third Party Forms</span></button>
            </div>
            <div className="user-chip"><span className="avatar">JD</span><span><strong>Jordan Davis</strong><small>Administrator</small></span><span>•••</span></div>
          </aside>
          <div className="workspace">

            {activeView === 'opening' && <section className="workflow-module" aria-labelledby="procedures-title"><div className="module-heading"><div><div className="breadcrumb">Workspace / Opening & Closing</div><h1 id="procedures-title">Opening & Closing Procedure</h1><p>Complete today&apos;s checklist and keep a reliable submission history.</p></div><span className="today-badge">Today · {procedureSubmitted ? 'Submitted' : 'Not started'}</span></div><div className="procedure-layout"><div className="checklist-card"><div className="checklist-header"><div><span className="panel-kicker">TODAY&apos;S CHECKLIST</span><h2>{procedureSubmitted ? 'Submission locked' : 'Opening procedure'}</h2></div><span className="progress-label">{procedureSubmitted ? '6 / 6 complete' : '0 / 6 complete'}</span></div>{['Unlock and inspect premises','Check refrigerator temperature','Review controlled medication log','Confirm register float','Check urgent deliveries','Sign opening handover'].map((task) => <label className="checklist-row" key={task}><input type="checkbox" disabled={procedureSubmitted} /> <span>{task}</span></label>)}<div className="staff-row"><label>Staff name<input placeholder="Enter your name" disabled={procedureSubmitted} /></label><button className="dark-button" onClick={() => setProcedureSubmitted(true)} disabled={procedureSubmitted}>{procedureSubmitted ? 'Locked' : 'Submit checklist'}</button></div></div><aside className="history-card"><span className="panel-kicker">SUBMISSIONS HISTORY</span><h2>Recent checklists</h2><p>Filter by date to find incomplete or missing submissions.</p><div className="history-item"><strong>Today</strong><span className={procedureSubmitted ? 'complete-status' : 'missing-status'}>{procedureSubmitted ? 'Complete · Jordan Davis' : 'Missing'}</span></div><div className="history-item"><strong>Yesterday</strong><span className="complete-status">Complete · Jordan Davis</span></div><button className="ghost-button">Filter by date</button><button className="text-link">Edit checklist template ↗</button></aside></div></section>}
            {activeView === 'closing' && <section className="workflow-module" aria-labelledby="closing-title"><div className="module-heading"><div><div className="breadcrumb">Workspace / Closing Procedure</div><h1 id="closing-title">Closing Procedure</h1><p>Complete the end-of-day checklist before handing over the pharmacy.</p></div><span className="today-badge">Today · {procedureSubmitted ? 'Submitted' : 'Not started'}</span></div><div className="procedure-layout"><div className="checklist-card"><div className="checklist-header"><div><span className="panel-kicker">TODAY&apos;S CHECKLIST</span><h2>{procedureSubmitted ? 'Submission locked' : 'Closing checklist'}</h2></div><span className="progress-label">{procedureSubmitted ? '6 / 6 complete' : '0 / 6 complete'}</span></div>{['Secure controlled medication storage','Record refrigerator temperature','Reconcile register and deliveries','Clean dispensing area','Set alarm and lock doors','Sign closing handover'].map((task) => <label className="checklist-row" key={task}><input type="checkbox" disabled={procedureSubmitted} /><span>{task}</span></label>)}<div className="staff-row"><label>Staff name<input placeholder="Enter your name" disabled={procedureSubmitted} /></label><button className="dark-button" onClick={() => setProcedureSubmitted(true)} disabled={procedureSubmitted}>{procedureSubmitted ? 'Locked' : 'Submit checklist'}</button></div></div></div></section>}
            {activeView === 'admin' && <section className="workflow-module" aria-labelledby="admin-title"><div className="module-heading"><div><div className="breadcrumb">Team / Admin panel</div><h1 id="admin-title">Admin panel</h1><p>Team-only controls for configuring each client pharmacy workspace.</p></div><span className="today-badge">Team members only</span></div><div className="policy-grid"><article className="policy-card"><span className="panel-kicker">FORMULARY DATA</span><h2>Upload medicine data</h2><p>Import an XLSX file and review the rows before publishing them to a client workspace.</p><button className="dark-button" onClick={() => fileInputRef.current?.click()}>Import spreadsheet</button></article><article className="policy-card"><span className="panel-kicker">CLIENT CONTENT</span><h2>Add workspace information</h2><p>Create policies, procedures, contacts, and forms for the selected pharmacy.</p><button className="ghost-button" onClick={() => setActiveView('forms')}>Manage content</button></article><article className="policy-card"><span className="panel-kicker">ACCESS</span><h2>Team access</h2><p>Keep client administration restricted to authorized team members when Supabase is connected.</p><span className="current-badge">Protected route ready</span></article></div></section>}
            {activeView !== 'formulary' && activeView !== 'opening' && activeView !== 'closing' && activeView !== 'admin' && <section className="workflow-module simple-module" aria-labelledby="section-title"><div className="module-heading"><div><div className="breadcrumb">Workspace / {activeView === 'staff' ? 'Staff Schedule' : activeView === 'emergency' ? 'Emergency Contact List' : activeView === 'standards' ? 'Standards of Procedure' : activeView === 'support' ? 'Prescription Data Entry Support Resources' : 'Third Party Forms'}</div><h1 id="section-title">{activeView === 'staff' ? 'Staff Schedule' : activeView === 'emergency' ? 'Emergency Contact List' : activeView === 'standards' ? 'Standards of Procedure' : activeView === 'support' ? 'Prescription Data Entry Support Resources' : 'Third Party Forms'}</h1><p>Keep the information your pharmacy team needs clear, current, and easy to find.</p></div></div><div className="resource-list">{(activeView === 'staff' ? ['Jordan Davis · Administrator', 'Add a staff member to begin scheduling shifts.'] : activeView === 'emergency' ? ['Pharmacy manager · Add contact details', 'Prescriber and after-hours contacts'] : activeView === 'standards' ? ['Standard operating procedures', 'Review and update team standards'] : activeView === 'support' ? (selectedSupportResource ? [selectedSupportResource] : []) : ['Third party claim forms', 'Download and manage pharmacy forms']).map((item) => <div className="resource-row" key={item}><span>{item}</span><button className="text-link" onClick={() => setSelectedResource(item)}>Open ↗</button></div>)}</div></section>}
            {selectedResource && <div className="auth-backdrop" role="dialog" aria-modal="true" aria-label={`${selectedResource} reader`}><article className="auth-card reader-card"><button className="close-panel" onClick={() => setSelectedResource('')} aria-label="Close reader">×</button><p className="eyebrow">WORKSPACE RESOURCE</p><h2>{selectedResource}</h2><p className="panel-subtitle">This resource is ready for your team. Add or replace its client-specific content from the Admin panel.</p><div className="resource-reader"><p>Current version</p><strong>Available to authorized team members</strong><p>Reader content will be stored privately when Supabase is connected.</p></div><button className="dark-button" onClick={() => setSelectedResource('')}>Close reader</button></article></div>}
            {activeView === 'formulary' && <>
            <header className="workspace-header"><div><div className="breadcrumb">Workspace / Formulary</div><h1>Formulary</h1><p>Review and edit the medicines assigned to Northside Pharmacy.</p></div></header>
            <div className="workspace-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chemical, brand, or DIN..." aria-label="Search formulary" /></label><span className="result-count">{filtered.length} of {allEntries.length} medicines</span><button className="ghost-button">Filter</button><button className="ghost-button">Export CSV</button></div>
            <div className="table-wrap"><table><thead><tr><th>Chemical name <span>↕</span></th><th>Preferred generic <span>↕</span></th><th>Preferred DIN</th><th>Alternate generic</th><th>Alternate DIN</th><th>Notes</th></tr></thead><tbody>{filtered.map((entry) => <tr key={entry[0]} onClick={() => setSelected(entry)}><td className="chemical">{entry[0]} <span className="row-edit">↗</span></td><td>{entry[1]}</td><td className="din">{entry[2]}</td><td>{entry[3]}</td><td className="din">{entry[4]}</td><td className="notes">{entry[5]}</td></tr>)}</tbody></table></div>
            <div className="audit-note"><span className="status-dot" /> All changes are saved automatically <span>Last edited by Jordan Davis · 2 min ago</span></div>
            </>}
          </div>
          {activeView === 'formulary' && selected && <aside className="detail-panel"><button className="close-panel" onClick={() => setSelected(null)} aria-label="Close detail panel">×</button><div className="panel-kicker">EDIT MEDICINE</div><h2>{selected[0]}</h2><p className="panel-subtitle">Updated 2 minutes ago by Jordan Davis</p><div className="detail-fields">{[['Preferred generic brand', selected[1]], ['Preferred generic DIN', selected[2]], ['Alternate generic brand', selected[3]], ['Alternate generic DIN', selected[4]], ['Notes', selected[5]]].map(([label, value]) => <label key={label}>{label}<input defaultValue={value} /></label>)}</div><div className="panel-actions"><button className="ghost-button" onClick={() => setSelected(null)}>Cancel</button><button className="dark-button" onClick={() => setSelected(null)}>Save changes</button></div></aside>}
        </section>
      ) : (
        <>
          <section className="hero" id="top">
            <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> FORMULARY MANAGEMENT FOR INDEPENDENT PHARMACIES</p><h1>Know what your pharmacy <em>prefers.</em></h1><p className="hero-description">A focused workspace for keeping generic substitutions accurate, accessible, and accountable — from the counter to the back office.</p><div className="hero-actions"><button className="dark-button large" onClick={startFreeTrial}>Start your free trial <span aria-hidden="true">↗</span></button><span>No credit card required</span></div><div className="trust-line"><span>Designed for the way pharmacies work</span><span>·</span><span>Simple to start</span><span>·</span><span>Ready when you are</span></div></div>
            <div className="preview-frame"><div className="preview-top"><span className="window-dots"><i /><i /><i /></span><span>Northside Pharmacy / Formulary</span><span className="preview-status"><b /> Live workspace</span></div><div className="preview-inner"><div className="preview-heading"><div><span className="mini-label">FORMULARY</span><strong>Preferred generics</strong></div><span className="preview-search">⌕ Search medicines</span></div><div className="mini-table"><div className="mini-row mini-head"><span>Chemical name</span><span>Preferred generic</span><span>DIN</span></div>{entries.slice(0, 5).map((entry) => <div className="mini-row" key={entry[0]}><span>{entry[0]}</span><span>{entry[1]}</span><span className="din">{entry[2]}</span></div>)}</div><div className="preview-footer"><span><b /> 248 medicines</span><span>Synced just now</span></div></div></div>
          </section>
          <section className="feature-strip" id="how-it-works">{features.map(([number, title, copy]) => <article key={number}><span className="feature-number">{number}</span><h2>{title}</h2><p>{copy}</p></article>)}</section>
          <section className="statement" id="security"><p className="eyebrow"><span className="eyebrow-line" /> MADE FOR PHARMACY TEAMS</p><h2>Your formulary should be as dependable as the care you provide.</h2><button className="text-link" onClick={() => { setAuthMode('sign-in'); setAuthError('') }}>See the workspace <span>↗</span></button></section>
          <footer><a className="wordmark" href="#top"><span className="wordmark-mark">+</span> formulary</a><span>Clear choices. Better care.</span><span>© 2026 Formulary</span></footer>
        </>
      )}
    </main>
    </>
  )
}
