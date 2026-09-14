"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogContent, DialogTitle, FormControl, IconButton,
  InputLabel, MenuItem, Pagination, Paper, Select, Skeleton, Stack, Typography,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import FilterListOutlined from "@mui/icons-material/FilterListOutlined";
import SearchOffOutlined from "@mui/icons-material/SearchOffOutlined";
import { fetchRecruiterCompetencies, fetchTalents, talentSearchParams } from "@/lib/recruiter";
import { hasTalentFilters, parseTalentSearch } from "@/lib/recruiter-search";
import { getApiErrorMessage } from "@/lib/api";
import { DISPONIBILIDADE_LABELS, MODALIDADE_LABELS, STATUS_FORMACAO_LABELS, TIPO_FORMACAO_LABELS } from "@/lib/labels";
import type { CatalogoCompetenciaResponse } from "@/types/student";
import type { PaginatedResponse, TalentListItem, TalentSearchFilters, TalentSort } from "@/types/recruiter";
import { TalentCard } from "./TalentCard";
import { TalentFilters } from "./TalentFilters";
import { ComparisonBar } from "./ComparisonBar";

export function TalentDiscoveryView() {
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();
  const current = useMemo(() => parseTalentSearch(new URLSearchParams(queryKey)), [queryKey]);
  return <TalentDiscoveryState key={queryKey} initial={current} />;
}

