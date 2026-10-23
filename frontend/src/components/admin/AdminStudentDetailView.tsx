"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, Button, Card, Chip, Snackbar, Stack, Typography } from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { CompetencyGroups } from "@/components/common/CompetencyGroups";
import { Reveal } from "@/components/common/Reveal";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { brandWash } from "@/components/common/surfaceGradient";
import { adminApi } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { formatBrazilianPhone, normalizePhone, validateBrazilianPhone, validateEmail, validateHttpUrl } from "@/lib/validation";
import { DISPONIBILIDADE_LABELS, MODALIDADE_LABELS, NIVEL_IDIOMA_LABELS, STATUS_FORMACAO_LABELS, STATUS_VALIDACAO_RPV_LABELS, TIPO_EXPERIENCIA_LABELS, TIPO_FORMACAO_LABELS } from "@/lib/labels";
import { ProtectedFileButton } from "@/components/recruiter/ProtectedFileButton";
import { ProtectedTalentPhoto } from "@/components/recruiter/ProtectedTalentPhoto";
import { useLoad } from "@/components/admin/useLoad";
import { Page, LoadState, Status, Confirm } from "@/components/admin/adminShared";

export function AdminStudentDetailView({ id }: { id: string }) {
  const state = useLoad(() => adminApi.student(id), [id]);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [confirmError, setConfirmError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  if (state.loading || state.error || !state.data)
    return (
      <Page title="Perfil do aluno">
        <LoadState {...state} />
      </Page>
    );
  const p = state.data;
  const removeValidation = async () => {
    if (!removeTarget || busy) return;
    setBusy(true);
    setConfirmError(null);
    try {
      await adminApi.validationAction(removeTarget, "remover-validacao");
      setRemoveTarget(null);
      setNotice("Validação RPV removida. A formação voltou para pendente.");
      state.reload();
    } catch (e) {
      setConfirmError(
        getApiErrorMessage(e, "Não foi possível concluir a ação."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Perfil do aluno"
      action={
        <Button component={Link} href="/admin/alunos" variant="outlined" startIcon={<ArrowBackOutlined />}>
          Voltar para alunos
        </Button>
      }
    >
      <Reveal index={1}>
        <Card sx={(theme) => ({ p: { xs: 2.5, sm: 3 }, backgroundImage: brandWash(theme, 14) })}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: { sm: "center" } }}>
            <ProtectedTalentPhoto path={p.fotoUrl} name={p.nomeCompleto} size={96} />
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="h5" sx={{ overflowWrap: "anywhere" }}>
                {p.nomeCompleto}
              </Typography>
              <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                {p.slug} · {[p.cidade, p.uf].filter(Boolean).join(" / ") || "Localização não informada"}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Status active={p.ativo} />
              </Box>
            </Box>
          </Stack>
        </Card>
      </Reveal>
      <SurfaceCard title="Sobre">
        <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }} color={p.bio ? "text.primary" : "text.secondary"}>
          {p.bio || "Não informado."}
        </Typography>
      </SurfaceCard>
      <SurfaceCard title="Contato">
        <Stack spacing={0.5}>
          <ContactRow label="Telefone" value={p.contato.telefone} kind="phone" />
          <ContactRow
            label="E-mail profissional"
            value={p.contato.emailProfissional}
            kind="email"
          />
          <ContactRow
            label="LinkedIn"
            value={p.contato.linkedInUrl}
            kind="url"
          />
          <ContactRow label="GitHub" value={p.contato.gitHubUrl} kind="url" />
          <ContactRow
            label="Portfólio"
            value={p.contato.portfolioUrl}
            kind="url"
          />
          {!Object.values(p.contato).some(Boolean) && (
            <Typography color="text.secondary">Não informado.</Typography>
          )}
        </Stack>
      </SurfaceCard>
      <SurfaceCard title="Competências">
        {p.competencias.length ? (
          <CompetencyGroups competencias={p.competencias} size="medium" />
        ) : (
          <Empty />
        )}
      </SurfaceCard>
      <SurfaceCard title="Formação">
        {p.formacoes.length ? (
          <Stack spacing={1.5}>
            {p.formacoes.map((f) => (
              <Box key={f.id} sx={(theme) => ({ p: 2, borderRadius: 3, border: 1, borderColor: (theme.vars ?? theme).palette.surface.border })}>
                <Typography sx={{ fontWeight: 700 }}>{f.nome}</Typography>
                <Typography color="text.secondary">
                  {f.instituicao} · {TIPO_FORMACAO_LABELS[f.tipo]} ·{" "}
                  {STATUS_FORMACAO_LABELS[f.status]} ·{" "}
                  {formatDate(f.dataInicio)}
                  {f.dataFim ? ` — ${formatDate(f.dataFim)}` : ""}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mt: 1, flexWrap: "wrap" }}
                >
                  {f.ehRioPombaValley && (
                    <Chip
                      size="small"
                      label={`RPV: ${
                        STATUS_VALIDACAO_RPV_LABELS[
                          f.statusValidacaoRpv ?? "PENDENTE"
                        ]
                      }`}
                    />
                  )}
                  {f.possuiCertificado && f.certificadoUrl && (
                    <ProtectedFileButton
                      path={f.certificadoUrl}
                      label="Abrir certificado"
                    />
                  )}
                  {f.ehRioPombaValley &&
                    f.statusValidacaoRpv === "VERIFICADO" && (
                      <Button
                        size="small"
                        onClick={() => {
                          setConfirmError(null);
                          setRemoveTarget(f.id);
                        }}
                      >
                        Remover validação
                      </Button>
                    )}
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Empty />
        )}
      </SurfaceCard>
      <SurfaceCard title="Experiência">
        {p.experiencias.length ? (
          p.experiencias.map((x) => (
            <Box key={x.id} sx={{ mb: 2, "&:last-child": { mb: 0 } }}>
              <Typography sx={{ fontWeight: 700 }}>{x.cargo}</Typography>
              <Typography color="text.secondary">
                {x.empresa} · {TIPO_EXPERIENCIA_LABELS[x.tipo]}
              </Typography>
              {x.descricao && <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{x.descricao}</Typography>}
            </Box>
          ))
        ) : (
          <Empty />
        )}
      </SurfaceCard>
      <SurfaceCard title="Idiomas e disponibilidade">
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {p.idiomas.map((x) => (
            <Chip
              key={x.idiomaId}
              label={`${x.nome} · ${NIVEL_IDIOMA_LABELS[x.nivel]}`}
            />
          ))}
          {p.disponibilidades.map((x) => (
            <Chip
              key={x}
              variant="outlined"
              label={DISPONIBILIDADE_LABELS[x]}
            />
          ))}
          {p.modalidades.map((x) => (
            <Chip key={x} variant="outlined" label={MODALIDADE_LABELS[x]} />
          ))}
        </Stack>
      </SurfaceCard>
      <SurfaceCard title="Projetos">
        {p.projetos.length ? (
          p.projetos.map((x) => (
            <Box key={x.id} sx={{ mb: 2, "&:last-child": { mb: 0 } }}>
              <Typography sx={{ fontWeight: 700 }}>{x.nome}</Typography>
              <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{x.descricao}</Typography>
              <ContactRow label="Demo" value={x.demoUrl} kind="url" />
              <ContactRow
                label="Repositório"
                value={x.repositorioUrl}
                kind="url"
              />
            </Box>
          ))
        ) : (
          <Empty />
        )}
      </SurfaceCard>
      <SurfaceCard title="Currículo">
        {p.curriculo.possuiCurriculo && p.curriculo.url ? (
          <ProtectedFileButton path={p.curriculo.url} label="Abrir currículo" />
        ) : (
          <Empty text="Currículo não informado." />
        )}
      </SurfaceCard>
      <Confirm
        open={removeTarget !== null}
        title="Remover validação RPV?"
        text="A formação deixará de ser exibida como verificada e o status de validação RPV voltará para pendente. A formação e o certificado não serão excluídos."
        busy={busy}
        onClose={() => {
          setConfirmError(null);
          setRemoveTarget(null);
        }}
        error={confirmError}
        confirm={() => void removeValidation()}
        danger
      />
      <Snackbar
        open={!!notice}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        message={notice}
      />
    </Page>
  );
}

function Empty({ text = "Nenhuma informação cadastrada." }: { text?: string }) {
  return <Typography color="text.secondary">{text}</Typography>;
}

type ContactLinkKind = "phone" | "email" | "url";

function contactHref(kind: ContactLinkKind, value: string): string | null {
  if (kind === "phone") {
    if (validateBrazilianPhone(value, false) !== null) return null;
    return `tel:+55${normalizePhone(value)}`;
  }
  if (kind === "email")
    return validateEmail(value, false) === null ? `mailto:${value}` : null;
  return validateHttpUrl(value) === null ? value : null;
}

function ContactRow({
  label,
  value,
  kind,
}: {
  label: string;
  value: string | null;
  kind: ContactLinkKind;
}) {
  const raw = value?.trim();
  if (!raw) return null;
  const href = contactHref(kind, raw);
  const display = kind === "phone" && href ? formatBrazilianPhone(raw) : raw;
  return (
    <Typography>
      {`${label}: `}
      {href ? (
        <Box
          component="a"
          href={href}
          target={kind === "url" ? "_blank" : undefined}
          rel={kind === "url" ? "noreferrer" : undefined}
          sx={{ display: "inline", overflowWrap: "anywhere" }}
        >
          {display}
        </Box>
      ) : (
        <Box component="span" sx={{ overflowWrap: "anywhere" }}>
          {raw}
        </Box>
      )}
    </Typography>
  );
}
