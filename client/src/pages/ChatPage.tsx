import { useEffect, useState } from 'react';
import { Alert, Typography } from '@mui/material';
import { ChatWidget } from '@/components/ChatWidget';
import { getConfig } from '@/api';
import { useBranding } from '@/branding/BrandingProvider';

// The customer-facing surface — end users of a company only ever see this
// page. There is no way to reach Setup from here, not even hidden in the
// DOM: AdminPanel/SetupPanel simply aren't imported into this tree.
export function ChatPage() {
  const { loading: brandingLoading, notFound } = useBranding();
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    if (notFound) return;
    getConfig()
      .then((status) => setConfigured(status.configured))
      .catch(() => setConfigured(false))
      .finally(() => setReady(true));
  }, [notFound]);

  if (brandingLoading) return null;

  if (notFound) {
    return (
      <Alert severity="error" variant="outlined">
        No company found at this address.
      </Alert>
    );
  }

  if (!ready) return null;

  if (!configured) {
    return (
      <Alert severity="info" variant="outlined">
        This company hasn't finished setting up their assistant yet.
      </Alert>
    );
  }

  return (
    <>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Ask a question — answers are grounded in this company's policies and support history.
      </Typography>
      <ChatWidget />
    </>
  );
}
