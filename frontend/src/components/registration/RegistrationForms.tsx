"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ConsentField } from "./ConsentField";
import { RegistrationLayout as PublicPage, RegistrationSection } from "./RegistrationLayout";
import {
  applyCepPaste,
  caretAfterDigits,
  findMunicipio,
  formatCep,
  municipioFilter,
} from "./location";
import {
  commonBlank,
  commonErrors,
  firstError,
  validateConsent,
  type CommonForm,
  type FieldErrors,
  type FocusableControl,
} from "./registrationForm";
import { useCepLookup } from "./useCepLookup";
import { useMunicipios } from "./useMunicipios";
import { registrationApi } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import {
  BRAZILIAN_UFS,
  normalizeEmailInput,
  normalizePhone,
  normalizeWhitespace,
  sanitizeCityName,
  sanitizePersonName,
  stripEmoji,
  stripEmojiOnPaste,
  validateCompanyName,
  validateHttpUrl,
  validateJobTitle,
} from "@/lib/validation";

// Visual/DOM order of the recruiter form's fields. Used to focus the first
// invalid field after a failed submission.
const recruiterFieldOrder = [
  "nomeCompleto",
  "email",
  "telefone",
  "cep",
  "uf",
  "cidade",
  "empresa",
  "cargo",
  "siteEmpresa",
  "consentTermos",
] as const;

// Confirmation shown in place of the recruiter form after a successful submission.
function Success() {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // The form is replaced by the confirmation, so focus moves to its heading.
  // A focused heading is announced by assistive tech on its own, which is why
  // this container is not an additional live region.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <Stack
      component="section"
      aria-labelledby="registration-success-heading"
      className="tv-registration__success"
      spacing={3}
    >
      <Box aria-hidden className="tv-registration__success-icon">
        <CheckCircleOutlineRounded fontSize="large" />
      </Box>
      <Stack spacing={1}>
        <Typography
          id="registration-success-heading"
          ref={headingRef}
          tabIndex={-1}
          component="h2"
          variant="h5"
          sx={{
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: 3,
              borderRadius: 1,
            },
          }}
        >
          Solicitação recebida!
        </Typography>
        <Typography color="text.secondary">
          Sua solicitação foi enviada e será analisada pela equipe do Talent
          Valley.
        </Typography>
        <Typography color="text.secondary">
          Se aprovada, você receberá as instruções para ativar sua conta.
        </Typography>
      </Stack>
      <Divider />
      <Button
        component={Link}
        href="/"
        variant="contained"
        size="large"
        startIcon={<HomeOutlined />}
        fullWidth
      >
        Voltar à página inicial
      </Button>
    </Stack>
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
  const cepStatus = useCepLookup({
    cep: value.cep,
    cidade: value.cidade,
    uf: value.uf,
    onChange,
    disabled,
  });
  const { municipios, loading, error, retry } = useMunicipios(value.uf);
  const selectedCity = municipios.find((m) => m.nome === value.cidade) ?? null;

  // When the official list recovers from an IBGE error, reconcile a manually
  // typed city: normalize it to the official name when it matches, otherwise
  // clear it so an invalid Cidade/UF pair can never be silently submitted or
  // left hidden behind the Autocomplete.
  const wasErrorRef = useRef(error);
  useEffect(() => {
    const wasError = wasErrorRef.current;
    if (error) {
      wasErrorRef.current = true;
      return;
    }
    if (municipios.length === 0) return;
    if (wasError && value.cidade) {
      const match = findMunicipio(municipios, value.cidade);
      onChange("cidade", match ? match.nome : "");
    }
    wasErrorRef.current = false;
  }, [error, municipios, value.cidade, onChange]);

  return (
    <>
      <RegistrationSection title="Dados pessoais" description="Como podemos identificar você.">
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
      </RegistrationSection>
      <RegistrationSection title="Localização e contato" description="Informe seu telefone e a cidade onde você está.">
        <Box className="tv-registration__fields">
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
            label="CEP"
            autoComplete="postal-code"
            value={value.cep}
            onChange={(event) => {
              const input = event.currentTarget;
              const raw = input.value;
              const caret = input.selectionStart ?? raw.length;
              const next = formatCep(raw);
              onChange("cep", next);
              const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, "").length;
              requestAnimationFrame(() => {
                const position = caretAfterDigits(next, digitsBeforeCaret);
                input.setSelectionRange(position, position);
              });
            }}
            onBlur={() => onBlur("cep")}
            inputRef={registerFieldRef("cep")}
            disabled={disabled}
            error={Boolean(errors.cep)}
            helperText={errors.cep ?? "Opcional; 8 dígitos para preencher Cidade e UF."}
            slotProps={{
              htmlInput: {
                inputMode: "numeric",
                maxLength: 9,
                onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => {
                  const input = event.currentTarget;
                  const selectionStart = input.selectionStart ?? input.value.length;
                  const selectionEnd = input.selectionEnd ?? selectionStart;
                  const pasted = applyCepPaste(
                    input.value,
                    selectionStart,
                    selectionEnd,
                    event.clipboardData.getData("text/plain"),
                  );
                  // Clipboard without digits: keep the native paste and let the
                  // regular onChange formatter normalize the field.
                  if (!pasted) return;
                  // Take over the paste so maxLength cannot truncate the raw
                  // clipboard text before formatting.
                  event.preventDefault();
                  onChange("cep", pasted.value);
                  requestAnimationFrame(() => {
                    const position = caretAfterDigits(
                      pasted.value,
                      pasted.digitsBeforeCaret,
                    );
                    input.setSelectionRange(position, position);
                  });
                },
                onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                  if (event.key !== "Backspace") return;
                  const input = event.currentTarget;
                  const caret = input.selectionStart ?? input.value.length;
                  if (caret <= 0 || input.value.charAt(caret - 1) !== "-") return;
                  event.preventDefault();
                  const before = input.value.slice(0, caret - 1);
                  const next = formatCep(before.slice(0, -1) + input.value.slice(caret));
                  onChange("cep", next);
                  const digitsBeforeCaret = before.slice(0, -1).replace(/\D/g, "").length;
                  requestAnimationFrame(() => {
                    const position = caretAfterDigits(next, digitsBeforeCaret);
                    input.setSelectionRange(position, position);
                  });
                },
              },
              input: {
                endAdornment:
                  cepStatus.type === "loading" ? (
                    <InputAdornment position="end">
                      <CircularProgress size={16} />
                    </InputAdornment>
                  ) : null,
              },
            }}
          />
          {(cepStatus.type === "success" || cepStatus.type === "error") && (
            <Typography
              component="p"
              variant="caption"
              role="status"
              sx={{ color: cepStatus.type === "error" ? "error.main" : "success.main" }}
            >
              {cepStatus.type === "error"
                ? cepStatus.message
                : cepStatus.message ?? "Cidade e UF preenchidas pelo CEP."}
            </Typography>
          )}
          <TextField
            required
            select
            label="Estado"
            value={value.uf}
            onChange={(e) => {
              const nextUf = e.target.value;
              onChange("uf", nextUf);
              // Changing the state invalidates the previously selected city so an
              // incompatible Cidade/Estado combination can never be submitted.
              if (nextUf !== value.uf) {
                onChange("cidade", "");
              }
            }}
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
          {error ? (
            <Stack spacing={1}>
              <TextField
                id="cidade"
                required
                label="Cidade"
                autoComplete="address-level2"
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
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ alignItems: "center", flexWrap: "wrap" }}
              >
                <Typography component="span" variant="caption" color="text.secondary" role="status">
                  Não foi possível carregar a lista oficial. Digite a cidade manualmente ou tente novamente.
                </Typography>
                <Button size="small" type="button" onClick={retry}>
                  Tentar novamente
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Autocomplete
              id="cidade"
              value={selectedCity}
              onChange={(_event, newValue) =>
                onChange("cidade", newValue ? newValue.nome : "")
              }
              options={municipios}
              getOptionLabel={(option) => option.nome}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={loading}
              loadingText="Carregando cidades..."
              noOptionsText="Nenhuma cidade encontrada."
              disabled={disabled || !value.uf}
              fullWidth
              filterOptions={municipioFilter}
              renderInput={(params) => (
                <TextField
                  {...params}
                  slotProps={{
                    ...params.slotProps,
                    htmlInput: {
                      ...params.slotProps.htmlInput,
                      value: params.slotProps.htmlInput.value ?? "",
                      onPaste: stripEmojiOnPaste,
                    },
                  }}
                  label="Cidade"
                  placeholder={
                    value.uf ? "Busque e selecione uma cidade" : "Selecione o estado primeiro"
                  }
                  onBlur={() => onBlur("cidade")}
                  inputRef={registerFieldRef("cidade")}
                  error={Boolean(errors.cidade)}
                  helperText={errors.cidade}
                />
              )}
              renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                return (
                  <li key={key} {...optionProps}>
                    {option.nome}
                  </li>
                );
              }}
            />
          )}
        </Box>
      </RegistrationSection>
    </>
  );
}


