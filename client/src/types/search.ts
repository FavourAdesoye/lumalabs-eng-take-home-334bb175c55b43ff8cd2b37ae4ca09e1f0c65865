export interface Contact {
  id: string
  displayName: string
  handle: string
  accentColor: string
}

export interface ConversationOverview {
  id: string
  title: string
  kind: 'direct' | 'group'
  participantIds: string[]
  lastMessageAt: string
  lastMessagePreview: string
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

export interface OverviewResponse {
  contacts: Contact[]
  conversations: ConversationOverview[]
}

export interface SearchResponse {
  query: string
  semanticEnabled: boolean
  semanticFallback: boolean
  semanticPending: boolean
  queryTimeMs: number
  rerankKey?: string
  scope: {
    conversationId?: string
    senderId?: string
    hasLink?: boolean
    dateFrom?: string
    dateTo?: string
  }
  results: SearchResult[]
}

export interface RerankStatusResponse {
  status: 'pending' | 'ready' | 'failed'
  rerankKey: string
  result?: SearchResponse
}
