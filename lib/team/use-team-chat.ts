'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createTeamBackend } from './backend'
import type { NewTeamChannelInput, TeamBackend, TeamChannelSummary, TeamColleague, TeamMessage } from './types'

export type LoadStatus = 'loading' | 'ready' | 'error'
export type ThreadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type TeamChatController = {
  mode: 'live' | 'preview'
  status: LoadStatus
  error: string | null
  displayName: string
  userId: string
  colleagues: TeamColleague[]
  channels: TeamChannelSummary[]
  activeChannelId: string | null
  activeChannel: TeamChannelSummary | null
  messages: TeamMessage[]
  threadStatus: ThreadStatus
  threadError: string | null
  sending: boolean
  sendError: string | null
  creating: boolean
  /** Unread messages across every channel — the sidebar badge. */
  totalUnread: number
  selectChannel: (channelId: string) => void
  createChannel: (input: NewTeamChannelInput) => Promise<string | null>
  sendMessage: (body: string) => Promise<boolean>
  editMessage: (messageId: string, body: string) => Promise<boolean>
  deleteMessage: (messageId: string) => Promise<boolean>
  retry: () => void
}

const fallbackMessage = 'Something went wrong. Please try again.'

/**
 * Owns all Team Chat state: my channels (with unread counts), the active thread,
 * realtime updates and optimistic sends. Backend-agnostic — the components never
 * know whether the data came from Supabase or the preview set.
 */
export function useTeamChat(): TeamChatController {
  const [backend, setBackend] = useState<TeamBackend | null>(null)

  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [colleagues, setColleagues] = useState<TeamColleague[]>([])
  const [channels, setChannels] = useState<TeamChannelSummary[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [threadStatus, setThreadStatus] = useState<ThreadStatus>('idle')
  const [threadError, setThreadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const activeChannelRef = useRef<string | null>(null)
  useEffect(() => {
    activeChannelRef.current = activeChannelId
  }, [activeChannelId])

  useEffect(() => {
    setBackend(createTeamBackend())
  }, [])

  const refreshSummaries = useCallback(async () => {
    if (!backend) return
    try {
      const snapshot = await backend.load()
      setUserId(snapshot.userId)
      setDisplayName(snapshot.displayName)
      setColleagues(snapshot.colleagues)
      setChannels(snapshot.channels)
    } catch {
      // Keep the last known list; a later event or retry will refresh it.
    }
  }, [backend])

  const refreshTimer = useRef<number | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null
      void refreshSummaries()
    }, 250)
  }, [refreshSummaries])

  useEffect(
    () => () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
    },
    [],
  )

  // Initial load: my colleagues, my channels and their unread counts.
  useEffect(() => {
    if (!backend) return
    let cancelled = false
    setStatus('loading')
    setError(null)

    backend
      .load()
      .then((snapshot) => {
        if (cancelled) return
        setUserId(snapshot.userId)
        setDisplayName(snapshot.displayName)
        setColleagues(snapshot.colleagues)
        setChannels(snapshot.channels)
        setStatus('ready')
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : fallbackMessage)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [backend, reloadKey])

  // The active thread: load its messages, then mark it read.
  useEffect(() => {
    if (!backend) return

    if (!activeChannelId) {
      setMessages([])
      setThreadError(null)
      setThreadStatus('ready')
      return
    }

    let cancelled = false
    setThreadStatus('loading')
    setThreadError(null)

    backend
      .loadMessages(activeChannelId)
      .then((thread) => {
        if (cancelled) return
        setMessages(thread)
        setThreadStatus('ready')
        void backend.markRead(activeChannelId).then(refreshSummaries).catch(() => undefined)
      })
      .catch((threadLoadError: unknown) => {
        if (cancelled) return
        setThreadError(threadLoadError instanceof Error ? threadLoadError.message : fallbackMessage)
        setThreadStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [backend, activeChannelId, refreshSummaries])

  useEffect(() => {
    if (!backend) return
    return backend.subscribe({
      onMessage: (message) => {
        if (message.channelId === activeChannelRef.current) {
          setMessages((current) =>
            current.some((item) => item.id === message.id) ? current : [...current, message],
          )
        }
        scheduleRefresh()
      },
      onChannelChange: () => scheduleRefresh(),
    })
  }, [backend, scheduleRefresh])

  // Safety net: a slow poll keeps the list current if realtime is blocked.
  useEffect(() => {
    if (!backend) return
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refreshSummaries()
      const channelId = activeChannelRef.current
      if (!channelId) return
      void backend
        .loadMessages(channelId)
        .then((thread) => setMessages(thread))
        .catch(() => undefined)
    }, 20_000)
    return () => window.clearInterval(interval)
  }, [backend, refreshSummaries])

  const selectChannel = useCallback((channelId: string) => {
    setActiveChannelId(channelId)
  }, [])

  const createChannel = useCallback(
    async (input: NewTeamChannelInput): Promise<string | null> => {
      if (!backend) return null
      setCreating(true)
      setSendError(null)
      try {
        const channelId = await backend.createChannel(input)
        await refreshSummaries()
        setActiveChannelId(channelId)
        return channelId
      } catch (createError: unknown) {
        setSendError(createError instanceof Error ? createError.message : fallbackMessage)
        return null
      } finally {
        setCreating(false)
      }
    },
    [backend, refreshSummaries],
  )

  const sendMessage = useCallback(
    async (body: string): Promise<boolean> => {
      if (!backend || !activeChannelId) return false
      setSending(true)
      setSendError(null)
      try {
        const message = await backend.sendMessage({ channelId: activeChannelId, body })
        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message],
        )
        void refreshSummaries()
        return true
      } catch (sendFailure: unknown) {
        setSendError(sendFailure instanceof Error ? sendFailure.message : fallbackMessage)
        return false
      } finally {
        setSending(false)
      }
    },
    [backend, activeChannelId, refreshSummaries],
  )

  const editMessage = useCallback(
    async (messageId: string, body: string): Promise<boolean> => {
      if (!backend) return false
      setSendError(null)
      try {
        const updated = await backend.editMessage({ messageId, body })
        setMessages((current) => current.map((item) => (item.id === messageId ? updated : item)))
        void refreshSummaries()
        return true
      } catch (editFailure: unknown) {
        setSendError(editFailure instanceof Error ? editFailure.message : fallbackMessage)
        return false
      }
    },
    [backend, refreshSummaries],
  )

  const deleteMessage = useCallback(
    async (messageId: string): Promise<boolean> => {
      if (!backend) return false
      setSendError(null)
      try {
        await backend.deleteMessage(messageId)
        const stamp = new Date().toISOString()
        setMessages((current) =>
          current.map((item) => (item.id === messageId ? { ...item, deletedAt: stamp } : item)),
        )
        void refreshSummaries()
        return true
      } catch (deleteFailure: unknown) {
        setSendError(deleteFailure instanceof Error ? deleteFailure.message : fallbackMessage)
        return false
      }
    },
    [backend, refreshSummaries],
  )

  const retry = useCallback(() => setReloadKey((current) => current + 1), [])

  const activeChannel = channels.find((channel) => channel.channelId === activeChannelId) ?? null
  const totalUnread = channels.reduce((sum, channel) => sum + channel.unreadCount, 0)

  return {
    mode: backend?.mode ?? 'preview',
    status,
    error,
    displayName,
    userId,
    colleagues,
    channels,
    activeChannelId,
    activeChannel,
    messages,
    threadStatus,
    threadError,
    sending,
    sendError,
    creating,
    totalUnread,
    selectChannel,
    createChannel,
    sendMessage,
    editMessage,
    deleteMessage,
    retry,
  }
}
