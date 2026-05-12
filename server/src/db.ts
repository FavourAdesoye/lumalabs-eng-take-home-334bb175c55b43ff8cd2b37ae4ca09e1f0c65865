import fs from 'node:fs'
import path from 'node:path'

import Database from 'better-sqlite3'

import { config } from './config.js'
import type { Contact, ConversationOverview, MessageRecord } from './types.js'

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true })

export const db = new Database(config.databasePath)

db.pragma('journal_mode = WAL')

export function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      handle TEXT NOT NULL,
      accent_color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      last_message_at TEXT NOT NULL,
      last_message_preview TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      PRIMARY KEY (conversation_id, contact_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations (id),
      FOREIGN KEY (contact_id) REFERENCES contacts (id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      has_link INTEGER NOT NULL DEFAULT 0,
      has_attachment INTEGER NOT NULL DEFAULT 0,
      embedding TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations (id),
      FOREIGN KEY (sender_id) REFERENCES contacts (id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
      ON messages (conversation_id);

    CREATE INDEX IF NOT EXISTS idx_messages_sender_id
      ON messages (sender_id);

    CREATE INDEX IF NOT EXISTS idx_messages_sent_at
      ON messages (sent_at DESC);
  `)
}

export function getContacts(): Contact[] {
  const statement = db.prepare(`
    SELECT
      id,
      display_name AS displayName,
      handle,
      accent_color AS accentColor
    FROM contacts
    ORDER BY display_name ASC
  `)

  return statement.all() as Contact[]
}

export function getConversations(): ConversationOverview[] {
  const statement = db.prepare(`
    SELECT
      c.id,
      c.title,
      c.kind,
      c.last_message_at AS lastMessageAt,
      c.last_message_preview AS lastMessagePreview,
      COALESCE(
        json_group_array(cp.contact_id)
          FILTER (WHERE cp.contact_id IS NOT NULL),
        json('[]')
      ) AS participantIds
    FROM conversations c
    LEFT JOIN conversation_participants cp
      ON cp.conversation_id = c.id
    GROUP BY c.id
    ORDER BY c.last_message_at DESC
  `)

  return (statement.all() as Array<Omit<ConversationOverview, 'participantIds'> & { participantIds: string }>)
    .map((conversation) => ({
      ...conversation,
      participantIds: JSON.parse(conversation.participantIds),
    }))
}

export function getMessages(filters: {
  conversationId?: string
  senderId?: string
  hasLink?: boolean
  dateFrom?: string
  dateTo?: string
}): MessageRecord[] {
  const conditions: string[] = []
  const values: Array<string | number> = []

  if (filters.conversationId) {
    conditions.push('m.conversation_id = ?')
    values.push(filters.conversationId)
  }

  if (filters.senderId) {
    conditions.push('m.sender_id = ?')
    values.push(filters.senderId)
  }

  if (filters.hasLink) {
    conditions.push('m.has_link = 1')
  }

  if (filters.dateFrom) {
    conditions.push('m.sent_at >= ?')
    values.push(filters.dateFrom)
  }

  if (filters.dateTo) {
    conditions.push('m.sent_at <= ?')
    values.push(filters.dateTo)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const statement = db.prepare(`
    SELECT
      m.id,
      m.conversation_id AS conversationId,
      c.title AS conversationTitle,
      m.sender_id AS senderId,
      ct.display_name AS senderName,
      m.body,
      m.sent_at AS sentAt,
      m.has_link AS hasLink,
      m.has_attachment AS hasAttachment,
      m.embedding
    FROM messages m
    INNER JOIN conversations c
      ON c.id = m.conversation_id
    INNER JOIN contacts ct
      ON ct.id = m.sender_id
    ${whereClause}
    ORDER BY m.sent_at DESC
  `)

  return (statement.all(...values) as Array<Omit<MessageRecord, 'embedding' | 'hasLink' | 'hasAttachment'> & {
    embedding: string | null
    hasLink: number
    hasAttachment: number
  }>).map((message) => ({
    ...message,
    hasLink: Boolean(message.hasLink),
    hasAttachment: Boolean(message.hasAttachment),
    embedding: message.embedding ? JSON.parse(message.embedding) : null,
  }))
}
