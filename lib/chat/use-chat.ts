'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createChatBackend } from './backend'
import type {
  AuthorizedHome,
  ChatBackend,
  ChatMessage,
  ConversationSummary,
  SendMessageInput,
} from './types'

export type LoadStatus = 'loading' | 'ready' | 'error'
export type ThreadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ChatController = {
  mode: 'live' | 'preview'
  status: LoadStatus
  error: string | null
  homes: AuthorizedHome[]
  conversations: ConversationSummary[]
  activeConversationId: string | null
  activeHomeId: string | null
  activeSummary: ConversationSummary | null
  messages: ChatMessage[]
  threadStatus: ThreadStatus
  threadError: string | null
  sending: boolean
  sendError: string | null
  selectConversation: (conversationId: string) => void
  startConversation: (homeId: string) => void
  sendMessage: (input: Omit<SendMessageInput, 'conversationId'>) => Promise<boolean>
  retry: () => void
}

const fallbackMessage = 'Something went wrong. Please try again.'

/**
 * Owns all chat state: the conversation list, the active thread, realtime
 * updates and optimistic sends. Backend-agnostic — it works against Supabase or
 * the preview data set without the components knowing the difference.
 *
 * The unit of work is a *conversation* (a thread), not a home: the Nursing Home
 * portal can hold several threads per home, and the pharmacy must reply inside
 * the same thread the home is reading. Threads are created lazily, on the first
 * message, and only when the home has no thread at all.
 */
export function useChatData(): ChatController {
  const [backend, setBackend] = useState<ChatBackend | null>(null)

  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [homes, setHomes] = useState<AuthorizedHome[]>([])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeHomeId, setActiveHomeId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [threadStatus, setThreadStatus] = useState<ThreadStatus>('idle')
  const [threadError, setThreadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const activeConversationRef = useRef<string | null>(null)

  useEffect(() => {
    activeConversationRef.current = activeConversationId
  }, [activeConversationId])

  // Create the backend on the client only (avoids touching browser APIs during SSR).
  useEffect(() => {
    setBackend(createChatBackend())
  }, [])

  const refreshSummaries = useCallback(async () => {
    if (!backend) return
    try {
      const snapshot = await backend.load()
      setHomes(snapshot.homes)
      setConversations(snapshot.conversations)
    } catch {
      // Keep the last known list; a later event or retry will refresh it.
    }
  }, [backend])

  // Realtime can fire several events at once — coalesce them into one reload.
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

  // Initial load of authorized homes + conversation threads.
  useEffect(() => {
    if (!backend) return
    let cancelled = false
    setStatus('loading')
    setError(null)

    backend
      .load()
      .then((snapshot) => {
        if (cancelled) return
        setHomes(snapshot.homes)
        setConversations(snapshot.conversations)
        setStatus('ready')
        // Open the most recently active thread by default, like the home portal.
        const latest = snapshot.conversations[0] ?? null
        setActiveConversationId((current) => current ?? latest?.conversationId ?? null)
        setActiveHomeId((current) => current ?? latest?.homeId ?? snapshot.homes[0]?.id ?? null)
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

  // Load the active thread and mark it read. A home with no thread yet simply
  // shows the "start the conversation" state until the first message is sent.
  useEffect(() => {
    if (!backend) return

    if (!activeConversationId) {
      setMessages([])
      setThreadError(null)
      setThreadStatus('ready')
      return
    }

    let cancelled = false
    setThreadStatus('loading')
    setThreadError(null)

    backend
      .loadMessages(activeConversationId)
      .then((thread) => {
        if (cancelled) return
        setMessages(thread)
        setThreadStatus('ready')
        void backend.markRead(activeConversationId).then(refreshSummaries).catch(() => undefined)
      })
      .catch((threadLoadError: unknown) => {
        if (cancelled) return
        setThreadError(threadLoadError instanceof Error ? threadLoadError.message : fallbackMessage)
        setThreadStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [backend, activeConversationId, refreshSummaries])

  // Realtime subscription for both portals.
  useEffect(() => {
    if (!backend) return
    return backend.subscribe({
      onMessage: (message) => {
        if (message.conversationId === activeConversationRef.current) {
          setMessages((current) =>
            current.some((item) => item.id === message.id) ? current : [...current, message],
          )
          // A message from the home side is ours to mark read.
          if (!message.fromPharmacy) {
            void backend.markRead(message.conversationId).then(scheduleRefresh).catch(() => undefined)
          }
        }
        scheduleRefresh()
      },
      onConversationChange: () => {
        scheduleRefresh()
      },
    })
  }, [backend, refreshSummaries, scheduleRefresh])

  // Safety net: realtime is the primary path, but a slow poll guarantees the
  // pharmacy still receives messages if a realtime subscription is blocked
  // (for example by a row-level security policy on the shared tables).
  useEffect(() => {
    if (!backend) return
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refreshSummaries()
      const conversationId = activeConversationRef.current
      if (!conversationId) return
      void backend
        .loadMessages(conversationId)
        .then((thread) => setMessages(thread))
        .catch(() => undefined)
    }, 20_000)
    return () => window.clearInterval(interval)
  }, [backend, refreshSummaries])

  const selectConversation = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId)
      const summary = conversations.find((item) => item.conversationId === conversationId)
      if (summary) setActiveHomeId(summary.homeId)
    },
    [conversations],
  )

  // Preparing a brand-new thread for a home: nothing is written until the first
  // message is sent, so merely browsing never creates rows.
  const startConversation = useCallback((homeId: string) => {
    setActiveConversationId(null)
    setActiveHomeId(homeId)
  }, [])

  const sendMessage = useCallback(
    async (input: Omit<SendMessageInput, 'conversationId'>): Promise<boolean> => {
      // Either an existing thread is open, or a home is selected to start one.
      if (!backend || (!activeConversationId && !activeHomeId)) return false
      setSending(true)
      setSendError(null)

      try {
        let conversationId = activeConversationId
        if (!conversationId) {
          if (!activeHomeId) return false
          // chat_threads requires a subject — the opening line doubles as it.
          conversationId = await backend.ensureConversation(activeHomeId, {
            subject: input.body.slice(0, 80),
            residentId: input.residentId,
            urgent: input.urgency !== 'routine',
          })
          setActiveConversationId(conversationId)
        }

        const message = await backend.sendMessage({ ...input, conversationId })
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
    [backend, activeHomeId, activeConversationId, refreshSummaries],
  )

  const retry = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  const activeSummary = conversations.find((item) => item.conversationId === activeConversationId) ?? null

  return {
    mode: backend?.mode ?? 'preview',
    status,
    error,
    homes,
    conversations,
    activeConversationId,
    activeHomeId,
    activeSummary,
    messages,
    threadStatus,
    threadError,
    sending,
    sendError,
    selectConversation,
    startConversation,
    sendMessage,
    retry,
  }
}
