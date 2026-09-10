import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

export const AppShell = styled(Box)({
  minHeight: '100vh',
});

export const ContentContainer = styled('main')(({ theme }) => ({
  maxWidth: 720,
  margin: '0 auto',
  padding: theme.spacing(5, 2.5),
}));
