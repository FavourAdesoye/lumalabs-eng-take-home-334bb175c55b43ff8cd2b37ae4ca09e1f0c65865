import { performance } from 'node:perf_hooks'

import { getMessages } from '../db.js'
import type { MessageRecord, SearchFilters, SearchReason, SearchResponse, SearchResult } from '../types.js'
import { cosineSimilarity, embedTexts } from './embedding.js'

const DEFAULT_LIMIT = 18
const RERANK_WINDOW = 40
const SEMANTIC_THRESHOLD = 0.33

interface RankedCandidate {
  message: MessageRecord
  lexicalScore: number
  semanticScore: number | null
  score: number
  reasons: SearchReason[]
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenize(value: string) {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 1)
}

function lexicalRank(message: MessageRecord, query: string, tokens: string[]): RankedCandidate {
  const normalizedQuery = normalize(query)
  const normalizedBody = normalize(message.body)
  const normalizedSender = normalize(message.senderName)
  const normalizedConversation = normalize(message.conversationTitle)
  const reasons: SearchReason[] = []
  let score = 0

  if (!normalizedQuery) {
    reasons.push({
      label: 'Recent',
      detail: 'Showing recent messages while the query is empty.',
    })

    return {
      message,
      lexicalScore: 0,
      semanticScore: null,
      score: recencyBoost(message.sentAt),
      reasons,
    }
  }

  if (normalizedBody.includes(normalizedQuery)) {
    score += 12
    reasons.push({
      label: 'Exact phrase',
      detail: 'The full query appears directly in the message.',
    })
  }

  const matchedTokens = tokens.filter((token) => normalizedBody.includes(token))

  if (matchedTokens.length > 0) {
    score += matchedTokens.length * 3
    reasons.push({
      label: 'Keyword match',
      detail: `Matched ${matchedTokens.length} query term${matchedTokens.length > 1 ? 's' : ''} in the message body.`,
    })
  }

  if (normalizedSender.includes(normalizedQuery)) {
    score += 5
    reasons.push({
      label: 'Sender match',
      detail: 'The query matches the sender name.',
    })
  }

  if (normalizedConversation.includes(normalizedQuery)) {
    score += 4
    reasons.push({
      label: 'Conversation match',
      detail: 'The query matches the conversation title.',
    })
  }

  if (message.hasLink && (normalizedQuery.includes('link') || normalizedQuery.includes('article'))) {
    score += 2
    reasons.push({
      label: 'Link-aware',
      detail: 'This message includes a link and matches a link-oriented query.',
    })
  }

  score += recencyBoost(message.sentAt)

  if (score > 0) {
    reasons.push({
      label: 'Recency',
      detail: 'More recent messages get a small ranking boost.',
    })
  }

  return {
    message,
    lexicalScore: score,
    semanticScore: null,
    score,
    reasons,
  }
}

function recencyBoost(sentAt: string) {
  const ageInDays = Math.max(
    0,
    (Date.now() - new Date(sentAt).getTime()) / (1000 * 60 * 60 * 24),
  )

  if (ageInDays <= 2) {
    return 2.5
  }

  if (ageInDays <= 7) {
    return 1.5
  }

  if (ageInDays <= 30) {
    return 0.75
  }

  return 0.25
}

function finalizeResult(candidate: RankedCandidate): SearchResult {
  return {
    id: candidate.message.id,
    conversationId: candidate.message.conversationId,
    conversationTitle: candidate.message.conversationTitle,
    senderId: candidate.message.senderId,
    senderName: candidate.message.senderName,
    body: candidate.message.body,
    sentAt: candidate.message.sentAt,
    hasLink: candidate.message.hasLink,
    hasAttachment: candidate.message.hasAttachment,
    score: Number(candidate.score.toFixed(3)),
    lexicalScore: Number(candidate.lexicalScore.toFixed(3)),
    semanticScore:
      candidate.semanticScore === null ? null : Number(candidate.semanticScore.toFixed(3)),
    reasons: candidate.reasons,
  }
}

function buildResponse(
  query: string,
  filters: SearchFilters,
  startedAt: number,
  semanticEnabled: boolean,
  semanticFallback: boolean,
  results: SearchResult[],
): SearchResponse {
  return {
    query,
    semanticEnabled,
    semanticFallback,
    queryTimeMs: Number((performance.now() - startedAt).toFixed(1)),
    scope: {
      conversationId: filters.conversationId,
      senderId: filters.senderId,
      hasLink: filters.hasLink,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    },
    results,
  }
}

export async function searchMessages(
  query: string,
  filters: SearchFilters,
): Promise<SearchResponse> {
  const startedAt = performance.now()
  const messages = getMessages(filters)
  const normalizedQuery = normalize(query)
  const tokens = tokenize(query)
  const limit = Math.max(1, Math.min(filters.limit ?? DEFAULT_LIMIT, 50))

  if (messages.length === 0) {
    return buildResponse(query, filters, startedAt, false, false, [])
  }

  const lexicalCandidates = messages
    .map((message) => lexicalRank(message, query, tokens))
    .filter((candidate) => normalizedQuery.length === 0 || candidate.lexicalScore > 0)
    .sort((left, right) => right.score - left.score)

  if (normalizedQuery.length === 0) {
    return buildResponse(
      query,
      filters,
      startedAt,
      false,
      false,
      lexicalCandidates.slice(0, limit).map(finalizeResult),
    )
  }

  const rerankPool =
    lexicalCandidates.length > 0
      ? lexicalCandidates.slice(0, RERANK_WINDOW)
      : messages.map((message) => ({
          message,
          lexicalScore: 0,
          semanticScore: null,
          score: recencyBoost(message.sentAt),
          reasons: [
            {
              label: 'Semantic fallback',
              detail: 'No strong lexical hits were found, so the app is checking similar messages.',
            },
          ],
        }))

  let semanticEnabled = false
  let semanticFallback = false

  if (tokens.length > 0) {
    const queryEmbedding = await embedTexts([query])
    const hasCandidateEmbeddings = rerankPool.some((candidate) => candidate.message.embedding)

    if (queryEmbedding?.[0] && hasCandidateEmbeddings) {
      const vector = queryEmbedding[0]

      for (const candidate of rerankPool) {
        if (!candidate.message.embedding) {
          continue
        }

        const similarity = cosineSimilarity(vector, candidate.message.embedding)

        if (similarity >= SEMANTIC_THRESHOLD) {
          semanticEnabled = true
          candidate.semanticScore = similarity
          candidate.score += similarity * 8
          candidate.reasons.push({
            label: 'Semantic similarity',
            detail: 'The message meaning is close to the query even if the wording differs.',
          })
        }
      }
    } else {
      semanticFallback = true
    }
  }

  const results = rerankPool
    .filter((candidate) => candidate.lexicalScore > 0 || (candidate.semanticScore ?? 0) >= SEMANTIC_THRESHOLD)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(finalizeResult)

  return buildResponse(
    query,
    filters,
    startedAt,
    semanticEnabled,
    semanticFallback,
    results,
  )
}
