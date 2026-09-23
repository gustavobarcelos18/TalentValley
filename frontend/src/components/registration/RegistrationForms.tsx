"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import BusinessCenterOutlined from "@mui/icons-material/BusinessCenterOutlined";
import LoginOutlined from "@mui/icons-material/LoginOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { GuestOnly } from "@/components/auth/GuestOnly";
import { registrationApi } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { TIPO_FORMACAO_LABELS } from "@/lib/labels";
import {
  BRAZILIAN_UFS,
  normalizeEmailInput,
  normalizePhone,
  normalizeWhitespace,
  sanitizeCityName,
  sanitizeIntegerInput,
  sanitizePersonName,
  stripEmoji,
  stripEmojiOnPaste,
  validateBrazilianPhone,
  validateCityName,
  validateCompanyName,
  validateCourseName,
  validateEmail,
  validateFreeText,
  validateHttpUrl,
  validateInstitutionName,
  validateJobTitle,
  validatePersonName,
  validateUF,
  validateYear,
} from "@/lib/validation";
import type { TipoFormacao } from "@/types/student";

type FieldErrors = Record<string, string | null>;
type CommonForm = {
  nomeCompleto: string;
  email: string;
  telefone: string;
  cidade: string;
  uf: string;
};

const formations = Object.keys(TIPO_FORMACAO_LABELS) as TipoFormacao[];
const commonBlank: CommonForm = {
  nomeCompleto: "",
  email: "",
  telefone: "",
  cidade: "",
  uf: "",
};

// Reference to a field's focusable control. MUI Select exposes an imperative
// handle with `focus` instead of a DOM node, so both shapes are accepted.
type FocusableControl = { focus: () => void } | null;

// Visual/DOM order of each registration form's fields. Used to focus the
// first invalid field after a failed submission.
const studentFieldOrder = [
  "nomeCompleto",
  "email",
  "telefone",
  "cidade",
  "uf",
  "instituicaoEnsino",
  "curso",
  "tipoFormacao",
  "anoConclusaoPrevisto",
  "relacaoRioPombaValley",
] as const;
const recruiterFieldOrder = [
  "nomeCompleto",
  "email",
  "telefone",
  "cidade",
  "uf",
  "empresa",
  "cargo",
  "siteEmpresa",
] as const;

// Public registration identity lockup: decorative accent, wordmark and
// institutional line. It sits above the page title so the registration
// heading stays the only h1 of the screen.
function BrandLockup() {
  return (
    <Stack spacing={0.5}>
      <Box
        aria-hidden
        sx={{ width: 32, height: 3, borderRadius: 1, bgcolor: "primary.main" }}
      />
      <Typography
        component="p"
        sx={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: { xs: "1.35rem", sm: "1.5rem" },
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: "-0.03em",
        }}
      >
        Talent{" "}
        <Box component="span" sx={{ color: "secondary.main" }}>
          Valley
        </Box>
      </Typography>
      <Typography component="p" variant="caption" color="text.secondary">
        Uma iniciativa Rio Pomba Valley
      </Typography>
    </Stack>
  );
}

// Prominent, accessible way back to the profile choice page. Kept as a native
// Next.js Link so it behaves like a normal navigation link.
function BackLink({ href }: { href: string }) {
  return (
    <Typography
      component={Link}
      href={href}
      variant="body2"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        width: "fit-content",
        color: "primary.main",
        fontWeight: 600,
        textDecoration: "none",
        "&:hover": { textDecoration: "underline" },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
          borderRadius: 1,
        },
      }}
    >
      <ArrowBackOutlined fontSize="small" />
      Voltar para escolher perfil
    </Typography>
  );
}

function PublicPage({
  title,
  subtitle,
  backHref,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <GuestOnly>
      <Box
        component="main"
        sx={{
          minHeight: "100dvh",
          py: { xs: 4, md: 7 },
          px: 2,
          bgcolor: "background.default",
        }}
      >
        <Container maxWidth="sm">
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4 },
              border: 1,
              borderColor: "divider",
              borderTop: 3,
              borderTopColor: "primary.main",
            }}
          >
            <Stack spacing={3}>
              <Stack spacing={2}>
                <BrandLockup />
                <Stack spacing={0.75}>
                  <Typography component="h1" variant="h4">
                    {title}
                  </Typography>
                  {subtitle && (
                    <Typography color="text.secondary">{subtitle}</Typography>
                  )}
                  <Typography
                    variant={subtitle ? "body2" : undefined}
                    color="text.secondary"
                  >
                    Seu pedido será analisado pela equipe do Talent Valley antes
                    da criação da conta.
                  </Typography>
                </Stack>
              </Stack>
              {backHref && <BackLink href={backHref} />}
              {children}
            </Stack>
          </Paper>
        </Container>
      </Box>
    </GuestOnly>
  );
}

