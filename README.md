# AI Customer Support Agent

A monorepo containing a React + TypeScript client and an Express server for an
AI-powered customer support agent. Paste an OpenAI or Anthropic API key,
upload your company's policy docs and past support tickets, and the agent
answers customer questions grounded in that data (RAG).

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
  `SupportAgentIcon` glyph used in the header, on the theme's primary indigo
  — if you change `theme.ts`'s primary color, update the SVG's `fill` to
  match (it can't read the TS theme file, it's a static asset).

### Chat UX

`ChatWidget` streams replies instead of waiting for the full completion (see
"How it works" below): a bouncing-dots indicator shows from submit until the
first chunk arrives, then the reply renders incrementally. Every assistant
message — indicator, in-progress reply, and finished messages — shows the
same `SupportAgentIcon` avatar next to it, WhatsApp-style; user messages are
right-aligned with no avatar.

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
1. Pick a provider (OpenAI or Anthropic) and paste your API key.
2. Upload policy documents and/or past ticket Q&A (.txt, .md, .pdf).
3. Optionally test retrieval directly before chatting.

The key and ingested documents are stored locally in `server/data/`
(gitignored) — plaintext on disk, fine for local/single-user use, not meant
for a shared deployment.

## Scripts (root)

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `npm run dev`    | Run client and server in parallel           |
| `npm run build`  | Build both packages                          |
| `npm start`      | Start the built server                       |

## How it works

- `POST /api/config` — save the LLM provider + API key.
- `POST /api/documents` — upload files; each is chunked and embedded.
  - OpenAI key → OpenAI's `text-embedding-3-small`.
  - Anthropic key (no embeddings API) → a local model (`@xenova/transformers`,
    no extra key needed) runs on-device instead.
  - Chunks + embeddings are stored in `server/data/vectors.json`, a flat
    JSON file acting as a small vector store (cosine similarity search in
    `server/src/lib/vectorStore.ts`).
- `GET /api/search?q=...` — test retrieval directly, no LLM call.
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
  Retrieval isn't wired into chat yet — that grounding step, plus a small
  LangGraph routing graph, an MCP server exposing the same tools, and
  Claude Code Skills/Subagents/Hooks/Plugins for maintaining this repo, are
  the next phases.
