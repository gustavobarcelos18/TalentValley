"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert, Box, Button, Card, Chip, Container, Divider, Skeleton, Stack, Typography,
} from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import BusinessCenterOutlined from "@mui/icons-material/BusinessCenterOutlined";
import GitHub from "@mui/icons-material/GitHub";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";
import LinkedIn from "@mui/icons-material/LinkedIn";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import PersonSearchOutlined from "@mui/icons-material/PersonSearchOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import { brandWash } from "@/components/common/surfaceGradient";
import { CompetencyGroups } from "@/components/common/CompetencyGroups";
import { EmptyState } from "@/components/common/EmptyState";
import { Reveal } from "@/components/common/Reveal";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { CONTENT_MAX_WIDTH } from "@/components/layout/contentWidth";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { fetchTalent } from "@/lib/recruiter";
import { formatDate, formatUpdatedAt } from "@/lib/format";
import { normalizePhone, validateBrazilianPhone, validateEmail, validateHttpUrl } from "@/lib/validation";
import {
  NIVEL_IDIOMA_LABELS, STATUS_FORMACAO_LABELS, TIPO_EXPERIENCIA_LABELS, TIPO_FORMACAO_LABELS,
} from "@/lib/labels";
import type { TalentExperience, TalentFormation, TalentProfile } from "@/types/recruiter";
import { BuscaDetails } from "./TalentBusca";
import { ProtectedFileButton } from "./ProtectedFileButton";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";
import { FavoriteButton } from "./FavoriteButton";
import { RpvShine, RpvVerifiedBadge, rpvHighlightSx } from "./RpvHighlight";

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

  return <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: { xs: 3, md: 4 } }}><Stack spacing={2.5}>
    <Button component={Link} href="/recrutador/talentos" startIcon={<ArrowBackOutlined />} sx={{ alignSelf: "flex-start" }}>Voltar para talentos</Button>
    {fileError && <Alert severity="error" onClose={() => setFileError(null)}>{fileError}</Alert>}
    <ProfileHeader profile={profile} onFileError={setFileError} onFavoriteChange={(favorite) => setProfile((current) => current ? { ...current, favorito: favorite } : current)} onUnavailable={() => setNotFound(true)} />
    <Section title="Sobre" index={1}><Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }} color={profile.bio ? "text.primary" : "text.secondary"}>{profile.bio || "Este talento ainda não informou uma apresentação profissional."}</Typography></Section>
    <Section title="Competências gerais" index={2}>{profile.competencias.length ? <CompetencyGroups competencias={profile.competencias} size="medium" /> : <Empty />}</Section>
    <TrajectorySection formations={profile.formacoes} experiences={profile.experiencias} onFileError={setFileError} />
    <Section title="Projetos" index={4}>{profile.projetos.length ? <Stack spacing={2} divider={<Divider />}>
      {profile.projetos.map((project) => <Stack key={project.id} spacing={1}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}><Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{project.nome}</Typography><Typography variant="caption" color="text.secondary">{period(project.dataInicio, project.dataFim, project.emAndamento)}</Typography></Stack>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{project.descricao}</Typography>
        <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>{project.tecnologias.map((item) => <Chip key={item.id} label={item.nome} size="small" variant="outlined" />)}</Stack>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>{project.demoUrl && <ExternalButton href={project.demoUrl} label="Ver demonstração" />}{project.repositorioUrl && <ExternalButton href={project.repositorioUrl} label="Ver repositório" />}</Stack>
      </Stack>)}
    </Stack> : <Empty />}</Section>
    <Section title="Idiomas" index={5}>{profile.idiomas.length ? <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>{profile.idiomas.map((item) => <Chip key={item.idiomaId} label={`${item.nome} · ${NIVEL_IDIOMA_LABELS[item.nivel]}`} variant="outlined" />)}</Stack> : <Empty />}</Section>
    <ContactSection profile={profile} />
    <Section title="O que busca" index={7}><BuscaDetails busca={profile.busca} disponibilidades={profile.disponibilidades} modalidades={profile.modalidades} /></Section>
    <Section title="Currículo" index={8}>{profile.curriculo.possuiCurriculo && profile.curriculo.url
      ? <ProtectedFileButton path={profile.curriculo.url} label={`Abrir currículo de ${profile.nomeCompleto}`} onError={setFileError} />
      : <Empty text="Currículo não informado." />}</Section>
  </Stack></Container>;
}

function ProfileHeader({ profile, onFileError, onFavoriteChange, onUnavailable }: { profile: TalentProfile; onFileError: (message: string) => void; onFavoriteChange: (favorite: boolean) => void; onUnavailable: () => void }) {
  const rpvVerified = profile.formacoes.some((item) => item.rpvVerificado);
  return <Reveal><Card component="header" sx={(theme) => ({ p: { xs: 2.5, sm: 3.5 }, backgroundImage: brandWash(theme), ...(rpvVerified && rpvHighlightSx(theme)) })}>
    {rpvVerified && <RpvShine />}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: { xs: "center", sm: "flex-start" } }}>
      <ProtectedTalentPhoto path={profile.fotoUrl} name={profile.nomeCompleto} size={112} />
      <Stack spacing={1.25} sx={{ minWidth: 0, alignItems: { xs: "center", sm: "flex-start" }, textAlign: { xs: "center", sm: "left" } }}>
        <Typography component="h1" variant="h4" sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{profile.nomeCompleto}</Typography>
        <Stack direction="row" spacing={.5} sx={{ alignItems: "center" }}><PlaceOutlined color="action" /><Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{[profile.cidade, profile.uf].filter(Boolean).join(" / ") || "Localização não informada"}</Typography></Stack>
        <Typography variant="caption" color="text.secondary">Atualizado em {formatUpdatedAt(profile.atualizadoEm)}</Typography>
        {rpvVerified && <RpvVerifiedBadge />}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", justifyContent: { xs: "center", sm: "flex-start" } }}>
          <FavoriteButton slug={profile.slug} name={profile.nomeCompleto} favorite={profile.favorito} onChange={onFavoriteChange} onUnavailable={onUnavailable} />
          {profile.contato.emailProfissional && <SafeEmailButton value={profile.contato.emailProfissional} label="E-mail" />}
          {profile.contato.linkedInUrl && <ExternalButton href={profile.contato.linkedInUrl} label="LinkedIn" icon={<LinkedIn />} />}
          {profile.curriculo.possuiCurriculo && profile.curriculo.url && <ProtectedFileButton path={profile.curriculo.url} label="Abrir CV" onError={onFileError} />}
        </Stack>
      </Stack>
    </Stack>
  </Card></Reveal>;
}

