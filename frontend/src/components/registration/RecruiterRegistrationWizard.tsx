"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { AuthFormPage } from "@/components/auth/AuthFormPage";
import { registrationApi } from "@/lib/admin";
import { getAuthErrorMessage } from "@/lib/authErrors";
import {
  normalizeEmailInput,
  normalizePhone,
  normalizeWhitespace,
  validateCompanyName,
  validateHttpUrl,
  validateJobTitle,
} from "@/lib/validation";
import { PersonalDataStep } from "./PersonalDataStep";
import {
  recruiterCompanyBlank,
  RecruiterCompanyStep,
  type RecruiterCompanyForm,
} from "./RecruiterCompanyStep";
import { RegistrationSuccess } from "./RegistrationSuccess";
import { ReviewStep } from "./ReviewStep";
import { SignupFooter } from "./SignupFooter";
import {
  commonBlank,
  commonErrors,
  firstError,
  validateConsent,
  type CommonForm,
  type FieldErrors,
} from "./registrationForm";
import { useCepLookup } from "./useCepLookup";
import { useFormFocus } from "./useFormFocus";
import { useWizard } from "./useWizard";
import { WizardProgress, WizardStepHeading } from "./WizardProgress";

const STEPS = [
  { label: "Dados", title: "Dados pessoais", description: "Como podemos identificar você." },
  {
    label: "Empresa",
    title: "Dados da empresa",
    description: "Apresente a empresa e sua atuação profissional.",
  },
  {
    label: "Revisão",
    title: "Revisão e termos",
    description: "Confira os dados e aceite os termos para enviar a solicitação.",
  },
];

// Visual/DOM order of each step's fields. Used to focus the first invalid field.
const STEP_FIELD_ORDER: string[][] = [
  ["nomeCompleto", "email", "telefone", "cep", "uf", "cidade"],
  ["empresa", "cargo", "siteEmpresa"],
  ["consentTermos"],
];

function companyErrors(company: RecruiterCompanyForm): FieldErrors {
  return {
    empresa: validateCompanyName(company.empresa),
    cargo: validateJobTitle(company.cargo),
    siteEmpresa: validateHttpUrl(company.siteEmpresa),
  };
}

