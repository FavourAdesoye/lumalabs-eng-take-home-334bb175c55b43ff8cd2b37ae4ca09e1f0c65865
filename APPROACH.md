# Approach

This document reflects the planned implementation and product decisions for my submission. I will update it with the final live URL and any implementation-specific learnings as the build is completed.

- Live URL: TBD

## What I Am Building And Why I Picked This Problem

I am rebuilding the search experience in iMessage and improving it in two ways that matter to me as a daily iPhone user:

1. better search relevance through a hybrid lexical + semantic ranking system
2. in-conversation search, so users can search within a single thread instead of only searching across all messages

I picked this problem because iMessage search is one of those features that feels good in theory but frustrating in practice. It is often slow to get to the right message, it does not give enough control over how results are narrowed, and it does not support a focused "search inside this conversation" workflow. That makes simple tasks, like finding the exact place someone sent an address, plan, link, or recommendation, more annoying than they should be.

The goal of this project is not to rebuild all of iMessage. The goal is to rebuild one specific interaction, message search, and make it feel faster, more relevant, more transparent, and more useful than Apple's current implementation.

## What I Am Improving

The rebuilt experience focuses on four improvements:

- **Hybrid relevance:** lexical search provides a deterministic baseline, and semantic reranking helps recover relevant results when the query and the original message use different wording.
- **In-conversation search:** users can search within a single thread instead of searching their entire corpus every time.
- **Better result presentation:** each hit shows contact, timestamp, conversation context, and a snippet with highlighted matches.
- **More understandable ranking:** a lightweight "Why this result?" explanation shows whether the result ranked highly because of an exact match, sender match, semantic similarity, recency, or thread context.

## Key Decisions And Tradeoffs

### Product scope

I intentionally scoped this to a polished search product rather than a full chat client. That means I am spending time on search quality, filtering, ranking, and result UI instead of send/receive flows, message composition, syncing, or a perfect recreation of the entire iMessage interface.

This is the right tradeoff for the take-home: the brief rewards a finished, opinionated slice more than a broad but shallow clone.

### Frontend: `Vite + React`

I chose `Vite + React` for the frontend because it gives me a fast development loop, straightforward deployment, and a clean way to build a polished web experience that reviewers can run in a Linux environment. I considered a mobile-first approach, but a browser-based app is lower-friction for review and easier to deploy quickly.

### Backend: `Node.js + Express`

I chose `Node.js + Express` for the backend because it keeps the architecture simple and lets me separate search logic, seed loading, and API responses from the UI layer without adding unnecessary complexity. The backend is responsible for loading the corpus, running lexical retrieval, applying semantic reranking, and returning explainable ranked results.

### Data store: `SQLite`

I am storing conversations, messages, contacts, and timestamps in `SQLite`. This gives me a lightweight local database that is easy to seed, easy to query, and much more practical for this project than standing up a separate hosted search or vector database.

The downside is that this is not the most scalable long-term architecture, but it is a strong fit for a take-home because it is simple, inspectable, and reliable in local and hosted environments.

### Search strategy: lexical retrieval first, semantic reranking second

This is the most important technical decision in the project.

I want semantic search because it is the core differentiator and the clearest way to make the experience better than iMessage. But I do not want the entire product to depend on fuzzy ranking or a fragile AI path. So the system uses a hybrid model:

- lexical retrieval is the baseline for every query
- Claude reranks only a bounded subset of lexical candidates
- if the semantic API fails for any reason, the app falls back to lexical-only results

This approach keeps the experience grounded and predictable while still allowing semantic wins on fuzzy or paraphrased queries.

### Semantic reranking: `Anthropic Claude API`

I switched the semantic layer to the `Anthropic Claude API` after finding that the local embedding approach was not accurate enough for the kinds of fuzzy message lookups I wanted this app to handle. Claude now acts as a semantic reranker on top of the lexical candidate set instead of the app relying on local vector similarity alone.

That tradeoff favors semantic quality and product feel over fully local inference. It does introduce an external API dependency, but the system still behaves safely because lexical retrieval stays intact and any Claude failure falls back silently to the lexical ranking.

### Seed data: `Faker.js`

I am using `Faker.js` to generate realistic message threads with recurring people, plans, links, addresses, rescheduled events, half-remembered wording, and other message patterns that make search interesting. Good seeded data is important here because hybrid search only looks compelling if the corpus feels like a believable personal history rather than toy placeholder text.

### Hosting: `Render`

I chose `Render` with a **Docker** web service because this project needs a long-running Node process, a predictable filesystem for SQLite, and environment variables that match production without platform-specific quirks. Render’s Dockerfile flow and **`RENDER_EXTERNAL_URL`** (used automatically for CORS when **`CLIENT_ORIGIN`** is unset) keep deployment simple compared to splitting static hosting and serverless API workarounds.

## Software Architecture

The system is organized into a few clear layers:

1. **Seed pipeline**  
   Generates realistic messages with `Faker.js`.

2. **Data layer**  
   Stores contacts, conversations, messages, and timestamps in `SQLite`.

3. **Search layer**  
   Runs lexical retrieval first, then semantic reranking on a limited candidate set, and produces ranking metadata for explanations.

4. **API layer**  
   Exposes search endpoints through `Node.js + Express` for global search and in-conversation search.

5. **UI layer**  
   Presents an iMessage-inspired search interface in `Vite + React`, including filters, result cards, highlights, and "Why this result?" explanations.

## What I Intentionally Left Out

I intentionally left out the following so the core experience could be polished:

- real iMessage or iCloud sync
- account auth and user-specific message import
- full chat UI beyond the search-related surfaces
- send and receive messaging flows
- attachment OCR or image understanding
- external vector databases or heavier search infrastructure
- pixel-perfect recreation of every iOS detail

These are all interesting directions, but they would distract from the actual point of the submission: proving a better message search interaction.

## What Breaks First Under Pressure

The first thing that would break under real production pressure is search quality at scale.

This design is optimized for a seeded corpus and a tightly controlled demo environment. As the corpus grows, ranking quality gets harder, semantic reranking needs better prompt design or evaluation, and external API latency becomes more noticeable.

Other likely pressure points:

- `SQLite` would eventually become limiting for larger-scale indexing and concurrent writes
- explanation quality can drift if the reasoning shown to the user is not tightly coupled to the actual scoring logic
- in-conversation search would need richer navigation once threads become very large
- hybrid ranking would need more tuning for short, ambiguous queries

## What I Would Build Next

If I had more time, I would extend this in the following order:

1. attachment and link search
2. richer conversation context around each hit, including jump-to-before-and-after messages
3. saved recent searches and query suggestions
4. better weighting and evaluation for ambiguous semantic queries
5. optional real message import and sync

## Summary

This project is my attempt to take a familiar, frustrating interaction and make it meaningfully better without overbuilding. The main idea is simple:

search should help people find the right message quickly, understand why it appeared, and narrow the search to the exact conversation they care about.

That is the bar I am aiming for with this rebuild of iMessage search.
