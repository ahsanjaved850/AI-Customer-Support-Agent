import { useEffect, useState } from 'react';
import { AppBar, IconButton, Tab, Tabs, Toolbar, Typography } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { ChatWidget } from '@/components/ChatWidget';
import { SetupPanel } from '@/components/SetupPanel';
import { getConfig } from '@/api';
import { useColorMode } from '@/theme/ColorModeProvider';
import { AppShell, ContentContainer } from './App.style';

type TabValue = 'chat' | 'setup';

export function App() {
  const [tab, setTab] = useState<TabValue>('setup');
  const [checkedConfig, setCheckedConfig] = useState(false);
  const { mode, toggleColorMode } = useColorMode();

  useEffect(() => {
    getConfig()
      .then((status) => setTab(status.configured ? 'chat' : 'setup'))
      .catch(() => setTab('setup'))
      .finally(() => setCheckedConfig(true));
  }, []);

  return (
    <AppShell>
      <AppBar position="static" color="transparent" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1 }}>
          <SupportAgentIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            AI Customer Support Agent
          </Typography>
          <Tabs value={tab} onChange={(_e, value: TabValue) => setTab(value)}>
            <Tab value="chat" label="Chat" />
            <Tab value="setup" label="Setup" />
          </Tabs>
          <IconButton
            onClick={toggleColorMode}
            aria-label="Toggle color mode"
            color="inherit"
            sx={{ ml: 1 }}
          >
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <ContentContainer>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Answers your customers based on the policies and history you give it.
        </Typography>

        {!checkedConfig ? null : tab === 'chat' ? (
          <ChatWidget />
        ) : (
          <SetupPanel onConfigured={() => setTab('chat')} />
        )}
      </ContentContainer>
    </AppShell>
  );
}
