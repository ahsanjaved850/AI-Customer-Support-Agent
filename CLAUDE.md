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

Server config (LLM provider + API key, and company branding — name + accent color) is set via the client's Setup tab (`POST /api/config`), not env vars — it's persisted to `server/data/config.json` (gitignored, plaintext, local/single-user only). `server/.env.example` covers `PORT`/`CLIENT_ORIGIN`/`ADMIN_PASSWORD`/`NODE_ENV`/`TRUST_PROXY`/`CHAT_RATE_LIMIT_MAX` — see Admin auth and Rate limiting & error handling below.

## Architecture

Monorepo with two independent TypeScript packages (both ESM — `"type": "module"` — using `NodeNext` resolution on the server) tied together by an HTTP contract under `/api`.

- **client/** — Vite + React + TypeScript, styled with MUI (see Styling below). `App.tsx` is a two-tab shell (Chat / Setup); it checks `GET /api/config` on load and defaults to whichever tab is relevant. `src/components/ChatWidget.tsx` owns chat state and calls `src/api.ts#sendChatStream` (see Chat streaming below). `src/components/SetupPanel.tsx` covers branding, provider/key entry, document upload + list/delete, and a manual retrieval-test box, all via `src/api.ts`. `vite.config.ts` proxies `/api` to `localhost:3001` in dev (`VITE_API_BASE` overrides for other environments).
- **server/** — Express + TypeScript (run via `tsx` in dev, compiled with `tsc` for prod). `src/index.ts` wires CORS (`credentials: true` — required for the admin session cookie)/cookie-parser/JSON parsing (256kb limit) and mounts five routers under `/api`: `routes/auth.ts`, `routes/config.ts`, `routes/documents.ts`, `routes/search.ts`, `routes/chat.ts`, followed by a JSON 404 handler and a catch-all error handler (both last, in that order — see Rate limiting & error handling below).
- **RAG pipeline** (server): upload → `lib/extractText.ts` (txt/md/pdf → plain text) → `lib/chunk.ts` (paragraph-aware chunking with overlap) → `lib/embeddings.ts` → `lib/vectorStore.ts` (flat JSON files: `server/data/documents.json` for metadata, `server/data/vectors.json` for chunks+embeddings, cosine similarity search — no external vector DB). `GET /api/search` exercises this path directly, bypassing the LLM, for testing ingestion.
- **lib/embeddings.ts** picks the embedding method from the *same* stored config as chat: an OpenAI key uses OpenAI's embeddings endpoint; anything else (e.g. an Anthropic key, which has no embeddings API) falls back to a local on-device model (`@xenova/transformers`, lazily loaded as a singleton) so setup never needs a second API key.
- **lib/llm.ts#chatCompleteStream** is the single provider-agnostic streaming chat function, reading `lib/config.ts` to dispatch to the OpenAI or Anthropic SDK. `lib/agent.ts#streamReply` is the one thing `routes/chat.ts` calls; it first calls `agent.ts#buildSystemPrompt` (also exported, for direct testing) which embeds the latest user message, retrieves the top 4 chunks via `vectorStore.ts#search`, and folds them into the system prompt — the model is instructed to use that context only when relevant and ignore it otherwise, rather than relying on a fixed similarity-score cutoff. Retrieval is best-effort: any failure (embedding error, nothing ingested) falls back to `BASE_SYSTEM_PROMPT` rather than failing the chat request.
- Both packages independently define the same `ChatMessage`/`role: 'user' | 'assistant'` shape in their own `types.ts` (no shared types package — keep them in sync manually when changing the wire format).

Data dir paths (`server/src/lib/config.ts`, `server/src/lib/vectorStore.ts`) are resolved relative to the module file via `import.meta.url`, not `process.cwd()` — this matters because `server/dist/lib/*.js` and `server/src/lib/*.ts` both need to land on the same `server/data/` regardless of which directory `node`/`tsx` was launched from.

## Chat streaming

`POST /api/chat` streams the reply as plain text over chunked transfer — it is **not** a JSON response despite every other route being one. `routes/chat.ts` validates the request (still returning JSON on a validation error), then calls `agent.ts#streamReply`, which calls `llm.ts#chatCompleteStream` (OpenAI `stream: true` / Anthropic `messages.stream()`), writing each chunk to `res` as it arrives. Because `res.setHeader` doesn't actually send headers until the first `res.write()`/`res.end()`, an error thrown *before* any chunk is produced (e.g. no provider configured) still falls through to a normal `res.status(500).json(...)` — check `res.headersSent` before assuming you can still send JSON if you touch this route.

On the client, `api.ts#sendChatStream(messages, onChunk)` reads `res.body.getReader()` and calls `onChunk` per chunk while also returning the full accumulated text once the stream ends. `ChatWidget.tsx` uses this to drive three UI states in sequence: `isWaiting` (submitted, no tokens yet → bouncing-dots `TypingDots`), `isStreaming` (first chunk arrived → live-growing `MessageBubble`), then the finished message is appended to `messages` once the stream completes. Every assistant-side bubble (indicator, in-progress, and finished) renders next to the same `AssistantAvatar` (`SupportAgentIcon`) — see `ChatWidget.style.ts`'s `MessageRow`/`AssistantAvatar`/`TypingDots`.

If you change the request/response shape here, remember `ChatResponse` was deliberately removed from `client/src/types.ts` — don't re-add a JSON response type for this route without also reverting the streaming.

## Admin auth

Gates everything that can change what the bot says or knows: `POST /api/config`, and all of `GET/POST /api/documents` + `DELETE /api/documents/:id`, and `GET /api/search`. **Not** gated: `GET /api/config` (customer-facing chat page needs it for branding) and `POST /api/chat` (the actual customer-facing surface).

- **`server/src/lib/auth.ts`** — `isAuthRequired()` is `Boolean(process.env.ADMIN_PASSWORD)`; when false, `requireAuth` middleware is a no-op (`next()` immediately) — this is what keeps local dev frictionless by default. Sessions are an in-memory `Map<sessionId, expiryMs>` (24h, `SESSION_MAX_AGE_MS`) — deliberately not persisted or shared across processes; fine for a single-process, single-admin, self-hosted deployment, wrong for anything multi-instance. `verifyPassword` uses `crypto.timingSafeEqual` (after an equal-length check, since that function throws on mismatched lengths) rather than plain `===`.
- **`server/src/routes/auth.ts`** — `GET /auth/status`, `POST /auth/login` (sets an httpOnly, `sameSite: 'lax'` cookie; `secure` only when `NODE_ENV=production`, so plain http:// dev still works), `POST /auth/logout`. All three respond `{ authRequired: false, authenticated: true }` immediately when no password is configured, matching `requireAuth`'s no-op behavior — the client only ever needs to branch on `authRequired`, not reimplement that logic.
- **Client**: `client/src/api.ts`'s `request()` helper always sends `credentials: 'include'` (harmless for public routes, required for gated ones) and throws `ApiError` (has `.status`) instead of a plain `Error`, so callers can distinguish a 401 (`isAuthError()`) from any other failure. `SetupPanel.tsx` checks `GET /auth/status` on mount; if `authRequired && !authenticated` it renders `AdminLogin.tsx` instead of its normal sections. Every mutating handler in `SetupPanel.tsx` (`handleSaveBranding`, `handleSaveKey`, `handleUpload`, `handleDelete`, `handleSearch`) routes its catch block through a local `handleAuthError(err)` helper that flips back to the login screen on a 401 (e.g. an expired session) instead of showing a generic error — follow that pattern if you add another mutating call here rather than duplicating the try/catch.
- `GET /api/documents` is gated even though it's a read — unlike `GET /api/config`, nothing customer-facing calls it (only `SetupPanel`), and it exposes internal document filenames. Same reasoning for `GET /api/search`: it's only used by Setup's "Test retrieval" box, and returns raw chunk text from ingested documents.

## Rate limiting & error handling

- **`server/src/lib/rateLimit.ts`** exports two `express-rate-limit` instances: `chatRateLimiter` (20 req/min/IP by default, `CHAT_RATE_LIMIT_MAX` env override — applied to `POST /api/chat`, since that route can't be gated behind admin auth but is a direct pass-through to a paid LLM API) and `loginRateLimiter` (10 attempts/15min/IP, fixed — applied to `POST /api/auth/login`, to slow down password guessing). Both key on `req.ip`, which is only trustworthy if `TRUST_PROXY=1` is set *and* the server is actually behind a reverse proxy (`index.ts` only calls `app.set('trust proxy', 1)` when that env var is set — never unconditionally, since blindly trusting `X-Forwarded-For` with no proxy in front lets a client spoof their IP and dodge every limit here).
- **`index.ts`** sets an explicit `express.json({ limit: '256kb' })` rather than relying on Express's unstated 100kb default (file uploads bypass this entirely — they go through `multer`'s own 10MB-per-file limit in `routes/documents.ts`).
- **Two handlers close out `index.ts`, in this order, both after every router**: a JSON 404 (`app.use('/api', ...)`) for unmatched `/api/*` routes, then a 4-arg catch-all error handler (`app.use((err, req, res, next) => ...)` — Express only treats a middleware as an error handler when it takes exactly four parameters, so don't collapse it to fewer even if some appear unused). This exists because body-parser's "payload too large" error (and any other error thrown before a route's own try/catch runs) previously fell through to Express's default handler, which returns an **HTML page containing the full stack trace and server file paths** — the catch-all logs the real error server-side via `console.error` and returns a generic JSON message to the client instead. It checks `res.headersSent` first and no-ops if so (a chat stream can be partway through `res.write()` when something goes wrong downstream).

## Branding & persistence

The app is white-labelable: a company sets its own name/accent color rather than these being fixed at build time.

- **`server/src/lib/config.ts`**'s `AppConfig` has `provider`/`apiKey` as *optional* fields alongside `companyName`/`accentColor` — a company can set branding before ever configuring an LLM provider. `writeConfig()` stays a dumb full-overwrite; **`updateConfig(patch)`** is the merge-aware wrapper (`{...readConfig(), ...patch}`) that `routes/config.ts` actually calls, so saving one form (branding vs. provider/key) in Setup never clobbers the other. `POST /config` only validates/applies provider+apiKey when they're actually present in the body (`isCredentialUpdate` check) — don't reintroduce a single all-or-nothing validation path here.
- **`client/src/branding/BrandingProvider.tsx`** fetches `GET /api/config` and exposes `{ companyName, accentColor, loading, refresh }` via `useBranding()` (throw-if-outside-provider, same pattern as `useColorMode()`). It also keeps `document.title` in sync. Deliberately *not* cached in `localStorage` — it's server truth, fetched fast locally; caching would add a second, staleness-prone source of truth. Mounted in `main.tsx` *outside* `ColorModeProvider`, since the latter reads `accentColor` from it.
- **`theme.ts`** exports `DEFAULT_ACCENT_COLOR` and both `getDesignTokens`/`getTheme` take an optional `accentColor` param — when given, `palette.primary` is just `{ main: accentColor }` and MUI's `augmentColor` derives light/dark/contrastText automatically. Reference `DEFAULT_ACCENT_COLOR` (e.g. `SetupPanel.tsx`'s color-picker default) rather than re-hardcoding the hex literal.
- **`client/src/lib/chatHistory.ts`** (first file in a new client `lib/` dir) persists `ChatWidget`'s `messages` to `localStorage` (key `'chat-history'`, capped at 50 messages via `writeStoredMessages`), following the exact try/catch-silent-failure pattern `ColorModeProvider` already established for its own localStorage use — just with `JSON.stringify`/`parse` since messages are objects. `ChatWidget.tsx` only ever writes on `messages` changes (a `useEffect` keyed on `messages` alone) — never on `isWaiting`/`isStreaming`/`streamingText`, which are separate state, so an in-flight reply is never persisted mid-stream. The header's reset button (`handleReset`) aborts any in-flight fetch via an `AbortController` (`sendChatStream`'s optional `signal` param) before clearing state — without the abort, a stale `onChunk` callback could still land text in the fresh conversation after reset.

## Styling

The client uses MUI (`@mui/material` — currently v9 — + MUI's own emotion-based `styled()`, not the separate `styled-components` package). No plain CSS files remain in `client/src`.

- **`src/theme/theme.ts`** is the single source of design tokens (palette, typography, shape, spacing, `components` overrides) via `getDesignTokens(mode, accentColor?)` → `getTheme(mode, accentColor?)`. Every color/radius/spacing value anywhere in the app should trace back here — don't hardcode hex codes or pixel values in a component (see Branding & persistence above for the `accentColor` override path and `DEFAULT_ACCENT_COLOR`).
- **`src/theme/ColorModeProvider.tsx`** wraps the app root (in `main.tsx`, nested inside `BrandingProvider`) with `ThemeProvider` + `CssBaseline`, persists light/dark mode to `localStorage`, reads `accentColor` from `useBranding()`, and exposes `useColorMode()`.
- **Co-located `ComponentName.style.ts`** files (e.g. `ChatWidget.style.ts`, `SetupPanel.style.ts`, `App.style.ts`) hold every non-trivial styled element for their component as named exports; the `.tsx` file imports and composes them. Trivial one-off spacing uses the `sx` prop instead of a new style-file entry.
- **MUI v9 gotchas hit while building this**: `theme.shape.borderRadius` is typed `number | string`, so arithmetic on it needs `Number(theme.shape.borderRadius)` first. `styled(Box)` loses `Box`'s polymorphic `component` prop in its types — for an actual `<form>`, style `styled('form')` directly rather than `styled(Box)` + `component="form"` (see `ChatForm` / `FormBar` in the two `.style.ts` files). Icon names sometimes differ from older MUI docs (e.g. it's `@mui/icons-material/DeleteOutlined`, not `DeleteOutline`) — check `node_modules/@mui/icons-material/` if an icon import 404s at the type level.
- **`client/public/favicon.svg`** is a static copy of the `SupportAgentIcon` glyph (same one used in the AppBar and chat avatar) on `theme.ts`'s `DEFAULT_ACCENT_COLOR`. It's a static asset — it can't import `theme.ts` and doesn't follow a per-company `accentColor` override; if you ever change `DEFAULT_ACCENT_COLOR` itself, update this file's `fill` by hand to match.

## Conventions

- **Named exports only** in app code — no `export default` in `client/src` or `server/src`. The one exception is `client/vite.config.ts`, which is Vite-mandated.
- **Client path alias**: `@/*` → `client/src/*` (configured in both `vite.config.ts`'s `resolve.alias` and `tsconfig.json`'s `paths` — both are required, the tsconfig entry alone doesn't affect the Vite runtime; `tsconfig.json`'s `paths` works without `baseUrl` as long as the pattern is `./`-prefixed, e.g. `"@/*": ["./src/*"]` — don't add `baseUrl` back, it's a deprecated option and unnecessary here). Use `@/...` for any cross-directory import; same-directory sibling imports (e.g. `api.ts` importing `./types` from the same folder) stay relative.
- **No path alias on the server** — it's plain Node ESM with no bundler, and the imports are already shallow (one directory level). Don't introduce one without also solving dev (`tsx`) vs. compiled (`dist`) resolution consistently.
