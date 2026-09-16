"use client";

import { useCallback, useEffect, useState } from "react";
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
  MenuItem,
  Pagination,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { adminApi } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import { TIPO_FORMACAO_LABELS } from "@/lib/labels";
import { stripEmoji, validateSearchTerm } from "@/lib/validation";
import type {
  AdminRegistrationRequest,
  AdminRegistrationRequestDetail,
  RegistrationRequestStatus,
  RegistrationRequestType,
} from "@/types/admin";

const statusLabel: Record<RegistrationRequestStatus, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
};
export function RegistrationRequestsView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [type, setType] = useState<RegistrationRequestType | "">(""),
    [status, setStatus] = useState<RegistrationRequestStatus | "">("PENDENTE"),
    [items, setItems] = useState<AdminRegistrationRequest[] | null>(null),
    [totalPages, setTotalPages] = useState(0),
    [error, setError] = useState<string | null>(null),
    [detail, setDetail] = useState<AdminRegistrationRequestDetail | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [searchError, setSearchError] = useState<string | null>(null),
    [rejectionOpen, setRejectionOpen] = useState(false),
    [reason, setReason] = useState(""),
    [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.registrationRequests(
        page,
        search,
        type,
        status,
      );
      setItems(data.items);
      setTotalPages(data.totalPages);
    } catch (cause) {
      setError(
        getApiErrorMessage(cause, "Não foi possível carregar as solicitações."),
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, status, type]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await adminApi.registrationRequests(
          page,
          search,
          type,
          status,
        );
        if (active) {
          setItems(data.items);
          setTotalPages(data.totalPages);
          setError(null);
        }
      } catch (cause) {
        if (active)
          setError(
            getApiErrorMessage(
              cause,
              "Não foi possível carregar as solicitações.",
            ),
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, search, status, type]);
  const open = async (id: string) => {
    try {
      setDetail(await adminApi.registrationRequest(id));
    } catch (cause) {
      setNotice(
        getApiErrorMessage(cause, "Não foi possível abrir a solicitação."),
      );
    }
  };
  const approve = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await adminApi.approveRegistration(detail.id);
      setNotice(
        "Cadastro aprovado. A ativação foi encaminhada pelo fluxo existente.",
      );
      setDetail(null);
      await load();
    } catch (cause) {
      setNotice(
        getApiErrorMessage(cause, "Não foi possível aprovar o cadastro."),
      );
    } finally {
      setBusy(false);
    }
  };
  const reject = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await adminApi.rejectRegistration(detail.id, reason.trim() || undefined);
      setNotice("Solicitação rejeitada.");
      setRejectionOpen(false);
      setDetail(null);
      setReason("");
      await load();
    } catch (cause) {
      setNotice(
        getApiErrorMessage(cause, "Não foi possível rejeitar a solicitação."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography component="h1" variant="h4">
            Solicitações de cadastro
          </Typography>
          <Typography color="text.secondary">
            Analise pedidos de acesso antes de criar uma conta no Talent Valley.
          </Typography>
        </Stack>
        <Stack
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            const validation = validateSearchTerm(draft);
            setSearchError(validation);
            if (validation) return;
            setPage(1);
            setSearch(draft.trim());
          }}
          direction={{ xs: "column", md: "row" }}
          spacing={1}
        >
          <TextField
            fullWidth
            size="small"
            label="Buscar nome, e-mail, empresa, instituição ou curso"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 150))}
            error={Boolean(searchError)}
            helperText={searchError}
            slotProps={{ htmlInput: { maxLength: 150 } }}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={type}
            onChange={(e) => {
              setPage(1);
              setType(e.target.value as RegistrationRequestType | "");
            }}
            sx={{ minWidth: 145 }}
          >
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="ALUNO">Alunos</MenuItem>
            <MenuItem value="RECRUTADOR">Recrutadores</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as RegistrationRequestStatus | "");
            }}
            sx={{ minWidth: 145 }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="PENDENTE">Pendentes</MenuItem>
            <MenuItem value="APROVADA">Aprovadas</MenuItem>
            <MenuItem value="REJEITADA">Rejeitadas</MenuItem>
          </TextField>
          <Button type="submit" variant="outlined">
            Buscar
          </Button>
        </Stack>
        {loading && (
          <Stack spacing={1.5}>
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} variant="rounded" height={110} />
            ))}
          </Stack>
        )}
        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={() => void load()}>
                Tentar novamente
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {items && (
          <>
            <Stack spacing={1.5}>
              {items.map((request) => (
                <RequestCard key={request.id} request={request} onOpen={open} />
              ))}
            </Stack>
            {items.length === 0 && (
              <Typography color="text.secondary">
                Nenhuma solicitação encontrada para os filtros selecionados.
              </Typography>
            )}
            {totalPages > 1 && (
              <Pagination
                page={page}
                count={totalPages}
                onChange={(_, next) => setPage(next)}
              />
            )}
          </>
        )}
        <DetailDialog
          detail={detail}
          busy={busy}
          onClose={() => setDetail(null)}
          onApprove={() => void approve()}
          onReject={() => setRejectionOpen(true)}
        />
        <Dialog
          open={rejectionOpen}
          onClose={busy ? undefined : () => setRejectionOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Rejeitar solicitação</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Motivo (opcional)"
              value={reason}
              onChange={(e) =>
                setReason(stripEmoji(e.target.value).slice(0, 500))
              }
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 500 } }}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setRejectionOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={busy}
              onClick={() => void reject()}
            >
              {busy ? "Rejeitando..." : "Rejeitar"}
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar
          open={!!notice}
          autoHideDuration={6000}
          onClose={() => setNotice(null)}
          message={notice}
        />
      </Stack>
    </Container>
  );
}
function RequestCard({
  request,
  onOpen,
}: {
  request: AdminRegistrationRequest;
  onOpen: (id: string) => void;
}) {
  const student = request.tipo === "ALUNO";
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.25,
        border: 1,
        borderColor:
          request.status === "PENDENTE" ? "primary.light" : "divider",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", mb: 0.5 }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              {request.nomeCompleto}
            </Typography>
            <Chip
              size="small"
              color={
                request.status === "PENDENTE"
                  ? "warning"
                  : request.status === "APROVADA"
                    ? "success"
                    : "default"
              }
              label={statusLabel[request.status]}
            />
            <Chip
              size="small"
              variant="outlined"
              label={student ? "Aluno" : "Recrutador"}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {request.email} · {request.telefone} · {request.cidade}/{request.uf}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {student
              ? `${request.instituicaoEnsino} · ${request.curso}${request.tipoFormacao ? ` · ${TIPO_FORMACAO_LABELS[request.tipoFormacao]}` : ""}`
              : `${request.empresa} · ${request.cargo}`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Solicitada {formatUpdatedAt(request.criadoEm)}
          </Typography>
        </Box>
        <Button onClick={() => onOpen(request.id)}>Ver detalhes</Button>
      </Stack>
    </Paper>
  );
}
function DetailDialog({
  detail,
  busy,
  onClose,
  onApprove,
  onReject,
}: {
  detail: AdminRegistrationRequestDetail | null;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (!detail) return null;
  const student = detail.tipo === "ALUNO";
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Detalhes da solicitação</DialogTitle>
      <DialogContent>
        <Stack spacing={1.15} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={1}>
            <Chip size="small" label={statusLabel[detail.status]} />
            <Chip
              size="small"
              variant="outlined"
              label={student ? "Aluno" : "Recrutador"}
            />
          </Stack>
          <Typography variant="h6">{detail.nomeCompleto}</Typography>
          {[
            ["E-mail", detail.email],
            ["Telefone", detail.telefone],
            ["Localização", `${detail.cidade}/${detail.uf}`],
            ["Enviada em", formatUpdatedAt(detail.criadoEm)],
            ...(student
              ? [
                  ["Instituição", detail.instituicaoEnsino],
                  ["Curso", detail.curso],
                  [
                    "Tipo de formação",
                    detail.tipoFormacao
                      ? TIPO_FORMACAO_LABELS[detail.tipoFormacao]
                      : null,
                  ],
                  ["Ano previsto", detail.anoConclusaoPrevisto],
                  ["Relação RPV", detail.relacaoRioPombaValley],
                ]
              : [
                  ["Empresa", detail.empresa],
                  ["Cargo", detail.cargo],
                  ["Site", detail.siteEmpresa],
                ]),
          ].map(([label, value]) =>
            value ? (
              <Typography key={String(label)}>
                <strong>{label}:</strong> {value}
              </Typography>
            ) : null,
          )}
          {detail.analisadoEm && (
            <Typography>
              <strong>Analisada em:</strong>{" "}
              {formatUpdatedAt(detail.analisadoEm)}
              {detail.adminEmail ? ` por ${detail.adminEmail}` : ""}
            </Typography>
          )}
          {detail.motivoRejeicao && (
            <Alert severity="info">
              Motivo da rejeição: {detail.motivoRejeicao}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Fechar
        </Button>
        {detail.status === "PENDENTE" && (
          <>
            <Button color="error" disabled={busy} onClick={onReject}>
              Rejeitar cadastro
            </Button>
            <Button variant="contained" disabled={busy} onClick={onApprove}>
              {busy ? "Aprovando..." : "Aprovar cadastro"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
