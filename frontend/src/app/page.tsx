import { Container, Paper, Stack, Typography } from "@mui/material";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center bg-slate-50 py-16">
      <Container maxWidth="sm">
        <Paper elevation={1} className="px-8 py-12 text-center sm:px-12">
          <Stack spacing={1}>
            <Typography component="h1" variant="h3" color="primary.main">
              Talent Valley
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Career Platform by Rio Pomba Valley
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </main>
  );
}
