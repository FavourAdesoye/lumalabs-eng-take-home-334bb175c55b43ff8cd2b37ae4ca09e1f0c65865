import { faker } from '@faker-js/faker'

import { db, ensureSchema } from '../db.js'

faker.seed(42)

type ContactSeed = {
  id: string
  displayName: string
  handle: string
  accentColor: string
}

type ConversationSeed = {
  id: string
  title: string
  kind: 'direct' | 'group'
  participantIds: string[]
}

type MessageSeed = {
  id: string
  conversationId: string
  senderId: string
  body: string
  sentAt: string
  hasLink: boolean
  hasAttachment: boolean
}

type FillerDraft = {
  body: string
  hasLink?: boolean
  hasAttachment?: boolean
}

const contacts: ContactSeed[] = [
  { id: 'you', displayName: 'You', handle: '+1 (555) 010-1000', accentColor: '#4F46E5' },
  { id: 'maya', displayName: 'Maya', handle: '+1 (555) 010-1001', accentColor: '#E11D48' },
  { id: 'theo', displayName: 'Theo', handle: '+1 (555) 010-1002', accentColor: '#059669' },
  { id: 'nora', displayName: 'Nora', handle: '+1 (555) 010-1003', accentColor: '#7C3AED' },
  { id: 'jordan', displayName: 'Jordan', handle: '+1 (555) 010-1004', accentColor: '#EA580C' },
  { id: 'mom', displayName: 'Mom', handle: '+1 (555) 010-1005', accentColor: '#DB2777' },
  { id: 'ashley', displayName: 'Ashley', handle: '+1 (555) 010-1006', accentColor: '#0284C7' },
]

const conversations: ConversationSeed[] = [
  { id: 'conv-luma', title: 'Luma Search Build', kind: 'group', participantIds: ['you', 'maya', 'theo'] },
  { id: 'conv-nora', title: 'Nora', kind: 'direct', participantIds: ['you', 'nora'] },
  { id: 'conv-jordan', title: 'Jordan Trip', kind: 'direct', participantIds: ['you', 'jordan'] },
  { id: 'conv-family', title: 'Family', kind: 'group', participantIds: ['you', 'mom'] },
  { id: 'conv-ashley', title: 'Ashley', kind: 'direct', participantIds: ['you', 'ashley'] },
]

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function makeMessage(
  conversationId: string,
  senderId: string,
  body: string,
  hoursBeforeNow: number,
  extra?: Partial<Pick<MessageSeed, 'hasLink' | 'hasAttachment'>>,
): MessageSeed {
  return {
    id: faker.string.uuid(),
    conversationId,
    senderId,
    body,
    sentAt: hoursAgo(hoursBeforeNow),
    hasLink: extra?.hasLink ?? /https?:\/\//.test(body),
    hasAttachment: extra?.hasAttachment ?? false,
  }
}

function makeMessageAtTime(
  conversationId: string,
  senderId: string,
  body: string,
  sentAt: string,
  extra?: Partial<Pick<MessageSeed, 'hasLink' | 'hasAttachment'>>,
): MessageSeed {
  return {
    id: faker.string.uuid(),
    conversationId,
    senderId,
    body,
    sentAt,
    hasLink: extra?.hasLink ?? /https?:\/\//.test(body),
    hasAttachment: extra?.hasAttachment ?? false,
  }
}

