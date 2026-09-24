"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Box, Button, Chip, Container, Divider, Paper, Skeleton, Stack, Typography } from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { fetchTalentComparison } from "@/lib/recruiter";
import { DISPONIBILIDADE_LABELS, MODALIDADE_LABELS, NIVEL_IDIOMA_LABELS, TIPO_FORMACAO_LABELS } from "@/lib/labels";
import { normalizePhone, validateBrazilianPhone, validateEmail, validateHttpUrl } from "@/lib/validation";
import type { TalentCommon, TalentCompetency, TalentProfile, TalentComparison } from "@/types/recruiter";
import { ProtectedFileButton } from "./ProtectedFileButton";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";

function comparisonSlugs(params: Pick<URLSearchParams, "getAll">): [string, string] | null {
  const values = params.getAll("slugs");
  return values.length === 2 && values[0].trim() && values[1].trim() && values[0] !== values[1] ? [values[0], values[1]] : null;
}

// Competencies present in this profile but not shared with the other student,
// matched by stable competency ID (never by display name).
function exclusiveCompetencies(profile: TalentProfile, common: TalentCommon): TalentCompetency[] {
  const commonIds = new Set(common.competencias.map((item) => item.id));
  return profile.competencias.filter((item) => !commonIds.has(item.id));
}

