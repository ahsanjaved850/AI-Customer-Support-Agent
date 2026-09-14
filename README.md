# AI Customer Support Agent

A monorepo containing a React + TypeScript client and an Express server for a
**multi-tenant** AI-powered customer support agent. One deployment can serve
any number of companies: each gets its own URL, branding (name + accent
color), LLM provider/API key, admin login, and uploaded policy docs/past
support tickets — and its customers get a chat widget answering their
questions grounded in that company's data (RAG), with no way to reach that
company's admin Setup page.

## Structure

```
AI Customer Support Agent/
├── client/          # Vite + React + TypeScript frontend (MUI-themed)
└── server/          # Express + TypeScript API
```

## Multi-tenancy

Companies are identified by a URL slug, not a subdomain — everything lives on
one deployment:

- `/c/:slug` — the **customer-facing chat widget** for that company. This is
  the only thing an end user ever sees; there's no way to navigate from here
  to that company's Setup page.
- `/admin/:slug` — that company's **Setup page** (branding, LLM provider/key,
  document upload, retrieval test), behind its own admin login.

There's no self-serve signup yet — a company is provisioned with a one-time
script:

```bash
npm run create-company --workspace server -- \
  --slug=acme --name="Acme Inc" --username=admin --password=change-me
```

This creates the company and its first admin account. Slugs are lowercase
letters/digits/hyphens only and must be unique; usernames only need to be
unique *within* a company, not globally.

Company data (branding, provider/API key, documents, chunks+embeddings,
admin credentials) is stored in `server/data/app.db`, a local SQLite
database (gitignored) — plaintext API keys and password hashes on disk, fine
for a local/prototype deployment with a handful of companies, not meant for
production multi-tenant use as-is.

## Styling

The client is styled with [MUI](https://mui.com/) (`@mui/material`, MUI's own
`styled()` — emotion-based, not the separate `styled-components` package).

- **`client/src/theme/theme.ts`** — the single source of design tokens
  (palette, typography, shape, spacing, component-level overrides). No raw
  hex codes or magic pixel values live outside this file.
- **`client/src/theme/ColorModeProvider.tsx`** — wraps the app in
  `ThemeProvider` + `CssBaseline`, resolving light/dark mode from
  `localStorage` (falling back to the OS preference) and exposing a
  `useColorMode()` toggle used by the AppBar's sun/moon icon.
- **Co-located style files**: each component with non-trivial styling has a
  sibling `ComponentName.style.ts` (e.g. `ChatWidget.style.ts`,
  `SetupPanel.style.ts`) exporting named `styled(...)` components that read
  every value from `theme` — the `.tsx` file only composes them and stays
  free of styling logic. One-off spacing tweaks use the `sx` prop instead of
  a style file.
- Font is [Inter](https://fontsource.org/fonts/inter) via `@fontsource/inter`
  (Latin subset only, imported in `main.tsx`), no external font request at
  runtime.
- Browser-tab favicon (`client/public/favicon.svg`) is the same
  `SupportAgentIcon` glyph used in the header, on the theme's default indigo
  — this one stays static (doesn't follow a company's custom accent color);
  if you change `theme.ts`'s `DEFAULT_ACCENT_COLOR`, update the SVG's `fill`
  by hand to match (it can't read the TS theme file, it's a static asset).

### Company branding

A company's Setup page (`/admin/:slug`) → "Company branding" lets it set its
own name and accent color, no code changes needed:
- **Company name** replaces "AI Customer Support Agent" in the browser tab
  title, the AppBar, and the chat header, and is woven into the assistant's
  greeting ("Hi! I'm *{name}*'s support assistant...").
- **Accent color** overrides the theme's primary color app-wide (buttons,
  AppBar, chat bubbles, etc.) — pick any color, MUI derives the light/dark/
  contrast-text shades automatically.
- Both are stored server-side in that company's row in `server/data/app.db`,
  and take effect immediately (no page reload) via
  `client/src/branding/BrandingProvider.tsx`, which every themed/branded
  part of the app reads from — and which also re-fetches whenever you
  navigate between different companies' pages in the same session.

### Chat UX

`ChatWidget` streams replies instead of waiting for the full completion (see
"How it works" below): a bouncing-dots indicator shows from submit until the
first chunk arrives, then the reply renders incrementally. Every assistant
message — indicator, in-progress reply, and finished messages — shows the
same `SupportAgentIcon` avatar next to it, WhatsApp-style; user messages are
right-aligned with no avatar.

Conversation history persists across a page refresh (saved to the browser's
`localStorage` under a per-company key, capped at the last 50 messages) —
see `client/src/lib/chatHistory.ts`. A "restart" icon button in the chat
header starts a fresh conversation, clearing the saved history and
cancelling any reply that's still streaming.

## Getting started

```bash
# from the repo root
npm install

# create your first company
npm run create-company --workspace server -- \
  --slug=acme --name="Acme Inc" --username=admin --password=change-me

# run client + server together
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

1. Visit `http://localhost:5173/admin/acme` and sign in with the
   username/password you provisioned above.
2. Optionally set your company name and accent color.
3. Pick a provider (OpenAI or Anthropic) and paste your API key.
4. Upload policy documents and/or past ticket Q&A (.txt, .md, .pdf).
5. Optionally test retrieval directly before chatting.
6. Visit `http://localhost:5173/c/acme` to see the customer-facing chat
   widget for that company.

