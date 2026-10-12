import type { WorkspaceData } from './types'

/**
 * Sample content for the preview workspace of the pharmacy in
 * lib/tenant/preview.ts (Pharmasave West Hills). It is read-only sample data, so
 * the workspace can be explored before Supabase is connected; nothing here is
 * ever written anywhere.
 */
export const previewWorkspace: WorkspaceData = {
  formulary: [
    {
      id: 'preview-alendronate',
      chemicalName: 'Alendronate',
      preferredGeneric: 'Alendronate',
      preferredDin: '02245667',
      alternateGeneric: 'Fosamax',
      alternateDin: '02231480',
      notes: 'Weekly dosing — confirm the day with the resident.',
    },
    {
      id: 'preview-amlodipine',
      chemicalName: 'Amlodipine',
      preferredGeneric: 'Amlodipine',
      preferredDin: '02313504',
      alternateGeneric: 'Norvasc',
      alternateDin: '01926858',
      notes: null,
    },
    {
      id: 'preview-apixaban',
      chemicalName: 'Apixaban',
      preferredGeneric: 'Apixaban',
      preferredDin: '02478123',
      alternateGeneric: 'Eliquis',
      alternateDin: '02478131',
      notes: 'Do not substitute without prescriber confirmation.',
    },
    {
      id: 'preview-atorvastatin',
      chemicalName: 'Atorvastatin',
      preferredGeneric: 'Atorvastatin',
      preferredDin: '02246915',
      alternateGeneric: 'Lipitor',
      alternateDin: '02213423',
      notes: null,
    },
    {
      id: 'preview-metformin',
      chemicalName: 'Metformin',
      preferredGeneric: 'Metformin',
      preferredDin: '02229470',
      alternateGeneric: 'Glucophage',
      alternateDin: '01944201',
      notes: 'Supplied as blister-packed strips for the Tuesday cycle.',
    },
    {
      id: 'preview-rosuvastatin',
      chemicalName: 'Rosuvastatin',
      preferredGeneric: 'Rosuvastatin',
      preferredDin: '02302316',
      alternateGeneric: 'Crestor',
      alternateDin: '02247158',
      notes: 'Short supply — check stock before promising a fill.',
    },
  ],
  content: [
    {
      id: 'preview-opening-1',
      section: 'opening',
      title: 'Unlock, disarm and check the alarm log',
      body: 'Disarm the panel at the back door, confirm no overnight alarm events, then unlock the front and dispensary doors.',
    },
    {
      id: 'preview-opening-2',
      section: 'opening',
      title: 'Check refrigerator temperature',
      body: 'Log the 8am reading. Accept anything between 2 °C and 8 °C; escalate outside that range before dispensing.',
    },
    {
      id: 'preview-closing-1',
      section: 'closing',
      title: 'Reconcile the narcotic safe count',
      body: 'Two staff sign the count sheet, then the shift lead files it in the controlled-substances binder.',
    },
    {
      id: 'preview-emergency-1',
      section: 'emergency',
      title: 'On-call pharmacist',
      body: 'Weeknights and weekends — call the on-call line, then log the after-hours intervention.',
    },
    {
      id: 'preview-emergency-2',
      section: 'emergency',
      title: 'Prescriber after-hours line',
      body: 'For time-sensitive substitutions outside clinic hours.',
    },
    {
      id: 'preview-standards-1',
      section: 'standards',
      title: 'Blister pack preparation',
      body: 'Verify against the current med list, double-check high-alert drugs, and record the preparer and checker initials.',
    },
    {
      id: 'preview-support-1',
      section: 'support',
      title: 'Data-entry quick reference',
      body: 'DIN lookups, interchange rules and the fields the claims adjudicator expects.',
    },
    {
      id: 'preview-forms-1',
      section: 'forms',
      title: 'Third-party claim forms',
      body: 'Fillable PDFs for the plans this pharmacy bills most often.',
    },
  ],
}
