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
  formatBrazilianPhone,
  normalizePhone,
  normalizeWhitespace,
  sanitizeCityName,
  sanitizePersonName,
  validateBrazilianPhone,
  validateCityName,
  validateCompanyName,
  validateEmail,
  validateHttpUrl,
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
    [confirmError, setConfirmError] = useState<string | null>(null),
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
    if (!target || busy) return;
    setBusy(true);
    setConfirmError(null);
    try {
      await adminApi.studentAction(target.id, action);
      setNotice(`Aluno ${action === "bloquear" ? "bloqueado" : "reativado"}.`);
      setTarget(null);
      state.reload();
    } catch (e) {
      setConfirmError(
        getApiErrorMessage(e, "Não foi possível concluir a ação."),
      );
    } finally {
      setBusy(false);
    }
  };
  const removeStudent = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setConfirmError(null);
    try {
      await adminApi.deleteStudent(deleteTarget.id);
      setNotice("Aluno excluído permanentemente.");
      setDeleteTarget(null);
      if (state.data && state.data.items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        state.reload();
      }
    } catch (e) {
      setConfirmError(
        getApiErrorMessage(e, "Não foi possível excluir o aluno."),
      );
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
                      onClick={() => {
                        setConfirmError(null);
                        setTarget(x);
                      }}
                    >
                      {x.ativo ? "Bloquear" : "Reativar"}
                    </Button>
                    {!x.ativo && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setConfirmError(null);
                          setDeleteTarget(x);
                        }}
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
        onClose={() => {
          setConfirmError(null);
          setTarget(null);
        }}
        error={confirmError}
        confirm={() => void mutate(target?.ativo ? "bloquear" : "reativar")}
      />
      <Confirm
        open={deleteTarget !== null}
        title="Excluir aluno permanentemente?"
        text={`A exclusão de ${deleteTarget?.nomeCompleto} é permanente e não poderá ser desfeita.`}
        busy={busy}
        onClose={() => {
          setConfirmError(null);
          setDeleteTarget(null);
        }}
        error={confirmError}
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
  const titleId = useId();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
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
      aria-labelledby={titleId}
    >
      <Box component="form" onSubmit={submit}>
        <DialogTitle id={titleId}>Criar acesso de aluno</DialogTitle>
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
export function AdminRecruitersView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [status, setStatus] = useState(""),
    [detailId, setDetailId] = useState<string | null>(null),
    [detail, setDetail] = useState<AdminRecruiterDetail | null>(null),
    [detailLoading, setDetailLoading] = useState(false),
    [detailError, setDetailError] = useState<string | null>(null),
    [create, setCreate] = useState(false),
    [target, setTarget] = useState<AdminRecruiter | null>(null),
    [busy, setBusy] = useState(false),
    [searchError, setSearchError] = useState<string | null>(null),
    [confirmError, setConfirmError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const detailRequestRef = useRef(0);
  const state = useLoad(
    () => adminApi.recruiters(page, search, status),
    [page, search, status],
  );
  const openDetail = (id: string) => {
    detailRequestRef.current += 1;
    const requestId = detailRequestRef.current;
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    adminApi
      .recruiter(id)
      .then((d) => {
        if (detailRequestRef.current === requestId) setDetail(d);
      })
      .catch((e) => {
        if (detailRequestRef.current === requestId)
          setDetailError(
            getApiErrorMessage(e, "Não foi possível carregar os detalhes."),
          );
      })
      .finally(() => {
        if (detailRequestRef.current === requestId) setDetailLoading(false);
      });
  };
  const closeDetail = () => {
    detailRequestRef.current += 1;
    setDetailId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError(null);
  };
  const action = async () => {
    if (!target || busy) return;
    setBusy(true);
    setConfirmError(null);
    try {
      await adminApi.recruiterAction(
        target.id,
        target.status === "ATIVO" ? "bloquear" : "reativar",
      );
      setTarget(null);
      setNotice("Situação do recrutador atualizada.");
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
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Status active={x.status === "ATIVO"} />
                    <Button size="small" onClick={() => openDetail(x.id)}>
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
      <RecruiterDetail
        open={detailId !== null}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => detailId && openDetail(detailId)}
        onClose={closeDetail}
      />
      <Confirm
        open={!!target}
        title={
          target?.status === "ATIVO"
            ? "Bloquear recrutador?"
            : "Reativar recrutador?"
        }
        text={`Deseja ${target?.status === "ATIVO" ? "bloquear" : "reativar"} ${target?.nomeCompleto}?`}
        busy={busy}
        onClose={() => {
          setConfirmError(null);
          setTarget(null);
        }}
        error={confirmError}
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
  const titleId = useId();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
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
      aria-labelledby={titleId}
    >
      <Box component="form" onSubmit={submit}>
        <DialogTitle id={titleId}>Criar acesso de recrutador</DialogTitle>
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
  open,
  detail,
  loading,
  error,
  onRetry,
  onClose,
}: {
  open: boolean;
  detail: AdminRecruiterDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>Detalhes do recrutador</DialogTitle>
      <DialogContent>
        {loading && (
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Skeleton variant="text" sx={{ fontSize: "1.5rem" }} />
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="rounded" height={48} />
          </Stack>
        )}
        {!loading && error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={onRetry}>
                Tentar novamente
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {!loading && !error && detail && (
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
    [selectedId, setSelectedId] = useState<string | null>(null),
    [detail, setDetail] = useState<RpvValidationDetail | null>(null),
    [detailLoading, setDetailLoading] = useState(false),
    [detailError, setDetailError] = useState<string | null>(null),
    [target, setTarget] = useState<"aprovar" | "rejeitar" | null>(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const state = useLoad(() => adminApi.validations(page), [page]);
  const detailRequestRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const titleId = useId();
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const open = useCallback((id: string) => {
    const requestId = ++detailRequestRef.current;
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    setActionError(null);
    setTarget(null);
    adminApi
      .validation(id)
      .then((data) => {
        if (mountedRef.current && requestId === detailRequestRef.current)
          setDetail(data);
      })
      .catch((e) => {
        if (mountedRef.current && requestId === detailRequestRef.current)
          setDetailError(
            getApiErrorMessage(e, "Não foi possível carregar a validação."),
          );
      })
      .finally(() => {
        if (mountedRef.current && requestId === detailRequestRef.current)
          setDetailLoading(false);
      });
  }, []);
  const retryDetail = useCallback(() => {
    if (selectedId) open(selectedId);
  }, [open, selectedId]);
  const closeDetail = useCallback(() => {
    detailRequestRef.current += 1;
    setSelectedId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError(null);
    setActionError(null);
    setTarget(null);
  }, []);
  const startTarget = (value: "aprovar" | "rejeitar") => {
    setActionError(null);
    setTarget(value);
  };
  const cancelTarget = () => {
    setActionError(null);
    setTarget(null);
  };
  const action = async () => {
    if (!detail || !target || busyRef.current) return;
    // When the only row of a non-first page is processed, that page becomes
    // empty, so navigate back instead of reloading a blank page.
    const emptyAfter = state.data?.items.length === 1 && page > 1;
    busyRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await adminApi.validationAction(detail.formacaoId, target);
      setNotice(`Formação ${target === "aprovar" ? "aprovada" : "rejeitada"}.`);
      closeDetail();
      if (emptyAfter) setPage((p) => (p > 1 ? p - 1 : p));
      else state.reload();
    } catch (e) {
      setActionError(
        getApiErrorMessage(e, "Não foi possível concluir a validação."),
      );
    } finally {
      busyRef.current = false;
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
        open={selectedId !== null}
        onClose={busy ? undefined : closeDetail}
        fullWidth
        maxWidth="sm"
        aria-labelledby={titleId}
      >
        <DialogTitle id={titleId}>Validação de formação RPV</DialogTitle>
        <DialogContent>
          {detailLoading && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Skeleton variant="text" sx={{ fontSize: "1.5rem" }} />
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="50%" />
              <Skeleton variant="rounded" height={48} />
            </Stack>
          )}
          {!detailLoading && detailError && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" onClick={retryDetail}>
                  Tentar novamente
                </Button>
              }
            >
              {detailError}
            </Alert>
          )}
          {!detailLoading && !detailError && detail && (
            <Stack spacing={1.25} sx={{ pt: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
                {detail.formacao.nome}
              </Typography>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                <strong>Aluno:</strong> {detail.aluno.nomeCompleto}
              </Typography>
              <Status active={detail.aluno.ativo} />
              <Typography sx={{ overflowWrap: "anywhere" }}>
                <strong>Instituição:</strong> {detail.formacao.instituicao}
              </Typography>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                <strong>Tipo:</strong>{" "}
                {TIPO_FORMACAO_LABELS[detail.formacao.tipo]}
              </Typography>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                <strong>Período:</strong>{" "}
                {formatDate(detail.formacao.dataInicio)}
                {detail.formacao.dataFim
                  ? ` — ${formatDate(detail.formacao.dataFim)}`
                  : ""}
              </Typography>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                <strong>Carga horária:</strong>{" "}
                {detail.formacao.cargaHoraria ?? "Não informada"}
              </Typography>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                <strong>Status da formação:</strong>{" "}
                {STATUS_FORMACAO_LABELS[detail.formacao.status]}
              </Typography>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                <strong>Validação RPV:</strong>{" "}
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
          <Button onClick={closeDetail} disabled={busy}>
            Fechar
          </Button>
          {!detailLoading && !detailError && detail && (
            <>
              <Button
                color="error"
                onClick={() => startTarget("rejeitar")}
                disabled={busy}
              >
                Rejeitar
              </Button>
              <Button
                variant="contained"
                onClick={() => startTarget("aprovar")}
                disabled={busy}
              >
                Aprovar
              </Button>
            </>
          )}
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
        error={actionError}
        onClose={cancelTarget}
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
          {state.data.items.length > 0 ? (
            <Stack spacing={1.25}>
              {state.data.items.map((x: AuditItem) => (
                <Paper
                  key={x.id}
                  elevation={0}
                  sx={{
                    p: { xs: 2, sm: 2.25 },
                    border: 1,
                    borderColor: "divider",
                    minWidth: 0,
                  }}
                >
                  <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={{ xs: 0.25, sm: 1.5 }}
                      sx={{
                        alignItems: { sm: "center" },
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography
                        component="h2"
                        variant="subtitle1"
                        sx={{ fontWeight: 700, overflowWrap: "anywhere" }}
                      >
                        {x.acao}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatUpdatedAt(x.criadoEm)}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
                      {x.descricao}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ flexWrap: "wrap", alignItems: "center" }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: "anywhere" }}
                      >
                        {x.adminEmail}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        {x.entidadeTipo}: {x.entidadeId}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                textAlign: "center",
                border: 1,
                borderColor: "divider",
              }}
            >
              <Typography variant="h6" sx={{ mb: 0.5 }}>
                Nenhum registro de auditoria
              </Typography>
              <Typography color="text.secondary">
                As ações administrativas aparecerão aqui.
              </Typography>
            </Paper>
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
