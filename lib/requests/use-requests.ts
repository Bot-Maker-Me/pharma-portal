'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createRequestsBackend } from './backend'
import type { RequestMessage, RequestStatus, RequestThread, RequestsBackend } from './types'

export type LoadStatus = 'loading' | 'ready' | 'error'
export type ThreadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type RequestsController = {
  mode: 'live' | 'preview'
  status: LoadStatus
  error: string | null
  threads: RequestThread[]
  activeThreadId: string | null
  activeThread: RequestThread | null
  messages: RequestMessage[]
  threadStatus: ThreadStatus
  threadError: string | null
  sending: boolean
  sendError: string | null
  /** Employee messages not yet opened by the pharmacy — the sidebar badge. */
  totalUnread: number
  selectThread: (threadId: string) => void
  sendMessage: (body: string) => Promise<boolean>
  setStatus: (status: RequestStatus) => Promise<boolean>
  retry: () => void
}

const fallbackMessage = 'Something went wrong. Please try again.'

/**
 * Owns all Employee Requests state: the thread inbox, the open thread, realtime
 * updates and optimistic replies. Backend-agnostic.
 */
export function useRequests(): RequestsController {
  const [backend, setBackend] = useState<RequestsBackend | null>(null)

  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [threads, setThreads] = useState<RequestThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<RequestMessage[]>([])
  const [threadStatus, setThreadStatus] = useState<ThreadStatus>('idle')
  const [threadError, setThreadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const activeThreadRef = useRef<string | null>(null)
  useEffect(() => {
    activeThreadRef.current = activeThreadId
  }, [activeThreadId])

  useEffect(() => {
    setBackend(createRequestsBackend())
  }, [])

  const refreshSummaries = useCallback(async () => {
    if (!backend) return
    try {
      const snapshot = await backend.load()
      setThreads(snapshot.threads)
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

  useEffect(() => {
    if (!backend) return
    let cancelled = false
    setStatus('loading')
    setError(null)

    backend
      .load()
      .then((snapshot) => {
        if (cancelled) return
        setThreads(snapshot.threads)
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

  useEffect(() => {
    if (!backend) return

    if (!activeThreadId) {
      setMessages([])
      setThreadError(null)
      setThreadStatus('ready')
      return
    }

    let cancelled = false
    setThreadStatus('loading')
    setThreadError(null)

    backend
      .loadMessages(activeThreadId)
      .then((thread) => {
        if (cancelled) return
        setMessages(thread)
        setThreadStatus('ready')
        void backend.markRead(activeThreadId).then(refreshSummaries).catch(() => undefined)
      })
      .catch((threadLoadError: unknown) => {
        if (cancelled) return
        setThreadError(threadLoadError instanceof Error ? threadLoadError.message : fallbackMessage)
        setThreadStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [backend, activeThreadId, refreshSummaries])

  useEffect(() => {
    if (!backend) return
    return backend.subscribe({
      onMessage: (message) => {
        if (message.threadId === activeThreadRef.current) {
          setMessages((current) =>
            current.some((item) => item.id === message.id) ? current : [...current, message],
          )
        }
        scheduleRefresh()
      },
      onThreadChange: () => scheduleRefresh(),
    })
  }, [backend, scheduleRefresh])

  // Safety net: a slow poll keeps the inbox current if realtime is blocked.
  useEffect(() => {
    if (!backend) return
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refreshSummaries()
      const threadId = activeThreadRef.current
      if (!threadId) return
      void backend
        .loadMessages(threadId)
        .then((thread) => setMessages(thread))
        .catch(() => undefined)
    }, 20_000)
    return () => window.clearInterval(interval)
  }, [backend, refreshSummaries])

  const selectThread = useCallback((threadId: string) => setActiveThreadId(threadId), [])

  const sendMessage = useCallback(
    async (body: string): Promise<boolean> => {
      if (!backend || !activeThreadId) return false
      setSending(true)
      setSendError(null)
      try {
        const message = await backend.sendMessage({ threadId: activeThreadId, body })
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
    [backend, activeThreadId, refreshSummaries],
  )

  const setStatusForActive = useCallback(
    async (next: RequestStatus): Promise<boolean> => {
      if (!backend || !activeThreadId) return false
      setSendError(null)
      try {
        await backend.setStatus(activeThreadId, next)
        const stamp = next === 'closed' ? new Date().toISOString() : null
        setThreads((current) =>
          current.map((thread) =>
            thread.id === activeThreadId ? { ...thread, status: next, closedAt: stamp } : thread,
          ),
        )
        void refreshSummaries()
        return true
      } catch (statusFailure: unknown) {
        setSendError(statusFailure instanceof Error ? statusFailure.message : fallbackMessage)
        return false
      }
    },
    [backend, activeThreadId, refreshSummaries],
  )

  const retry = useCallback(() => setReloadKey((current) => current + 1), [])

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null

  return {
    mode: backend?.mode ?? 'preview',
    status,
    error,
    threads,
    activeThreadId,
    activeThread,
    messages,
    threadStatus,
    threadError,
    sending,
    sendError,
    totalUnread: threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
    selectThread,
    sendMessage,
    setStatus: setStatusForActive,
    retry,
  }
}
