# iMessage Search Rebuild

This repo contains my submission for Luma's take-home. I am rebuilding and improving the iMessage search experience with:

- a `Vite + React` frontend
- a `Node.js + Express` backend
- a `SQLite` corpus of conversations, contacts, and messages
- semantic reranking powered by the `Anthropic Claude API`
- seeded realistic message data generated with `Faker.js`

## Local Development

```bash
cp .env.example .env
npm install
npm run seed
npm run dev
```

This starts:

- the Vite client on `http://localhost:5173`
- the Express API on `http://localhost:3001`

### Docker

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3001` (Express serves the built client and API). If port `3001` is already in use, run `HOST_PORT=13001 docker compose up` and open `http://localhost:13001` instead.

### Deploy to Railway

This repo ships a root `Dockerfile` (builds the client, compiles the server, seeds SQLite) and `railway.toml` so Railway uses the Dockerfile builder and `/api/health` for health checks.

1. In [Railway](https://railway.app), create a project and **New** → **GitHub Repo** (or **Empty Project** → connect the repo).
2. Add a **single service** from this repository. Railway should pick up `railway.toml` and build with **Dockerfile**.
3. Under the service **Variables**, set at least:
   - `ANTHROPIC_API_KEY` — required for semantic reranking (leave unset to run lexical-only).
   - `SEMANTIC_SEARCH_ENABLED` — optional; default `true` when a key is present (see `server/src/config.ts`).
4. Open **Settings** → **Networking** → **Generate domain** (public HTTPS). No need to set `PORT`; Railway injects it.
5. **CORS / public URL:** If you do not set `CLIENT_ORIGIN`, the server uses `https://<RAILWAY_PUBLIC_DOMAIN>` when that variable is present (Railway sets it automatically). For a **custom domain**, set `CLIENT_ORIGIN` to your public origin (for example `https://search.example.com`).
6. Deploy. Open the generated URL; the SPA and `/api/*` are served from the same Express process.

The SQLite file is baked into the image at build time. Runtime changes to the DB are not persisted across redeploys unless you attach a [volume](https://docs.railway.com/guides/volumes) and point `DATABASE_PATH` at the mounted path.

Useful commands:

```bash
npm run seed
npm run build
npm run lint
npm run start
```

## Original Take-Home Brief

## Luma Take-Home

Modern engineering is about directing leverage — tools, judgment, taste — toward real outcomes. This take-home is designed around that.

Pick a problem. Build something that works. You have ~1 working day.

**You must use AI coding tools** — Claude Code, Cursor, Codex, whatever you prefer. These problems are scoped so that AI is necessary to ship something real in a day. We want to see how you direct the tools: how you plan, how you course-correct, what you accept, and what you push back on.

---

## Choose a Problem

Pick the one that excites you most. These are deliberately open-ended — we want to see what directions you take and what decisions you make.

### 1. Reverse-Engineer an Undocumented API

Pick any website that doesn't have a public API. Reverse-engineer how it works under the hood, then build a useful tool on top of it.

**Figure out the API, then build something real with it.**

### 2. Fix Something Annoying

Pick a website you use daily. Identify something that genuinely annoys you about it. Build a browser extension that fixes it.

**Find the annoyance, ship the fix.**

### 3. Clone and Improve

Pick one specific feature or interaction from an app you admire. Rebuild it, then make it better — faster, cleaner, more thoughtful, whatever "better" means to you.

**Rebuild it, improve it, and explain what you changed and why.**

---

## Tips

The candidates who do best don't start by building — they start by getting sharp on the problem. It's easy to either throw everything at the wall or get heads-down on making something work, and miss the more important question: *what's actually worth solving here, and for whom?*

Slow down before you write a line of code. The thinking you do upfront will shape everything.

---

## What We're Looking For

We want real, working software — not a prototype, not a toy. You'll likely focus on a slice of the problem, but that slice should actually work and be something you'd put in front of a user. Show polish where it matters to you — in the UX, the details, the interactions that feel right. Ship a finished product, not a proof of concept.

We expect the result to be better than what an AI would produce on its own with minimal guidance. The AI writes the code; you own the decisions — what to build, how it should work, what to cut, and what to polish. Specifically, we're paying attention to:

- **How you approach new problems** — how you break down ambiguity, decide what to tackle first, and make good decisions with incomplete information
- **How you use AI tools** — not just that you used them, but how you directed them, where you pushed back, and where your judgment shaped the result
- **The unique perspective you bring** — the product instincts, technical taste, or domain insight that made your solution distinct from what anyone else would have built

---

## What to Deliver

### 1. Working software

Build your solution directly in this repo. It should run. Include setup instructions that work in a fresh Linux container — we will run your code in one during review. If you use Docker, provide a `docker-compose.yml` for one-command setup.

**If your project is deployable, deploy it.** We want to experience what you built, not just read about it. A live URL — whether it's a web app, an API endpoint, a browser extension, or a hosted service — goes a long way. Vercel, Railway, Fly, a VPS, whatever works. Include the URL in your APPROACH.md.

A `.env.example` is included with stub keys for providers we have accounts with (Anthropic, OpenAI, ElevenLabs, Google Cloud, AWS). Copy it to `.env`, use whichever keys your solution needs, and document any others.

### 2. APPROACH.md

- What you built and why you picked this problem
- Key decisions and tradeoffs
- What you intentionally left out
- What breaks first under pressure
- What you'd build next

### 3. Video walkthrough

Record a short video (~5 minutes) showing what you built. Demo the key flows — whether that's a UI walkthrough, a CLI session, or hitting your API — explain your decisions, and highlight anything you're particularly proud of. This is your chance to show us the experience through your eyes.

**Paste your video link (Loom, Google Drive, YouTube, etc.) into `video.md`.**

### 4. AI session history

Your AI session logs (Claude Code, Codex, Cursor) are packaged automatically when you run `./submit.sh`. If you used other AI tools (ChatGPT, etc.), export those conversations and include them in your repo before submitting.

This is a required deliverable. We review your AI interaction to understand how you work — how you plan, iterate, and direct the tools.

---

## Getting Started

```bash
# 1. Extract the challenge archive you downloaded
tar xzf challenge.tar.gz && cd *eng-take-home*

# 2. Create your own private repo and push to it
git init && git add -A && git commit -m "initial"
gh repo create my-take-home --private --source=. --push

# 3. Copy the env file and fill in any keys you need
cp .env.example .env
```

Now build your solution. Commit and push as you go.

---

## Submitting

When you're ready, run the submit script from your repo root:

```bash
./submit.sh
```

This handles everything: packages your AI session history, commits and pushes your latest changes, grants reviewer access, and registers your submission. You'll see a confirmation when it's done.
