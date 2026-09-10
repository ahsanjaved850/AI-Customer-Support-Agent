import { styled } from '@mui/material/styles';
import { Box, Paper, Stack } from '@mui/material';

export const SetupStack = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(3.5),
}));

export const SectionPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
}));

export const FormRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.25),
  alignItems: 'center',
}));

// A styled('form') rather than styled(Box) with component="form" — styled()
// on an MUI polymorphic component (Box) doesn't retain the `component` prop
// in its types, so actual <form> containers get their own styled element.
export const FormBar = styled('form')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.25),
  alignItems: 'center',
}));

export const ResultCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  backgroundColor: theme.palette.action.hover,
  boxShadow: 'none',
}));
