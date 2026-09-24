"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Pagination,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import { adminApi } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { formatDate, formatUpdatedAt } from "@/lib/format";
import {
  normalizePhone,
  normalizeWhitespace,
  sanitizeCityName,
  sanitizePersonName,
  validateBrazilianPhone,
  validateCityName,
  validateCompanyName,
  validateEmail,
  validateJobTitle,
  validatePersonName,
  validateSearchTerm,
  validateUF,
} from "@/lib/validation";
import {
  DISPONIBILIDADE_LABELS,
  MODALIDADE_LABELS,
  NIVEL_IDIOMA_LABELS,
  STATUS_FORMACAO_LABELS,
  TIPO_EXPERIENCIA_LABELS,
  TIPO_FORMACAO_LABELS,
} from "@/lib/labels";
import { ProtectedFileButton } from "@/components/recruiter/ProtectedFileButton";
import { ProtectedTalentPhoto } from "@/components/recruiter/ProtectedTalentPhoto";
import type {
  AdminRecruiter,
  AdminRecruiterDetail,
  AdminStudentListItem,
  AuditItem,
  PaginatedResponse,
  RpvValidationDetail,
} from "@/types/admin";

function useLoad<T>(
  loader: () => Promise<T>,
  dependencies: readonly unknown[],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const key = JSON.stringify(dependencies);
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const run = useCallback((requestId: number) => {
    loaderRef
      .current()
      .then((result) => {
        if (mountedRef.current && requestId === requestIdRef.current)
          setData(result);
      })
      .catch((e) => {
        if (mountedRef.current && requestId === requestIdRef.current)
          setError(
            getApiErrorMessage(e, "Não foi possível carregar os dados."),
          );
      })
      .finally(() => {
        if (mountedRef.current && requestId === requestIdRef.current)
          setLoading(false);
      });
  }, []);
  const reload = useCallback(() => {
    requestIdRef.current += 1;
    setLoading(true);
    setError(null);
    run(requestIdRef.current);
  }, [run]);
  // Reset loading/error when the request parameters change. React recommends
  // adjusting state during render instead of setting it inside an effect body.
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setLoading(true);
    setError(null);
  }
  useEffect(() => {
    requestIdRef.current += 1;
    run(requestIdRef.current);
  }, [key, run]);
  return { data, loading, error, reload };
}
function Page({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Typography component="h1" variant="h4">
            {title}
          </Typography>
          {action}
        </Stack>
        {children}
      </Stack>
    </Container>
  );
}
function LoadState({
  loading,
  error,
  reload,
}: {
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  if (loading)
    return (
      <Stack spacing={1.5}>
        {[1, 2, 3].map((x) => (
          <Skeleton key={x} variant="rounded" height={100} />
        ))}
      </Stack>
    );
  if (error)
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" onClick={reload}>
            Tentar novamente
          </Button>
        }
      >
        {error}
      </Alert>
    );
  return null;
}
function Status({ active }: { active: boolean }) {
  return (
    <Chip
      size="small"
      color={active ? "success" : "default"}
      label={active ? "Ativo" : "Bloqueado"}
    />
  );
}
function Pager({
  data,
  setPage,
}: {
  data: PaginatedResponse<unknown>;
  setPage: (page: number) => void;
}) {
  return data.totalPages > 1 ? (
    <Pagination
      page={data.page}
      count={data.totalPages}
      onChange={(_, p) => setPage(p)}
    />
  ) : null;
}
function Confirm({
  open,
  title,
  text,
  confirm,
  busy,
  onClose,
  danger = false,
  error = null,
}: {
  open: boolean;
  title: string;
  text: string;
  confirm: () => void;
  busy: boolean;
  onClose: () => void;
  danger?: boolean;
  error?: string | null;
}) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}
        <Typography>{text}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color={danger ? "error" : "primary"}
          onClick={confirm}
          disabled={busy}
        >
          {busy ? "Processando..." : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AdminDashboardView() {
  const state = useLoad(() => adminApi.dashboard(), []);
  if (state.loading || state.error || !state.data)
    return (
      <Page title="Visão geral">
        <LoadState {...state} />
      </Page>
    );
  const d = state.data;
  const cards: [string, number, string, boolean][] = [
    [
      "Solicitações de cadastro pendentes",
      d.solicitacoesCadastroPendentes,
      "/admin/solicitacoes",
      d.solicitacoesCadastroPendentes > 0,
    ],
    ["Alunos ativos", d.alunosAtivos, "/admin/alunos", false],
    ["Recrutadores ativos", d.recrutadoresAtivos, "/admin/recrutadores", false],
    [
      "Validações RPV pendentes",
      d.validacoesRpvPendentes,
      "/admin/validacoes-rpv",
      d.validacoesRpvPendentes > 0,
    ],
    [
      "Perfis atualizados nos últimos 7 dias",
      d.perfisAtualizadosUltimos7Dias,
      "/admin/alunos",
      false,
    ],
    [
      "Formações RPV verificadas",
      d.formacoesRpvVerificadas,
      "/admin/validacoes-rpv",
      false,
    ],
  ];
  return (
    <Page title="Visão geral">
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          },
          gap: 2,
        }}
      >
        {cards.map(([label, value, href, attention]) => (
          <Paper
            key={label}
            component={Link}
            href={href}
            elevation={0}
            sx={{
              p: 2.5,
              border: 1,
              borderColor: attention ? "primary.light" : "divider",
              textDecoration: "none",
              color: "text.primary",
              bgcolor: attention ? "action.selected" : "background.paper",
            }}
          >
            <Typography color="text.secondary" variant="body2">
              {label}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {value}
            </Typography>
          </Paper>
        ))}
      </Box>
      <Paper elevation={0} sx={{ p: 2.5, border: 1, borderColor: "divider" }}>
        <Typography variant="h6" gutterBottom>
          Competências mais utilizadas
        </Typography>
        {d.competenciasMaisUtilizadas.length ? (
          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ flexWrap: "wrap" }}
          >
            {d.competenciasMaisUtilizadas.map((c) => (
              <Chip key={c.id} label={`${c.nome} · ${c.quantidadeAlunos}`} />
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            Ainda não há competências cadastradas em perfis ativos.
          </Typography>
        )}
      </Paper>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        {[
          ["Analisar solicitações", "/admin/solicitacoes"],
          ["Gerenciar alunos", "/admin/alunos"],
          ["Gerenciar recrutadores", "/admin/recrutadores"],
          ["Ver validações RPV", "/admin/validacoes-rpv"],
          ["Ver auditoria", "/admin/auditoria"],
        ].map(([label, href]) => (
          <Button key={href} component={Link} href={href} variant="outlined">
            {label}
          </Button>
        ))}
      </Stack>
    </Page>
  );
}

