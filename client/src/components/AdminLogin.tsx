import { useState } from 'react';
import { Alert, Button, Paper, TextField, Typography } from '@mui/material';
import { login } from '@/api';

interface Props {
  onSuccess: () => void;
}

// Simple, one-off form — no co-located .style.ts file, sx is enough per
// this repo's own styling convention (see CLAUDE.md's Styling section).
export function AdminLogin({ onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(password);
      setPassword('');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Paper
      elevation={1}
      component="form"
      onSubmit={handleSubmit}
      sx={{ p: 3, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 360 }}
    >
      <Typography variant="subtitle1">Admin sign-in required</Typography>
      <Typography variant="body2" color="text.secondary">
        This deployment requires an admin password to change setup, provider keys, or documents.
      </Typography>
      <TextField
        type="password"
        placeholder="Admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        required
      />
      <Button type="submit" variant="contained" disabled={submitting || !password}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
      {error && (
        <Alert severity="error" variant="outlined">
          {error}
        </Alert>
      )}
    </Paper>
  );
}
