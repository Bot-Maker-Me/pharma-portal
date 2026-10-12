'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createChatBackend } from './backend'
import type {
  AuthorizedHome,
  ChatBackend,
  ChatMessage,
  ConversationRead,
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
  activeHomeId: string | null
  activeConversationId: string | null
  activeSummary: ConversationSummary | null
  messages: ChatMessage[]
  reads: ConversationRead[]
  threadStatus: ThreadStatus
  threadError: string | null
  sending: boolean
  sendError: string | null
  selfUserId: string | null
  selectHome: (homeId: string) => void
  sendMessage: (input: Omit<SendMessageInput, 'conversationId'>) => Promise<boolean>
  retry: () => void
}

const fallbackMessage = 'Something went wrong. Please try again.'

/**
 * Owns all chat state: the conversation list, the active thread, realtime
 * updates and optimistic sends. Backend-agnostic — it works against Supabase or
 * the preview data set without the components knowing the difference.
 */
export function useChatData(): ChatController {
  const [backend, setBackend] = useState<ChatBackend | null>(null)

  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [selfUserId, setSelfUserId] = useState<string | null>(null)
  const [homes, setHomes] = useState<AuthorizedHome[]>([])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeHomeId, setActiveHomeId] = useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reads, setReads] = useState<ConversationRead[]>([])
  const [threadStatus, setThreadStatus] = useState<ThreadStatus>('idle')
  const [threadError, setThreadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const activeConversationRef = useRef<string | null>(null)
  const selfIdRef = useRef<string | null>(null)

  useEffect(() => {
    activeConversationRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    selfIdRef.current = selfUserId
  }, [selfUserId])

  // Kept in a ref so the conversation-resolution effect does not re-run every
  // time the summaries refresh (which would re-trigger ensureConversation).
  const conversationsRef = useRef<ConversationSummary[]>([])
  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

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

  // Initial load of authorized homes + conversation summaries.
  useEffect(() => {
    if (!backend) return
    let cancelled = false
    setStatus('loading')
    setError(null)

    backend
      .load()
      .then((snapshot) => {
        if (cancelled) return
        setSelfUserId(snapshot.selfUserId)
        setHomes(snapshot.homes)
        setConversations(snapshot.conversations)
        setStatus('ready')
        setActiveHomeId((current) => {
          if (current) return current
          return snapshot.conversations[0]?.homeId ?? snapshot.homes[0]?.id ?? null
        })
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

  // Resolve the conversation for the selected home, creating one if needed.
  useEffect(() => {
    if (!backend || !activeHomeId) return
    let cancelled = false

    const existing = conversationsRef.current.find((conversation) => conversation.homeId === activeHomeId)
    if (existing) {
      setActiveConversationId(existing.conversationId)
      return
    }

    setActiveConversationId(null)
    backend
      .ensureConversation(activeHomeId)
      .then((conversationId) => {
        if (cancelled) return
        setActiveConversationId(conversationId)
        void refreshSummaries()
      })
      .catch((ensureError: unknown) => {
        if (cancelled) return
        setThreadError(ensureError instanceof Error ? ensureError.message : fallbackMessage)
        setThreadStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [backend, activeHomeId, refreshSummaries])

  // Load the active thread and mark it read.
  useEffect(() => {
    if (!backend || !activeConversationId) return
    let cancelled = false
    setThreadStatus('loading')
    setThreadError(null)

    Promise.all([backend.loadMessages(activeConversationId), backend.loadReads(activeConversationId)])
      .then(([thread, threadReads]) => {
        if (cancelled) return
        setMessages(thread)
        setReads(threadReads)
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
          if (message.senderId !== selfIdRef.current) {
            void backend.markRead(message.conversationId).then(scheduleRefresh).catch(() => undefined)
          }
        }
        scheduleRefresh()
      },
      onConversationChange: () => {
        scheduleRefresh()
      },
      onReadChange: (read) => {
        if (read.conversationId !== activeConversationRef.current) return
        setReads((current) => [...current.filter((item) => item.userId !== read.userId), read])
      },
    })
  }, [backend, refreshSummaries, scheduleRefresh])

  const selectHome = useCallback((homeId: string) => {
    setActiveHomeId(homeId)
  }, [])

  const sendMessage = useCallback(
    async (input: Omit<SendMessageInput, 'conversationId'>): Promise<boolean> => {
      if (!backend || !activeConversationId) return false
      setSending(true)
      setSendError(null)
      try {
        const message = await backend.sendMessage({ ...input, conversationId: activeConversationId })
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
    [backend, activeConversationId, refreshSummaries],
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
    activeHomeId,
    activeConversationId,
    activeSummary,
    messages,
    reads,
    threadStatus,
    threadError,
    sending,
    sendError,
    selfUserId,
    selectHome,
    sendMessage,
    retry,
  }
}