export function AdminStudentsView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [create, setCreate] = useState(false),
    [target, setTarget] = useState<AdminStudentListItem | null>(null),
    [deleteTarget, setDeleteTarget] = useState<AdminStudentListItem | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [searchError, setSearchError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const state = useLoad(() => adminApi.students(page, search), [page, search]);
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const validation = validateSearchTerm(draft);
    setSearchError(validation);
    if (validation) return;
    setPage(1);
    setSearch(draft.trim());
  };
  const mutate = async (action: "bloquear" | "reativar") => {
    if (!target) return;
    setBusy(true);
    try {
      await adminApi.studentAction(target.id, action);
      setNotice(`Aluno ${action === "bloquear" ? "bloqueado" : "reativado"}.`);
      setTarget(null);
      state.reload();
    } catch (e) {
      setNotice(getApiErrorMessage(e, "Não foi possível concluir a ação."));
    } finally {
      setBusy(false);
    }
  };
  const removeStudent = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteStudent(deleteTarget.id);
      setNotice("Aluno excluído permanentemente.");
      setDeleteTarget(null);
      state.reload();
    } catch (e) {
      setNotice(getApiErrorMessage(e, "Não foi possível excluir o aluno."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Alunos"
      action={
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={() => setCreate(true)}
        >
          Criar acesso de aluno
        </Button>
      }
    >
      <form onSubmit={submitSearch}>
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            label="Buscar por nome"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 150))}
            error={Boolean(searchError)}
            helperText={searchError}
            slotProps={{ htmlInput: { maxLength: 150 } }}
          />
          <Button type="submit" variant="outlined">
            Buscar
          </Button>
        </Stack>
      </form>
      <LoadState {...state} />
      {!state.loading && !state.error && state.data && (
        <>
          <Stack spacing={1.5}>
            {state.data.items.map((x) => (
              <Paper
                key={x.id}
                elevation={0}
                sx={{ p: 2, border: 1, borderColor: "divider" }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{
                    alignItems: { sm: "center" },
                    justifyContent: "space-between",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center" }}
                  >
                    <ProtectedTalentPhoto
                      path={x.fotoUrl}
                      name={x.nomeCompleto}
                    />
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {x.nomeCompleto}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[x.cidade, x.uf].filter(Boolean).join(" / ") ||
                          "Localização não informada"}{" "}
                        · Atualizado {formatUpdatedAt(x.atualizadoEm)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Status active={x.ativo} />
                    <Button
                      component={Link}
                      href={`/admin/alunos/${x.id}`}
                      size="small"
                    >
                      Ver perfil
                    </Button>
                    <Button
                      size="small"
                      color={x.ativo ? "warning" : "success"}
                      onClick={() => setTarget(x)}
                    >
                      {x.ativo ? "Bloquear" : "Reativar"}
                    </Button>
                    {!x.ativo && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(x)}
                      >
                        Excluir
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
          {state.data.items.length === 0 && (
            <Typography color="text.secondary">
              Nenhum aluno encontrado.
            </Typography>
          )}
          <Pager data={state.data} setPage={setPage} />
        </>
      )}
      <StudentCreate
        open={create}
        onClose={() => setCreate(false)}
        onSuccess={() => {
          setCreate(false);
          setNotice(
            "Acesso de aluno criado. A ativação seguirá o fluxo existente.",
          );
          state.reload();
        }}
      />
      <Confirm
        open={target !== null}
        title={target?.ativo ? "Bloquear aluno?" : "Reativar aluno?"}
        text={
          target?.ativo
            ? `Bloquear ${target.nomeCompleto}? A conta será excluída automaticamente em 30 dias, salvo se for reativada.`
            : `Deseja reativar ${target?.nomeCompleto}? A exclusão automática será cancelada.`
        }
        busy={busy}
        onClose={() => setTarget(null)}
        confirm={() => void mutate(target?.ativo ? "bloquear" : "reativar")}
      />
      <Confirm
        open={deleteTarget !== null}
        title="Excluir aluno permanentemente?"
        text={`A exclusão de ${deleteTarget?.nomeCompleto} é permanente e não poderá ser desfeita.`}
        busy={busy}
        onClose={() => setDeleteTarget(null)}
        confirm={() => void removeStudent()}
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
function StudentCreate({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [nomeCompleto, setName] = useState(""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const validation = validatePersonName(nomeCompleto) ?? validateEmail(email);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi.createStudent({
        nomeCompleto: nomeCompleto.trim(),
        email: email.trim(),
      });
      setName("");
      setEmail("");
      onSuccess();
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Não foi possível criar o acesso."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
    >
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Criar acesso de aluno</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              required
              label="Nome completo"
              value={nomeCompleto}
              onChange={(e) => setName(sanitizePersonName(e.target.value))}
              slotProps={{ htmlInput: { maxLength: 150 } }}
            />
            <TextField
              required
              type="email"
              label="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 254))}
              slotProps={{ htmlInput: { maxLength: 254 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Criando..." : "Criar acesso"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

const STATUS_VALIDACAO_RPV_LABELS = {
  PENDENTE: "Aguardando validação",
  VERIFICADO: "Verificado pelo Rio Pomba Valley",
  REJEITADO: "Validação não aprovada",
};

export function AdminStudentDetailView({ id }: { id: string }) {
  const state = useLoad(() => adminApi.student(id), [id]);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  if (state.loading || state.error || !state.data)
    return (
      <Page title="Perfil do aluno">
        <LoadState {...state} />
      </Page>
    );
  const p = state.data;
  const removeValidation = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await adminApi.validationAction(removeTarget, "remover-validacao");
      setRemoveTarget(null);
      setNotice("Validação RPV removida. A formação voltou para pendente.");
      state.reload();
    } catch (e) {
      setNotice(getApiErrorMessage(e, "Não foi possível concluir a ação."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Perfil do aluno"
      action={
        <Button component={Link} href="/admin/alunos">
          Voltar para alunos
        </Button>
      }
    >
      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <ProtectedTalentPhoto
            path={p.fotoUrl}
            name={p.nomeCompleto}
            size={96}
          />
          <Box>
            <Typography variant="h5">{p.nomeCompleto}</Typography>
            <Typography color="text.secondary">
              {p.slug} ·{" "}
              {[p.cidade, p.uf].filter(Boolean).join(" / ") ||
                "Localização não informada"}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Status active={p.ativo} />
            </Box>
          </Box>
        </Stack>
      </Paper>
      <Section title="Sobre">
        <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }} color={p.bio ? "text.primary" : "text.secondary"}>
          {p.bio || "Não informado."}
        </Typography>
      </Section>
      <Section title="Contato">
        <Stack spacing={0.5}>
          {p.contato.telefone && (
            <Typography>
              {"Telefone: "}
              <Box
                component="a"
                href={`tel:${p.contato.telefone}`}
                sx={{ display: "inline", overflowWrap: "anywhere" }}
              >
                {p.contato.telefone}
              </Box>
            </Typography>
          )}
          {p.contato.emailProfissional && (
            <Typography>
              {"E-mail profissional: "}
              <Box
                component="a"
                href={`mailto:${p.contato.emailProfissional}`}
                sx={{ display: "inline", overflowWrap: "anywhere" }}
              >
                {p.contato.emailProfissional}
              </Box>
            </Typography>
          )}
          {p.contato.linkedInUrl && (
            <Typography>
              {"LinkedIn: "}
              <Box
                component="a"
                href={p.contato.linkedInUrl}
                target="_blank"
                rel="noreferrer"
                sx={{ display: "inline", overflowWrap: "anywhere" }}
              >
                {p.contato.linkedInUrl}
              </Box>
            </Typography>
          )}
          {p.contato.gitHubUrl && (
            <Typography>
              {"GitHub: "}
              <Box
                component="a"
                href={p.contato.gitHubUrl}
                target="_blank"
                rel="noreferrer"
                sx={{ display: "inline", overflowWrap: "anywhere" }}
              >
                {p.contato.gitHubUrl}
              </Box>
            </Typography>
          )}
          {p.contato.portfolioUrl && (
            <Typography>
              {"Portfólio: "}
              <Box
                component="a"
                href={p.contato.portfolioUrl}
                target="_blank"
                rel="noreferrer"
                sx={{ display: "inline", overflowWrap: "anywhere" }}
              >
                {p.contato.portfolioUrl}
              </Box>
            </Typography>
          )}
          {!Object.values(p.contato).some(Boolean) && (
            <Typography color="text.secondary">Não informado.</Typography>
          )}
        </Stack>
      </Section>
      <Section title="Competências">
        {p.competencias.length ? (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            {p.competencias.map((x) => (
              <Chip key={x.id} label={x.nome} />
            ))}
          </Stack>
        ) : (
          <Empty />
        )}
      </Section>
      <Section title="Formação">
        {p.formacoes.length ? (
          <Stack spacing={2} divider={<Divider />}>
            {p.formacoes.map((f) => (
              <Box key={f.id}>
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
                        onClick={() => setRemoveTarget(f.id)}
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
      </Section>
      <Section title="Experiência">
        {p.experiencias.length ? (
          p.experiencias.map((x) => (
            <Box key={x.id} sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 700 }}>{x.cargo}</Typography>
              <Typography color="text.secondary">
                {x.empresa} · {TIPO_EXPERIENCIA_LABELS[x.tipo]}
              </Typography>
              {x.descricao && <Typography>{x.descricao}</Typography>}
            </Box>
          ))
        ) : (
          <Empty />
        )}
      </Section>
      <Section title="Idiomas e disponibilidade">
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
      </Section>
      <Section title="Projetos">
        {p.projetos.length ? (
          p.projetos.map((x) => (
            <Box key={x.id} sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 700 }}>{x.nome}</Typography>
              <Typography>{x.descricao}</Typography>
            </Box>
          ))
        ) : (
          <Empty />
        )}
      </Section>
      <Section title="Currículo">
        {p.curriculo.possuiCurriculo && p.curriculo.url ? (
          <ProtectedFileButton path={p.curriculo.url} label="Abrir currículo" />
        ) : (
          <Empty text="Currículo não informado." />
        )}
      </Section>
      <Confirm
        open={removeTarget !== null}
        title="Remover validação RPV?"
        text="A formação deixará de ser exibida como verificada e o status de validação RPV voltará para pendente. A formação e o certificado não serão excluídos."
        busy={busy}
        onClose={() => setRemoveTarget(null)}
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
export function AdminRecruitersView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [status, setStatus] = useState(""),
    [detail, setDetail] = useState<AdminRecruiterDetail | null>(null),
    [create, setCreate] = useState(false),
    [target, setTarget] = useState<AdminRecruiter | null>(null),
    [busy, setBusy] = useState(false),
    [searchError, setSearchError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const state = useLoad(
    () => adminApi.recruiters(page, search, status),
    [page, search, status],
  );
  const showDetail = (id: string) =>
    adminApi
      .recruiter(id)
      .then(setDetail)
      .catch((e) =>
        setNotice(
          getApiErrorMessage(e, "Não foi possível carregar os detalhes."),
        ),
      );
  const action = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await adminApi.recruiterAction(
        target.id,
        target.status === "ATIVO" ? "bloquear" : "reativar",
      );
      setTarget(null);
      setNotice("Situação do recrutador atualizada.");
      state.reload();
    } catch (e) {
      setNotice(getApiErrorMessage(e, "Não foi possível concluir a ação."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Recrutadores"
      action={
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={() => setCreate(true)}
        >
          Criar acesso de recrutador
        </Button>
      }
    >
      <Stack
        component="form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const validation = validateSearchTerm(draft);
          setSearchError(validation);
          if (validation) return;
          setPage(1);
          setSearch(draft.trim());
        }}
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
      >
        <TextField
          fullWidth
          size="small"
          label="Buscar nome ou empresa"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 150))}
          error={Boolean(searchError)}
          helperText={searchError}
          slotProps={{ htmlInput: { maxLength: 150 } }}
        />
        <TextField
          select
          size="small"
          label="Situação"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="ATIVO">Ativos</MenuItem>
          <MenuItem value="BLOQUEADO">Bloqueados</MenuItem>
        </TextField>
        <Button type="submit" variant="outlined">
          Buscar
        </Button>
      </Stack>
      <LoadState {...state} />
      {!state.loading && !state.error && state.data && (
        <>
          <Stack spacing={1.5}>
            {state.data.items.map((x) => (
              <Paper
                key={x.id}
                elevation={0}
                sx={{ p: 2, border: 1, borderColor: "divider" }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{
                    justifyContent: "space-between",
                    alignItems: { sm: "center" },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>
                      {x.nomeCompleto}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {x.empresa} · {x.cargo} · {x.cidade}/{x.uf}
                    </Typography>
                    <Typography color="text.secondary" variant="caption">
                      Último acesso:{" "}
                      {x.ultimoAcessoEm
                        ? formatUpdatedAt(x.ultimoAcessoEm)
                        : "não informado"}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Status active={x.status === "ATIVO"} />
                    <Button size="small" onClick={() => void showDetail(x.id)}>
                      Detalhes
                    </Button>
                    <Button
                      size="small"
                      color={x.status === "ATIVO" ? "warning" : "success"}
                      onClick={() => setTarget(x)}
                    >
                      {x.status === "ATIVO" ? "Bloquear" : "Reativar"}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
          {state.data.items.length === 0 && (
            <Typography color="text.secondary">
              Nenhum recrutador encontrado.
            </Typography>
          )}
          <Pager data={state.data} setPage={setPage} />
        </>
      )}
      <RecruiterCreate
        open={create}
        onClose={() => setCreate(false)}
        onSuccess={() => {
          setCreate(false);
          setNotice(
            "Acesso de recrutador criado. A ativação seguirá o fluxo existente.",
          );
          state.reload();
        }}
      />
      <RecruiterDetail detail={detail} onClose={() => setDetail(null)} />
      <Confirm
        open={!!target}
        title={
          target?.status === "ATIVO"
            ? "Bloquear recrutador?"
            : "Reativar recrutador?"
        }
        text={`Deseja ${target?.status === "ATIVO" ? "bloquear" : "reativar"} ${target?.nomeCompleto}?`}
        busy={busy}
        onClose={() => setTarget(null)}
        confirm={() => void action()}
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
function RecruiterCreate({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const blank = {
    nomeCompleto: "",
    email: "",
    empresa: "",
    cargo: "",
    telefone: "",
    cidade: "",
    uf: "",
  };
  const [data, setData] = useState(blank),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const validation =
      validatePersonName(data.nomeCompleto) ??
      validateEmail(data.email) ??
      validateCompanyName(data.empresa) ??
      validateJobTitle(data.cargo) ??
      validateBrazilianPhone(data.telefone) ??
      validateCityName(data.cidade) ??
      validateUF(data.uf);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi.createRecruiter(
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [
            k,
            k === "uf"
              ? v.trim().toUpperCase()
              : k === "telefone"
                ? normalizePhone(v)
                : normalizeWhitespace(v),
          ]),
        ),
      );
      setData(blank);
      onSuccess();
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Não foi possível criar o acesso."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Criar acesso de recrutador</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {[
              ["nomeCompleto", "Nome completo", "text"],
              ["email", "E-mail", "email"],
              ["empresa", "Empresa", "text"],
              ["cargo", "Cargo", "text"],
              ["telefone", "Telefone", "tel"],
              ["cidade", "Cidade", "text"],
              ["uf", "UF", "text"],
            ].map(([key, label, type]) => (
              <TextField
                key={key}
                required
                label={label}
                type={type}
                value={data[key as keyof typeof data]}
                onChange={(e) => {
                  const value = e.target.value;
                  setData((p) => ({
                    ...p,
                    [key]:
                      key === "nomeCompleto"
                        ? sanitizePersonName(value)
                        : key === "cidade"
                          ? sanitizeCityName(value)
                          : key === "telefone"
                            ? value
                            : key === "uf"
                              ? value.toUpperCase().slice(0, 2)
                              : value,
                  }));
                }}
                slotProps={{
                  htmlInput: {
                    maxLength:
                      key === "telefone"
                        ? undefined
                        : key === "uf"
                        ? 2
                          : key === "email"
                            ? 254
                            : key === "cidade"
                              ? 120
                              : 150,
                    inputMode: key === "telefone" ? "tel" : undefined,
                  },
                }}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Criando..." : "Criar acesso"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
function RecruiterDetail({
  detail,
  onClose,
}: {
  detail: AdminRecruiterDetail | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!detail} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Detalhes do recrutador</DialogTitle>
      <DialogContent>
        {detail && (
          <Stack spacing={1}>
            <Typography variant="h6">{detail.nomeCompleto}</Typography>
            {[
              ["E-mail", detail.email],
              ["Empresa", detail.empresa],
              ["Cargo", detail.cargo],
              ["Telefone", detail.telefone],
              ["Localização", `${detail.cidade}/${detail.uf}`],
              [
                "Último acesso",
                detail.ultimoAcessoEm
                  ? formatUpdatedAt(detail.ultimoAcessoEm)
                  : "Não informado",
              ],
            ].map(([l, v]) => (
              <Typography key={l}>
                <strong>{l}:</strong> {v}
              </Typography>
            ))}
            <Status active={detail.status === "ATIVO"} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
export function AdminRpvValidationsView() {
  const [page, setPage] = useState(1),
    [detail, setDetail] = useState<RpvValidationDetail | null>(null),
    [target, setTarget] = useState<"aprovar" | "rejeitar" | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  const state = useLoad(() => adminApi.validations(page), [page]);
  const open = (id: string) =>
    adminApi
      .validation(id)
      .then(setDetail)
      .catch((e) =>
        setNotice(
          getApiErrorMessage(e, "Não foi possível carregar a validação."),
        ),
      );
  const action = async () => {
    if (!detail || !target) return;
    setBusy(true);
    try {
      await adminApi.validationAction(detail.formacaoId, target);
      setDetail(null);
      setTarget(null);
      setNotice(`Formação ${target === "aprovar" ? "aprovada" : "rejeitada"}.`);
      state.reload();
    } catch (e) {
      setNotice(
        getApiErrorMessage(e, "Não foi possível concluir a validação."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Validações RPV">
      <LoadState {...state} />
      {!state.loading && !state.error && state.data && (
        <>
          <Stack spacing={1.5}>
            {state.data.items.map((x) => (
              <Paper
                key={x.formacaoId}
                elevation={0}
                sx={{ p: 2, border: 1, borderColor: "divider" }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{
                    justifyContent: "space-between",
                    alignItems: { sm: "center" },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{x.nome}</Typography>
                    <Typography color="text.secondary">
                      {x.alunoNome} · {x.instituicao} ·{" "}
                      {TIPO_FORMACAO_LABELS[x.tipo]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Atualizado {formatUpdatedAt(x.atualizadoEm)} ·{" "}
                      {x.possuiCertificado
                        ? "Certificado disponível"
                        : "Sem certificado"}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Status active={x.alunoAtivo} />
                    <Button onClick={() => void open(x.formacaoId)}>
                      Analisar
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
          {state.data.items.length === 0 && (
            <Typography color="text.secondary">
              Não há validações RPV pendentes.
            </Typography>
          )}
          <Pager data={state.data} setPage={setPage} />
        </>
      )}
      <Dialog
        open={!!detail}
        onClose={busy ? undefined : () => setDetail(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Validação de formação RPV</DialogTitle>
        <DialogContent>
          {detail && (
            <Stack spacing={1.25} sx={{ pt: 1 }}>
              <Typography variant="h6">{detail.formacao.nome}</Typography>
              <Typography>
                <strong>Aluno:</strong> {detail.aluno.nomeCompleto} (
                {detail.aluno.ativo ? "Ativo" : "Bloqueado"})
              </Typography>
              <Typography>
                <strong>Instituição:</strong> {detail.formacao.instituicao}
              </Typography>
              <Typography>
                <strong>Tipo:</strong>{" "}
                {TIPO_FORMACAO_LABELS[detail.formacao.tipo]}
              </Typography>
              <Typography>
                <strong>Período:</strong>{" "}
                {formatDate(detail.formacao.dataInicio)}
                {detail.formacao.dataFim
                  ? ` — ${formatDate(detail.formacao.dataFim)}`
                  : ""}
              </Typography>
              <Typography>
                <strong>Carga horária:</strong>{" "}
                {detail.formacao.cargaHoraria ?? "Não informada"}
              </Typography>
              <Typography>
                <strong>Status:</strong>{" "}
                {STATUS_FORMACAO_LABELS[detail.formacao.status]} · RPV{" "}
                {detail.formacao.statusValidacaoRpv}
              </Typography>
              {detail.formacao.possuiCertificado ? (
                <ProtectedFileButton
                  path={`/api/admin/validacoes-rpv/${detail.formacaoId}/certificado`}
                  label="Abrir certificado"
                />
              ) : (
                <Alert severity="info">
                  Não há certificado disponível para esta formação.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)} disabled={busy}>
            Fechar
          </Button>
          <Button
            color="error"
            onClick={() => setTarget("rejeitar")}
            disabled={busy}
          >
            Rejeitar
          </Button>
          <Button
            variant="contained"
            onClick={() => setTarget("aprovar")}
            disabled={busy}
          >
            Aprovar
          </Button>
        </DialogActions>
      </Dialog>
      <Confirm
        open={!!target}
        title={
          target === "aprovar" ? "Aprovar formação?" : "Rejeitar formação?"
        }
        text={
          target === "aprovar"
            ? "A formação será marcada como verificada pelo Rio Pomba Valley."
            : "A formação será marcada como rejeitada."
        }
        busy={busy}
        onClose={() => setTarget(null)}
        confirm={() => void action()}
        danger={target === "rejeitar"}
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
export function AdminAuditView() {
  const [page, setPage] = useState(1);
  const state = useLoad(() => adminApi.audit(page), [page]);
  return (
    <Page title="Auditoria">
      <LoadState {...state} />
      {!state.loading && !state.error && state.data && (
        <>
          <Stack spacing={1.25}>
            {state.data.items.map((x: AuditItem) => (
              <Paper
                key={x.id}
                elevation={0}
                sx={{ p: 2, border: 1, borderColor: "divider" }}
              >
                <Typography sx={{ fontWeight: 700 }}>{x.descricao}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {formatUpdatedAt(x.criadoEm)} · {x.adminEmail} · {x.acao}
                </Typography>
                <Typography color="text.secondary" variant="caption">
                  {x.entidadeTipo}: {x.entidadeId}
                </Typography>
              </Paper>
            ))}
          </Stack>
          {state.data.items.length === 0 && (
            <Typography color="text.secondary">
              Nenhuma ação administrativa registrada.
            </Typography>
          )}
          <Pager data={state.data} setPage={setPage} />
        </>
      )}
    </Page>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ p: 2.5, border: 1, borderColor: "divider" }}
    >
      <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}
function Empty({ text = "Nenhuma informação cadastrada." }: { text?: string }) {
  return <Typography color="text.secondary">{text}</Typography>;
}