function curatedMessages() {
  return [
    makeMessage('conv-luma', 'maya', 'Can we make search explain why a result ranked highly instead of feeling random?', 72),
    makeMessage('conv-luma', 'you', 'Yes, lexical retrieval first and semantic reranking second. That keeps relevance grounded.', 70),
    makeMessage('conv-luma', 'theo', 'I like the thread-level search idea too. iMessage still makes me search globally for everything.', 68),
    makeMessage('conv-luma', 'maya', 'I added notes about highlighting the matched text and showing conversation context in the result card.', 52),
    makeMessage('conv-luma', 'you', 'Let us keep the semantic rerank small. Top 40 lexical candidates should be enough.', 49),
    makeMessage('conv-luma', 'theo', 'Render should be easier than forcing this through serverless + sqlite workarounds.', 42),
    makeMessage('conv-nora', 'nora', 'wifi password is still aurora-house-24 if you are coming by tonight', 130),
    makeMessage('conv-nora', 'you', 'Perfect, I forgot whether it was the old router or the new one.', 128),
    makeMessage('conv-nora', 'nora', 'I left the parking note under the plant by the front door.', 120),
    makeMessage('conv-jordan', 'jordan', 'I dropped the boarding pass and hotel confirmation in the shared note.', 96),
    makeMessage('conv-jordan', 'you', 'Amazing. I kept searching for flight details and could not remember what you called it.', 92),
    makeMessage('conv-jordan', 'jordan', 'Also, the airport shuttle picks us up at 5:40 a.m. sharp.', 89),
    makeMessage('conv-jordan', 'jordan', 'Here is the guide for the Kyoto neighborhood we talked about: https://example.com/kyoto-guide', 86, { hasLink: true }),
    makeMessage('conv-family', 'mom', 'Can you resend the banana bread recipe to auntie? She misplaced it again.', 144),
    makeMessage('conv-family', 'you', 'I saved the recipe card as a PDF, I will send it tonight.', 142, { hasAttachment: true }),
    makeMessage('conv-family', 'mom', 'Thanks. Also the pediatrician moved grandma’s appointment to Thursday at 11.', 138),
    makeMessage('conv-ashley', 'ashley', 'The ramen spot on 4th is still the move if you want dinner after work.', 62),
    makeMessage('conv-ashley', 'you', 'Yes please. I remembered noodles but not the actual place.', 58),
    makeMessage('conv-ashley', 'ashley', 'If that line is bad, we can do the tiny yakitori place next door.', 56),
  ]
}

function randomTimestampInLastTwoYears() {
  return faker.date
    .between({
      from: faker.date.past({ years: 2 }),
      to: new Date(),
    })
    .toISOString()
}

function pick<T>(values: T[]) {
  return faker.helpers.arrayElement(values)
}

function buildLumaDraft(): FillerDraft {
  const theme = pick(['relevance', 'filters', 'thread', 'infra', 'demo'])

  switch (theme) {
    case 'relevance':
      return {
        body: `I tried searching for "${pick(['travel papers', 'banana bread recipe', 'ramen place', 'wifi password'])}" and the ranking felt ${pick(['much more believable', 'a lot sharper', 'finally understandable'])} after the latest tweak.`,
      }
    case 'filters':
      return {
        body: `${pick(['Date filters', 'Sender filters', 'Thread-only search'])} should be visible without another tap. That is the fastest way to make this feel better than iMessage.`,
      }
    case 'thread':
      return {
        body: `The best demo is still finding ${pick(['the exact parking note', 'the hotel confirmation', 'the link Ashley sent'])} inside one conversation instead of scanning the whole inbox.`,
      }
    case 'infra':
      return {
        body: `I dropped the deployment notes here: https://example.com/${pick(['render-checklist', 'sqlite-notes', 'review-setup'])}`,
        hasLink: true,
      }
    default:
      return {
        body: `For the walkthrough I want one query that shows exact match, one that shows semantic rescue, and one that proves in-thread search is the real quality-of-life win.`,
      }
  }
}

function buildNoraDraft(): FillerDraft {
  const theme = pick(['home', 'errands', 'meals', 'plans', 'nostalgia'])

  switch (theme) {
    case 'home':
      return {
        body: `${pick(['The spare batteries are in the hall closet', 'I moved the extra blankets to the guest room', 'The thermostat is set a little lower tonight'])}, just in case you were looking for them later.`,
      }
    case 'errands':
      return {
        body: `Can you grab ${pick(['oat milk', 'dish soap', 'paper towels', 'lemons'])} if you are stopping by ${pick(['Trader Joe’s', 'Target', 'the corner store'])}?`,
      }
    case 'meals':
      return {
        body: `${pick(['I saved you some pasta', 'There is soup in the fridge', 'I marinated the tofu already'])}, so dinner should be easy when you get back.`,
      }
    case 'plans':
      return {
        body: `Still good for ${pick(['movie night on Friday', 'walking to the farmer’s market tomorrow', 'coffee before your haircut'])}?`,
      }
    default:
      return {
        body: `${pick(['I found the old polaroids from that snow day', 'That tiny blue mug reminded me of your first apartment', 'I still laugh about the plant we swore we could keep alive'])}.`,
        hasAttachment: faker.datatype.boolean({ probability: 0.2 }),
      }
  }
}

