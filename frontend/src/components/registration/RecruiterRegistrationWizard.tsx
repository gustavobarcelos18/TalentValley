"use client";

import { registrationApi } from "@/lib/admin";
import {
  normalizeOptionalUrl,
  normalizeWhitespace,
  validateCompanyName,
  validateJobTitle,
  validateTypedLink,
} from "@/lib/validation";
import {
  recruiterCompanyBlank,
  RecruiterCompanyStep,
  type RecruiterCompanyForm,
} from "./RecruiterCompanyStep";
import { RegistrationWizard, type RegistrationProfile } from "./RegistrationWizard";

const recruiterProfile: RegistrationProfile<RecruiterCompanyForm> = {
  title: "Solicitar acesso como recrutador",
  detailsStep: {
    label: "Empresa",
    title: "Dados da empresa",
    description: "Apresente a empresa e sua atuação profissional.",
  },
  detailsFields: ["empresa", "cargo", "siteEmpresa"],
  blank: recruiterCompanyBlank,
  validate: (company) => ({
    empresa: validateCompanyName(company.empresa),
    cargo: validateJobTitle(company.cargo),
    siteEmpresa: validateTypedLink(company.siteEmpresa),
  }),
  DetailsStep: RecruiterCompanyStep,
  review: (company) => ({
    title: "Dados da empresa",
    editLabel: "Editar dados da empresa",
    rows: [
      { label: "Empresa", value: company.empresa },
      { label: "Cargo", value: company.cargo },
      { label: "Site da empresa", value: company.siteEmpresa },
    ],
  }),
  send: (base, company) =>
    registrationApi.recruiter({
      ...base,
      empresa: normalizeWhitespace(company.empresa),
      cargo: normalizeWhitespace(company.cargo),
      siteEmpresa: normalizeOptionalUrl(company.siteEmpresa),
    }),
};

// Recruiter signup in three steps: personal data, company, review and terms.
export function RecruiterRegistrationWizard() {
  return <RegistrationWizard profile={recruiterProfile} />;
}
