import crypto from 'node:crypto'
import { performance } from 'node:perf_hooks'

import { getMessages } from '../db.js'
import type {
  MessageRecord,
  RerankStatusResponse,
  SearchFilters,
  SearchReason,
  SearchResponse,
  SearchResult,
} from '../types.js'
import { semanticRerankWithClaude } from './embedding.js'

const DEFAULT_LIMIT = 18
const RERANK_WINDOW = 40
/** Top lexical hits included in the Claude batch (rest of window is zero-lexical rescue). */
const LEXICAL_SLOTS_IN_RERANK_POOL = 20
const SEMANTIC_THRESHOLD = 0.33
const CACHE_TTL_MS = 1000 * 60 * 10

interface RankedCandidate {
  message: MessageRecord
  lexicalScore: number
  semanticScore: number | null
  score: number
  reasons: SearchReason[]
}

interface SemanticCacheEntry {
  status: 'pending' | 'ready' | 'failed'
  updatedAt: number
  result?: SearchResponse
  promise?: Promise<void>
}

const semanticCache = new Map<string, SemanticCacheEntry>()

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
  let lexicalOnly = 0

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
    lexicalOnly += 12
    reasons.push({
      label: 'Exact phrase',
      detail: 'The full query appears directly in the message.',
    })
  }

  const matchedTokens = tokens.filter((token) => normalizedBody.includes(token))

  if (matchedTokens.length > 0) {
    lexicalOnly += matchedTokens.length * 3
    reasons.push({
      label: 'Keyword match',
      detail: `Matched ${matchedTokens.length} query term${matchedTokens.length > 1 ? 's' : ''} in the message body.`,
    })
  }

  if (normalizedSender.includes(normalizedQuery)) {
    lexicalOnly += 5
    reasons.push({
      label: 'Sender match',
      detail: 'The query matches the sender name.',
    })
  }

  if (normalizedConversation.includes(normalizedQuery)) {
    lexicalOnly += 4
    reasons.push({
      label: 'Conversation match',
      detail: 'The query matches the conversation title.',
    })
  }

  if (message.hasLink && (normalizedQuery.includes('link') || normalizedQuery.includes('article'))) {
    lexicalOnly += 2
    reasons.push({
      label: 'Link-aware',
      detail: 'This message includes a link and matches a link-oriented query.',
    })
  }

  const recency = recencyBoost(message.sentAt)
  const score = lexicalOnly + recency

  reasons.push({
    label: 'Recency',
    detail: 'More recent messages get a small ranking boost.',
  })

  return {
    message,
    lexicalScore: lexicalOnly,
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

function cloneCandidate(candidate: RankedCandidate): RankedCandidate {
  return {
    ...candidate,
    reasons: candidate.reasons.map((reason) => ({ ...reason })),
  }
}

function byRecencyNewestFirst(left: RankedCandidate, right: RankedCandidate) {
  return (
    new Date(right.message.sentAt).getTime() - new Date(left.message.sentAt).getTime()
  )
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
  semanticPending: boolean,
  results: SearchResult[],
  rerankKey?: string,
): SearchResponse {
  return {
    query,
    semanticEnabled,
    semanticFallback: false,
    semanticPending,
    queryTimeMs: Number((performance.now() - startedAt).toFixed(1)),
    rerankKey,
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

function buildRerankKey(query: string, filters: SearchFilters, rerankPool: RankedCandidate[]) {
  return crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        query: normalize(query),
        filters,
        candidates: rerankPool.map((candidate) => candidate.message.id),
      }),
    )
    .digest('hex')
}

function cleanupCache() {
  const cutoff = Date.now() - CACHE_TTL_MS

  for (const [key, entry] of semanticCache.entries()) {
    if (entry.updatedAt < cutoff) {
      semanticCache.delete(key)
    }
  }
}

function buildLexicalResults(candidates: RankedCandidate[], limit: number) {
  return candidates.slice(0, limit).map(finalizeResult)
}

function applySemanticScores(candidates: RankedCandidate[], semanticScores: Map<string, number>) {
  let semanticEnabled = false

  for (const candidate of candidates) {
    const similarity = semanticScores.get(candidate.message.id)

    if (similarity === undefined) {
      continue
    }

    candidate.semanticScore = similarity

    if (similarity >= SEMANTIC_THRESHOLD) {
      semanticEnabled = true
      candidate.score += similarity * 8
      candidate.reasons.push({
        label: 'Semantic similarity',
        detail: 'Claude judged this message meaningfully related even though the wording differs.',
      })
    }
  }

  const claudeReturnedAnyScore = candidates.some(
    (candidate) => candidate.semanticScore !== null,
  )

  return semanticEnabled || claudeReturnedAnyScore
}