export function RecruiterRegistrationForm() {
  const [common, setCommon] = useState(commonBlank);
  const [extra, setExtra] = useState({
    empresa: "",
    cargo: "",
    siteEmpresa: "",
  });
  const [consent, setConsent] = useState(false);
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
    consentTermos: validateConsent(consent),
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
      // CEP is a frontend-only lookup helper and must not be sent to the API.
      await registrationApi.recruiter({
        ...extra,
        nomeCompleto: normalizeWhitespace(common.nomeCompleto),
        email: normalizeEmailInput(common.email),
        telefone: normalizePhone(common.telefone),
        cidade: normalizeWhitespace(common.cidade),
        uf: common.uf,
        empresa: normalizeWhitespace(extra.empresa),
        cargo: normalizeWhitespace(extra.cargo),
        siteEmpresa: extra.siteEmpresa.trim() || null,
        consentTermos: true,
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
    <PublicPage
      title="Solicitar acesso como recrutador"
      backHref={success ? undefined : "/cadastro"}
    >
      {success ? (
        <Success />
      ) : (
        <Box
          component="form"
          onSubmit={submit}
          noValidate
          aria-busy={busy || undefined}
        >
          <Stack spacing={4}>
            {error && (
              <Alert ref={errorAlertRef} tabIndex={-1} severity="error">
                {error}
              </Alert>
            )}
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
            <RegistrationSection title="Dados profissionais" description="Apresente a empresa e sua atuação profissional.">
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
            </RegistrationSection>
            <ConsentField
              checked={consent}
              error={errors.consentTermos}
              disabled={busy}
              onChange={(checked) => {
                setConsent(checked);
                setErrors((current) => ({ ...current, consentTermos: null }));
              }}
              inputRef={registerFieldRef("consentTermos")}
            />
            <Typography variant="caption" color="text.secondary">Os campos com * são obrigatórios.</Typography>
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
