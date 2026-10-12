// The workspace sections that hold free-form content. Shared by the admin console
// (which writes them) and the workspace (which reads them) so the keys always match.

export type WorkspaceSectionKey =
  | 'opening'
  | 'closing'
  | 'staff'
  | 'emergency'
  | 'standards'
  | 'support'
  | 'forms'

export type WorkspaceSection = {
  key: WorkspaceSectionKey
  label: string
  hint: string
}

export const workspaceSections: WorkspaceSection[] = [
  { key: 'opening', label: 'Opening Procedure', hint: 'Steps to complete when opening the pharmacy.' },
  { key: 'closing', label: 'Closing Procedure', hint: 'Steps to complete before locking up.' },
  { key: 'staff', label: 'Staff Schedule', hint: 'Team members and their shifts.' },
  { key: 'emergency', label: 'Emergency Contact List', hint: 'After-hours, prescriber and manager contacts.' },
  { key: 'standards', label: 'Standards of Procedure', hint: 'Standard operating procedures and policies.' },
  {
    key: 'support',
    label: 'Prescription Data Entry Support Resources',
    hint: 'Prescription data-entry reference material.',
  },
  { key: 'forms', label: 'Third Party Forms', hint: 'Claim forms, links and downloads.' },
]

export function sectionLabel(key: string): string {
  return workspaceSections.find((section) => section.key === key)?.label ?? key
}
