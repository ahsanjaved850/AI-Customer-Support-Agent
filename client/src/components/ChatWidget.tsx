import { useEffect, useRef, useState } from 'react';
import { Alert, IconButton, TextField } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { sendChatStream } from '@/api';
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

const GREETING: ChatMessage = {
  role: 'assistant',
  content: 'Hi! I’m your support assistant. How can I help today?',
};

export function ChatWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  // Submitted, no tokens received yet — shows the bouncing-dots indicator.
  const [isWaiting, setIsWaiting] = useState(false);
  // First chunk has arrived and more may still be coming.
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = isWaiting || isStreaming;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWaiting, streamingText]);

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

    try {
      let firstChunkReceived = false;
      const full = await sendChatStream(next, (chunk) => {
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          setIsWaiting(false);
          setIsStreaming(true);
        }
        setStreamingText((prev) => prev + chunk);
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: full }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsWaiting(false);
      setIsStreaming(false);
      setStreamingText('');
    }
  }

  return (
    <ChatContainer elevation={2}>
      <ChatHeader>
        <SupportAgentIcon fontSize="small" />
        Support
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
