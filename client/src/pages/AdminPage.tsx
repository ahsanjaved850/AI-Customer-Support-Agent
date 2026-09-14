import { Alert, Typography } from '@mui/material';
import { SetupPanel } from '@/components/SetupPanel';
import { useBranding } from '@/branding/BrandingProvider';

// Admin-only surface — reached at /admin/:slug, never linked from the
// customer-facing ChatPage. SetupPanel itself still gates on the admin
// session (see its own auth-status check) before showing anything mutable.
export function AdminPage() {
  const { loading, notFound } = useBranding();

  if (loading) return null;

  if (notFound) {
    return (
      <Alert severity="error" variant="outlined">
        No company found at this address.
      </Alert>
    );
  }

  return (
    <>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage this company's branding, LLM provider, and ingested documents.
      </Typography>
      <SetupPanel />
    </>
  );
}
