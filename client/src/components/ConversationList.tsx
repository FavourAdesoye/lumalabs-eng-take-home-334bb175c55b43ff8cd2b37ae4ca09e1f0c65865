import type { ConversationOverview } from '../types/search'

interface ConversationListProps {
  conversations: ConversationOverview[]
  selectedConversationId?: string
  onSelectConversation: (conversationId?: string) => void
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  return (
    <aside className="conversation-list">
      <div className="conversation-list__header">
        <div>
          <h2>Conversations</h2>
        </div>
        <button
          type="button"
          className={!selectedConversationId ? 'conversation-list__reset is-active' : 'conversation-list__reset'}
          onClick={() => onSelectConversation(undefined)}
        >
          All chats
        </button>
      </div>

      <div className="conversation-list__items">
        {conversations.map((conversation) => {
          const active = conversation.id === selectedConversationId

          return (
            <button
              key={conversation.id}
              type="button"
              className={active ? 'conversation-card is-active' : 'conversation-card'}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="conversation-card__topline">
                <strong>{conversation.title}</strong>
                <span>{formatTimestamp(conversation.lastMessageAt)}</span>
              </div>
              <p>{conversation.lastMessagePreview}</p>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
