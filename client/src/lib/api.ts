import type { OverviewResponse, RerankStatusResponse, SearchResponse } from '../types/search'

export async function fetchOverview() {
  const response = await fetch('/api/overview')

  if (!response.ok) {
    throw new Error('Failed to load conversations.')
  }

  return (await response.json()) as OverviewResponse
}

export async function fetchSearch(params: {
  query: string
  conversationId?: string
  senderId?: string
  hasLink?: boolean
  dateFrom?: string
  dateTo?: string
}) {
  const searchParams = new URLSearchParams()

  if (params.query) {
    searchParams.set('q', params.query)
  }

  if (params.senderId) {
    searchParams.set('senderId', params.senderId)
  }

  if (params.hasLink) {
    searchParams.set('hasLink', 'true')
  }

  if (params.dateFrom) {
    searchParams.set('dateFrom', params.dateFrom)
  }

  if (params.dateTo) {
    searchParams.set('dateTo', params.dateTo)
  }

  const endpoint = params.conversationId
    ? `/api/conversations/${params.conversationId}/search`
    : '/api/search'
  const url = `${endpoint}?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Search failed.')
  }

  return (await response.json()) as SearchResponse
}

export async function fetchRerankStatus(rerankKey: string) {
  const response = await fetch(`/api/search/rerank/${rerankKey}`)

  if (!response.ok) {
    throw new Error('Failed to load reranked results.')
  }

  return (await response.json()) as RerankStatusResponse
}