function queueBackgroundRerank(
  rerankKey: string,
  query: string,
  filters: SearchFilters,
  rankedCandidates: RankedCandidate[],
  rerankPool: RankedCandidate[],
  limit: number,
) {
  const existing = semanticCache.get(rerankKey)

  if (existing?.status === 'pending') {
    return
  }

  const startedAt = performance.now()
  const entry: SemanticCacheEntry = {
    status: 'pending',
    updatedAt: Date.now(),
  }

  entry.promise = (async () => {
    const semanticScores = await semanticRerankWithClaude(
      query,
      rerankPool.map(({ message }) => message),
    )

    if (!semanticScores) {
      semanticCache.set(rerankKey, {
        status: 'failed',
        updatedAt: Date.now(),
      })
      return
    }

    const candidates = rankedCandidates.map(cloneCandidate)
    const semanticEnabled = applySemanticScores(candidates, semanticScores)
    const results = candidates
      .filter(
        (candidate) =>
          candidate.lexicalScore > 0 || (candidate.semanticScore ?? 0) >= SEMANTIC_THRESHOLD,
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(finalizeResult)

    semanticCache.set(rerankKey, {
      status: 'ready',
      updatedAt: Date.now(),
      result: buildResponse(query, filters, startedAt, semanticEnabled, false, results, rerankKey),
    })
  })().catch(() => {
    semanticCache.set(rerankKey, {
      status: 'failed',
      updatedAt: Date.now(),
    })
  })

  semanticCache.set(rerankKey, entry)
}

export function getRerankStatus(rerankKey: string): RerankStatusResponse {
  cleanupCache()

  const entry = semanticCache.get(rerankKey)

  if (!entry) {
    return {
      status: 'failed',
      rerankKey,
    }
  }

  if (entry.status === 'ready' && entry.result) {
    return {
      status: 'ready',
      rerankKey,
      result: entry.result,
    }
  }

  return {
    status: entry.status,
    rerankKey,
  }
}

export function searchMessages(query: string, filters: SearchFilters): SearchResponse {
  cleanupCache()

  const startedAt = performance.now()
  const messages = getMessages(filters)
  const normalizedQuery = normalize(query)
  const tokens = tokenize(query)
  const limit = Math.max(1, Math.min(filters.limit ?? DEFAULT_LIMIT, 50))

  if (messages.length === 0) {
    return buildResponse(query, filters, startedAt, false, false, [])
  }

  const allRanked = messages.map((message) => lexicalRank(message, query, tokens))

  const lexicalCandidates = allRanked
    .filter((candidate) => normalizedQuery.length === 0 || candidate.lexicalScore > 0)
    .sort((left, right) => right.score - left.score)

  if (normalizedQuery.length === 0) {
    return buildResponse(
      query,
      filters,
      startedAt,
      false,
      false,
      buildLexicalResults(lexicalCandidates, limit),
    )
  }

  let rerankPool: RankedCandidate[]
  let mergeCandidates: RankedCandidate[]

  if (lexicalCandidates.length > 0) {
    const lexicalInPool = Math.min(
      lexicalCandidates.length,
      LEXICAL_SLOTS_IN_RERANK_POOL,
      RERANK_WINDOW,
    )
    const zeroSlots = Math.max(0, RERANK_WINDOW - lexicalInPool)
    const lexicalPart = lexicalCandidates.slice(0, lexicalInPool).map(cloneCandidate)
    const lexicalPartIds = new Set(lexicalPart.map((c) => c.message.id))

    const zeroLexicalPool = allRanked
      .filter((c) => c.lexicalScore === 0 && !lexicalPartIds.has(c.message.id))
      .sort(byRecencyNewestFirst)
      .slice(0, zeroSlots)
      .map(cloneCandidate)

    rerankPool = [...lexicalPart, ...zeroLexicalPool]

    mergeCandidates = [...lexicalCandidates, ...zeroLexicalPool]
  } else {
    rerankPool = allRanked
      .filter((c) => c.lexicalScore === 0)
      .sort(byRecencyNewestFirst)
      .slice(0, RERANK_WINDOW)
      .map((candidate) => {
        const cloned = cloneCandidate(candidate)
        cloned.reasons = [
          {
            label: 'Semantic candidate',
            detail:
              'No strong lexical hits were found, so this message was considered by semantic reranking.',
          },
          ...cloned.reasons,
        ]
        return cloned
      })

    mergeCandidates = rerankPool.map(cloneCandidate)
  }

  const rerankKey = buildRerankKey(query, filters, rerankPool)
  const cached = semanticCache.get(rerankKey)

  if (cached?.status === 'ready' && cached.result) {
    return buildResponse(
      query,
      filters,
      startedAt,
      cached.result.semanticEnabled,
      false,
      cached.result.results,
      rerankKey,
    )
  }

  if (cached?.status !== 'pending') {
    queueBackgroundRerank(rerankKey, query, filters, mergeCandidates, rerankPool, limit)
  }

  return buildResponse(
    query,
    filters,
    startedAt,
    false,
    true,
    buildLexicalResults(lexicalCandidates, limit),
    rerankKey,
  )
}