function Success() {
  return (
    <Alert severity="success">
      <Typography sx={{ fontWeight: 700 }}>
        Solicitação enviada com sucesso.
      </Typography>
      <Typography variant="body2">
        Seu cadastro será analisado pela equipe do Talent Valley. Se aprovado,
        você receberá as instruções para ativar sua conta.
      </Typography>
    </Alert>
  );
}
function commonErrors(form: CommonForm): FieldErrors {
  return {
    nomeCompleto: validatePersonName(form.nomeCompleto),
    email: validateEmail(form.email),
    telefone: validateBrazilianPhone(form.telefone),
    cidade: validateCityName(form.cidade),
    uf: validateUF(form.uf),
  };
}
function firstError(errors: FieldErrors): string | null {
  return (
    Object.values(errors).find((error): error is string => Boolean(error)) ??
    null
  );
}

function CommonFields({
  value,
  errors,
  onChange,
  onBlur,
  registerFieldRef,
  disabled,
}: {
  value: CommonForm;
  errors: FieldErrors;
  onChange: (key: keyof CommonForm, value: string) => void;
  onBlur: (key: keyof CommonForm) => void;
  registerFieldRef: (key: keyof CommonForm) => (node: FocusableControl) => void;
  disabled: boolean;
}) {
  return (
    <>
      <TextField
        required
        label="Nome completo"
        autoComplete="name"
        value={value.nomeCompleto}
        onChange={(e) =>
          onChange("nomeCompleto", sanitizePersonName(e.target.value))
        }
        onBlur={() => onBlur("nomeCompleto")}
        inputRef={registerFieldRef("nomeCompleto")}
        disabled={disabled}
        error={Boolean(errors.nomeCompleto)}
        helperText={errors.nomeCompleto}
        slotProps={{
          htmlInput: { maxLength: 150, onPaste: stripEmojiOnPaste },
        }}
      />
      <TextField
        required
        type="email"
        label="E-mail"
        autoComplete="email"
        value={value.email}
        onChange={(e) =>
          onChange("email", stripEmoji(e.target.value).slice(0, 254))
        }
        onBlur={() => onBlur("email")}
        inputRef={registerFieldRef("email")}
        disabled={disabled}
        error={Boolean(errors.email)}
        helperText={errors.email}
        slotProps={{
          htmlInput: {
            maxLength: 254,
            autoCapitalize: "none",
            onPaste: stripEmojiOnPaste,
          },
        }}
      />
      <TextField
        required
        type="tel"
        label="Telefone"
        value={value.telefone}
        onChange={(e) => onChange("telefone", stripEmoji(e.target.value))}
        onBlur={() => onBlur("telefone")}
        inputRef={registerFieldRef("telefone")}
        disabled={disabled}
        error={Boolean(errors.telefone)}
        helperText={errors.telefone ?? "Ex.: (32) 99999-9999"}
        slotProps={{
          htmlInput: { inputMode: "tel", onPaste: stripEmojiOnPaste },
        }}
      />
      <TextField
        required
        label="Cidade"
        value={value.cidade}
        onChange={(e) => onChange("cidade", sanitizeCityName(e.target.value))}
        onBlur={() => onBlur("cidade")}
        inputRef={registerFieldRef("cidade")}
        disabled={disabled}
        error={Boolean(errors.cidade)}
        helperText={errors.cidade}
        slotProps={{
          htmlInput: { maxLength: 120, onPaste: stripEmojiOnPaste },
        }}
      />
      <TextField
        required
        select
        label="UF"
        value={value.uf}
        onChange={(e) => onChange("uf", e.target.value)}
        onBlur={() => onBlur("uf")}
        inputRef={registerFieldRef("uf")}
        disabled={disabled}
        error={Boolean(errors.uf)}
        helperText={errors.uf}
      >
        <MenuItem value="">Selecione</MenuItem>
        {BRAZILIAN_UFS.map((uf) => (
          <MenuItem key={uf} value={uf}>
            {uf}
          </MenuItem>
        ))}
      </TextField>
    </>
  );
}

