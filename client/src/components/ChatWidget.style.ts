import { keyframes } from '@emotion/react';
import { styled } from '@mui/material/styles';
import { Avatar, Box, Paper } from '@mui/material';
import type { Role } from '@/types';

export const ChatContainer = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: 520,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  overflow: 'hidden',
}));

export const ChatHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2.5),
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  fontWeight: 600,
}));

export const MessageLog = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(2.5),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
}));

// One row per message: the assistant's avatar + bubble sit side by side on
// the left, a user's bubble is pushed to the right — mirrors how WhatsApp
// lays out a contact's avatar next to their messages.
export const MessageRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'messageRole',
})<{ messageRole: Role }>(({ theme, messageRole }) => ({
  display: 'flex',
  alignItems: 'flex-end',
  gap: theme.spacing(1),
  justifyContent: messageRole === 'user' ? 'flex-end' : 'flex-start',
}));

export const AssistantAvatar = styled(Avatar)(({ theme }) => ({
  width: 26,
  height: 26,
  backgroundColor: theme.palette.primary.main,
  flexShrink: 0,
}));

export const MessageBubble = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'messageRole',
})<{ messageRole: Role }>(({ theme, messageRole }) => {
  const isUser = messageRole === 'user';
  return {
    maxWidth: '78%',
    padding: theme.spacing(1.1, 1.75),
    borderRadius: Number(theme.shape.borderRadius) * 1.5,
    borderBottomRightRadius: isUser ? 4 : undefined,
    borderBottomLeftRadius: isUser ? undefined : 4,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    backgroundColor: isUser ? theme.palette.primary.main : theme.palette.action.hover,
    color: isUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
  };
});

const bounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
`;

// "Assistant is typing…" indicator: three dots bouncing in sequence,
// shown in a bubble before the first chunk of a reply has arrived.
export const TypingDots = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: theme.spacing(0.25, 0),
  '& span': {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: theme.palette.text.secondary,
    animation: `${bounce} 1.2s infinite ease-in-out`,
  },
  '& span:nth-of-type(2)': { animationDelay: '0.15s' },
  '& span:nth-of-type(3)': { animationDelay: '0.3s' },
}));

// A styled('form') rather than styled(Box) with component="form" — styled()
// on an MUI polymorphic component (Box) doesn't retain the `component` prop
// in its types, so the actual <form> container gets its own styled element.
export const ChatForm = styled('form')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
}));
