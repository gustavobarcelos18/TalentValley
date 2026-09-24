"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Chip, Container, InputAdornment, Paper, Skeleton, Stack, TextField, Typography } from "@mui/material";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import FavoriteBorderOutlined from "@mui/icons-material/FavoriteBorderOutlined";
import NewReleasesOutlined from "@mui/icons-material/NewReleasesOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import UpdateOutlined from "@mui/icons-material/UpdateOutlined";
import { fetchRecruiterDashboard } from "@/lib/recruiter";
import { getApiErrorMessage } from "@/lib/api";
import { validateSearchTerm } from "@/lib/validation";
import type { RecruiterDashboard } from "@/types/recruiter";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";

const indicators = [
  { key: "perfisAtualizadosDesdeUltimoAcesso", label: "Perfis atualizados", icon: <UpdateOutlined color="primary" /> },
  { key: "novosAlunosDesdeUltimoAcesso", label: "Novos alunos", icon: <NewReleasesOutlined color="primary" /> },
  { key: "favoritos", label: "Favoritos", icon: <FavoriteBorderOutlined color="primary" /> },
] as const;

export function RecruiterDashboardView() {
  const [data, setData] = useState<RecruiterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    fetchRecruiterDashboard().then((response) => { if (active) setData(response); })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Não foi possível carregar a visão geral.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [version]);
  function retry() { setLoading(true); setError(null); setVersion((value) => value + 1); }

  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = searchTerm.trim();
    const validation = validateSearchTerm(term, 150);
    setSearchError(validation);
    if (validation) return;
    router.push(term ? `/recrutador/talentos?nome=${encodeURIComponent(term)}` : "/recrutador/talentos");
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
          <Box>
            <Typography component="h1" variant="h4">Visão geral</Typography>
            <Typography color="text.secondary" sx={{ mt: .5 }}>
              {data?.desdeUltimoAcesso ? "Acompanhe o que mudou desde o seu último acesso." : "Bem-vindo. Comece explorando os talentos disponíveis."}
            </Typography>
          </Box>
          <Button component={Link} href="/recrutador/talentos" variant="contained" endIcon={<ArrowForwardOutlined />}>Explorar talentos</Button>
        </Stack>
        <Paper component="form" onSubmit={submitSearch} elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: 1, borderColor: "divider" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
            <TextField
              label="Buscar talentos"
              placeholder="Busque por nome"
              value={searchTerm}
              onChange={(event) => { setSearchTerm(event.target.value.slice(0, 150)); if (searchError) setSearchError(null); }}
              slotProps={{ htmlInput: { maxLength: 150 }, input: { startAdornment: <InputAdornment position="start"><SearchOutlined color="action" /></InputAdornment> } }}
              error={Boolean(searchError)}
              helperText={searchError ?? undefined}
              fullWidth
            />
            <Button type="submit" variant="contained" startIcon={<SearchOutlined />} sx={{ flexShrink: 0 }}>Buscar</Button>
          </Stack>
        </Paper>
        {error && <Alert severity="error" action={<Button color="inherit" onClick={retry}>Tentar novamente</Button>}>{error}</Alert>}
        <Box className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {indicators.map((item) => (
            <Paper key={item.key} elevation={0} sx={{ p: 2.5, border: 1, borderColor: "divider" }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>{item.icon}<Box>
                <Typography variant="h5">{loading ? <Skeleton width={32} /> : data?.indicadores[item.key] ?? 0}</Typography>
                <Typography variant="body2" color="text.secondary">{item.label}</Typography>
              </Box></Stack>
            </Paper>
          ))}
        </Box>
        <Paper component="section" elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, border: 1, borderColor: "divider" }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography component="h2" variant="h6">Favoritos recentes</Typography>
            <Button component={Link} href="/recrutador/favoritos" size="small" endIcon={<ArrowForwardOutlined />}>Ver todos</Button>
          </Stack>
          {loading ? <Stack spacing={2} sx={{ mt: 2 }}>{[1, 2].map((item) => <Skeleton key={item} variant="rounded" height={76} />)}</Stack>
            : data && data.favoritosRecentes.length > 0 ? <Stack divider={<Box sx={{ borderBottom: 1, borderColor: "divider" }} />} sx={{ mt: 1 }}>
              {data.favoritosRecentes.map(({ talento }) => (
                <Stack key={talento.id} component={Link} href={`/recrutador/talentos/${talento.slug}`} direction="row" spacing={2}
                  sx={{ py: 1.5, alignItems: "center", color: "inherit", textDecoration: "none", borderRadius: 1, "&:hover": { bgcolor: "action.hover" } }}>
                  <ProtectedTalentPhoto path={talento.fotoUrl} name={talento.nomeCompleto} size={48} />
                  <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontWeight: 650 }} noWrap>{talento.nomeCompleto}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{[talento.cidade, talento.uf].filter(Boolean).join(" / ") || "Localização não informada"}</Typography></Box>
                  {talento.formacaoPrincipal?.rpvVerificado && <Chip size="small" color="success" label="RPV verificado" sx={{ display: { xs: "none", sm: "inline-flex" } }} />}
                  <ArrowForwardOutlined color="action" />
                </Stack>
              ))}
            </Stack> : <Typography color="text.secondary" sx={{ mt: 2 }}>Você ainda não possui favoritos recentes.</Typography>}
        </Paper>
      </Stack>
    </Container>
  );
}