// A selectable profile card. It stays a native Next.js Link (rendered as an
// anchor through Paper) so keyboard, middle-click and assistive tech keep the
// default link behavior, while hover/focus/active states make it feel tappable.
function ChoiceCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Paper
      component={Link}
      href={href}
      elevation={0}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        p: { xs: 2, sm: 2.5 },
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        textDecoration: "none",
        color: "text.primary",
        transition: (theme) =>
          theme.transitions.create(
            ["background-color", "border-color", "box-shadow"],
            { duration: theme.transitions.duration.shorter },
          ),
        "&:hover": {
          bgcolor: "action.hover",
          borderColor: "primary.main",
          boxShadow: (theme) => theme.shadows[2],
        },
        "&:active": {
          bgcolor: "action.selected",
          borderColor: "primary.dark",
          boxShadow: "none",
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
        "@media (hover: hover) and (prefers-reduced-motion: no-preference)": {
          "&:hover .ChoiceCard-arrow": {
            transform: "translateX(3px)",
          },
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "& .ChoiceCard-arrow": { transition: "none" },
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: 2,
          color: "primary.main",
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
      <ArrowForwardOutlined
        aria-hidden
        fontSize="small"
        className="ChoiceCard-arrow"
        sx={{
          flexShrink: 0,
          color: "action.active",
          transition: (theme) =>
            theme.transitions.create("transform", {
              duration: theme.transitions.duration.shorter,
            }),
        }}
      />
    </Paper>
  );
}