// Recruiter signup in three steps: personal data, company, review and terms.
// All data lives here, so moving between steps never loses what was typed.
export function RecruiterRegistrationWizard() {
  const wizard = useWizard(STEPS.length);
  const [common, setCommon] = useState<CommonForm>(commonBlank);
  const [company, setCompany] = useState<RecruiterCompanyForm>(recruiterCompanyBlank);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const { error, clearError, reportError, errorAlertRef, registerFieldRef } = useFormFocus();

  // Editing a field drops the error summary, so it never stays on screen
  // after the problem it described was fixed.
  const changeCommon = useCallback(
    (key: keyof CommonForm, value: string) => {
      setCommon((current) => ({ ...current, [key]: value }));
      setErrors((current) => ({ ...current, [key]: null }));
      clearError();
    },
    [clearError],
  );

  const changeCompany = (key: keyof RecruiterCompanyForm, value: string) => {
    setCompany((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: null }));
    clearError();
  };

  // The lookup lives here, not in the step, so coming back to the first step
  // never repeats it over a city the person already confirmed.
  const cepStatus = useCepLookup({
    cep: common.cep,
    cidade: common.cidade,
    uf: common.uf,
    onChange: changeCommon,
    disabled: success,
  });

  const stepErrors = (step: number): FieldErrors => {
    if (step === 0) return commonErrors(common);
    if (step === 1) return companyErrors(company);
    return { consentTermos: validateConsent(consent) };
  };

  const blurCommon = (key: keyof CommonForm) =>
    setErrors((current) => ({ ...current, [key]: commonErrors(common)[key] }));
  const blurCompany = (key: keyof RecruiterCompanyForm) =>
    setErrors((current) => ({ ...current, [key]: companyErrors(company)[key] }));

  const editStep = (step: number) => {
    clearError();
    wizard.goTo(step);
  };

  const submit = async () => {
    setBusy(true);
    try {
      // CEP is a frontend-only lookup helper and must not be sent to the API.
      await registrationApi.recruiter({
        nomeCompleto: normalizeWhitespace(common.nomeCompleto),
        email: normalizeEmailInput(common.email),
        telefone: normalizePhone(common.telefone),
        cidade: normalizeWhitespace(common.cidade),
        uf: common.uf,
        empresa: normalizeWhitespace(company.empresa),
        cargo: normalizeWhitespace(company.cargo),
        siteEmpresa: company.siteEmpresa.trim() || null,
        consentTermos: true,
      });
      setSuccess(true);
    } catch (reason) {
      reportError(
        getAuthErrorMessage(reason, {
          fallback: "Não foi possível enviar a solicitação. Revise os dados e tente novamente.",
          overrides: { 403: "Não foi possível enviar a solicitação agora. Recarregue a página e tente novamente." },
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    clearError();

    // Advancing validates the current step; the last step validates every step,
    // so a stale earlier step can never be submitted.
    const stepsToValidate = wizard.isLast
      ? STEPS.map((_, index) => index)
      : [wizard.step];

    for (const step of stepsToValidate) {
      const nextErrors = stepErrors(step);
      const message = firstError(nextErrors);
      if (!message) continue;
      setErrors((current) => ({ ...current, ...nextErrors }));
      if (step !== wizard.step) wizard.goTo(step);
      reportError(message, STEP_FIELD_ORDER[step].find((key) => nextErrors[key]) ?? null);
      return;
    }

    if (wizard.isLast) {
      void submit();
    } else {
      wizard.next();
    }
  };

  if (success) {
    return <RegistrationSuccess />;
  }

  const current = STEPS[wizard.step];

  return (
    <AuthFormPage
      eyebrow="FAÇA PARTE DO TALENT VALLEY"
      title="Solicitar acesso como recrutador"
      subtitle="Seu pedido será analisado pela equipe do Talent Valley antes da criação da conta."
      onSubmit={handleSubmit}
      ariaBusy={busy}
      footer={<SignupFooter backHref="/cadastro" backLabel="Voltar para escolher perfil" />}
    >
      <WizardProgress steps={STEPS.map((step) => step.label)} activeStep={wizard.step} />

      {error && (
        <Alert
          ref={errorAlertRef}
          tabIndex={-1}
          severity="error"
          variant="filled"
          sx={{ fontSize: "0.875rem" }}
        >
          {error}
        </Alert>
      )}

      <WizardStepHeading
        step={wizard.step}
        total={STEPS.length}
        title={current.title}
        description={current.description}
      />

      {wizard.step === 0 && (
        <PersonalDataStep
          value={common}
          errors={errors}
          onChange={changeCommon}
          onBlur={blurCommon}
          registerFieldRef={registerFieldRef}
          disabled={busy}
          cepStatus={cepStatus}
        />
      )}

      {wizard.step === 1 && (
        <RecruiterCompanyStep
          value={company}
          errors={errors}
          onChange={changeCompany}
          onBlur={blurCompany}
          registerFieldRef={registerFieldRef}
          disabled={busy}
        />
      )}

      {wizard.step === 2 && (
        <ReviewStep
          personal={common}
          details={{
            title: "Dados da empresa",
            editLabel: "Editar dados da empresa",
            rows: [
              { label: "Empresa", value: company.empresa },
              { label: "Cargo", value: company.cargo },
              { label: "Site da empresa", value: company.siteEmpresa },
            ],
          }}
          consent={consent}
          consentError={errors.consentTermos}
          disabled={busy}
          onConsentChange={(checked) => {
            setConsent(checked);
            setErrors((currentErrors) => ({ ...currentErrors, consentTermos: null }));
            clearError();
          }}
          onEditStep={editStep}
          registerFieldRef={registerFieldRef}
        />
      )}

      {!wizard.isLast && (
        <Typography variant="caption" color="text.secondary">
          Os campos com * são obrigatórios.
        </Typography>
      )}

      <div className="flex gap-3">
        {!wizard.isFirst && (
          <Button
            type="button"
            variant="outlined"
            size="large"
            disabled={busy}
            onClick={() => editStep(wizard.step - 1)}
            sx={{ flexShrink: 0 }}
          >
            Voltar
          </Button>
        )}
        <Button type="submit" variant="contained" size="large" fullWidth disabled={busy}>
          {wizard.isLast ? (busy ? "Enviando..." : "Enviar solicitação") : "Continuar"}
        </Button>
      </div>
    </AuthFormPage>
  );
}
