"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Container, Pagination, Stack, Typography } from "@mui/material";
import FavoriteBorderOutlined from "@mui/icons-material/FavoriteBorderOutlined";
import { EmptyState } from "@/components/common/EmptyState";
import { CONTENT_MAX_WIDTH } from "@/components/layout/contentWidth";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { Reveal } from "@/components/common/Reveal";
import { getApiErrorMessage } from "@/lib/api";
import { fetchFavorites } from "@/lib/recruiter";
import { AVISO_PCD } from "@/lib/talent-busca";
import type { FavoriteTalent, PaginatedResponse, TalentListItem } from "@/types/recruiter";
import { TalentCard } from "./TalentCard";
import { ComparisonBar } from "./ComparisonBar";
import { TalentPreviewDialog } from "./TalentPreviewDialog";

function pageFrom(params: Pick<URLSearchParams, "get">) { const value = Number(params.get("page")); return Number.isInteger(value) && value > 0 ? value : 1; }

export function FavoritesView() {
  const params = useSearchParams(); const pathname = usePathname(); const router = useRouter();
  const page = useMemo(() => pageFrom(params), [params]);
  const [data, setData] = useState<PaginatedResponse<FavoriteTalent> | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<TalentListItem[]>([]); const [selectionMessage, setSelectionMessage] = useState<string | null>(null); const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const navigate = useCallback((nextPage: number) => { setLoading(true); setError(null); router.push(`${pathname}${nextPage > 1 ? `?page=${nextPage}` : ""}`); }, [pathname, router]);

  useEffect(() => {
    if (params.get("page") !== null && page === 1 && params.get("page") !== "1") router.replace(pathname);
  }, [page, params, pathname, router]);
  useEffect(() => { let active = true;
    fetchFavorites(page).then((value) => { if (active) setData(value); }).catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Não foi possível carregar seus favoritos.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, version]);
  function retry() { setLoading(true); setError(null); setVersion((value) => value + 1); }
  function favoriteChanged(slug: string, favorite: boolean) {
    if (favorite) { retry(); return; }
    setSelected((items) => items.filter((item) => item.slug !== slug));
    const remaining = (data?.items ?? []).filter((item) => item.talento.slug !== slug);
    if (remaining.length === 0 && page > 1) navigate(page - 1); else retry();
  }
  function favoriteUnavailable(slug: string) {
    setUnavailableMessage("Este perfil não está mais disponível.");
    setSelected((items) => items.filter((item) => item.slug !== slug));
    const remaining = (data?.items ?? []).filter((item) => item.talento.slug !== slug);
    if (remaining.length === 0 && page > 1) navigate(page - 1); else retry();
  }
  function selectionChanged(talent: TalentListItem, checked: boolean) {
    setSelectionMessage(null);
    if (checked) {
      if (selected.some((item) => item.id === talent.id)) return;
      if (selected.length === 2) { setSelectionMessage("A comparação permite selecionar apenas dois talentos."); return; }
      setSelected((items) => [...items, talent]);
    } else setSelected((items) => items.filter((item) => item.id !== talent.id));
  }
  const items = data?.items ?? [];
  return <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: { xs: 3, md: 4 } }}><Stack spacing={2.5}>
    <PageHeader title="Favoritos" description="Perfis que você salvou para consultar depois." />
    <Typography variant="caption" color="text.secondary">{AVISO_PCD}</Typography>
    <ComparisonBar selected={selected} message={selectionMessage} />
    {error && <Alert severity="error" action={<Button color="inherit" onClick={retry}>Tentar novamente</Button>}>{error}</Alert>}
    {unavailableMessage && <Alert severity="info" onClose={() => setUnavailableMessage(null)}>{unavailableMessage}</Alert>}
    {loading && <LoadingSkeleton variant="list" count={3} />}
    {!loading && items.length > 0 && <>
      {items.map(({ talento }, position) => <Reveal key={talento.id} index={position}><TalentCard talent={talento} onFavoriteChange={(favorite) => favoriteChanged(talento.slug, favorite)} onUnavailable={() => favoriteUnavailable(talento.slug)} comparisonSelected={selected.some((item) => item.id === talento.id)} onComparisonChange={(checked) => selectionChanged(talento, checked)} onPreview={() => setPreviewSlug(talento.slug)} /></Reveal>)}
      {data && data.totalPages > 1 && <Stack sx={{ alignItems: "center", pt: 1 }}><Pagination page={data.page} count={data.totalPages} color="primary" onChange={(_, next) => navigate(next)} siblingCount={0} boundaryCount={1} aria-label="Paginação de favoritos" /></Stack>}
    </>}
    {!loading && !error && items.length === 0 && <EmptyState icon={<FavoriteBorderOutlined />} title="Nenhum favorito ainda" description="Salve talentos para encontrá-los rapidamente aqui." action={<Button component={Link} href="/recrutador/talentos" variant="contained">Explorar talentos</Button>} />}
    <TalentPreviewDialog open={Boolean(previewSlug)} slug={previewSlug} onClose={() => setPreviewSlug(null)}
      onFavoriteChange={(favorite) => { if (previewSlug) favoriteChanged(previewSlug, favorite); }}
      onUnavailable={() => { if (previewSlug) favoriteUnavailable(previewSlug); }} />
  </Stack></Container>;
}