Repeat `create-company` with a different `--slug` to add another company —
each gets fully isolated data and its own admin login; one company's admin
session cannot authenticate against another's `/admin/:slug` page.

### Admin auth

Every company has its own admin account(s) (username + password, hashed with
`scrypt`), created via `create-company` above — there's no global password
and no "unprotected by default" mode. Sessions are an in-memory httpOnly
cookie (24h, cleared on "Log out" or server restart), scoped to a single
company: a session created by logging into `/admin/acme` will not work
against `/admin/globex`, even in the same browser. There's no separate
signup UI yet — see "Multi-tenancy" above for how new companies are
provisioned.

### Rate limiting & request limits

`POST /api/c/:slug/chat` is unauthenticated by necessity (it's the
customer-facing surface) but is capped at 20 requests/minute per IP by
default, shared across all companies — override with `CHAT_RATE_LIMIT_MAX`
in `server/.env`. `POST /api/c/:slug/auth/login` is separately capped at 10
attempts per 15 minutes per IP, to slow down password guessing. JSON request
bodies are capped at 256kb (file uploads go through multer's own
10MB-per-file limit instead). If this server sits behind a reverse proxy
(nginx, Caddy, a platform load balancer), set `TRUST_PROXY=1` so rate
limiting keys on the real client IP rather than the proxy's — leave it unset
otherwise, or a client could spoof their IP via `X-Forwarded-For` and dodge
the limit entirely.

## Scripts (root)

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `npm run dev`    | Run client and server in parallel           |
| `npm run build`  | Build both packages                          |
| `npm start`      | Start the built server                       |

Company provisioning (`create-company`) is a server-workspace script — run it
as `npm run create-company --workspace server -- --slug=... --name=... --username=... --password=...`.

## How it works

- `POST /api/c/:slug/auth/login` / `POST /api/c/:slug/auth/logout` /
  `GET /api/c/:slug/auth/status` — admin session for that company's Setup
  page, checked against `admin_users` scoped to the company resolved from
  `:slug`. Session is an httpOnly cookie checked by the `requireAuth`
  middleware (`server/src/lib/auth.ts`), which also rejects (403) a valid
  session whose company doesn't match the URL — this is what keeps one
  company's admin from touching another's data even with a stolen/reused
  cookie.
- `POST /api/c/:slug/config` **(admin)** — save any combination of the LLM
  provider + API key and/or `companyName`/`accentColor` for that company;
  each is validated and merged independently
  (`server/src/lib/config.ts#updateConfig`) so saving one never clobbers the
  other. `GET /api/c/:slug/config` stays public — it's how that company's
  customer-facing chat page gets its branding, not just Setup.
- `POST /api/c/:slug/documents` / `DELETE /api/c/:slug/documents/:id` /
  `GET /api/c/:slug/documents` **(admin, all three)** — upload files for that
  company; each is chunked and embedded.
  - OpenAI key → OpenAI's `text-embedding-3-small`.
  - Anthropic key (no embeddings API) → a local model (`@xenova/transformers`,
    no extra key needed) runs on-device instead.
  - Chunks + embeddings are stored in SQLite (`server/data/app.db`'s
    `chunks` table, scoped by `company_id`), a lightweight per-company
    vector store (cosine similarity search in `server/src/lib/vectorStore.ts`).
- `GET /api/c/:slug/search?q=...` **(admin)** — test retrieval directly for
  that company, no LLM call. Gated because it returns raw chunk text from
  its ingested documents on request, and nothing customer-facing calls it
  (only Setup's "Test retrieval" box does).
- `POST /api/c/:slug/chat` — **streams** the reply as plain text (chunked
  transfer, not JSON): `server/src/routes/chat.ts` calls
  `server/src/lib/agent.ts`, which calls that company's configured provider
  via `server/src/lib/llm.ts`'s `chatCompleteStream()` (OpenAI's
  `stream: true` / Anthropic's `messages.stream()`), writing each chunk to
  the response as it's generated. The client
  (`client/src/api.ts#sendChatStream`) reads the body incrementally with
  `getReader()` so the reply renders as it arrives instead of after the full
  completion — see "Chat UX" above. An error before any text is generated
  (e.g. no provider configured for this company yet) still returns a normal
  JSON error, since headers aren't sent until the first chunk.
  Before calling the LLM, `agent.ts#buildSystemPrompt` embeds the latest
  user message, retrieves the top 4 chunks scoped to that company
  (`vectorStore.ts#search`), and folds them into the system prompt with
  instructions to use the context only when it's actually relevant and
  otherwise ignore it — so answers are grounded in that company's uploaded
  policies/tickets when applicable, without forcing an unrelated policy into
  unrelated questions. If nothing is ingested yet, or retrieval fails for
  any reason, it falls back to an ungrounded reply rather than failing the
  chat request.
  A small LangGraph routing graph, an MCP server exposing the same tools,
  and Claude Code Skills/Subagents/Hooks/Plugins for maintaining this repo
  are still on the roadmap as later, separate learning-oriented phases —
  distinct from the productization work. Multi-tenancy, admin auth, and rate
  limiting are done (above); tests and a real deployment/hosting story are
  still next up.
