import Anthropic from '@anthropic-ai/sdk'

import { config } from '../config.js'
import type { MessageRecord } from '../types.js'

type SemanticCandidate = Pick<
  MessageRecord,
  'id' | 'conversationTitle' | 'senderName' | 'body' | 'sentAt'
>

let anthropicClient: Anthropic | null | undefined

function getClient() {
  if (anthropicClient !== undefined) {
    return anthropicClient
  }

  if (!config.semanticSearchEnabled || !config.anthropicApiKey) {
    anthropicClient = null
    return anthropicClient
  }

  anthropicClient = new Anthropic({
    apiKey: config.anthropicApiKey,
  })

  return anthropicClient
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) {
    return value
  }

  return `${value.slice(0, limit - 1)}...`
}

function extractTextContent(content: Anthropic.Messages.Message['content']) {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

function parseScores(rawText: string) {
  const candidate = rawText.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? rawText

  try {
    const parsed = JSON.parse(candidate) as Array<{ id?: string; score?: number }>
    return parsed
  } catch {
    return null
  }
}

export async function semanticRerankWithClaude(
  query: string,
  candidates: SemanticCandidate[],
): Promise<Map<string, number> | null> {
  if (!config.semanticSearchEnabled || query.trim().length === 0 || candidates.length === 0) {
    return null
  }

  try {
    const client = getClient()

    if (!client) {
      return null
    }

    const response = await client.messages.create({
      model: config.semanticModel,
      max_tokens: 1600,
      temperature: 0,
      system: `You are a semantic reranker for an iMessage-style search engine.
Return JSON only.
Given a search query and candidate messages, score each candidate from 0 to 1 based only on semantic relevance.
0 means unrelated.
1 means the candidate clearly answers or matches the meaning of the query.
You must output exactly one object per candidate, using the same id string as in the input (do not invent or shorten ids).
Do not add commentary.
Return an array of objects with exactly this shape:
[{"id":"candidate-id","score":0.82}]`,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            query,
            candidates: candidates.map((candidate) => ({
              id: candidate.id,
              conversationTitle: candidate.conversationTitle,
              senderName: candidate.senderName,
              sentAt: candidate.sentAt,
              body: truncate(candidate.body, 220),
            })),
          }),
        },
      ],
    })

    const parsed = parseScores(extractTextContent(response.content))

    if (!parsed) {
      return null
    }

    const validIds = new Set(candidates.map((candidate) => candidate.id))
    const scoreMap = new Map<string, number>()

    for (const item of parsed) {
      const id = typeof item.id === 'string' ? item.id.trim() : ''

      if (!id || !validIds.has(id) || typeof item.score !== 'number') {
        continue
      }

      scoreMap.set(id, Math.max(0, Math.min(1, item.score)))
    }

    return scoreMap
  } catch {
    return null
  }
}
