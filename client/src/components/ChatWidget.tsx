import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, IconButton, TextField } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SendIcon from '@mui/icons-material/Send';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { sendChatStream } from '@/api';
import { DEFAULT_COMPANY_NAME, useBranding } from '@/branding/BrandingProvider';
import { clearStoredMessages, readStoredMessages, writeStoredMessages } from '@/lib/chatHistory';
import type { ChatMessage } from '@/types';
import {
  AssistantAvatar,
  ChatContainer,
  ChatForm,
  ChatHeader,
  MessageBubble,
  MessageLog,
  MessageRow,
  TypingDots,
} from './ChatWidget.style';

function buildGreeting(companyName: string | null): ChatMessage {
  return {
    role: 'assistant',
    content: companyName
      ? `Hi! I’m ${companyName}’s support assistant. How can I help today?`
      : 'Hi! I’m your support assistant. How can I help today?',
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export function ChatWidget() {
  const { companyName } = useBranding();
  const { slug } = useParams<{ slug: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => (slug ? readStoredMessages(slug) : null) ?? [buildGreeting(companyName)],
  );
  const [input, setInput] = useState('');
  // Submitted, no tokens received yet — shows the bouncing-dots indicator.
  const [isWaiting, setIsWaiting] = useState(false);
  // First chunk has arrived and more may still be coming.
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = isWaiting || isStreaming;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWaiting, streamingText]);

  // Persist only completed exchanges — this effect is keyed on `messages`
  // alone, which never changes mid-stream (streamingText/isWaiting/
  // isStreaming are separate state), so in-flight replies are never written.
  useEffect(() => {
    if (slug) writeStoredMessages(slug, messages);
  }, [slug, messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const next = [...messages, { role: 'user', content: text } as ChatMessage];
    setMessages(next);
    setInput('');
    setError(null);
    setStreamingText('');
    setIsWaiting(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let firstChunkReceived = false;
      const full = await sendChatStream(
        next,
        (chunk) => {
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            setIsWaiting(false);
            setIsStreaming(true);
          }
          setStreamingText((prev) => prev + chunk);
        },
        controller.signal,
      );
      setMessages((prev) => [...prev, { role: 'assistant', content: full }]);
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setIsWaiting(false);
      setIsStreaming(false);
      setStreamingText('');
    }
  }

  function handleReset() {
    abortRef.current?.abort();
    setMessages([buildGreeting(companyName)]);
    setInput('');
    setError(null);
    setIsWaiting(false);
    setIsStreaming(false);
    setStreamingText('');
    if (slug) clearStoredMessages(slug);
  }

  return (
    <ChatContainer elevation={2}>
      <ChatHeader>
        <SupportAgentIcon fontSize="small" />
        <Box sx={{ flexGrow: 1 }}>{companyName ?? DEFAULT_COMPANY_NAME}</Box>
        <IconButton size="small" color="inherit" onClick={handleReset} aria-label="Start new conversation">
          <RestartAltIcon fontSize="small" />
        </IconButton>
      </ChatHeader>

      <MessageLog>
        {messages.map((m, i) => (
          <MessageRow key={i} messageRole={m.role}>
            {m.role === 'assistant' && (
              <AssistantAvatar>
                <SupportAgentIcon fontSize="small" />
              </AssistantAvatar>
            )}
            <MessageBubble messageRole={m.role}>{m.content}</MessageBubble>
          </MessageRow>
        ))}

        {isWaiting && (
          <MessageRow messageRole="assistant">
            <AssistantAvatar>
              <SupportAgentIcon fontSize="small" />
            </AssistantAvatar>
            <MessageBubble messageRole="assistant">
              <TypingDots>
                <span />
                <span />
                <span />
              </TypingDots>
            </MessageBubble>
          </MessageRow>
        )}

        {isStreaming && (
          <MessageRow messageRole="assistant">
            <AssistantAvatar>
              <SupportAgentIcon fontSize="small" />
            </AssistantAvatar>
            <MessageBubble messageRole="assistant">{streamingText}</MessageBubble>
          </MessageRow>
        )}

        {error && (
          <Alert severity="error" variant="outlined" sx={{ alignSelf: 'center' }}>
            {error}
          </Alert>
        )}
        <div ref={bottomRef} />
      </MessageLog>

      <ChatForm onSubmit={handleSend}>
        <TextField
          fullWidth
          placeholder="Type your message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <IconButton type="submit" color="primary" disabled={busy || !input.trim()} aria-label="Send message">
          <SendIcon />
        </IconButton>
      </ChatForm>
    </ChatContainer>
  );
}
