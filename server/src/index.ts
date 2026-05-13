import fs from 'node:fs'
import path from 'node:path'

import cors from 'cors'
import express from 'express'

import { config } from './config.js'
import { ensureSchema, getContacts, getConversations } from './db.js'
import { getRerankStatus, searchMessages } from './lib/search.js'

function readBooleanFlag(value: unknown) {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return undefined
}

function readLimit(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function readDateStart(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined
  }

  return `${value}T00:00:00.000Z`
}

function readDateEnd(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined
  }

  return `${value}T23:59:59.999Z`
}

function readSearchFilters(
  query: express.Request['query'],
  conversationId?: string,
) {
  return {
    conversationId,
    senderId: typeof query.senderId === 'string' ? query.senderId : undefined,
    hasLink: readBooleanFlag(query.hasLink),
    dateFrom: readDateStart(query.dateFrom),
    dateTo: readDateEnd(query.dateTo),
    limit: readLimit(query.limit),
  }
}

ensureSchema()

const app = express()
const clientDistIndex = path.join(config.clientDistDir, 'index.html')

app.use(
  cors({
    origin: config.clientOrigin,
  }),
)
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    semanticSearchEnabled: config.semanticSearchEnabled,
  })
})

app.get('/api/overview', (_request, response) => {
  response.json({
    contacts: getContacts(),
    conversations: getConversations(),
  })
})

app.get('/api/search', async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q : ''
  const results = searchMessages(
    query,
    readSearchFilters(
      request.query,
      typeof request.query.conversationId === 'string' ? request.query.conversationId : undefined,
    ),
  )

  response.json(results)
})

app.get('/api/conversations/:conversationId/search', async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q : ''
  const results = searchMessages(query, readSearchFilters(request.query, request.params.conversationId))

  response.json(results)
})

app.get('/api/search/rerank/:rerankKey', (request, response) => {
  const result = getRerankStatus(request.params.rerankKey)

  response.json(result)
})

if (fs.existsSync(clientDistIndex)) {
  app.use(express.static(config.clientDistDir))

  app.use((request, response, next) => {
    if (request.path.startsWith('/api')) {
      next()
      return
    }

    response.sendFile(clientDistIndex)
  })
}

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${config.port}`)
  console.log(`Using SQLite corpus at ${config.databasePath}`)
})