export function TalentComparisonView() {
  const searchParams = useSearchParams(); const slugs = useMemo(() => comparisonSlugs(searchParams), [searchParams]);
  const [comparison, setComparison] = useState<TalentComparison | null>(null); const [loading, setLoading] = useState(Boolean(slugs)); const [error, setError] = useState<string | null>(null); const [version, setVersion] = useState(0);
  useEffect(() => { if (!slugs) return; let active = true;
    fetchTalentComparison(slugs).then((data) => { if (active) setComparison(data); }).catch((reason) => { if (!active) return; setError(reason instanceof ApiError && reason.status === 404 ? "Um dos perfis não está mais disponível." : getApiErrorMessage(reason, "Não foi possível carregar a comparação.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slugs, version]);
  if (!slugs) return <ComparisonState title="Selecione exatamente dois talentos para comparar." />;
  if (loading) return <Container maxWidth="xl" sx={{ py: 4 }}><Stack spacing={2}>{[1, 2, 3].map((item) => <Skeleton key={item} variant="rounded" height={180} />)}</Stack></Container>;
  function retry() { setLoading(true); setError(null); setVersion((value) => value + 1); }
  if (error || !comparison) return <Container maxWidth="md" sx={{ py: 5 }}><Alert severity="error" action={<Button color="inherit" onClick={retry}>Tentar novamente</Button>}>{error ?? "Não foi possível carregar a comparação."}</Alert></Container>;
  return <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}><Stack spacing={2.5}>
    <Box><Button component={Link} href="/recrutador/talentos" startIcon={<ArrowBackOutlined />}>Voltar para talentos</Button><Typography component="h1" variant="h4" sx={{ mt: 1 }}>Comparar talentos</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>Informações apresentadas lado a lado, sem ranking ou recomendação.</Typography></Box>
    <Box className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <ComparisonSide profile={comparison.talentoA} exclusiveCompetencies={exclusiveCompetencies(comparison.talentoA, comparison.emComum)} />
      <Common common={comparison.emComum} />
      <ComparisonSide profile={comparison.talentoB} exclusiveCompetencies={exclusiveCompetencies(comparison.talentoB, comparison.emComum)} />
    </Box>
  </Stack></Container>;
}

function ComparisonSide({ profile, exclusiveCompetencies }: { profile: TalentProfile; exclusiveCompetencies: TalentCompetency[] }) { const [fileError, setFileError] = useState<string | null>(null); return <Paper component="article" elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: 1, borderColor: "divider", minWidth: 0 }}><Stack spacing={2.25}>
  {fileError && <Alert severity="error" onClose={() => setFileError(null)}>{fileError}</Alert>}
  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}><ProtectedTalentPhoto path={profile.fotoUrl} name={profile.nomeCompleto} size={72} /><Box sx={{ minWidth: 0 }}><Typography component="h2" variant="h6" sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{profile.nomeCompleto}</Typography><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{[profile.cidade, profile.uf].filter(Boolean).join(" / ") || "Localização não informada"}</Typography></Box></Stack>
  <CompareSection title="Sobre"><Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }} color={profile.bio ? "text.primary" : "text.secondary"}>{profile.bio || "Apresentação profissional não informada."}</Typography></CompareSection>
  <CompareSection title="Competências exclusivas"><CompetencyChips values={exclusiveCompetencies} /></CompareSection>
  <CompareSection title="Trajetória">{profile.formacoes.length || profile.experiencias.length ? <Stack spacing={1} divider={<Divider flexItem />}>{profile.formacoes.map((item) => <Box key={item.id}><Typography variant="subtitle2" sx={{ overflowWrap: "anywhere" }}>{item.nome}</Typography><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{item.instituicao} · {TIPO_FORMACAO_LABELS[item.tipo]}</Typography>{item.possuiCertificado && item.certificadoUrl && <ProtectedFileButton path={item.certificadoUrl} label="Abrir certificado" onError={setFileError} />}</Box>)}{profile.experiencias.map((item) => <Box key={item.id}><Typography variant="subtitle2" sx={{ overflowWrap: "anywhere" }}>{item.cargo}</Typography><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{item.empresa}</Typography>{item.descricao && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{item.descricao}</Typography>}</Box>)}</Stack> : <Empty />}</CompareSection>
  <CompareSection title="Projetos">{profile.projetos.length ? <Stack spacing={1}>{profile.projetos.map((item) => <Box key={item.id}><Typography variant="subtitle2" sx={{ overflowWrap: "anywhere" }}>{item.nome}</Typography><Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{item.descricao}</Typography><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>{item.demoUrl && <SafeExternal url={item.demoUrl} label="Demonstração" size="small" />}{item.repositorioUrl && <SafeExternal url={item.repositorioUrl} label="Repositório" size="small" />}</Stack></Box>)}</Stack> : <Empty />}</CompareSection>
  <CompareSection title="Idiomas"><Chips values={profile.idiomas.map((item) => `${item.nome} · ${NIVEL_IDIOMA_LABELS[item.nivel]}`)} /></CompareSection>
  <CompareSection title="Disponibilidade"><Chips values={profile.disponibilidades.map((item) => DISPONIBILIDADE_LABELS[item])} /></CompareSection>
  <CompareSection title="Modalidades"><Chips values={profile.modalidades.map((item) => MODALIDADE_LABELS[item])} /></CompareSection>
  <CompareSection title="Contato"><Stack spacing={.5}>{profile.contato.emailProfissional && <SafeEmail value={profile.contato.emailProfissional} />}{profile.contato.telefone && <SafePhone value={profile.contato.telefone} />}{profile.contato.linkedInUrl && <SafeExternal url={profile.contato.linkedInUrl} label="LinkedIn" />}{profile.contato.gitHubUrl && <SafeExternal url={profile.contato.gitHubUrl} label="GitHub" />}{profile.contato.portfolioUrl && <SafeExternal url={profile.contato.portfolioUrl} label="Portfólio" />}{profile.curriculo.possuiCurriculo && profile.curriculo.url && <ProtectedFileButton path={profile.curriculo.url} label="Abrir currículo" onError={setFileError} />}</Stack></CompareSection>
</Stack></Paper>; }
function Common({ common }: { common: TalentCommon }) { return <Paper component="section" elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: 1, borderColor: "primary.light", bgcolor: "action.hover", minWidth: 0 }}><Stack spacing={2.5}><Typography component="h2" variant="h6" align="center">Em comum</Typography><CompareSection title="Competências gerais"><CompetencyChips values={common.competencias} emptyText="Nenhum item em comum." /></CompareSection><CompareSection title="Disponibilidade"><Chips values={common.disponibilidades.map((item) => DISPONIBILIDADE_LABELS[item])} emptyText="Nenhum item em comum." /></CompareSection><CompareSection title="Modalidades"><Chips values={common.modalidades.map((item) => MODALIDADE_LABELS[item])} emptyText="Nenhum item em comum." /></CompareSection></Stack></Paper>; }
function CompareSection({ title, children }: { title: string; children: React.ReactNode }) { return <Box component="section"><Typography variant="subtitle1" sx={{ fontWeight: 700, mb: .75 }}>{title}</Typography>{children}</Box>; }
function Chips({ values, emptyText = "Nenhuma informação cadastrada." }: { values: string[]; emptyText?: string }) { return values.length ? <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>{values.map((item) => <Chip key={item} label={item} size="small" />)}</Stack> : <Empty text={emptyText} />; }
function CompetencyChips({ values, emptyText = "Nenhuma informação cadastrada." }: { values: TalentCompetency[]; emptyText?: string }) { return values.length ? <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>{values.map((item) => <Chip key={item.id} label={item.nome} size="small" />)}</Stack> : <Empty text={emptyText} />; }
function Empty({ text = "Nenhuma informação cadastrada." }: { text?: string }) { return <Typography variant="body2" color="text.secondary">{text}</Typography>; }
// Contact values and external links are only rendered clickable when they pass
// validation. Malformed legacy values stay visible as plain text.
function PlainValue({ children }: { children: React.ReactNode }) { return <Typography variant="body2" sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{children}</Typography>; }
function SafeEmail({ value }: { value: string }) { return validateEmail(value) === null ? <Button component="a" href={`mailto:${value}`}>E-mail</Button> : <PlainValue>{value}</PlainValue>; }
function SafePhone({ value }: { value: string }) { return validateBrazilianPhone(value) === null ? <Button component="a" href={`tel:${normalizePhone(value)}`}>Telefone</Button> : <PlainValue>{value}</PlainValue>; }
function SafeExternal({ url, label, size }: { url: string; label: string; size?: "small" | "medium" }) { return validateHttpUrl(url) === null ? <Button component="a" href={url} target="_blank" rel="noreferrer" size={size}>{label}</Button> : <PlainValue>{url}</PlainValue>; }
function ComparisonState({ title }: { title: string }) { return <Container maxWidth="sm" sx={{ py: 8 }}><Paper elevation={0} sx={{ p: 4, border: 1, borderColor: "divider", textAlign: "center" }}><Typography variant="h5">{title}</Typography><Button component={Link} href="/recrutador/talentos" sx={{ mt: 2 }}>Explorar talentos</Button></Paper></Container>; }
