import { Route, Routes } from 'react-router-dom';
import { AppBar, IconButton, Toolbar, Typography } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { AdminPage } from '@/pages/AdminPage';
import { ChatPage } from '@/pages/ChatPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { DEFAULT_COMPANY_NAME, useBranding } from '@/branding/BrandingProvider';
import { useColorMode } from '@/theme/ColorModeProvider';
import { AppShell, ContentContainer } from './App.style';

export function App() {
  const { mode, toggleColorMode } = useColorMode();
  const { companyName } = useBranding();

  return (
    <AppShell>
      <AppBar position="static" color="transparent" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1 }}>
          <SupportAgentIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {companyName ?? DEFAULT_COMPANY_NAME}
          </Typography>
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
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/c/:slug" element={<ChatPage />} />
          <Route path="/admin/:slug" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ContentContainer>
    </AppShell>
  );
}
