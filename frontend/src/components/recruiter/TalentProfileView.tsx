"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert, Box, Button, Chip, Container, Divider, Paper, Skeleton, Stack, Typography,
} from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import GitHub from "@mui/icons-material/GitHub";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";
import LinkedIn from "@mui/icons-material/LinkedIn";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { fetchTalent } from "@/lib/recruiter";
import { formatDate, formatUpdatedAt } from "@/lib/format";
import {
  DISPONIBILIDADE_LABELS, MODALIDADE_LABELS, NIVEL_IDIOMA_LABELS, STATUS_FORMACAO_LABELS,
  TIPO_EXPERIENCIA_LABELS, TIPO_FORMACAO_LABELS,
} from "@/lib/labels";
import type { TalentExperience, TalentFormation, TalentProfile } from "@/types/recruiter";
import { ProtectedFileButton } from "./ProtectedFileButton";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";
import { FavoriteButton } from "./FavoriteButton";

export function TalentProfileView({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false); const [fileError, setFileError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    fetchTalent(slug).then((response) => { if (active) setProfile(response); }).catch((reason) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 404) setNotFound(true);
      else setError(getApiErrorMessage(reason, "Não foi possível carregar o perfil."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, version]);
  function retry() { setLoading(true); setError(null); setNotFound(false); setVersion((value) => value + 1); }

  if (loading) return <ProfileLoading />;
  if (notFound) return <StatePage title="Este perfil não está mais disponível." />;
  if (error || !profile) return <Container maxWidth="md" sx={{ py: 5 }}><Alert severity="error" action={<Button color="inherit" onClick={retry}>Tentar novamente</Button>}>{error ?? "Não foi possível carregar o perfil."}</Alert></Container>;

  return <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}><Stack spacing={2.5}>
    <Button component={Link} href="/recrutador/talentos" startIcon={<ArrowBackOutlined />} sx={{ alignSelf: "flex-start" }}>Voltar para talentos</Button>
    {fileError && <Alert severity="error" onClose={() => setFileError(null)}>{fileError}</Alert>}
    <ProfileHeader profile={profile} onFileError={setFileError} onFavoriteChange={(favorite) => setProfile((current) => current ? { ...current, favorito: favorite } : current)} onUnavailable={() => setNotFound(true)} />
    <Section title="Sobre"><Typography sx={{ whiteSpace: "pre-wrap" }} color={profile.bio ? "text.primary" : "text.secondary"}>{profile.bio || "Este talento ainda não informou uma apresentação profissional."}</Typography></Section>
    <Section title="Competências gerais">{profile.competencias.length ? <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>{profile.competencias.map((item) => <Chip key={item.id} label={item.nome} />)}</Stack> : <Empty />}</Section>
    <TrajectorySection formations={profile.formacoes} experiences={profile.experiencias} onFileError={setFileError} />
    <Section title="Projetos">{profile.projetos.length ? <Stack spacing={2} divider={<Divider />}>
      {profile.projetos.map((project) => <Stack key={project.id} spacing={1}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{project.nome}</Typography><Typography variant="caption" color="text.secondary">{period(project.dataInicio, project.dataFim, project.emAndamento)}</Typography></Stack>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{project.descricao}</Typography>
        <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>{project.tecnologias.map((item) => <Chip key={item.id} label={item.nome} size="small" variant="outlined" />)}</Stack>
        <Stack direction="row" spacing={1}>{project.demoUrl && <ExternalButton href={project.demoUrl} label="Ver demonstração" />}{project.repositorioUrl && <ExternalButton href={project.repositorioUrl} label="Ver repositório" />}</Stack>
      </Stack>)}
    </Stack> : <Empty />}</Section>
    <Section title="Idiomas">{profile.idiomas.length ? <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>{profile.idiomas.map((item) => <Chip key={item.idiomaId} label={`${item.nome} · ${NIVEL_IDIOMA_LABELS[item.nivel]}`} variant="outlined" />)}</Stack> : <Empty />}</Section>
    <Section title="Disponibilidade e modalidades"><Stack spacing={1.5}>
      <Box><Typography variant="subtitle2" gutterBottom>Disponibilidade</Typography>{profile.disponibilidades.length ? <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>{profile.disponibilidades.map((item) => <Chip key={item} color="primary" variant="outlined" label={DISPONIBILIDADE_LABELS[item]} />)}</Stack> : <Empty />}</Box>
      <Box><Typography variant="subtitle2" gutterBottom>Modalidades</Typography>{profile.modalidades.length ? <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>{profile.modalidades.map((item) => <Chip key={item} label={MODALIDADE_LABELS[item]} />)}</Stack> : <Empty />}</Box>
    </Stack></Section>
    <ContactSection profile={profile} />
    <Section title="Currículo">{profile.curriculo.possuiCurriculo && profile.curriculo.url
      ? <ProtectedFileButton path={profile.curriculo.url} label={`Abrir currículo de ${profile.nomeCompleto}`} onError={setFileError} />
      : <Empty text="Currículo não informado." />}</Section>
  </Stack></Container>;
}

