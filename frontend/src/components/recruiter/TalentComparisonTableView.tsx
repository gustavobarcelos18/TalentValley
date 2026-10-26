"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Alert, Box, Button, Card, Chip, Container, Skeleton, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import CompareArrowsOutlined from "@mui/icons-material/CompareArrowsOutlined";
import GitHub from "@mui/icons-material/GitHub";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";
import LinkedIn from "@mui/icons-material/LinkedIn";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { CONTENT_MAX_WIDTH } from "@/components/layout/contentWidth";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { disponivelAgora, resumoMobilidade } from "@/lib/busca";
import { comparisonSlugs } from "@/lib/comparison";
import { formatDate, formatUpdatedAt } from "@/lib/format";
import {
  AREA_INTERESSE_LABELS, CARGA_HORARIA_LABELS, DISPONIBILIDADE_LABELS, MODALIDADE_LABELS,
  NIVEL_IDIOMA_LABELS, STATUS_FORMACAO_LABELS, TIPO_EXPERIENCIA_LABELS, TIPO_FORMACAO_LABELS,
} from "@/lib/labels";
import { fetchTalent } from "@/lib/recruiter";
import { validateHttpUrl } from "@/lib/validation";
import type { TalentCompetency, TalentFormation, TalentProfile } from "@/types/recruiter";
import type { TipoCompetencia } from "@/types/student";
import { ComparisonViewTabs } from "./ComparisonViewTabs";
import { ProtectedFileButton } from "./ProtectedFileButton";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";

const UNAVAILABLE = "Um dos perfis não está mais disponível.";
const LOAD_FALLBACK = "Não foi possível carregar a comparação.";
const CANDIDATE_LABELS = ["Candidato A", "Candidato B"] as const;

// Resume table: the same two talents as the side-by-side comparison, one column each.
// Profiles come from the protected single-talent endpoint, so visibility rules are the ones of the full profile.
// Contact e-mail and phone are intentionally never rendered here, and PCD data is never read.
export function TalentComparisonTableView() {
  const searchParams = useSearchParams();
  const slugs = useMemo(() => comparisonSlugs(searchParams), [searchParams]);
  const [profiles, setProfiles] = useState<[TalentProfile, TalentProfile] | null>(null);
  const [loading, setLoading] = useState(Boolean(slugs));
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!slugs) return;
    let active = true;
    Promise.all([fetchTalent(slugs[0]), fetchTalent(slugs[1])])
      .then((data) => { if (active) setProfiles(data); })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof ApiError && reason.status === 404 ? UNAVAILABLE : getApiErrorMessage(reason, LOAD_FALLBACK));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slugs, version]);

  if (!slugs) return <TableState title="Selecione exatamente dois talentos para comparar." />;
  if (loading) {
    return <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: 4 }}><Stack spacing={2} role="status" aria-label="Carregando comparação">{[1, 2, 3].map((item) => <Skeleton key={item} variant="rounded" height={140} sx={{ borderRadius: "4px" }} />)}</Stack></Container>;
  }
  function retry() { setLoading(true); setError(null); setVersion((value) => value + 1); }
  if (error || !profiles) {
    return <Container maxWidth="md" sx={{ py: 5 }}><Alert severity="error" action={<Button color="inherit" onClick={retry}>Tentar novamente</Button>}>{error ?? LOAD_FALLBACK}</Alert></Container>;
  }

  return <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: { xs: 3, md: 4 } }}><Stack spacing={2.5}>
    <Button component={Link} href="/recrutador/talentos" startIcon={<ArrowBackOutlined />} sx={{ alignSelf: "flex-start" }}>Voltar para talentos</Button>
    <ComparisonViewTabs slugs={slugs} active="tabela" />
    <PageHeader title="Comparar talentos" description="Currículos em tabela, sem ranking ou recomendação." />
    <ResumeTable profiles={profiles} />
  </Stack></Container>;
}

