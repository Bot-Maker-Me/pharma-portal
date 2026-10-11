'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

type Section = 'formulary' | 'opening' | 'closing' | 'staff' | 'emergency' | 'standards' | 'support' | 'forms'

const sectionLabels: Record<Section, string> = {
  formulary: 'Formulary',
  opening: 'Opening Procedure',
  closing: 'Closing Procedure',
  staff: 'Staff Schedule',
  emergency: 'Emergency Contact List',
  standards: 'Standards of Procedure',
  support: 'Prescription Data Entry Support Resources',
  forms: 'Third Party Forms',
}

const supportItems = ['Rejection and Intervention Codes', 'Diabetic Supplies Pseudo DIN', 'Early Refill Policy for Private Plans', 'Compounding Pseudo DIN', 'Meter Billing Information', 'Third Party Plan Carrier ID']
const checklistItems = ['Unlock and inspect premises', 'Check refrigerator temperature', 'Review controlled medication log', 'Confirm register float', 'Sign opening handover']
const closingItems = ['Secure controlled medication storage', 'Record refrigerator temperature', 'Reconcile register and deliveries', 'Clean dispensing area', 'Set alarm and lock doors']

export default function AdminPage() {
  const [client, setClient] = useState('Northside Pharmacy')
  const [section, setSection] = useState<Section>('formulary')
  const [saved, setSaved] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, Record<Section, string[]>>>({ 'Northside Pharmacy': { formulary: [], opening: [], closing: [], staff: [], emergency: [], standards: [], support: [], forms: [] }, 'Maple Street Pharmacy': { formulary: [], opening: [], closing: [], staff: [], emergency: [], standards: [], support: [], forms: [] }, 'Harbour Pharmacy': { formulary: [], opening: [], closing: [], staff: [], emergency: [], standards: [], support: [], forms: [] } })
  const [medicines, setMedicines] = useState<Record<string, string[]>>({ 'Northside Pharmacy': ['Alendronate', 'Amlodipine', 'Apixaban'], 'Maple Street Pharmacy': [], 'Harbour Pharmacy': [] })
  const [content, setContent] = useState<Record<string, Record<Section, string[]>>>({ 'Northside Pharmacy': { formulary: [], opening: [], closing: [], staff: [], emergency: [], standards: [], support: [], forms: [] }, 'Maple Street Pharmacy': { formulary: [], opening: [], closing: [], staff: [], emergency: [], standards: [], support: [], forms: [] }, 'Harbour Pharmacy': { formulary: [], opening: [], closing: [], staff: [], emergency: [], standards: [], support: [], forms: [] } })

  const addFiles = (files: File[], links: string[] = []) => {
    const names = [...files.map((file) => file.name), ...links].filter(Boolean)
    if (!names.length) return
    setUploadedFiles((current) => ({ ...current, [client]: { ...current[client], [section]: [...(current[client]?.[section] || []), ...names] } }))
    setSaved(`${names.length} file${names.length === 1 ? '' : 's'} added to ${client}`)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const links = event.dataTransfer.getData('text/uri-list').split('\\n').map((link) => link.trim()).filter(Boolean)
    addFiles(Array.from(event.dataTransfer.files), links)
  }

  const addContent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = String(form.get('value') || '').trim()
    if (!value) return
    if (section === 'formulary') setMedicines((current) => ({ ...current, [client]: [...(current[client] || []), value] }))
    else setContent((current) => ({ ...current, [client]: { ...current[client], [section]: [...(current[client]?.[section] || []), value] } }))
    setSaved(`${sectionLabels[section]} updated for ${client}`)
    event.currentTarget.reset()
  }

  const items = section === 'formulary' ? medicines[client] || [] : content[client]?.[section] || []
  const template = section === 'opening' ? checklistItems : section === 'closing' ? closingItems : section === 'support' ? supportItems : []

  return <main className="admin-app-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand"><span>+</span> formulary</Link><div className="admin-sidebar-label">TEAM ADMINISTRATION</div><h2>Client setup</h2><p>Configure each pharmacy independently.</p><label className="admin-field">Selected pharmacy<select value={client} onChange={(event) => { setClient(event.target.value); setSaved('') }}><option>Northside Pharmacy</option><option>Maple Street Pharmacy</option><option>Harbour Pharmacy</option></select></label><nav className="admin-nav" aria-label="Admin sections">{(Object.keys(sectionLabels) as Section[]).map((key) => <button key={key} className={section === key ? 'active' : ''} onClick={() => { setSection(key); setSaved('') }}>{sectionLabels[key]}</button>)}</nav><Link className="admin-back" href="/">Back to workspace</Link></aside>
    <section className="admin-main"><header className="admin-main-header"><div><span className="panel-kicker">PRIVATE TEAM CONSOLE</span><h1>{sectionLabels[section]}</h1><p>Managing <strong>{client}</strong> · changes stay scoped to this pharmacy.</p></div><span className="today-badge">Team only</span></header>
      <div className="admin-content-card"><div className="admin-section-intro"><div><span className="panel-kicker">{section === 'formulary' ? 'MEDICINE DATA' : 'CLIENT CONTENT'}</span><h2>{section === 'formulary' ? 'Assigned medicines' : `Manage ${sectionLabels[section].toLowerCase()}`}</h2><p>{section === 'formulary' ? 'Add medicines for this pharmacy. Clients can edit assigned records but cannot create new ones.' : 'Add the information your client will see in their workspace.'}</p></div><span className="admin-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span></div>
        {template.length > 0 && <div className="template-box"><span className="panel-kicker">READY-TO-ADD TEMPLATE</span><div className="template-chips">{template.map((item) => <button type="button" key={item} onClick={() => { setContent((current) => ({ ...current, [client]: { ...current[client], [section]: [...(current[client]?.[section] || []), item] } })); setSaved(`${item} added to ${client}`) }}>{item} +</button>)}</div></div>}
        <div className={`admin-dropzone ${isDragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}><input id="admin-file-input" className="sr-only" type="file" multiple onChange={(event) => addFiles(Array.from(event.target.files || []))} /><label htmlFor="admin-file-input"><strong>Drop files here</strong><span>or choose files</span></label><small>Excel, CSV, PDF, Word, images, or a Google Sheets link</small></div>
        <form className="admin-add-form" onSubmit={addContent}><label>{section === 'formulary' ? 'Medicine name' : 'Add information'}<input name="value" required placeholder={section === 'formulary' ? 'e.g. Atorvastatin' : `Add to ${sectionLabels[section]}`} /></label><button className="dark-button" type="submit">+ Add to {client}</button></form>
        <div className="admin-records">{items.length === 0 ? <div className="admin-empty">No data added for {client} yet.</div> : items.map((item, index) => <div className="admin-record" key={`${item}-${index}`}><span>{item}</span><button type="button" onClick={() => { if (section === 'formulary') setMedicines((current) => ({ ...current, [client]: current[client].filter((_, itemIndex) => itemIndex !== index) })); else setContent((current) => ({ ...current, [client]: { ...current[client], [section]: current[client][section].filter((_, itemIndex) => itemIndex !== index) } })); setSaved('Item removed') }}>Remove</button></div>)}</div>{(uploadedFiles[client]?.[section] || []).length > 0 && <div className="admin-uploaded-files"><span className="panel-kicker">ADDED FILES</span>{uploadedFiles[client][section].map((file, index) => <div className="admin-record" key={`${file}-${index}`}><span>{file}</span><span className="admin-file-status">Ready for {client}</span></div>)}</div>}{saved && <p className="admin-success" role="status">{saved}</p>}</div>
      <div className="admin-grid-cards"><article><span className="panel-kicker">DATA ISOLATION</span><h3>Selected pharmacy only</h3><p>Switching pharmacies changes the records shown above. Each client has its own setup.</p></article><article><span className="panel-kicker">CLIENT PERMISSIONS</span><h3>No client creation controls</h3><p>Medicine creation and content setup are available only inside this team console.</p></article></div>
    </section>
  </main>
}
