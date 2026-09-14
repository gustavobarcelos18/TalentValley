"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Box, Button, Chip, Container, Divider, Paper, Skeleton, Stack, Typography } from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { fetchTalentComparison } from "@/lib/recruiter";
import { DISPONIBILIDADE_LABELS, MODALIDADE_LABELS, NIVEL_IDIOMA_LABELS, TIPO_FORMACAO_LABELS } from "@/lib/labels";
import type { TalentCommon, TalentProfile, TalentComparison } from "@/types/recruiter";
import { ProtectedFileButton } from "./ProtectedFileButton";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";

function comparisonSlugs(params: Pick<URLSearchParams, "getAll">): [string, string] | null {
  const values = params.getAll("slugs");
  return values.length === 2 && values[0].trim() && values[1].trim() && values[0] !== values[1] ? [values[0], values[1]] : null;
}

export function TalentComparisonView() {
  const searchParams = useSearchParams(); const slugs = useMemo(() => comparisonSlugs(searchParams), [searchParams]);
  const [comparison, setComparison] = useState<TalentComparison | null>(null); const [loading, setLoading] = useState(Boolean(slugs)); const [error, setError] = useState<string | null>(null); const [version, setVersion] = useState(0);
  useEffect(() => { if (!slugs) return; let active = true; setLoading(true); setError(null);
    fetchTalentComparison(slugs).then((data) => { if (active) setComparison(data); }).catch((reason) => { if (!active) return; setError(reason instanceof ApiError && reason.status === 404 ? "Um dos perfis não está mais disponível." : getApiErrorMessage(reason, "Não foi possível carregar a comparação.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slugs, version]);
  if (!slugs) return <ComparisonState title="Selecione exatamente dois talentos para comparar." />;
  if (loading) return <Container maxWidth="xl" sx={{ py: 4 }}><Stack spacing={2}>{[1, 2, 3].map((item) => <Skeleton key={item} variant="rounded" height={180} />)}</Stack></Container>;
  if (error || !comparison) return <Container maxWidth="md" sx={{ py: 5 }}><Alert severity="error" action={<Button color="inherit" onClick={() => setVersion((value) => value + 1)}>Tentar novamente</Button>}>{error ?? "Não foi possível carregar a comparação."}</Alert></Container>;
  return <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}><Stack spacing={2.5}>
    <Box><Button component={Link} href="/recrutador/talentos" startIcon={<ArrowBackOutlined />}>Voltar para talentos</Button><Typography component="h1" variant="h4" sx={{ mt: 1 }}>Comparar talentos</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>Informações apresentadas lado a lado, sem ranking ou recomendação.</Typography></Box>
    <Box className="grid grid-cols-1 gap-5 lg:grid-cols-3"><ComparisonSide profile={comparison.talentoA} /><Common common={comparison.emComum} /><ComparisonSide profile={comparison.talentoB} /></Box>
  </Stack></Container>;
}

function ComparisonSide({ profile }: { profile: TalentProfile }) { const [fileError, setFileError] = useState<string | null>(null); return <Paper component="article" elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: 1, borderColor: "divider" }}><Stack spacing={2.25}>
  {fileError && <Alert severity="error" onClose={() => setFileError(null)}>{fileError}</Alert>}
  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}><ProtectedTalentPhoto path={profile.fotoUrl} name={profile.nomeCompleto} size={72} /><Box><Typography component="h2" variant="h6">{profile.nomeCompleto}</Typography><Typography variant="body2" color="text.secondary">{[profile.cidade, profile.uf].filter(Boolean).join(" / ") || "Localização não informada"}</Typography></Box></Stack>
  <CompareSection title="Sobre"><Typography color={profile.bio ? "text.primary" : "text.secondary"}>{profile.bio || "Apresentação profissional não informada."}</Typography></CompareSection>
  <CompareSection title="Competências gerais"><Chips values={profile.competencias.map((item) => item.nome)} /></CompareSection>
  <CompareSection title="Trajetória">{profile.formacoes.length || profile.experiencias.length ? <Stack spacing={1} divider={<Divider flexItem />}>{profile.formacoes.map((item) => <Box key={item.id}><Typography variant="subtitle2">{item.nome}</Typography><Typography variant="body2" color="text.secondary">{item.instituicao} · {TIPO_FORMACAO_LABELS[item.tipo]}</Typography>{item.possuiCertificado && item.certificadoUrl && <ProtectedFileButton path={item.certificadoUrl} label="Abrir certificado" onError={setFileError} />}</Box>)}{profile.experiencias.map((item) => <Box key={item.id}><Typography variant="subtitle2">{item.cargo}</Typography><Typography variant="body2" color="text.secondary">{item.empresa}</Typography>{item.descricao && <Typography variant="body2">{item.descricao}</Typography>}</Box>)}</Stack> : <Empty />}</CompareSection>
  <CompareSection title="Projetos">{profile.projetos.length ? <Stack spacing={1}>{profile.projetos.map((item) => <Box key={item.id}><Typography variant="subtitle2">{item.nome}</Typography><Typography variant="body2">{item.descricao}</Typography><Stack direction="row" spacing={1}>{item.demoUrl && <Button component="a" href={item.demoUrl} target="_blank" size="small">Demonstração</Button>}{item.repositorioUrl && <Button component="a" href={item.repositorioUrl} target="_blank" size="small">Repositório</Button>}</Stack></Box>)}</Stack> : <Empty />}</CompareSection>
  <CompareSection title="Idiomas"><Chips values={profile.idiomas.map((item) => `${item.nome} · ${NIVEL_IDIOMA_LABELS[item.nivel]}`)} /></CompareSection>
  <CompareSection title="Disponibilidade"><Chips values={profile.disponibilidades.map((item) => DISPONIBILIDADE_LABELS[item])} /></CompareSection>
  <CompareSection title="Modalidades"><Chips values={profile.modalidades.map((item) => MODALIDADE_LABELS[item])} /></CompareSection>
  <CompareSection title="Contato"><Stack spacing={.5}>{profile.contato.emailProfissional && <Button component="a" href={`mailto:${profile.contato.emailProfissional}`}>E-mail</Button>}{profile.contato.telefone && <Button component="a" href={`tel:${profile.contato.telefone}`}>Telefone</Button>}{profile.contato.linkedInUrl && <Button component="a" href={profile.contato.linkedInUrl} target="_blank">LinkedIn</Button>}{profile.contato.gitHubUrl && <Button component="a" href={profile.contato.gitHubUrl} target="_blank">GitHub</Button>}{profile.contato.portfolioUrl && <Button component="a" href={profile.contato.portfolioUrl} target="_blank">Portfólio</Button>}{profile.curriculo.possuiCurriculo && profile.curriculo.url && <ProtectedFileButton path={profile.curriculo.url} label="Abrir currículo" onError={setFileError} />}</Stack></CompareSection>
</Stack></Paper>; }
function Common({ common }: { common: TalentCommon }) { return <Paper component="section" elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: 1, borderColor: "primary.light", bgcolor: "action.hover" }}><Stack spacing={2.5}><Typography component="h2" variant="h6" align="center">Em comum</Typography><CompareSection title="Competências gerais"><Chips values={common.competencias.map((item) => item.nome)} /></CompareSection><CompareSection title="Disponibilidade"><Chips values={common.disponibilidades.map((item) => DISPONIBILIDADE_LABELS[item])} /></CompareSection><CompareSection title="Modalidades"><Chips values={common.modalidades.map((item) => MODALIDADE_LABELS[item])} /></CompareSection></Stack></Paper>; }
function CompareSection({ title, children }: { title: string; children: React.ReactNode }) { return <Box component="section"><Typography variant="subtitle1" sx={{ fontWeight: 700, mb: .75 }}>{title}</Typography>{children}</Box>; }
function Chips({ values }: { values: string[] }) { return values.length ? <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>{values.map((item) => <Chip key={item} label={item} size="small" />)}</Stack> : <Empty text="Nenhum item em comum." />; }
function Empty({ text = "Nenhuma informação cadastrada." }: { text?: string }) { return <Typography variant="body2" color="text.secondary">{text}</Typography>; }
function ComparisonState({ title }: { title: string }) { return <Container maxWidth="sm" sx={{ py: 8 }}><Paper elevation={0} sx={{ p: 4, border: 1, borderColor: "divider", textAlign: "center" }}><Typography variant="h5">{title}</Typography><Button component={Link} href="/recrutador/talentos" sx={{ mt: 2 }}>Explorar talentos</Button></Paper></Container>; }