function ResumeTable({ profiles }: { profiles: [TalentProfile, TalentProfile] }) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [a, b] = profiles;
  const both = (render: (profile: TalentProfile) => ReactNode): [ReactNode, ReactNode] => [render(a), render(b)];

  return <Stack spacing={1.5}>
    {fileError && <Alert severity="error" onClose={() => setFileError(null)}>{fileError}</Alert>}
    <Card sx={{ minWidth: 0 }}>
      <TableContainer sx={{ maxHeight: { md: "calc(100vh - 160px)" } }}>
        <Table stickyHeader aria-label="Tabela de currículos" sx={{ minWidth: 760, tableLayout: "fixed" }}>
          <TableHead>
            <TableRow>
              <HeaderCell first>Campo</HeaderCell>
              {profiles.map((profile, index) => <HeaderCell key={profile.slug}>
                <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                  <Chip label={CANDIDATE_LABELS[index]} size="small" color="primary" variant="outlined" />
                  <Typography component="span" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{profile.nomeCompleto}</Typography>
                </Stack>
              </HeaderCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            <SectionRow title="Perfil profissional" />
            <FieldRow label="Foto e nome" values={both((p) => <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}><ProtectedTalentPhoto path={p.fotoUrl} name={p.nomeCompleto} size={56} /><Typography component="span" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{p.nomeCompleto}</Typography></Stack>)} />
            <FieldRow label="Cidade/UF" values={both((p) => [p.cidade, p.uf].filter(Boolean).join(" / ") || null)} />
            <FieldRow label="Atualizado em" values={both((p) => formatUpdatedAt(p.atualizadoEm))} />

            <SectionRow title="Formação" />
            <FieldRow label="Formação principal" values={both((p) => {
              const main = p.formacoes.find((item) => item.principal);
              return main ? <FormationBlock formation={main} onFileError={setFileError} /> : null;
            })} />
            <FieldRow label="Outras formações e cursos" values={both((p) => {
              const others = p.formacoes.filter((item) => !item.principal);
              return others.length ? <Blocks>{others.map((item) => <FormationBlock key={item.id} formation={item} onFileError={setFileError} />)}</Blocks> : null;
            })} />

            <SectionRow title="Experiências" />
            <FieldRow label="Experiências profissionais" values={both((p) => p.experiencias.length ? <Blocks>{p.experiencias.map((item) => <Block key={item.id}>
              <Typography variant="subtitle2" sx={{ overflowWrap: "anywhere" }}>{item.cargo}</Typography>
              <Muted>{item.empresa} · {TIPO_EXPERIENCIA_LABELS[item.tipo]}</Muted>
              <Muted>{period(item.dataInicio, item.dataFim, item.atual)}{item.atual ? " (experiência atual)" : ""}</Muted>
              {item.descricao && <LongText>{item.descricao}</LongText>}
            </Block>)}</Blocks> : null)} />

            <SectionRow title="Competências" />
            <FieldRow label="Competências técnicas" values={both((p) => competencyChips(p.competencias, "TECNICA"))} />
            <FieldRow label="Competências comportamentais" values={both((p) => competencyChips(p.competencias, "COMPORTAMENTAL"))} />

            <SectionRow title="Idiomas" />
            <FieldRow label="Idiomas e nível" values={both((p) => p.idiomas.length ? <Chips values={p.idiomas.map((item) => `${item.nome} · ${NIVEL_IDIOMA_LABELS[item.nivel]}`)} /> : null)} />

            <SectionRow title="Projetos" />
            <FieldRow label="Projetos em destaque" values={both((p) => p.projetos.length ? <Blocks>{p.projetos.map((item) => <Block key={item.id}>
              <Typography variant="subtitle2" sx={{ overflowWrap: "anywhere" }}>{item.nome}</Typography>
              <Muted>{period(item.dataInicio, item.dataFim, item.emAndamento)} · {item.emAndamento ? "Em andamento" : "Concluído"}</Muted>
              <LongText>{item.descricao}</LongText>
              {item.tecnologias.length > 0 && <Chips values={item.tecnologias.map((tech) => tech.nome)} />}
              {(item.demoUrl || item.repositorioUrl) && <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {item.demoUrl && <ExternalLink url={item.demoUrl} label="Demonstração" />}
                {item.repositorioUrl && <ExternalLink url={item.repositorioUrl} label="Repositório" />}
              </Stack>}
            </Block>)}</Blocks> : null)} />

            <SectionRow title="Objetivos profissionais" />
            <FieldRow label="Objetivo declarado" values={both((p) => p.busca.objetivo ? <LongText>{p.busca.objetivo}</LongText> : null)} />
            <FieldRow label="Áreas de interesse" values={both((p) => p.busca.areasInteresse.length ? <Chips values={p.busca.areasInteresse.map((item) => AREA_INTERESSE_LABELS[item])} /> : null)} />

            <SectionRow title="Disponibilidade" />
            <FieldRow label="Tipos de vaga" values={both((p) => p.disponibilidades.length ? <Chips values={p.disponibilidades.map((item) => DISPONIBILIDADE_LABELS[item])} /> : null)} />
            <FieldRow label="Modalidades" values={both((p) => p.modalidades.length ? <Chips values={p.modalidades.map((item) => MODALIDADE_LABELS[item])} /> : null)} />
            <FieldRow label="Início" values={both((p) => startLabel(p))} />
            <FieldRow label="Carga horária" values={both((p) => p.busca.cargaHoraria ? CARGA_HORARIA_LABELS[p.busca.cargaHoraria] : null)} />
            <FieldRow label="Mobilidade" values={both((p) => {
              const items = resumoMobilidade(p.busca);
              return items.length ? <Chips values={items} /> : null;
            })} />

            <SectionRow title="Links profissionais" />
            <FieldRow label="LinkedIn" values={both((p) => p.contato.linkedInUrl ? <ExternalLink url={p.contato.linkedInUrl} label="LinkedIn" icon={<LinkedIn />} /> : null)} />
            <FieldRow label="GitHub" values={both((p) => p.contato.gitHubUrl ? <ExternalLink url={p.contato.gitHubUrl} label="GitHub" icon={<GitHub />} /> : null)} />
            <FieldRow label="Portfólio" values={both((p) => p.contato.portfolioUrl ? <ExternalLink url={p.contato.portfolioUrl} label="Portfólio" icon={<LanguageOutlined />} /> : null)} />

            <SectionRow title="Currículo" />
            <FieldRow label="Currículo em PDF" values={both((p) => {
              if (!p.curriculo.possuiCurriculo) return null;
              return p.curriculo.url ? <ProtectedFileButton path={p.curriculo.url} label="Abrir currículo" onError={setFileError} /> : "Disponível";
            })} />
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  </Stack>;
}

