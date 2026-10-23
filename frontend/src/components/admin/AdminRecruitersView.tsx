"use client";

import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Snackbar, Stack, TextField, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import BusinessCenterOutlined from "@mui/icons-material/BusinessCenterOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { EmptyState } from "@/components/common/EmptyState";
import { CityStateFields } from "@/components/registration/CityStateFields";
import { adminApi } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import { maskPhoneChange, normalizeEmailInput, normalizePhone, normalizeWhitespace, sanitizePersonName, stripEmoji, stripEmojiOnPaste, validateBrazilianPhone, validateCityName, validateCompanyName, validateEmail, validateJobTitle, validatePersonName, validateSearchTerm, validateUF } from "@/lib/validation";
import { ActivationSnackbar, useActivationFeedback } from "@/components/admin/activationFeedback";
import type { AdminRecruiter, AdminRecruiterCreated, AdminRecruiterDetail } from "@/types/admin";
import { useLoad } from "@/components/admin/useLoad";
import { Page, LoadState, AdminRow, DetailSkeleton, IconTile, SearchCard, fieldOnWash, Status, Pager, Confirm } from "@/components/admin/adminShared";

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
  const activation = useActivationFeedback();
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
      description="Pesquise, consulte e gerencie o acesso dos recrutadores."
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
      <SearchCard
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const validation = validateSearchTerm(draft);
          setSearchError(validation);
          if (validation) return;
          setPage(1);
          setSearch(draft.trim());
        }}
      >
        <TextField
          fullWidth
          label="Buscar nome ou empresa"
          value={draft}
          onChange={(e) => setDraft(stripEmoji(e.target.value).slice(0, 150))}
          error={Boolean(searchError)}
          helperText={searchError}
          slotProps={{
            htmlInput: { maxLength: 150, onPaste: stripEmojiOnPaste },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined color="action" />
                </InputAdornment>
              ),
            },
          }}
          sx={fieldOnWash}
        />
        <TextField
          select
          label="Situação"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          sx={{ minWidth: 170, ...fieldOnWash }}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="ATIVO">Ativos</MenuItem>
          <MenuItem value="BLOQUEADO">Bloqueados</MenuItem>
        </TextField>
      </SearchCard>
      <LoadState {...state} />
      {!state.loading && !state.error && state.data && (
        <>
          <Stack spacing={1.5}>
            {state.data.items.map((x, index) => (
              <AdminRow key={x.id} index={index}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  sx={{
                    justifyContent: "space-between",
                    alignItems: { md: "center" },
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                    <IconTile>
                      <BusinessCenterOutlined />
                    </IconTile>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{x.nomeCompleto}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        {x.empresa} · {x.cargo} · {x.cidade}/{x.uf}
                      </Typography>
                      <Typography color="text.secondary" variant="caption">
                        Último acesso: {x.ultimoAcessoEm ? formatUpdatedAt(x.ultimoAcessoEm) : "não informado"}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                    <Status active={x.status === "ATIVO"} />
                    <Button size="small" variant="outlined" onClick={() => openDetail(x.id)}>
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
              </AdminRow>
            ))}
          </Stack>
          {state.data.items.length === 0 && (
            <EmptyState
              icon={<BusinessCenterOutlined />}
              title="Nenhum recrutador encontrado."
              description={search || status ? "Tente outro nome, empresa ou situação." : "Os recrutadores cadastrados aparecem aqui."}
            />
          )}
          <Pager data={state.data} setPage={setPage} />
        </>
      )}
      <RecruiterCreate
        open={create}
        onClose={() => setCreate(false)}
        onSuccess={(created) => {
          setCreate(false);
          activation.reportCreated(
            created.id,
            created.activationSent,
            "Acesso de recrutador criado e email de ativação enviado.",
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
      <ActivationSnackbar
        notice={activation.notice}
        busy={activation.resendBusy}
        onClose={() => activation.setNotice(null)}
        onResend={() => void activation.resend()}
      />
    </Page>
  );
}

interface RecruiterField {
  key: keyof typeof BLANK_RECRUITER;
  label: string;
  type: string;
  maxLength?: number;
  /** Cleans what the admin types into the field; the event lets a mask keep the caret in place. */
  sanitize: (value: string, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => string;
  /** Cleans the value right before it is sent to the API. */
  normalize: (value: string) => string;
}

const BLANK_RECRUITER = {
  nomeCompleto: "",
  email: "",
  empresa: "",
  cargo: "",
  telefone: "",
  cidade: "",
  uf: "",
};

const RECRUITER_FIELDS: RecruiterField[] = [
  { key: "nomeCompleto", label: "Nome completo", type: "text", maxLength: 150, sanitize: sanitizePersonName, normalize: normalizeWhitespace },
  { key: "email", label: "E-mail", type: "email", maxLength: 254, sanitize: stripEmoji, normalize: normalizeEmailInput },
  { key: "empresa", label: "Empresa", type: "text", maxLength: 150, sanitize: stripEmoji, normalize: normalizeWhitespace },
  { key: "cargo", label: "Cargo", type: "text", maxLength: 150, sanitize: stripEmoji, normalize: normalizeWhitespace },
  { key: "telefone", label: "Telefone", type: "tel", sanitize: (_value, event) => maskPhoneChange(event), normalize: normalizePhone },
];

function RecruiterCreate({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (created: AdminRecruiterCreated) => void;
}) {
  const [data, setData] = useState(BLANK_RECRUITER),
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
      validateUF(data.uf) ??
      validateCityName(data.cidade);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await adminApi.createRecruiter({
        ...Object.fromEntries(RECRUITER_FIELDS.map(({ key, normalize }) => [key, normalize(data[key])])),
        cidade: normalizeWhitespace(data.cidade),
        uf: data.uf,
      });
      setData(BLANK_RECRUITER);
      onSuccess(created);
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
      <Box component="form" noValidate onSubmit={submit}>
        <DialogTitle id={titleId}>Criar acesso de recrutador</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {RECRUITER_FIELDS.map(({ key, label, type, maxLength, sanitize }) => (
              <TextField
                key={key}
                required
                label={label}
                type={type}
                value={data[key]}
                onChange={(e) => {
                  const value = sanitize(e.target.value, e);
                  setData((p) => ({ ...p, [key]: value }));
                }}
                slotProps={{ htmlInput: { maxLength, inputMode: key === "telefone" ? "tel" : undefined, onPaste: stripEmojiOnPaste } }}
              />
            ))}
            <CityStateFields
              idPrefix="recrutador"
              cidade={data.cidade}
              uf={data.uf}
              onCidadeChange={(cidade) => setData((p) => ({ ...p, cidade }))}
              onUfChange={(uf) => setData((p) => ({ ...p, uf }))}
              disabled={busy}
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
          <DetailSkeleton />
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
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
                {detail.nomeCompleto}
              </Typography>
              <Status active={detail.status === "ATIVO"} />
            </Stack>
            <Box component="dl" className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ["E-mail", detail.email],
                ["Empresa", detail.empresa],
                ["Cargo", detail.cargo],
                ["Telefone", detail.telefone],
                ["Localização", `${detail.cidade}/${detail.uf}`],
                ["Último acesso", detail.ultimoAcessoEm ? formatUpdatedAt(detail.ultimoAcessoEm) : "Não informado"],
              ].map(([l, v]) => (
                <Box key={l} sx={{ minWidth: 0 }}>
                  <Typography component="dt" variant="caption" color="text.secondary">
                    {l}
                  </Typography>
                  <Typography component="dd" sx={{ m: 0, overflowWrap: "anywhere" }}>
                    {v}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
