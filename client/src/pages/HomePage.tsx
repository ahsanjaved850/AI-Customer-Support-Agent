import { Typography } from '@mui/material';

// Shown at "/" — there's no company in the URL yet, so there's nothing to
// render but a pointer to where a company's chat/admin pages actually live.
export function HomePage() {
  return (
    <>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
        This is a support-chat platform for companies to embed on their own site.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Visit <code>/c/your-company-slug</code> for a company's chat widget, or{' '}
        <code>/admin/your-company-slug</code> to manage a company's setup.
      </Typography>
    </>
  );
}