function startLabel(profile: TalentProfile): string | null {
  if (disponivelAgora(profile.busca)) return "Imediato";
  return profile.busca.disponivelAPartirDe ? `A partir de ${formatDate(profile.busca.disponivelAPartirDe)}` : null;
}

function period(start: string, end: string | null, ongoing: boolean): string {
  let endLabel = "Não informado";
  if (ongoing) endLabel = "Atual";
  else if (end) endLabel = formatDate(end);
  return `${formatDate(start)} — ${endLabel}`;
}

// The first column stays in place while the table scrolls sideways on narrow screens.
const stickyFirst = { position: "sticky", left: 0, zIndex: 1 } as const;

function HeaderCell({ children, first = false }: { children: ReactNode; first?: boolean }) {
  return <TableCell
    component="th"
    scope="col"
    sx={(theme) => {
      const { divider, surface, text } = (theme.vars ?? theme).palette;
      return {
        width: first ? 180 : undefined,
        py: 1.5,
        verticalAlign: "bottom",
        backgroundColor: surface.sunken,
        borderBottom: `1px solid ${divider}`,
        color: first ? text.secondary : text.primary,
        fontWeight: 700,
        ...(first ? { ...stickyFirst, zIndex: 3 } : {}),
      };
    }}
  >{children}</TableCell>;
}

function SectionRow({ title }: { title: string }) {
  return <TableRow>
    <TableCell
      component="th"
      scope="rowgroup"
      colSpan={3}
      sx={(theme) => {
        const { divider, surface, text } = (theme.vars ?? theme).palette;
        return { py: 1, backgroundColor: surface.sunken, borderBottom: `1px solid ${divider}`, color: text.secondary };
      }}
    >
      <Typography component="span" variant="overline" sx={{ fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.6 }}>{title}</Typography>
    </TableCell>
  </TableRow>;
}

