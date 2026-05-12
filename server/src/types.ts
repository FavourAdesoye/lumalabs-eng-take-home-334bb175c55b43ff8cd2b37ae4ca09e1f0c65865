export type ConversationKind = 'direct' | 'group'

export interface Contact {
  id: string
  displayName: string
  handle: string
  accentColor: string
}

export interface ConversationOverview {
  id: string
  title: string
  kind: ConversationKind
  participantIds: string[]
  lastMessageAt: string
  lastMessagePreview: string
}

export interface MessageRecord {
  id: string
  conversationId: string
  conversationTitle: string
  senderId: string
  senderName: string
  body: string
  sentAt: string
  hasLink: boolean
  hasAttachment: boolean
  embedding: number[] | null
}

export interface SearchFilters {
  senderId?: string
  conversationId?: string
  hasLink?: boolean
  dateFrom?: string
  dateTo?: string
  limit?: number
}

export interface SearchReason {
  label: string
  detail: string
}

export interface SearchResult {
  id: string
  conversationId: string
  conversationTitle: string
  senderId: string
  senderName: string
  body: string
  sentAt: string
  hasLink: boolean
  hasAttachment: boolean
  score: number
  lexicalScore: number
  semanticScore: number | null
  reasons: SearchReason[]
}

export interface SearchResponse {
  query: string
  semanticEnabled: boolean
  semanticFallback: boolean
  queryTimeMs: number
  scope: {
    conversationId?: string
    senderId?: string
    hasLink?: boolean
    dateFrom?: string
    dateTo?: string
  }
  results: SearchResult[]
}

export interface OverviewResponse {
  contacts: Contact[]
  conversations: ConversationOverview[]
}
