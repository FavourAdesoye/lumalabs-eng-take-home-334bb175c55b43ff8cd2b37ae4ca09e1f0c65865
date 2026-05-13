import { useEffect, useMemo, useState } from 'react'

import './App.css'
import { ConversationList } from './components/ConversationList'
import { FiltersBar } from './components/FiltersBar'
import { ResultsPanel } from './components/ResultsPanel'
import { SearchBar } from './components/SearchBar'
import { fetchOverview, fetchRerankStatus, fetchSearch } from './lib/api'
import type { OverviewResponse, SearchResult } from './types/search'

function App() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [query, setQuery] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<string>()
  const [selectedSenderId, setSelectedSenderId] = useState<string>()
  const [hasLinkOnly, setHasLinkOnly] = useState(false)
  const [dateFrom, setDateFrom] = useState<string>()
  const [dateTo, setDateTo] = useState<string>()
  const [results, setResults] = useState<SearchResult[]>([])
  const [semanticEnabled, setSemanticEnabled] = useState(false)
  const [semanticPending, setSemanticPending] = useState(false)
  const [queryTimeMs, setQueryTimeMs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const selectedConversation = useMemo(
    () => overview?.conversations.find(({ id }) => id === selectedConversationId),
    [overview, selectedConversationId],
  )

  useEffect(() => {
    let active = true

    async function loadOverview() {
      try {
        const nextOverview = await fetchOverview()

        if (!active) {
          return
        }

        setOverview(nextOverview)
      } catch (loadError) {
        if (!active) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load the app.')
      }
    }

    loadOverview()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!overview) {
      return
    }

    let active = true

    const handle = window.setTimeout(async () => {
      if (active) {
        setLoading(true)
        setSemanticPending(false)
      }

      try {
        const response = await fetchSearch({
          query,
          conversationId: selectedConversationId,
          senderId: selectedSenderId,
          hasLink: hasLinkOnly,
          dateFrom,
          dateTo,
        })

        if (!active) {
          return
        }

        setResults(response.results)
        setSemanticEnabled(response.semanticEnabled)
        setSemanticPending(response.semanticPending)
        setQueryTimeMs(response.queryTimeMs)
        setError(undefined)
        setLoading(false)

        if (response.semanticPending && response.rerankKey) {
          for (let attempt = 0; active && attempt < 24; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 300 : 500))

            const rerankStatus = await fetchRerankStatus(response.rerankKey)

            if (!active) {
              return
            }

            if (rerankStatus.status === 'pending') {
              continue
            }

            setSemanticPending(false)

            if (rerankStatus.status === 'ready' && rerankStatus.result) {
              setResults(rerankStatus.result.results)
              setSemanticEnabled(rerankStatus.result.semanticEnabled)
              setQueryTimeMs(rerankStatus.result.queryTimeMs)
            }

            return
          }

          if (active) {
            setSemanticPending(false)
          }
        }
      } catch (searchError) {
        if (!active) {
          return
        }

        setError(searchError instanceof Error ? searchError.message : 'Search failed.')
        setSemanticPending(false)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }, 180)

    return () => {
      active = false
      window.clearTimeout(handle)
    }
  }, [dateFrom, dateTo, hasLinkOnly, overview, query, selectedConversationId, selectedSenderId])

  if (!overview && !error) {
    return <div className="app-shell app-shell--loading">Loading iMessage search rebuild...</div>
  }

  if (!overview) {
    return <div className="app-shell app-shell--loading">{error}</div>
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <h1>IMessage Search, rebuilt with hybrid relevance</h1>
          <p className="hero-panel__description">
            Lexical retrieval keeps results grounded, semantic reranking rescues fuzzy queries, and
            thread-level search makes it easier to find the exact message inside a conversation.
          </p>
        </div>

        <div className="hero-panel__metrics">
          <div>
            <strong>{overview.conversations.length}</strong>
            <span>conversations</span>
          </div>
          <div>
            <strong>{overview.contacts.length}</strong>
            <span>contacts</span>
          </div>
          <div>
            <strong>{results.length}</strong>
            <span>visible hits</span>
          </div>
        </div>
      </section>

      <section className="workspace">
        <ConversationList
          conversations={overview.conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
        />

        <section className="search-workspace">
          <div className="search-workspace__controls">
            <SearchBar
              query={query}
              placeholder={
                selectedConversation
                  ? `Search within ${selectedConversation.title}`
                  : 'Search across all messages'
              }
              onQueryChange={setQuery}
            />

            <FiltersBar
              contacts={overview.contacts}
              senderId={selectedSenderId}
              hasLinkOnly={hasLinkOnly}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onSenderChange={setSelectedSenderId}
              onHasLinkChange={setHasLinkOnly}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />
          </div>

          {error ? <p className="error-banner">{error}</p> : null}

          <ResultsPanel
            query={query}
            loading={loading}
            semanticEnabled={semanticEnabled}
            semanticPending={semanticPending}
            queryTimeMs={queryTimeMs}
            selectedConversationTitle={selectedConversation?.title}
            results={results}
          />
        </section>
      </section>
    </main>
  )
}

export default App