export function RegistrationChoice() {
  return (
    <PublicPage
      title="Como deseja participar?"
      subtitle="Escolha seu perfil para solicitar acesso ao Talent Valley."
    >
      <Stack spacing={2}>
        <ChoiceCard
          href="/cadastro/aluno"
          icon={<SchoolOutlined />}
          title="Sou aluno"
          description="Envie seus dados para análise. Após aprovação, você receberá acesso para criar seu perfil profissional."
        />
        <ChoiceCard
          href="/cadastro/recrutador"
          icon={<BusinessCenterOutlined />}
          title="Sou Recrutador"
          description="Solicite acesso para pesquisar talentos da comunidade Rio Pomba Valley."
        />
        <Stack spacing={2}>
          <Divider />
          <Stack
            direction="row"
            spacing={1.5}
            useFlexGap
            sx={{
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Já possui acesso?
            </Typography>
            <Button
              component={Link}
              href="/login"
              variant="outlined"
              startIcon={<LoginOutlined />}
            >
              Entrar
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </PublicPage>
  );
}

export function StudentRegistrationForm() {
  const [common, setCommon] = useState(commonBlank);
  const [school, setSchool] = useState({
    instituicaoEnsino: "",
    curso: "",
    tipoFormacao: "" as TipoFormacao | "",
    anoConclusaoPrevisto: "",
    relacaoRioPombaValley: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const fieldRefs = useRef<Partial<Record<string, FocusableControl>>>({});
  const [errorSequence, setErrorSequence] = useState(0);
  const lastErrorFocus = useRef<string | null>(null);
  const registerFieldRef = (key: string) => (node: FocusableControl) => {
    fieldRefs.current[key] = node;
  };
  const validate = () => ({
    ...commonErrors(common),
    instituicaoEnsino: validateInstitutionName(school.instituicaoEnsino),
    curso: validateCourseName(school.curso),
    tipoFormacao: school.tipoFormacao
      ? null
      : "Selecione um tipo de formação válido.",
    anoConclusaoPrevisto: validateYear(school.anoConclusaoPrevisto),
    relacaoRioPombaValley: school.relacaoRioPombaValley
      ? validateFreeText(school.relacaoRioPombaValley, 500)
      : null,
  });
  const blurCommon = (key: keyof CommonForm) =>
    setErrors((current) => ({ ...current, [key]: commonErrors(common)[key] }));
  // After a failed submission, move focus to the first invalid field in DOM
  // order, or to the error summary for submission/server errors. The sequence
  // id re-runs the effect even when the same error is reported twice in a row.
  useEffect(() => {
    if (errorSequence === 0) return;
    const key = lastErrorFocus.current;
    if (key && fieldRefs.current[key]) {
      fieldRefs.current[key]?.focus();
      return;
    }
    // Fallback: the target field has no registered focusable control, so move
    // focus to the error summary instead.
    errorAlertRef.current?.focus();
  }, [errorSequence]);

  function reportError(message: string, focusKey: string | null = null) {
    lastErrorFocus.current = focusKey;
    setError(message);
    setErrorSequence((n) => n + 1);
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = validate();
    setErrors(nextErrors);
    const validation = firstError(nextErrors);
    if (validation) {
      const firstInvalid = studentFieldOrder.find((key) => nextErrors[key]);
      reportError(validation, firstInvalid ?? null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await registrationApi.student({
        ...common,
        ...school,
        nomeCompleto: normalizeWhitespace(common.nomeCompleto),
        email: normalizeEmailInput(common.email),
        telefone: normalizePhone(common.telefone),
        cidade: normalizeWhitespace(common.cidade),
        uf: common.uf,
        instituicaoEnsino: normalizeWhitespace(school.instituicaoEnsino),
        curso: normalizeWhitespace(school.curso),
        tipoFormacao: school.tipoFormacao as TipoFormacao,
        anoConclusaoPrevisto: school.anoConclusaoPrevisto
          ? Number(school.anoConclusaoPrevisto)
          : null,
        relacaoRioPombaValley: school.relacaoRioPombaValley.trim() || null,
      });
      setSuccess(true);
    } catch (reason) {
      reportError(
        getApiErrorMessage(reason, "Não foi possível enviar a solicitação."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <PublicPage title="Solicitar acesso como aluno" backHref="/cadastro">
      {success ? (
        <Success />
      ) : (
        <Box
          component="form"
          onSubmit={submit}
          noValidate
          aria-busy={busy || undefined}
        >
          <Stack spacing={2}>
            {error && (
              <Alert ref={errorAlertRef} tabIndex={-1} severity="error">
                {error}
              </Alert>
            )}
            <Typography component="h2" variant="h6">
              Dados pessoais
            </Typography>
            <CommonFields
              value={common}
              errors={errors}
              onChange={(key, value) => {
                setCommon((current) => ({ ...current, [key]: value }));
                setErrors((current) => ({ ...current, [key]: null }));
              }}
              onBlur={blurCommon}
              registerFieldRef={registerFieldRef}
              disabled={busy}
            />
            <Divider />
            <Typography component="h2" variant="h6">
              Formação acadêmica
            </Typography>
            <TextField
              required
              label="Instituição de ensino"
              value={school.instituicaoEnsino}
              onChange={(e) => {
                setSchool((x) => ({
                  ...x,
                  instituicaoEnsino: stripEmoji(e.target.value).slice(0, 180),
                }));
                setErrors((current) => ({
                  ...current,
                  instituicaoEnsino: null,
                }));
              }}
              onBlur={() =>
                setErrors((x) => ({
                  ...x,
                  instituicaoEnsino: validateInstitutionName(
                    school.instituicaoEnsino,
                  ),
                }))
              }
              inputRef={registerFieldRef("instituicaoEnsino")}
              disabled={busy}
              error={Boolean(errors.instituicaoEnsino)}
              helperText={errors.instituicaoEnsino}
              slotProps={{
                htmlInput: { maxLength: 180, onPaste: stripEmojiOnPaste },
              }}
            />
            <TextField
              required
              label="Curso"
              value={school.curso}
              onChange={(e) => {
                setSchool((x) => ({
                  ...x,
                  curso: stripEmoji(e.target.value).slice(0, 180),
                }));
                setErrors((current) => ({ ...current, curso: null }));
              }}
              onBlur={() =>
                setErrors((x) => ({
                  ...x,
                  curso: validateCourseName(school.curso),
                }))
              }
              inputRef={registerFieldRef("curso")}
              disabled={busy}
              error={Boolean(errors.curso)}
              helperText={errors.curso}
              slotProps={{
                htmlInput: { maxLength: 180, onPaste: stripEmojiOnPaste },
              }}
            />
            <TextField
              required
              select
              label="Tipo de formação"
              value={school.tipoFormacao}
              onChange={(e) => {
                setSchool((x) => ({
                  ...x,
                  tipoFormacao: e.target.value as TipoFormacao,
                }));
                setErrors((current) => ({ ...current, tipoFormacao: null }));
              }}
              onBlur={() =>
                setErrors((x) => ({
                  ...x,
                  tipoFormacao: school.tipoFormacao
                    ? null
                    : "Selecione um tipo de formação válido.",
                }))
              }
              inputRef={registerFieldRef("tipoFormacao")}
              disabled={busy}
              error={Boolean(errors.tipoFormacao)}
              helperText={errors.tipoFormacao}
            >
              {formations.map((type) => (
                <MenuItem key={type} value={type}>
                  {TIPO_FORMACAO_LABELS[type]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Ano previsto de conclusão"
              value={school.anoConclusaoPrevisto}
              onChange={(e) => {
                setSchool((x) => ({
                  ...x,
                  anoConclusaoPrevisto: sanitizeIntegerInput(e.target.value, 4),
                }));
                setErrors((current) => ({
                  ...current,
                  anoConclusaoPrevisto: null,
                }));
              }}
              onBlur={() =>
                setErrors((x) => ({
                  ...x,
                  anoConclusaoPrevisto: validateYear(
                    school.anoConclusaoPrevisto,
                  ),
                }))
              }
              inputRef={registerFieldRef("anoConclusaoPrevisto")}
              disabled={busy}
              error={Boolean(errors.anoConclusaoPrevisto)}
              helperText={
                errors.anoConclusaoPrevisto ?? "Opcional; use quatro dígitos."
              }
              slotProps={{
                htmlInput: {
                  inputMode: "numeric",
                  pattern: "[0-9]*",
                  maxLength: 4,
                },
              }}
            />
            <TextField
              multiline
              minRows={3}
              label="Relação com o Rio Pomba Valley (opcional)"
              value={school.relacaoRioPombaValley}
              onChange={(e) => {
                setSchool((x) => ({
                  ...x,
                  relacaoRioPombaValley: stripEmoji(e.target.value).slice(
                    0,
                    500,
                  ),
                }));
                setErrors((current) => ({
                  ...current,
                  relacaoRioPombaValley: null,
                }));
              }}
              onBlur={() =>
                setErrors((x) => ({
                  ...x,
                  relacaoRioPombaValley: school.relacaoRioPombaValley
                    ? validateFreeText(school.relacaoRioPombaValley, 500)
                    : null,
                }))
              }
              inputRef={registerFieldRef("relacaoRioPombaValley")}
              disabled={busy}
              error={Boolean(errors.relacaoRioPombaValley)}
              helperText={
                <Box
                  component="span"
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Box component="span">{errors.relacaoRioPombaValley}</Box>
                  <Box component="span" sx={{ color: "text.secondary" }}>
                    {school.relacaoRioPombaValley.length} / 500
                  </Box>
                </Box>
              }
              slotProps={{
                htmlInput: { maxLength: 500, onPaste: stripEmojiOnPaste },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy}
            >
              {busy ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </Stack>
        </Box>
      )}
    </PublicPage>
  );
}

export function RecruiterRegistrationForm() {
  const [common, setCommon] = useState(commonBlank);
  const [extra, setExtra] = useState({
    empresa: "",
    cargo: "",
    siteEmpresa: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const fieldRefs = useRef<Partial<Record<string, FocusableControl>>>({});
  const [errorSequence, setErrorSequence] = useState(0);
  const lastErrorFocus = useRef<string | null>(null);
  const registerFieldRef = (key: string) => (node: FocusableControl) => {
    fieldRefs.current[key] = node;
  };
  const validate = () => ({
    ...commonErrors(common),
    empresa: validateCompanyName(extra.empresa),
    cargo: validateJobTitle(extra.cargo),
    siteEmpresa: validateHttpUrl(extra.siteEmpresa),
  });
  const blurCommon = (key: keyof CommonForm) =>
    setErrors((current) => ({ ...current, [key]: commonErrors(common)[key] }));
  // After a failed submission, move focus to the first invalid field in DOM
  // order, or to the error summary for submission/server errors. The sequence
  // id re-runs the effect even when the same error is reported twice in a row.
  useEffect(() => {
    if (errorSequence === 0) return;
    const key = lastErrorFocus.current;
    if (key && fieldRefs.current[key]) {
      fieldRefs.current[key]?.focus();
      return;
    }
    // Fallback: the target field has no registered focusable control, so move
    // focus to the error summary instead.
    errorAlertRef.current?.focus();
  }, [errorSequence]);

  function reportError(message: string, focusKey: string | null = null) {
    lastErrorFocus.current = focusKey;
    setError(message);
    setErrorSequence((n) => n + 1);
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = validate();
    setErrors(nextErrors);
    const validation = firstError(nextErrors);
    if (validation) {
      const firstInvalid = recruiterFieldOrder.find((key) => nextErrors[key]);
      reportError(validation, firstInvalid ?? null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await registrationApi.recruiter({
        ...common,
        ...extra,
        nomeCompleto: normalizeWhitespace(common.nomeCompleto),
        email: normalizeEmailInput(common.email),
        telefone: normalizePhone(common.telefone),
        cidade: normalizeWhitespace(common.cidade),
        uf: common.uf,
        empresa: normalizeWhitespace(extra.empresa),
        cargo: normalizeWhitespace(extra.cargo),
        siteEmpresa: extra.siteEmpresa.trim() || null,
      });
      setSuccess(true);
    } catch (reason) {
      reportError(
        getApiErrorMessage(reason, "Não foi possível enviar a solicitação."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <PublicPage title="Solicitar acesso como recrutador" backHref="/cadastro">
      {success ? (
        <Success />
      ) : (
        <Box
          component="form"
          onSubmit={submit}
          noValidate
          aria-busy={busy || undefined}
        >
          <Stack spacing={2}>
            {error && (
              <Alert ref={errorAlertRef} tabIndex={-1} severity="error">
                {error}
              </Alert>
            )}
            <Typography component="h2" variant="h6">
              Dados pessoais
            </Typography>
            <CommonFields
              value={common}
              errors={errors}
              onChange={(key, value) => {
                setCommon((current) => ({ ...current, [key]: value }));
                setErrors((current) => ({ ...current, [key]: null }));
              }}
              onBlur={blurCommon}
              registerFieldRef={registerFieldRef}
              disabled={busy}
            />
            <Divider />
            <Typography component="h2" variant="h6">
              Dados profissionais
            </Typography>
            <TextField
              required
              label="Empresa"
              value={extra.empresa}
              onChange={(e) => {
                setExtra((x) => ({
                  ...x,
                  empresa: stripEmoji(e.target.value).slice(0, 150),
                }));
                setErrors((current) => ({ ...current, empresa: null }));
              }}
              onBlur={() =>
                setErrors((x) => ({
                  ...x,
                  empresa: validateCompanyName(extra.empresa),
                }))
              }
              inputRef={registerFieldRef("empresa")}
              disabled={busy}
              error={Boolean(errors.empresa)}
              helperText={errors.empresa}
              slotProps={{
                htmlInput: { maxLength: 150, onPaste: stripEmojiOnPaste },
              }}
            />
            <TextField
              required
              label="Cargo"
              value={extra.cargo}
              onChange={(e) => {
                setExtra((x) => ({
                  ...x,
                  cargo: stripEmoji(e.target.value).slice(0, 120),
                }));
                setErrors((current) => ({ ...current, cargo: null }));
              }}
              onBlur={() =>
                setErrors((x) => ({
                  ...x,
                  cargo: validateJobTitle(extra.cargo),
                }))
              }
              inputRef={registerFieldRef("cargo")}
              disabled={busy}
              error={Boolean(errors.cargo)}
              helperText={errors.cargo}
              slotProps={{
                htmlInput: { maxLength: 120, onPaste: stripEmojiOnPaste },
              }}
            />
            <TextField
              type="url"
              label="Site da empresa (opcional)"
              value={extra.siteEmpresa}
              onChange={(e) => {
                setExtra((x) => ({
                  ...x,
                  siteEmpresa: stripEmoji(e.target.value).slice(0, 2048),
                }));
                setErrors((current) => ({ ...current, siteEmpresa: null }));
              }}
              onBlur={() =>
                setErrors((x) => ({
                  ...x,
                  siteEmpresa: validateHttpUrl(extra.siteEmpresa),
                }))
              }
              inputRef={registerFieldRef("siteEmpresa")}
              disabled={busy}
              error={Boolean(errors.siteEmpresa)}
              helperText={
                errors.siteEmpresa ?? "Use um endereço HTTP ou HTTPS."
              }
              slotProps={{
                htmlInput: {
                  maxLength: 2048,
                  inputMode: "url",
                  onPaste: stripEmojiOnPaste,
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy}
            >
              {busy ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </Stack>
        </Box>
      )}
    </PublicPage>
  );
}