function FieldRow({ label, values }: { label: string; values: [ReactNode, ReactNode] }) {
  return <TableRow hover>
    <TableCell
      component="th"
      scope="row"
      sx={(theme) => {
        const { divider, surface, text } = (theme.vars ?? theme).palette;
        return { ...stickyFirst, verticalAlign: "top", backgroundColor: surface.raised, borderBottom: `1px solid ${divider}`, color: text.secondary, fontWeight: 600 };
      }}
    >{label}</TableCell>
    {values.map((value, index) => <TableCell
      key={CANDIDATE_LABELS[index]}
      sx={(theme) => ({ verticalAlign: "top", overflowWrap: "anywhere", borderBottom: `1px solid ${(theme.vars ?? theme).palette.divider}` })}
    >{value === null || value === undefined || value === "" ? <Missing /> : value}</TableCell>)}
  </TableRow>;
}

function Missing() {
  return <Typography component="span" variant="body2" color="text.secondary">Não informado</Typography>;
}

function Muted({ children }: { children: ReactNode }) {
  return <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{children}</Typography>;
}

function LongText({ children }: { children: ReactNode }) {
  return <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{children}</Typography>;
}

function Blocks({ children }: { children: ReactNode }) {
  return <Stack spacing={2}>{children}</Stack>;
}

function Block({ children }: { children: ReactNode }) {
  return <Stack spacing={0.5}>{children}</Stack>;
}

function Chips({ values }: { values: string[] }) {
  return <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>{values.map((item) => <Chip key={item} label={item} size="small" />)}</Stack>;
}

// Competencies of one type. Returns null (not an empty element) so the field row shows "Não informado".
function competencyChips(items: TalentCompetency[], tipo: TipoCompetencia): ReactNode {
  const values = items.filter((item) => item.tipo === tipo).map((item) => item.nome);
  return values.length ? <Chips values={values} /> : null;
}

function FormationBlock({ formation, onFileError }: { formation: TalentFormation; onFileError: (message: string) => void }) {
  return <Block>
    <Typography variant="subtitle2" sx={{ overflowWrap: "anywhere" }}>{formation.nome}</Typography>
    <Muted>{formation.instituicao} · {TIPO_FORMACAO_LABELS[formation.tipo]}</Muted>
    <Muted>{period(formation.dataInicio, formation.dataFim, false)} · {STATUS_FORMACAO_LABELS[formation.status]}</Muted>
    {formation.cargaHoraria !== null && <Muted>Carga horária: {formation.cargaHoraria} h</Muted>}
    {(formation.principal || formation.rpvVerificado) && <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      {formation.principal && <Chip label="Formação principal" size="small" variant="outlined" />}
      {formation.rpvVerificado && <Chip label="Verificado pelo Rio Pomba Valley" size="small" color="success" />}
    </Stack>}
    {formation.possuiCertificado && (formation.certificadoUrl
      ? <Box><ProtectedFileButton path={formation.certificadoUrl} label="Abrir certificado" onError={onFileError} /></Box>
      : <Muted>Certificado disponível</Muted>)}
  </Block>;
}

// External links are only clickable when they pass the same validation as the other recruiter screens;
// a malformed legacy value stays visible as plain text.
function ExternalLink({ url, label, icon }: { url: string; label: string; icon?: ReactNode }) {
  return validateHttpUrl(url) === null
    ? <Button component="a" href={url} target="_blank" rel="noreferrer" size="small" variant="outlined" startIcon={icon}>{label}</Button>
    : <Typography variant="body2" sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{url}</Typography>;
}

function TableState({ title }: { title: string }) {
  return <Container maxWidth="sm" sx={{ py: 8 }}><EmptyState icon={<CompareArrowsOutlined />} title={title} titleAs="h1" action={<Button component={Link} href="/recrutador/talentos">Explorar talentos</Button>} /></Container>;
}
