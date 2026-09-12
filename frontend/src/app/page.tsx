import Link from "next/link";
import { Button, Container, Paper, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Talent Valley — Career Platform by Rio Pomba Valley",
};

export default function Home() {
  return (
    <main className="flex min-h-screen items-center bg-gradient-to-br from-zinc-50 to-violet-50 px-4 py-16 dark:from-zinc-950 dark:to-zinc-900">
      <Container maxWidth="sm">
        <Paper elevation={0} className="border border-zinc-200 px-8 py-12 text-center sm:px-12 dark:border-zinc-800">
          <Stack spacing={3} sx={{ alignItems: "center" }}>
            <Stack spacing={1}>
              <Typography component="h1" variant="h3" color="primary.main">
                Talent Valley
              </Typography>
              <Typography variant="h6" color="text.secondary">
                Career Platform by Rio Pomba Valley
              </Typography>
            </Stack>
            <Typography color="text.secondary">
              Conectando talentos do Rio Pomba Valley ao mercado de tecnologia.
            </Typography>
            <Link href="/login" className="block w-full max-w-xs no-underline">
              <Button variant="contained" size="large" fullWidth>
                Entrar
              </Button>
            </Link>
          </Stack>
        </Paper>
      </Container>
    </main>
  );
}
