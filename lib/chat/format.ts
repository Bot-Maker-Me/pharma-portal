// Date helpers built on the native Intl API (no date libraries).

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
// Full calendar date, e.g. "Sat, Oct 12, 2026" — day dividers always spell the
// date out so a thread can be read without guessing which day it refers to.
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const fullFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatMessageTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

export function formatConversationTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return timeFormatter.format(date)

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  const withinWeek = now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000
  if (withinWeek) return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

/** Day divider label: "Today · Sat, Oct 12, 2026", "Yesterday · …", or the date alone. */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const calendarDate = dateFormatter.format(date)
  if (date.toDateString() === now.toDateString()) return `Today · ${calendarDate}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${calendarDate}`

  return calendarDate
}

/** The date on its own, e.g. "Sat, Oct 12, 2026" — used where the time is not needed. */
export function formatCalendarDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

export function formatFullTimestamp(iso: string): string {
  return fullFormatter.format(new Date(iso))
}

export function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
