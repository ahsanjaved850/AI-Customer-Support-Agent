# AI Customer Support Agent

A monorepo containing a React + TypeScript client and an Express server for an
AI-powered customer support agent. Any company can make it their own from the
Setup tab — set a company name and accent color, paste an OpenAI or Anthropic
API key, upload your company's policy docs and past support tickets — and the
agent answers customer questions grounded in that data (RAG).

## Structure

```
AI Customer Support Agent/
├── client/          # Vite + React + TypeScript frontend (MUI-themed)
└── server/          # Express + TypeScript API
```

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

Setup → "Company branding" lets any company set their own name and accent
color, no code changes needed:
- **Company name** replaces "AI Customer Support Agent" in the browser tab
  title, the AppBar, and the chat header, and is woven into the assistant's
  greeting ("Hi! I'm *{name}*'s support assistant...").
- **Accent color** overrides the theme's primary color app-wide (buttons,
  AppBar, chat bubbles, etc.) — pick any color, MUI derives the light/dark/
  contrast-text shades automatically.
- Both are stored server-side in the same `server/data/config.json` as the
  provider/API key, and take effect immediately (no page reload) via
  `client/src/branding/BrandingProvider.tsx`, which every themed/branded
  part of the app reads from.

### Chat UX

`ChatWidget` streams replies instead of waiting for the full completion (see
"How it works" below): a bouncing-dots indicator shows from submit until the
first chunk arrives, then the reply renders incrementally. Every assistant
message — indicator, in-progress reply, and finished messages — shows the
same `SupportAgentIcon` avatar next to it, WhatsApp-style; user messages are
right-aligned with no avatar.

Conversation history persists across a page refresh (saved to the browser's
`localStorage`, capped at the last 50 messages) — see `client/src/lib/chatHistory.ts`.
A "restart" icon button in the chat header starts a fresh conversation,
clearing the saved history and cancelling any reply that's still streaming.

## Getting started

```bash
# from the repo root
npm install

# run client + server together
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

On first load the client shows the **Setup** tab:
1. Optionally set your company name and accent color.
2. Pick a provider (OpenAI or Anthropic) and paste your API key.
3. Upload policy documents and/or past ticket Q&A (.txt, .md, .pdf).
4. Optionally test retrieval directly before chatting.

The key, branding, and ingested documents are stored locally in
`server/data/` (gitignored) — plaintext on disk, fine for local/single-user
use, not meant for a shared deployment.

### Protecting the Setup tab

By default the Setup tab (provider/API key, branding, documents) has **no
login** — fine for local dev, not fine once this server is reachable by
anyone else. Before deploying it anywhere beyond localhost:

1. Set `ADMIN_PASSWORD` in `server/.env` (copy `server/.env.example` first).
2. Restart the server — you'll see a startup warning if it's still unset.
3. The Setup tab now requires signing in with that password before any
   change can be made; the chat itself (`/api/chat`) stays open, since
   that's the customer-facing surface.

Sessions are a simple in-memory cookie (24h, `httpOnly`, cleared on
"Log out" or server restart) — no separate login system or user accounts,
by design, for a single-admin self-hosted deployment.

### Rate limiting & request limits

`POST /api/chat` is unauthenticated by necessity (it's the customer-facing
surface) but is capped at 20 requests/minute per IP by default — override
with `CHAT_RATE_LIMIT_MAX` in `server/.env`. `POST /api/auth/login` is
separately capped at 10 attempts per 15 minutes per IP, to slow down
password guessing. JSON request bodies are capped at 256kb (file uploads go
through multer's own 10MB-per-file limit instead). If this server sits
behind a reverse proxy (nginx, Caddy, a platform load balancer), set
`TRUST_PROXY=1` so rate limiting keys on the real client IP rather than the
proxy's — leave it unset otherwise, or a client could spoof their IP via
`X-Forwarded-For` and dodge the limit entirely.

## Scripts (root)

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `npm run dev`    | Run client and server in parallel           |
| `npm run build`  | Build both packages                          |
| `npm start`      | Start the built server                       |

## How it works

- `POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/status`
  — admin session for the Setup tab, gated by `ADMIN_PASSWORD` (see
  "Protecting the Setup tab" above); a no-op (always "authenticated") when
  that env var isn't set. Session is an httpOnly cookie checked by the
  `requireAuth` middleware (`server/src/lib/auth.ts`).
- `POST /api/config` **(admin)** — save any combination of the LLM provider
  + API key and/or `companyName`/`accentColor`; each is validated and merged
  independently (`server/src/lib/config.ts#updateConfig`) so saving one
  never clobbers the other. `GET /api/config` stays public — it's how the
  customer-facing chat page gets its branding, not just Setup.
- `POST /api/documents` / `DELETE /api/documents/:id` / `GET /api/documents`
  **(admin, all three)** — upload files; each is chunked and embedded.
  - OpenAI key → OpenAI's `text-embedding-3-small`.
  - Anthropic key (no embeddings API) → a local model (`@xenova/transformers`,
    no extra key needed) runs on-device instead.
  - Chunks + embeddings are stored in `server/data/vectors.json`, a flat
    JSON file acting as a small vector store (cosine similarity search in
    `server/src/lib/vectorStore.ts`).
- `GET /api/search?q=...` **(admin)** — test retrieval directly, no LLM
  call. Gated because it returns raw chunk text from your ingested
  documents on request, and nothing customer-facing calls it (only Setup's
  "Test retrieval" box does).
- `POST /api/chat` — **streams** the reply as plain text (chunked transfer,
  not JSON): `server/src/routes/chat.ts` calls `server/src/lib/agent.ts`,
  which calls the configured provider via `server/src/lib/llm.ts`'s
  `chatCompleteStream()` (OpenAI's `stream: true` / Anthropic's
  `messages.stream()`), writing each chunk to the response as it's
  generated. The client (`client/src/api.ts#sendChatStream`) reads the body
  incrementally with `getReader()` so the reply renders as it arrives
  instead of after the full completion — see "Chat UX" above. An error
  before any text is generated (e.g. no provider configured) still returns
  a normal JSON error, since headers aren't sent until the first chunk.
  Before calling the LLM, `agent.ts#buildSystemPrompt` embeds the latest
  user message, retrieves the top 4 chunks (`vectorStore.ts#search`), and
  folds them into the system prompt with instructions to use the context
  only when it's actually relevant and otherwise ignore it — so answers are
  grounded in your uploaded policies/tickets when applicable, without
  forcing an unrelated policy into unrelated questions. If nothing is
  ingested yet, or retrieval fails for any reason, it falls back to an
  ungrounded reply rather than failing the chat request.
  A small LangGraph routing graph, an MCP server exposing the same tools,
  and Claude Code Skills/Subagents/Hooks/Plugins for maintaining this repo
  are still on the roadmap as later, separate learning-oriented phases —
  distinct from the productization work. Admin auth and rate limiting are
  done (above); tests and a deployment story are still next up.