function buildJordanDraft(): FillerDraft {
  const theme = pick(['travel', 'lodging', 'food', 'logistics', 'packing'])

  switch (theme) {
    case 'travel':
      return {
        body: `I moved our ${pick(['train tickets', 'boarding docs', 'museum reservations'])} into the shared folder so they are easier to find this time.`,
      }
    case 'lodging':
      return {
        body: `${pick(['The ryokan check-in starts at 4', 'Hotel breakfast is included after all', 'The apartment host sent a new door code'])}.`,
      }
    case 'food':
      return {
        body: `Saved this for later: https://example.com/${pick(['late-night-ramen', 'tiny-izakaya', 'coffee-map', 'dessert-list'])}`,
        hasLink: true,
      }
    case 'logistics':
      return {
        body: `Can you remind me whether we said ${pick(['carry-on only', 'one checked bag', 'leave for the airport by 4:45'])}? I do not want to guess again.`,
      }
    default:
      return {
        body: `Packing list update: ${pick(['portable charger', 'rain shell', 'comfy shoes', 'adapter'])} is the one thing I know I will forget if I do not write it down.`,
      }
  }
}

function buildFamilyDraft(): FillerDraft {
  const theme = pick(['care', 'scheduling', 'food', 'errands', 'nostalgia'])

  switch (theme) {
    case 'care':
      return {
        body: `${pick(['Grandma said her knee feels a little better today', 'Can you check whether auntie picked up the prescription', 'I left the heating pad by the couch'])}.`,
      }
    case 'scheduling':
      return {
        body: `${pick(['The appointment moved to next Wednesday at 10:30', 'Choir rehearsal starts earlier this week', 'The school meeting is now on Thursday evening'])}.`,
      }
    case 'food':
      return {
        body: `${pick(['I made stew and put some aside for you', 'Do not forget the plantains', 'The banana bread smells so good today', 'I wrote the soup recipe on the back of the grocery list'])}.`,
      }
    case 'errands':
      return {
        body: `If you are already out, can you stop by ${pick(['the pharmacy', 'the tailor', 'the post office', 'Costco'])} for ${pick(['the refill', 'the package slip', 'the photo order', 'paper towels'])}?`,
      }
    default:
      return {
        body: `${pick(['I found the old beach photo album', 'That Sunday song still reminds me of grandma’s kitchen', 'Remember when we used to race to the corner bakery before church'])}.`,
        hasAttachment: faker.datatype.boolean({ probability: 0.24 }),
      }
  }
}

function buildAshleyDraft(): FillerDraft {
  const theme = pick(['dinner', 'plans', 'neighborhood', 'music', 'catchup'])

  switch (theme) {
    case 'dinner':
      return {
        body: `Do you want ${pick(['ramen again', 'tacos instead', 'the wine bar with the tiny patio', 'that new hand-roll place'])} after work this week?`,
      }
    case 'plans':
      return {
        body: `I can do ${pick(['Thursday after 7', 'Friday around 6:30', 'Sunday afternoon'])} if that still works for you.`,
      }
    case 'neighborhood':
      return {
        body: `Someone finally made a decent guide to the neighborhood spots: https://example.com/${pick(['best-noodles', 'late-drinks', 'weekend-brunch', 'cheap-eats'])}`,
        hasLink: true,
      }
    case 'music':
      return {
        body: `${pick(['That Valerie karaoke clip still has me crying', 'I heard our old pregame playlist today', 'You were right about that song sounding better live'])}.`,
      }
    default:
      return {
        body: `${pick(['I still owe you the photo from last weekend', 'Send me the name of that candle place when you get a chance', 'I am ten minutes out, save me a seat near the window'])}.`,
        hasAttachment: faker.datatype.boolean({ probability: 0.18 }),
      }
  }
}

