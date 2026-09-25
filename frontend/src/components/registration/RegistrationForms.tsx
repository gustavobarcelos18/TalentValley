"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import BusinessCenterOutlined from "@mui/icons-material/BusinessCenterOutlined";
import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  createFilterOptions,
} from "@mui/material";
import { RegistrationLayout as PublicPage, RegistrationSection } from "./RegistrationLayout";
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
  cep: string;
  cidade: string;
  uf: string;
};

const formations = Object.keys(TIPO_FORMACAO_LABELS) as TipoFormacao[];
const commonBlank: CommonForm = {
  nomeCompleto: "",
  email: "",
  telefone: "",
  cep: "",
  cidade: "",
  uf: "",
};

// ---------------------------------------------------------------------------
// IBGE municipality lookup (frontend-only). Fetches the official city list for
// a Brazilian state so the Cidade field is always restricted to real options.
// The list is cached per UF to avoid redundant requests for the same state.
// ---------------------------------------------------------------------------

type Municipio = {
  id: number;
  nome: string;
};

type MunicipiosState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; municipios: Municipio[] }
  | { type: "error" };

const municipioCache = new Map<string, Municipio[]>();

const municipioFilter = createFilterOptions<Municipio>({
  ignoreAccents: true,
  ignoreCase: true,
  limit: 100,
});

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findMunicipio(municipios: Municipio[], nome: string): Municipio | null {
  const target = normalizeSearch(nome);
  return municipios.find((m) => normalizeSearch(m.nome) === target) ?? null;
}

async function fetchMunicipios(uf: string, signal: AbortSignal): Promise<Municipio[]> {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
    { signal },
  );
  if (!response.ok) throw new Error("IBGE HTTP failure");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("IBGE invalid response");

  const municipios: Municipio[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "number" ? record.id : Number(record.id);
    const nome = typeof record.nome === "string" ? record.nome.trim() : "";
    if (Number.isFinite(id) && nome) municipios.push({ id, nome });
  }
  if (municipios.length === 0) throw new Error("IBGE empty response");
  return municipios;
}

function useMunicipios(uf: string): {
  municipios: Municipio[];
  loading: boolean;
  error: boolean;
  retry: () => void;
} {
  const [state, setState] = useState<MunicipiosState>(
    uf ? { type: "loading" } : { type: "idle" },
  );
  const [retryNonce, setRetryNonce] = useState(0);
  const [loadKey, setLoadKey] = useState({ uf, nonce: 0 });

  // Adjust the displayed state during render when the UF (or a retry) changes,
  // instead of calling setState synchronously inside the effect body.
  if (loadKey.uf !== uf || loadKey.nonce !== retryNonce) {
    setLoadKey({ uf, nonce: retryNonce });
    if (!uf) {
      setState({ type: "idle" });
    } else {
      const cached = municipioCache.get(uf);
      setState(cached ? { type: "success", municipios: cached } : { type: "loading" });
    }
  }

  useEffect(() => {
    if (!uf) return;
    if (municipioCache.has(uf)) return;

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10000);

    fetchMunicipios(uf, controller.signal)
      .then((municipios) => {
        municipioCache.set(uf, municipios);
        if (!controller.signal.aborted) {
          setState({ type: "success", municipios });
        }
      })
      .catch(() => {
        // A real timeout must reach the error state; an abort caused by a UF
        // change or unmount must stay silent.
        if (timedOut || !controller.signal.aborted) {
          setState({ type: "error" });
        }
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [uf, retryNonce]);

  return {
    municipios: state.type === "success" ? state.municipios : [],
    loading: state.type === "loading",
    error: state.type === "error",
    retry: () => {
      municipioCache.delete(uf);
      setRetryNonce((n) => n + 1);
    },
  };
}

// ---------------------------------------------------------------------------
// CEP lookup (frontend-only helper). Reads the public ViaCEP API to autofill
// Cidade/UF. CEP is never sent to the backend registration endpoints.
// ---------------------------------------------------------------------------

type CepStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; message?: string }
  | { type: "error"; message: string };

const CEP_LOOKUP_ERROR =
  "Não foi possível localizar o CEP. Preencha Cidade e UF manualmente.";

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function validateCep(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length !== 8) return "Informe um CEP válido com 8 dígitos.";
  return null;
}

// Maps "how many digits sit before the caret" back to a position in the
// hyphenated value, so formatting never makes the caret jump unexpectedly.
function caretAfterDigits(formatted: string, digitsBeforeCaret: number): number {
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (seen === digitsBeforeCaret) return index;
    if (/\d/.test(formatted[index])) seen += 1;
  }
  return formatted.length;
}

