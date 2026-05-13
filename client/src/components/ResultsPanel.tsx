import type { SearchResult } from '../types/search'

interface ResultsPanelProps {
  query: string
  loading: boolean
  semanticEnabled: boolean
  semanticPending: boolean
  queryTimeMs: number
  selectedConversationTitle?: string
  results: SearchResult[]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function highlight(text: string, query: string) {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    return text
  }

  const pattern = new RegExp(`(${trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')
  const pieces = text.split(pattern)

  return pieces.map((piece, index) =>
    piece.toLowerCase() === trimmedQuery.toLowerCase() ? (
      <mark key={`${piece}-${index}`}>{piece}</mark>
    ) : (
      <span key={`${piece}-${index}`}>{piece}</span>
    ),
  )
}

export function ResultsPanel({
  query,
  loading,
  semanticEnabled,
  semanticPending,
  queryTimeMs,
  selectedConversationTitle,
  results,
}: ResultsPanelProps) {
  const statusLabel = semanticPending
    ? 'Refining with Claude'
    : semanticEnabled
    ? 'Hybrid reranking on'
    : 'Ready to search'

  return (
    <section className="results-panel">
      <div className="results-panel__header">
        <div>
          <p className="eyebrow">{selectedConversationTitle ? 'In-conversation search' : 'Global search'}</p>
          <h2>{selectedConversationTitle ?? 'All conversations'}</h2>
        </div>
        <div className="results-panel__status">
          <div
            className={
              semanticPending
                ? 'status-pill is-pending'
                : semanticEnabled
                  ? 'status-pill is-active'
                  : 'status-pill'
            }
          >
            {statusLabel}
          </div>
          <span className="query-timing">
            {loading ? 'Searching...' : semanticPending ? `${queryTimeMs.toFixed(1)} ms lexical` : `${queryTimeMs.toFixed(1)} ms`}
          </span>
        </div>
      </div>

      {loading ? <div className="empty-state">Searching messages...</div> : null}

      {!loading && results.length === 0 ? (
        <div className="empty-state">
          {query
            ? 'No messages matched this search yet.'
            : 'Start typing to search across your seeded message history.'}
        </div>
      ) : null}

      <div className="result-list">
        {results.map((result) => (
          <article key={result.id} className="result-card">
            <div className="result-card__meta">
              <div>
                <strong>{result.senderName}</strong>
                <span>{result.conversationTitle}</span>
              </div>
              <time dateTime={result.sentAt}>{formatDate(result.sentAt)}</time>
            </div>

            <p className="result-card__body">{highlight(result.body, query)}</p>

            <div className="result-card__footer">
              <div className="reason-list">
                {result.reasons.slice(0, 3).map((reason) => (
                  <span key={`${result.id}-${reason.label}`} className="reason-pill" title={reason.detail}>
                    {reason.label}
                  </span>
                ))}
              </div>

              <div className="score-breakdown">
                <span>Lexical {result.lexicalScore.toFixed(1)}</span>
                <span>
                  Semantic{' '}
                  {semanticPending
                    ? '…'
                    : result.semanticScore === null
                      ? '—'
                      : result.semanticScore.toFixed(2)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
