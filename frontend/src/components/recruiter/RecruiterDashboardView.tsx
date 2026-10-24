"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Card, Chip, Container, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import FavoriteBorderOutlined from "@mui/icons-material/FavoriteBorderOutlined";
import NewReleasesOutlined from "@mui/icons-material/NewReleasesOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import UpdateOutlined from "@mui/icons-material/UpdateOutlined";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { Reveal } from "@/components/common/Reveal";
import { StatCard } from "@/components/common/StatCard";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { brandWash } from "@/components/common/surfaceGradient";
import { CONTENT_MAX_WIDTH } from "@/components/layout/contentWidth";
import { fetchRecruiterDashboard } from "@/lib/recruiter";
import { getApiErrorMessage } from "@/lib/api";
import { validateSearchTerm } from "@/lib/validation";
import type { RecruiterDashboard } from "@/types/recruiter";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";

const indicators = [
  { key: "perfisAtualizadosDesdeUltimoAcesso", label: "Perfis atualizados", icon: <UpdateOutlined /> },
  { key: "novosAlunosDesdeUltimoAcesso", label: "Novos alunos", icon: <NewReleasesOutlined /> },
  { key: "favoritos", label: "Favoritos", icon: <FavoriteBorderOutlined /> },
] as const;

function RecentFavorites({ loading, favorites }: { loading: boolean; favorites: RecruiterDashboard["favoritosRecentes"] }) {
  if (loading) return <LoadingSkeleton variant="list" count={2} />;
  if (favorites.length === 0) return <EmptyState icon={<FavoriteBorderOutlined />} title="Você ainda não possui favoritos recentes." description="Os talentos que você favoritar aparecem aqui para consulta rápida." />;
  return (
    <Stack spacing={.5}>
              {favorites.map(({ talento }) => (
                <Stack key={talento.id} component={Link} href={`/recrutador/talentos/${talento.slug}`} direction="row" spacing={2}
                  sx={(theme) => ({ p: 1.5, alignItems: "center", color: "inherit", textDecoration: "none", borderRadius: 3, transition: "background-color 150ms", "&:hover": { bgcolor: (theme.vars ?? theme).palette.surface.hover } })}>
                  <ProtectedTalentPhoto path={talento.fotoUrl} name={talento.nomeCompleto} size={48} />
                  <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontWeight: 650 }} noWrap>{talento.nomeCompleto}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{[talento.cidade, talento.uf].filter(Boolean).join(" / ") || "Localização não informada"}</Typography></Box>
                  {talento.rpvVerificado && <Chip size="small" color="success" icon={<VerifiedOutlined />} label="RPV verificado" sx={{ display: { xs: "none", sm: "inline-flex" } }} />}
                  <ArrowForwardOutlined color="action" />
                </Stack>
              ))}
            </Stack>
  );
}

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
    <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: { xs: 3, md: 4 } }}>
      <Stack spacing={3}>
        <PageHeader
          title="Visão geral"
          description={data?.desdeUltimoAcesso ? "Acompanhe o que mudou desde o seu último acesso." : "Bem-vindo. Comece explorando os talentos disponíveis."}
          action={<Button component={Link} href="/recrutador/talentos" variant="contained" endIcon={<ArrowForwardOutlined />}>Explorar talentos</Button>}
        />
        <Reveal index={1}>
          <Card
            component="form"
            onSubmit={submitSearch}
            sx={(theme) => ({ p: { xs: 2.5, sm: 3.5 }, backgroundImage: brandWash(theme) })}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "flex-start" } }}>
              <TextField
                label="Buscar talentos"
                placeholder="Busque por nome"
                value={searchTerm}
                onChange={(event) => { setSearchTerm(event.target.value.slice(0, 150)); if (searchError) setSearchError(null); }}
                slotProps={{ htmlInput: { maxLength: 150 }, input: { startAdornment: <InputAdornment position="start"><SearchOutlined color="action" /></InputAdornment> } }}
                error={Boolean(searchError)}
                helperText={searchError ?? undefined}
                size="medium"
                fullWidth
                sx={{ "& .MuiInputBase-root": { fontSize: "1.0625rem", bgcolor: "background.paper" } }}
              />
              <Button type="submit" variant="contained" size="large" startIcon={<SearchOutlined />} sx={{ flexShrink: 0, minHeight: 56 }}>Buscar</Button>
            </Stack>
          </Card>
        </Reveal>
        {error && <Alert severity="error" action={<Button color="inherit" onClick={retry}>Tentar novamente</Button>}>{error}</Alert>}
        {loading ? <LoadingSkeleton variant="stats-three" count={indicators.length} /> : (
          <Box className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {indicators.map((item, position) => (
              <StatCard key={item.key} label={item.label} value={data?.indicadores[item.key] ?? 0} icon={item.icon} index={position + 2} />
            ))}
          </Box>
        )}
        <SurfaceCard title="Favoritos recentes" index={5} action={<Button component={Link} href="/recrutador/favoritos" size="small" endIcon={<ArrowForwardOutlined />}>Ver todos</Button>}>
          <RecentFavorites loading={loading} favorites={data?.favoritosRecentes ?? []} />
        </SurfaceCard>
      </Stack>
    </Container>
  );
}