function ProfileHeader({ profile, onFileError, onFavoriteChange, onUnavailable }: { profile: TalentProfile; onFileError: (message: string) => void; onFavoriteChange: (favorite: boolean) => void; onUnavailable: () => void }) {
  return <Paper component="header" elevation={0} sx={{ p: { xs: 2.5, sm: 3.5 }, border: 1, borderColor: "divider" }}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: { xs: "center", sm: "flex-start" } }}>
      <ProtectedTalentPhoto path={profile.fotoUrl} name={profile.nomeCompleto} size={112} />
      <Stack spacing={1.25} sx={{ minWidth: 0, alignItems: { xs: "center", sm: "flex-start" }, textAlign: { xs: "center", sm: "left" } }}>
        <Typography component="h1" variant="h4">{profile.nomeCompleto}</Typography>
        <Stack direction="row" spacing={.5} sx={{ alignItems: "center" }}><PlaceOutlined color="action" /><Typography color="text.secondary">{[profile.cidade, profile.uf].filter(Boolean).join(" / ") || "Localização não informada"}</Typography></Stack>
        <Typography variant="caption" color="text.secondary">Atualizado em {formatUpdatedAt(profile.atualizadoEm)}</Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", justifyContent: { xs: "center", sm: "flex-start" } }}>
          <FavoriteButton slug={profile.slug} name={profile.nomeCompleto} favorite={profile.favorito} onChange={onFavoriteChange} onUnavailable={onUnavailable} />
          {profile.contato.emailProfissional && <Button component="a" href={`mailto:${profile.contato.emailProfissional}`} startIcon={<EmailOutlined />}>E-mail</Button>}
          {profile.contato.linkedInUrl && <ExternalButton href={profile.contato.linkedInUrl} label="LinkedIn" icon={<LinkedIn />} />}
          {profile.curriculo.possuiCurriculo && profile.curriculo.url && <ProtectedFileButton path={profile.curriculo.url} label="Abrir CV" onError={onFileError} />}
        </Stack>
      </Stack>
    </Stack>
  </Paper>;
}

