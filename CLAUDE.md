# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run all commands from the repo root (npm workspaces: `client`, `server`).

```bash
npm install                  # install all workspace deps

npm run dev                  # run client (5173) + server (3001) together
npm run dev:client           # client only (Vite)
npm run dev:server           # server only (tsx watch)

npm run build                # build client then server
npm start                    # run the built server (dist/index.js)
```

There is no test suite and no lint script configured yet.

Server config (LLM provider + API key) is set via the client's Setup tab (`POST /api/config`), not env vars — it's persisted to `server/data/config.json` (gitignored, plaintext, local/single-user only). `server/.env.example` covers only `PORT`/`CLIENT_ORIGIN`.

## Architecture

Monorepo with two independent TypeScript packages (both ESM — `"type": "module"` — using `NodeNext` resolution on the server) tied together by an HTTP contract under `/api`.

- **client/** — Vite + React + TypeScript, styled with MUI (see Styling below). `App.tsx` is a two-tab shell (Chat / Setup); it checks `GET /api/config` on load and defaults to whichever tab is relevant. `src/components/ChatWidget.tsx` owns chat state and calls `src/api.ts#sendChatStream` (see Chat streaming below). `src/components/SetupPanel.tsx` covers provider/key entry, document upload + list/delete, and a manual retrieval-test box, all via `src/api.ts`. `vite.config.ts` proxies `/api` to `localhost:3001` in dev (`VITE_API_BASE` overrides for other environments).
- **server/** — Express + TypeScript (run via `tsx` in dev, compiled with `tsc` for prod). `src/index.ts` wires CORS/JSON parsing and mounts four routers under `/api`: `routes/config.ts`, `routes/documents.ts`, `routes/search.ts`, `routes/chat.ts`.
- **RAG pipeline** (server): upload → `lib/extractText.ts` (txt/md/pdf → plain text) → `lib/chunk.ts` (paragraph-aware chunking with overlap) → `lib/embeddings.ts` → `lib/vectorStore.ts` (flat JSON files: `server/data/documents.json` for metadata, `server/data/vectors.json` for chunks+embeddings, cosine similarity search — no external vector DB). `GET /api/search` exercises this path directly, bypassing the LLM, for testing ingestion.
- **lib/embeddings.ts** picks the embedding method from the *same* stored config as chat: an OpenAI key uses OpenAI's embeddings endpoint; anything else (e.g. an Anthropic key, which has no embeddings API) falls back to a local on-device model (`@xenova/transformers`, lazily loaded as a singleton) so setup never needs a second API key.
- **lib/llm.ts#chatCompleteStream** is the single provider-agnostic streaming chat function, reading `lib/config.ts` to dispatch to the OpenAI or Anthropic SDK. `lib/agent.ts#streamReply` is the one thing `routes/chat.ts` calls — it currently does *not* pull in retrieved context yet (RAG is ingested and searchable, but not yet wired into the chat prompt; see README's "next phases" note before assuming answers are policy-grounded).
- Both packages independently define the same `ChatMessage`/`role: 'user' | 'assistant'` shape in their own `types.ts` (no shared types package — keep them in sync manually when changing the wire format).

Data dir paths (`server/src/lib/config.ts`, `server/src/lib/vectorStore.ts`) are resolved relative to the module file via `import.meta.url`, not `process.cwd()` — this matters because `server/dist/lib/*.js` and `server/src/lib/*.ts` both need to land on the same `server/data/` regardless of which directory `node`/`tsx` was launched from.

## Chat streaming

`POST /api/chat` streams the reply as plain text over chunked transfer — it is **not** a JSON response despite every other route being one. `routes/chat.ts` validates the request (still returning JSON on a validation error), then calls `agent.ts#streamReply`, which calls `llm.ts#chatCompleteStream` (OpenAI `stream: true` / Anthropic `messages.stream()`), writing each chunk to `res` as it arrives. Because `res.setHeader` doesn't actually send headers until the first `res.write()`/`res.end()`, an error thrown *before* any chunk is produced (e.g. no provider configured) still falls through to a normal `res.status(500).json(...)` — check `res.headersSent` before assuming you can still send JSON if you touch this route.

On the client, `api.ts#sendChatStream(messages, onChunk)` reads `res.body.getReader()` and calls `onChunk` per chunk while also returning the full accumulated text once the stream ends. `ChatWidget.tsx` uses this to drive three UI states in sequence: `isWaiting` (submitted, no tokens yet → bouncing-dots `TypingDots`), `isStreaming` (first chunk arrived → live-growing `MessageBubble`), then the finished message is appended to `messages` once the stream completes. Every assistant-side bubble (indicator, in-progress, and finished) renders next to the same `AssistantAvatar` (`SupportAgentIcon`) — see `ChatWidget.style.ts`'s `MessageRow`/`AssistantAvatar`/`TypingDots`.

If you change the request/response shape here, remember `ChatResponse` was deliberately removed from `client/src/types.ts` — don't re-add a JSON response type for this route without also reverting the streaming.

## Styling

The client uses MUI (`@mui/material` — currently v9 — + MUI's own emotion-based `styled()`, not the separate `styled-components` package). No plain CSS files remain in `client/src`.

- **`src/theme/theme.ts`** is the single source of design tokens (palette, typography, shape, spacing, `components` overrides) via `getDesignTokens(mode)` → `getTheme(mode)`. Every color/radius/spacing value anywhere in the app should trace back here — don't hardcode hex codes or pixel values in a component.
- **`src/theme/ColorModeProvider.tsx`** wraps the app root (in `main.tsx`) with `ThemeProvider` + `CssBaseline`, persists light/dark mode to `localStorage`, and exposes `useColorMode()`.
- **Co-located `ComponentName.style.ts`** files (e.g. `ChatWidget.style.ts`, `SetupPanel.style.ts`, `App.style.ts`) hold every non-trivial styled element for their component as named exports; the `.tsx` file imports and composes them. Trivial one-off spacing uses the `sx` prop instead of a new style-file entry.
- **MUI v9 gotchas hit while building this**: `theme.shape.borderRadius` is typed `number | string`, so arithmetic on it needs `Number(theme.shape.borderRadius)` first. `styled(Box)` loses `Box`'s polymorphic `component` prop in its types — for an actual `<form>`, style `styled('form')` directly rather than `styled(Box)` + `component="form"` (see `ChatForm` / `FormBar` in the two `.style.ts` files). Icon names sometimes differ from older MUI docs (e.g. it's `@mui/icons-material/DeleteOutlined`, not `DeleteOutline`) — check `node_modules/@mui/icons-material/` if an icon import 404s at the type level.
- **`client/public/favicon.svg`** is a static copy of the `SupportAgentIcon` glyph (same one used in the AppBar and chat avatar) on the theme's primary indigo — it can't import `theme.ts`, so if the primary color changes, update this file's `fill` by hand to match.

## Conventions

- **Named exports only** in app code — no `export default` in `client/src` or `server/src`. The one exception is `client/vite.config.ts`, which is Vite-mandated.
- **Client path alias**: `@/*` → `client/src/*` (configured in both `vite.config.ts`'s `resolve.alias` and `tsconfig.json`'s `paths` — both are required, the tsconfig entry alone doesn't affect the Vite runtime; `tsconfig.json`'s `paths` works without `baseUrl` as long as the pattern is `./`-prefixed, e.g. `"@/*": ["./src/*"]` — don't add `baseUrl` back, it's a deprecated option and unnecessary here). Use `@/...` for any cross-directory import; same-directory sibling imports (e.g. `api.ts` importing `./types` from the same folder) stay relative.
- **No path alias on the server** — it's plain Node ESM with no bundler, and the imports are already shallow (one directory level). Don't introduce one without also solving dev (`tsx`) vs. compiled (`dist`) resolution consistently.
