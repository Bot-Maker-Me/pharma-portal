import type { Urgency } from './types'

export type UrgencyMeta = {
  label: string
  short: string
  description: string
  badgeClass: string
  dotClass: string
}

// Calm, clinical palette: routine stays quiet, urgency escalates through coral.
export const urgencyMeta: Record<Urgency, UrgencyMeta> = {
  routine: {
    label: 'Routine',
    short: 'Routine',
    description: 'Standard clinical request',
    badgeClass: 'bg-sage/20 text-evergreen',
    dotClass: 'bg-sage',
  },
  urgent: {
    label: 'Urgent',
    short: 'Urgent',
    description: 'Needs attention today',
    badgeClass: 'bg-coral/15 text-coral',
    dotClass: 'bg-coral',
  },
  emergency: {
    label: 'Emergency',
    short: 'STAT',
    description: 'Immediate clinical escalation',
    badgeClass: 'bg-coral text-white',
    dotClass: 'bg-coral',
  },
}

export const urgencyOrder: Urgency[] = ['routine', 'urgent', 'emergency']
