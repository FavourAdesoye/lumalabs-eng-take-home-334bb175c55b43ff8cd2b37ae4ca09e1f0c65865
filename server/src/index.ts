import fs from 'node:fs'
import path from 'node:path'

import cors from 'cors'
import express from 'express'

import { config } from './config.js'
import { ensureSchema, getContacts, getConversations } from './db.js'
import { searchMessages } from './lib/search.js'

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

  const results = await searchMessages(query, {
    senderId: typeof request.query.senderId === 'string' ? request.query.senderId : undefined,
    conversationId:
      typeof request.query.conversationId === 'string' ? request.query.conversationId : undefined,
    hasLink: readBooleanFlag(request.query.hasLink),
    dateFrom: readDateStart(request.query.dateFrom),
    dateTo: readDateEnd(request.query.dateTo),
    limit: readLimit(request.query.limit),
  })

  response.json(results)
})

app.get('/api/conversations/:conversationId/search', async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q : ''

  const results = await searchMessages(query, {
    conversationId: request.params.conversationId,
    senderId: typeof request.query.senderId === 'string' ? request.query.senderId : undefined,
    hasLink: readBooleanFlag(request.query.hasLink),
    dateFrom: readDateStart(request.query.dateFrom),
    dateTo: readDateEnd(request.query.dateTo),
    limit: readLimit(request.query.limit),
  })

  response.json(results)
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

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`)
  console.log(`Using SQLite corpus at ${config.databasePath}`)
})