// Pasted CEPs arrive in many shapes ("36700120", "36700-120", "36.700-120",
// sometimes padded with whitespace). Because the field keeps maxLength 9, the
// native paste would truncate "36.700-120" to "36.700-12" and lose the last
// digit before the formatter ever runs. The paste handler therefore rebuilds
// the value from the digits only, replacing the current selection.
function applyCepPaste(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  clipboardText: string,
): { value: string; digitsBeforeCaret: number } | null {
  const digits = clipboardText.replace(/\D/g, "");
  if (!digits) return null;
  const merged =
    currentValue.slice(0, selectionStart) +
    digits +
    currentValue.slice(selectionEnd);
  return {
    value: formatCep(merged),
    digitsBeforeCaret: merged
      .slice(0, selectionStart + digits.length)
      .replace(/\D/g, "").length,
  };
}

interface ViaCepResult {
  cidade: string;
  uf: string;
}

function readViaCep(data: unknown): ViaCepResult | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.erro === true) return null;
  const cidade = sanitizeCityName(String(record.localidade ?? ""));
  const uf = String(record.uf ?? "").trim().toUpperCase();
  if (!cidade || !(BRAZILIAN_UFS as readonly string[]).includes(uf)) return null;
  return { cidade, uf };
}

function useCepLookup({
  cep,
  cidade,
  uf,
  onChange,
  disabled,
}: {
  cep: string;
  cidade: string;
  uf: string;
  onChange: (key: keyof CommonForm, value: string) => void;
  disabled: boolean;
}): CepStatus {
  const [lookup, setLookup] = useState<{ cep: string; status: CepStatus }>({
    cep: "",
    status: { type: "idle" },
  });
  const latestRef = useRef({ cidade, uf, onChange });

  // Keep the latest values available to the async lookup callback without
  // re-running the lookup effect (which would fire duplicate requests).
  useEffect(() => {
    latestRef.current = { cidade, uf, onChange };
  });

  const digits = cep.replace(/\D/g, "");

  useEffect(() => {
    if (digits.length !== 8 || disabled) return;

    const controller = new AbortController();
    // Snapshot of the city/UF at request time. A late response must never
    // overwrite a field the user edited manually while it was pending.
    const snapshot = {
      cidade: latestRef.current.cidade,
      uf: latestRef.current.uf,
    };

    const debounce = setTimeout(() => {
      setLookup({ cep: digits, status: { type: "loading" } });
      void (async () => {
        let timedOut = false;
        const timeout = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, 8000);
        try {
          const response = await fetch(
            `https://viacep.com.br/ws/${digits}/json/`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("ViaCEP HTTP failure");
          const result = readViaCep(await response.json());
          if (!result) throw new Error("ViaCEP invalid response");
          if (controller.signal.aborted) return;

          // Resolve the official municipality name for the returned UF before
          // touching the form, so the selected city is never from another state.
          let matched: string | null = null;
          try {
            const cached = municipioCache.get(result.uf);
            const municipios =
              cached ?? (await fetchMunicipios(result.uf, controller.signal));
            if (!cached) municipioCache.set(result.uf, municipios);
            if (controller.signal.aborted) return;
            matched = findMunicipio(municipios, result.cidade)?.nome ?? null;
          } catch (reason) {
            // A timeout during the municipality lookup must surface the lookup
            // error below; an obsolete abort (changed CEP/UF) stays silent.
            // Other failures still fill the UF and leave Cidade unselected.
            if (timedOut) throw reason;
            if (controller.signal.aborted) return;
          }

          const latest = latestRef.current;
          const ufUnchanged = latest.uf === snapshot.uf;
          const cidadeUnchanged = latest.cidade === snapshot.cidade;
          const applied = ufUnchanged && cidadeUnchanged;

          // Apply UF and Cidade together so a CEP autofill never leaves a
          // Cidade/Estado mismatch, and never overrides a newer user edit.
          if (applied) {
            latest.onChange("uf", result.uf);
            latest.onChange("cidade", matched ?? "");
          }

          setLookup({
            cep: digits,
            // Only advertise an autofill when it was actually applied; a stale
            // response (the user edited Cidade/UF while it was pending) must
            // not claim both fields were populated.
            status: applied
              ? matched
                ? { type: "success" }
                : {
                    type: "success",
                    message: "UF preenchida pelo CEP. Selecione a cidade na lista.",
                  }
              : { type: "idle" },
          });
        } catch {
          if (timedOut || !controller.signal.aborted) {
            setLookup({
              cep: digits,
              status: { type: "error", message: CEP_LOOKUP_ERROR },
            });
          }
        } finally {
          clearTimeout(timeout);
        }
      })();
    }, 400);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [digits, disabled]);

  if (digits.length !== 8 || disabled || lookup.cep !== digits) {
    return { type: "idle" };
  }
  return lookup.status;
}

// Reference to a field's focusable control. MUI Select exposes an imperative
// handle with `focus` instead of a DOM node, so both shapes are accepted.
type FocusableControl = { focus: () => void } | null;

// Visual/DOM order of each registration form's fields. Used to focus the
// first invalid field after a failed submission.
const studentFieldOrder = [
  "nomeCompleto",
  "email",
  "telefone",
  "cep",
  "uf",
  "cidade",
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
  "cep",
  "uf",
  "cidade",
  "empresa",
  "cargo",
  "siteEmpresa",
] as const;

// Confirmation shown in place of the form after a successful submission.
// Shared by the student and recruiter flows so both stay identical.
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
// The submitted city must belong to the selected UF. This only enforces the
// combination when the official municipality list for that UF is already
// loaded, so an IBGE lookup failure never invalidates a legitimate selection.
function validateCityState(form: CommonForm): string | null {
  const city = normalizeWhitespace(form.cidade);
  if (!city) return null;
  const municipios = municipioCache.get(form.uf);
  if (!municipios) return null;
  return findMunicipio(municipios, city)
    ? null
    : "A cidade informada não pertence ao estado selecionado.";
}

function commonErrors(form: CommonForm): FieldErrors {
  return {
    nomeCompleto: validatePersonName(form.nomeCompleto),
    email: validateEmail(form.email),
    telefone: validateBrazilianPhone(form.telefone),
    cep: validateCep(form.cep),
    cidade: validateCityName(form.cidade) ?? validateCityState(form),
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
  const cepStatus = useCepLookup({
    cep: value.cep,
    cidade: value.cidade,
    uf: value.uf,
    onChange,
    disabled,
  });
  const { municipios, loading, error, retry } = useMunicipios(value.uf);
  const selectedCity = municipios.find((m) => m.nome === value.cidade) ?? null;
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
            noOptionsText={
              error
                ? "Não foi possível carregar as cidades."
                : "Nenhuma cidade encontrada."
            }
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
          {error && (
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Typography component="span" variant="caption" color="error.main" role="status">
                Não foi possível carregar a lista de cidades.
              </Typography>
              <Button size="small" type="button" onClick={retry}>
                Tentar novamente
              </Button>
            </Stack>
          )}
        </Box>
      </RegistrationSection>
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
    <Paper component={Link} href={href} elevation={0} className="tv-registration__choice">
      <Box aria-hidden className="tv-registration__choice-icon">{icon}</Box>
      <Box>
        <Typography component="h2" variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
      </Box>
      <ArrowForwardOutlined aria-hidden fontSize="small" className="tv-registration__choice-arrow" />
    </Paper>
  );
}

export function RegistrationChoice() {
  return (
    <PublicPage
      title="Como deseja participar?"
      subtitle="Escolha seu perfil para solicitar acesso ao Talent Valley."
    >
      <Box className="tv-registration__choices">
        <ChoiceCard
          href="/cadastro/aluno"
          icon={<SchoolOutlined />}
          title="Sou aluno"
          description="Após aprovação, crie seu perfil profissional e apresente sua trajetória."
        />
        <ChoiceCard
          href="/cadastro/recrutador"
          icon={<BusinessCenterOutlined />}
          title="Sou Recrutador"
          description="Solicite acesso para descobrir talentos da comunidade Rio Pomba Valley."
        />
      </Box>
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
      // CEP is a frontend-only lookup helper and must not be sent to the API.
      await registrationApi.student({
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
    <PublicPage
      title="Solicitar acesso como aluno"
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
            <RegistrationSection title="Formação acadêmica" description="Conte onde você estuda e qual formação está cursando.">
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
              <Box className="tv-registration__fields">
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
              </Box>
            </RegistrationSection>
            <RegistrationSection title="Rio Pomba Valley" description="Se desejar, compartilhe seu vínculo com a comunidade.">
              <TextField
                multiline
                minRows={3}
                label="Relação com o RPV (opcional)"
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
            </RegistrationSection>
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