function TrajectorySection({ formations, experiences, onFileError }: { formations: TalentFormation[]; experiences: TalentExperience[]; onFileError: (message: string) => void }) {
  const items = useMemo(() => [
    ...formations.map((item) => ({ kind: "formation" as const, date: item.dataInicio, item })),
    ...experiences.map((item) => ({ kind: "experience" as const, date: item.dataInicio, item })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [formations, experiences]);
  return <Section title="Trajetória" index={3}>{items.length ? <Stack spacing={3} component="ol" role="list" sx={(theme) => ({
    listStyle: "none", m: 0, p: 0, position: "relative",
    "&::before": { content: "\"\"", position: "absolute", left: 17, top: 18, bottom: 18, width: 2, backgroundColor: (theme.vars ?? theme).palette.divider },
  })}>
    {items.map((entry) => entry.kind === "formation"
      ? <TimelineItem key={`f-${entry.item.id}`} icon={<SchoolOutlined fontSize="small" />}><FormationItem formation={entry.item} onFileError={onFileError} /></TimelineItem>
      : <TimelineItem key={`e-${entry.item.id}`} icon={<BusinessCenterOutlined fontSize="small" />}><ExperienceItem experience={entry.item} /></TimelineItem>)}
  </Stack> : <Empty />}</Section>;
}

function TimelineItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <Box component="li" sx={{ position: "relative", pl: 6.5 }}>
    <Box aria-hidden="true" className="flex size-9 items-center justify-center" sx={(theme) => {
      const { primary, surface } = (theme.vars ?? theme).palette;
      return { position: "absolute", left: 0, top: 0, borderRadius: "50%", color: primary.main, backgroundColor: surface.raised, border: 2, borderColor: primary.main };
    }}>{icon}</Box>
    {children}
  </Box>;
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
  return <Section title="Contato" index={6}>{hasContact ? <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
    {contact.emailProfissional && <SafeEmailButton value={contact.emailProfissional} />}
    {contact.telefone && <SafePhoneButton value={contact.telefone} />}
    {contact.linkedInUrl && <ExternalButton href={contact.linkedInUrl} label="LinkedIn" icon={<LinkedIn />} />}
    {contact.gitHubUrl && <ExternalButton href={contact.gitHubUrl} label="GitHub" icon={<GitHub />} />}
    {contact.portfolioUrl && <ExternalButton href={contact.portfolioUrl} label="Portfólio" icon={<LanguageOutlined />} />}
  </Stack> : <Empty text="Contato profissional não informado." />}</Section>;
}

function Section({ title, index, children }: { title: string; index: number; children: React.ReactNode }) { return <SurfaceCard title={title} index={index}>{children}</SurfaceCard>; }
function Empty({ text = "Nenhuma informação cadastrada." }: { text?: string }) { return <Typography variant="body2" color="text.secondary">{text}</Typography>; }
function ExternalButton({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) { return validateHttpUrl(href) === null ? <Button component="a" href={href} target="_blank" rel="noreferrer" startIcon={icon} endIcon={!icon ? <LanguageOutlined /> : undefined}>{label}</Button> : <PlainText>{href}</PlainText>; }
// Contact values are only rendered clickable when they pass validation; unsafe or
// malformed legacy values stay visible as plain text.
function PlainText({ children }: { children: React.ReactNode }) { return <Typography variant="body2" sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{children}</Typography>; }
function SafeEmailButton({ value, label }: { value: string; label?: string }) { return validateEmail(value) === null ? <Button component="a" href={`mailto:${value}`} startIcon={<EmailOutlined />}>{label ?? value}</Button> : <PlainText>{value}</PlainText>; }
function SafePhoneButton({ value }: { value: string }) { return validateBrazilianPhone(value) === null ? <Button component="a" href={`tel:${normalizePhone(value)}`} startIcon={<PhoneOutlined />}>{value}</Button> : <PlainText>{value}</PlainText>; }
function period(start: string, end: string | null, current: boolean): string {
  let endLabel = "Não informado";
  if (current) endLabel = "Atual";
  else if (end) endLabel = formatDate(end);
  return `${formatDate(start)} — ${endLabel}`;
}

function StatePage({ title }: { title: string }) { return <Container maxWidth="sm" sx={{ py: 8 }}><EmptyState icon={<PersonSearchOutlined />} title={title} titleAs="h1" action={<Button component={Link} href="/recrutador/talentos" startIcon={<ArrowBackOutlined />}>Voltar para talentos</Button>} /></Container>; }
function ProfileLoading() { return <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: 4 }}><Stack spacing={2}>{[150, 140, 180, 260].map((height) => <Skeleton key={height} variant="rounded" height={height} sx={{ borderRadius: "4px" }} />)}</Stack></Container>; }