function TrajectorySection({ formations, experiences, onFileError }: { formations: TalentFormation[]; experiences: TalentExperience[]; onFileError: (message: string) => void }) {
  const items = useMemo(() => [
    ...formations.map((item) => ({ kind: "formation" as const, date: item.dataInicio, item })),
    ...experiences.map((item) => ({ kind: "experience" as const, date: item.dataInicio, item })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [formations, experiences]);
  return <Section title="Trajetória">{items.length ? <Stack spacing={2.5} divider={<Divider />}>
    {items.map((entry) => entry.kind === "formation" ? <FormationItem key={`f-${entry.item.id}`} formation={entry.item} onFileError={onFileError} /> : <ExperienceItem key={`e-${entry.item.id}`} experience={entry.item} />)}
  </Stack> : <Empty />}</Section>;
}

function FormationItem({ formation, onFileError }: { formation: TalentFormation; onFileError: (message: string) => void }) {
  return <Stack spacing={1}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}><Box><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formation.nome}</Typography><Typography variant="body2" color="text.secondary">{formation.instituicao} · {TIPO_FORMACAO_LABELS[formation.tipo]} · {STATUS_FORMACAO_LABELS[formation.status]}</Typography></Box><Typography variant="caption" color="text.secondary">{period(formation.dataInicio, formation.dataFim, formation.status === "EM_ANDAMENTO")}</Typography></Stack>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
      {formation.rpvVerificado && <Chip icon={<VerifiedOutlined />} size="small" color="success" label="Verificado pelo Rio Pomba Valley" />}
      {formation.cargaHoraria && <Chip size="small" variant="outlined" label={`${formation.cargaHoraria} horas`} />}
      {formation.possuiCertificado && formation.certificadoUrl && <ProtectedFileButton path={formation.certificadoUrl} label={`Abrir certificado de ${formation.nome}`} onError={onFileError} />}
    </Stack>
  </Stack>;
}

function ExperienceItem({ experience }: { experience: TalentExperience }) {
  return <Stack spacing={.75}><Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}><Box><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{experience.cargo}</Typography><Typography variant="body2" color="text.secondary">{experience.empresa} · {TIPO_EXPERIENCIA_LABELS[experience.tipo]}</Typography></Box><Typography variant="caption" color="text.secondary">{period(experience.dataInicio, experience.dataFim, experience.atual)}</Typography></Stack>{experience.descricao && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{experience.descricao}</Typography>}</Stack>;
}

function ContactSection({ profile }: { profile: TalentProfile }) {
  const contact = profile.contato; const hasContact = Object.values(contact).some(Boolean);
  return <Section title="Contato">{hasContact ? <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
    {contact.emailProfissional && <Button component="a" href={`mailto:${contact.emailProfissional}`} startIcon={<EmailOutlined />}>{contact.emailProfissional}</Button>}
    {contact.telefone && <Button component="a" href={`tel:${contact.telefone}`} startIcon={<PhoneOutlined />}>{contact.telefone}</Button>}
    {contact.linkedInUrl && <ExternalButton href={contact.linkedInUrl} label="LinkedIn" icon={<LinkedIn />} />}
    {contact.gitHubUrl && <ExternalButton href={contact.gitHubUrl} label="GitHub" icon={<GitHub />} />}
    {contact.portfolioUrl && <ExternalButton href={contact.portfolioUrl} label="Portfólio" icon={<LanguageOutlined />} />}
  </Stack> : <Empty text="Contato profissional não informado." />}</Section>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <Paper component="section" elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, border: 1, borderColor: "divider" }}><Typography component="h2" variant="h6" sx={{ mb: 2 }}>{title}</Typography>{children}</Paper>; }
function Empty({ text = "Nenhuma informação cadastrada." }: { text?: string }) { return <Typography variant="body2" color="text.secondary">{text}</Typography>; }
function ExternalButton({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) { return <Button component="a" href={href} target="_blank" rel="noreferrer" startIcon={icon} endIcon={!icon ? <LanguageOutlined /> : undefined}>{label}</Button>; }
function period(start: string, end: string | null, current: boolean): string { return `${formatDate(start)} — ${current ? "Atual" : end ? formatDate(end) : "Não informado"}`; }

function StatePage({ title }: { title: string }) { return <Container maxWidth="sm" sx={{ py: 8 }}><Paper elevation={0} sx={{ p: 4, border: 1, borderColor: "divider", textAlign: "center" }}><Typography variant="h5">{title}</Typography><Button component={Link} href="/recrutador/talentos" startIcon={<ArrowBackOutlined />} sx={{ mt: 2 }}>Voltar para talentos</Button></Paper></Container>; }
function ProfileLoading() { return <Container maxWidth="lg" sx={{ py: 4 }}><Stack spacing={2}>{[150, 140, 180, 260].map((height, index) => <Skeleton key={index} variant="rounded" height={height} />)}</Stack></Container>; }