function TalentDiscoveryState({ initial }: { initial: TalentSearchFilters }) {
  const router = useRouter(); const pathname = usePathname();
  const [draft, setDraft] = useState(initial); const [mobileOpen, setMobileOpen] = useState(false);
  const [result, setResult] = useState<PaginatedResponse<TalentListItem> | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const [competencies, setCompetencies] = useState<CatalogoCompetenciaResponse[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null); const [catalogVersion, setCatalogVersion] = useState(0);
  const [selected, setSelected] = useState<TalentListItem[]>([]); const [selectionMessage, setSelectionMessage] = useState<string | null>(null);

  const navigate = useCallback((filters: TalentSearchFilters) => {
    const query = talentSearchParams(filters).toString(); router.push(`${pathname}${query ? `?${query}` : ""}`);
  }, [pathname, router]);

  useEffect(() => {
    let active = true;
    fetchTalents(initial).then((data) => { if (active) setResult(data); })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Não foi possível buscar talentos.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initial, resultVersion]);

  useEffect(() => {
    let active = true;
    fetchRecruiterCompetencies().then((data) => { if (active) setCompetencies(data); })
      .catch(() => { if (active) setCatalogError("O catálogo de competências não está disponível para esta conta."); });
    return () => { active = false; };
  }, [catalogVersion]);

  const clear = () => navigate({ ...parseTalentSearch(new URLSearchParams()), page: 1 });
  const apply = () => { setMobileOpen(false); navigate({ ...draft, page: 1 }); };
  const retryResults = () => { setLoading(true); setError(null); setResultVersion((value) => value + 1); };
  const retryCatalog = () => { setCatalogError(null); setCatalogVersion((value) => value + 1); };
  const filterCount = [initial.nome, initial.cidade, initial.uf, initial.competenciaIds.length, initial.tiposFormacao.length,
    initial.formacaoNome, initial.statusFormacao.length, initial.rpvVerificado, initial.disponibilidades.length, initial.modalidades.length].filter(Boolean).length;
  const activeLabels = [
    initial.nome && `Nome: ${initial.nome}`,
    initial.cidade && `Cidade: ${initial.cidade}`,
    initial.uf && `UF: ${initial.uf}`,
    ...initial.competenciaIds.map((id) => competencies.find((item) => item.id === id)?.nome ?? `Competência #${id}`),
    ...initial.tiposFormacao.map((item) => TIPO_FORMACAO_LABELS[item]),
    initial.formacaoNome && `Formação: ${initial.formacaoNome}`,
    ...initial.statusFormacao.map((item) => STATUS_FORMACAO_LABELS[item]),
    initial.rpvVerificado && "RPV verificado",
    ...initial.disponibilidades.map((item) => DISPONIBILIDADE_LABELS[item]),
    ...initial.modalidades.map((item) => MODALIDADE_LABELS[item]),
  ].filter((label): label is string => Boolean(label));
  const filters = <TalentFilters value={draft} onChange={setDraft} onApply={apply} onClear={clear} competencies={competencies}
    catalogError={catalogError} retryCatalog={retryCatalog} />;
  function updateFavorite(id: string, favorite: boolean) {
    setResult((currentResult) => currentResult ? { ...currentResult, items: currentResult.items.map((item) => item.id === id ? { ...item, favorito: favorite } : item) } : currentResult);
  }
  function updateSelection(talent: TalentListItem, checked: boolean) {
    setSelectionMessage(null);
    if (checked) {
      if (selected.some((item) => item.id === talent.id)) return;
      if (selected.length === 2) { setSelectionMessage("A comparação permite selecionar apenas dois talentos."); return; }
      setSelected((items) => [...items, talent]);
    } else setSelected((items) => items.filter((item) => item.id !== talent.id));
  }

  return <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}><Stack spacing={2.5}>
    <Box><Typography component="h1" variant="h4">Explorar talentos</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>Encontre perfis profissionais usando os critérios disponíveis.</Typography></Box>
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }} useFlexGap>
      <Button variant="outlined" startIcon={<FilterListOutlined />} onClick={() => setMobileOpen(true)} sx={{ display: { md: "none" } }}>Filtros{filterCount ? ` (${filterCount})` : ""}</Button>
      <Typography variant="body2" color="text.secondary">{loading ? "Buscando…" : `${result?.totalItems ?? 0} talento(s) encontrado(s)`}</Typography>
      <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel id="sort-label">Ordenar por</InputLabel>
        <Select labelId="sort-label" label="Ordenar por" value={initial.ordenacao ?? ""} onChange={(event) => navigate({ ...initial, page: 1, ordenacao: (event.target.value || null) as TalentSort | null })}>
          <MenuItem value=""><em>Padrão</em></MenuItem><MenuItem value="RELEVANCIA">Relevância</MenuItem><MenuItem value="RECENTES">Mais recentes</MenuItem><MenuItem value="NOME">Nome</MenuItem>
        </Select></FormControl>
    </Stack>
    {filterCount > 0 && <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><Typography variant="caption" color="text.secondary">Filtros ativos:</Typography>
      {activeLabels.map((label, index) => <Chip key={`${label}-${index}`} size="small" label={label} />)}<Button size="small" onClick={clear}>Limpar filtros</Button></Stack>}
    <Box className="grid grid-cols-1 gap-5 md:grid-cols-[300px_minmax(0,1fr)]">
      <Paper component="aside" elevation={0} sx={{ display: { xs: "none", md: "block" }, p: 2.5, border: 1, borderColor: "divider", alignSelf: "start", position: "sticky", top: 84, maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Filtros</Typography>{filters}
      </Paper>
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        {error && <Alert severity="error" action={<Button color="inherit" onClick={retryResults}>Tentar novamente</Button>}>{error}</Alert>}
        <ComparisonBar selected={selected} message={selectionMessage} />
        {loading ? [1, 2, 3].map((item) => <Skeleton key={item} variant="rounded" height={190} />)
          : result && result.items.length > 0 ? result.items.map((talent) => <TalentCard key={talent.id} talent={talent} onFavoriteChange={(favorite) => updateFavorite(talent.id, favorite)} comparisonSelected={selected.some((item) => item.id === talent.id)} onComparisonChange={(checked) => updateSelection(talent, checked)} />)
          : !error && <Paper elevation={0} sx={{ p: 5, border: 1, borderColor: "divider", textAlign: "center" }}><SearchOffOutlined color="action" sx={{ fontSize: 48 }} />
            <Typography variant="h6" sx={{ mt: 1 }}>Nenhum talento encontrado</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>Tente ajustar os critérios da busca.</Typography>
            {hasTalentFilters(initial) && <Button onClick={clear} sx={{ mt: 2 }}>Limpar filtros</Button>}</Paper>}
        {!loading && result && result.totalPages > 1 && <Stack sx={{ alignItems: "center", pt: 1 }}><Pagination page={result.page} count={result.totalPages} color="primary"
          onChange={(_, page) => navigate({ ...initial, page })} siblingCount={0} boundaryCount={1} aria-label="Paginação de talentos" /></Stack>}
      </Stack>
    </Box>
    <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} fullWidth maxWidth="sm" fullScreen={false} aria-labelledby="mobile-filter-title"
      slotProps={{ paper: { sx: { m: { xs: 1, sm: 3 }, maxHeight: { xs: "calc(100% - 16px)", sm: "calc(100% - 64px)" } } } }}>
      <DialogTitle id="mobile-filter-title"><Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>Filtros<IconButton aria-label="Fechar filtros" onClick={() => setMobileOpen(false)}><CloseOutlined /></IconButton></Stack></DialogTitle>
      <DialogContent dividers>{filters}</DialogContent>
    </Dialog>
  </Stack></Container>;
}