function buildFillerDraft(conversationId: string): FillerDraft {
  switch (conversationId) {
    case 'conv-luma':
      return buildLumaDraft()
    case 'conv-nora':
      return buildNoraDraft()
    case 'conv-jordan':
      return buildJordanDraft()
    case 'conv-family':
      return buildFamilyDraft()
    case 'conv-ashley':
      return buildAshleyDraft()
    default:
      return { body: faker.lorem.sentence() }
  }
}

function fillerMessages(curated: MessageSeed[]) {
  const generated: MessageSeed[] = []

  for (const conversation of conversations) {
    const usedBodies = new Set(
      curated
        .filter((message) => message.conversationId === conversation.id)
        .map((message) => message.body),
    )
    const fillerCount = faker.number.int({ min: 23, max: 25 })
    let stallBudget = fillerCount * 150

    for (let index = 0; index < fillerCount; index += 1) {
      if (stallBudget-- <= 0) {
        break
      }

      let draft = buildFillerDraft(conversation.id)
      let attempts = 0

      while (usedBodies.has(draft.body) && attempts < 12) {
        draft = buildFillerDraft(conversation.id)
        attempts += 1
      }

      if (usedBodies.has(draft.body)) {
        index -= 1
        continue
      }

      usedBodies.add(draft.body)
      const senderId = pick(conversation.participantIds)
      generated.push(
        makeMessageAtTime(conversation.id, senderId, draft.body, randomTimestampInLastTwoYears(), {
          hasLink: draft.hasLink,
          hasAttachment: draft.hasAttachment ?? faker.datatype.boolean({ probability: 0.12 }),
        }),
      )
    }
  }

  return generated
}

async function seed() {
  ensureSchema()

  const curated = curatedMessages()
  const messages = [...curated, ...fillerMessages(curated)].sort((left, right) =>
    left.sentAt.localeCompare(right.sentAt),
  )

  const conversationSummaries = conversations.map((conversation) => {
    const conversationMessages = messages
      .filter((message) => message.conversationId === conversation.id)
      .sort((left, right) => right.sentAt.localeCompare(left.sentAt))
    const latest = conversationMessages[0]

    return {
      ...conversation,
      lastMessageAt: latest?.sentAt ?? new Date().toISOString(),
      lastMessagePreview: latest?.body ?? '',
    }
  })

  const insertContact = db.prepare(`
    INSERT INTO contacts (id, display_name, handle, accent_color)
    VALUES (@id, @displayName, @handle, @accentColor)
  `)

  const insertConversation = db.prepare(`
    INSERT INTO conversations (id, title, kind, last_message_at, last_message_preview)
    VALUES (@id, @title, @kind, @lastMessageAt, @lastMessagePreview)
  `)

  const insertParticipant = db.prepare(`
    INSERT INTO conversation_participants (conversation_id, contact_id)
    VALUES (?, ?)
  `)

  const insertMessage = db.prepare(`
    INSERT INTO messages (
      id,
      conversation_id,
      sender_id,
      body,
      sent_at,
      has_link,
      has_attachment,
      embedding
    ) VALUES (
      @id,
      @conversationId,
      @senderId,
      @body,
      @sentAt,
      @hasLink,
      @hasAttachment,
      @embedding
    )
  `)

  const transaction = db.transaction(() => {
    db.exec(`
      DELETE FROM conversation_participants;
      DELETE FROM messages;
      DELETE FROM conversations;
      DELETE FROM contacts;
    `)

    for (const contact of contacts) {
      insertContact.run(contact)
    }

    for (const conversation of conversationSummaries) {
      insertConversation.run(conversation)

      for (const participantId of conversation.participantIds) {
        insertParticipant.run(conversation.id, participantId)
      }
    }

    messages.forEach((message) => {
      insertMessage.run({
        ...message,
        hasLink: message.hasLink ? 1 : 0,
        hasAttachment: message.hasAttachment ? 1 : 0,
        embedding: null,
      })
    })
  })

  transaction()

  console.log(
    `Seeded ${contacts.length} contacts, ${conversations.length} conversations, and ${messages.length} messages.`,
  )
  console.log(
    'Seeded SQLite corpus for lexical retrieval and Claude semantic reranking.',
  )
}

seed().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
