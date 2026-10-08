import { fireEvent, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { vi } from "vitest";
import { municipioCache } from "@/components/registration/location";

const MUNICIPIOS = [
  { id: 3153608, nome: "Rio Pomba" },
  { id: 3170404, nome: "Ubá" },
];

export const PERSONAL = {
  nameInput: "  Maria   da Silva ",
  name: "Maria da Silva",
  emailInput: "Maria@Example.com",
  email: "maria@example.com",
  phoneInput: "(32) 99999-9999",
  phone: "32999999999",
  uf: "MG",
  city: "Rio Pomba",
};

export const NAME_FIELD = "Nome completo";
export const EMAIL_FIELD = "E-mail";
const PHONE_FIELD = "Telefone";
export const CEP_FIELD = "CEP";
export const CONTINUE = "Continuar";
export const BACK = "Voltar";
export const SUBMITTING = "Enviando solicitação...";
export const NOT_INFORMED = "Não informado";
export const PERSONAL_HEADING = /Dados pessoais/;
export const REVIEW_HEADING = /Revisão e termos/;
export const EDIT_PERSONAL = "Editar dados pessoais";
export const CONSENT_ERROR = "Você deve aceitar os termos para continuar.";
export const LGPD_CONSENT_ERROR = "Você deve autorizar o tratamento dos dados essenciais para continuar.";
export const SUBMIT_LABEL = "Enviar solicitação";
export const SUCCESS_TITLE = "Solicitação recebida";
export const SUBMIT_FALLBACK = "Não foi possível enviar a solicitação. Revise os dados e tente novamente.";
export const SUBMIT_FORBIDDEN =
  "Não foi possível enviar a solicitação agora. Recarregue a página e tente novamente.";
export const NETWORK_ERROR = "Não foi possível conectar ao servidor. Tente novamente.";

export function seedMunicipios() {
  municipioCache.clear();
  municipioCache.set(PERSONAL.uf, MUNICIPIOS);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  vi.stubGlobal("scrollTo", vi.fn());
}

export function summaryValue(label: string) {
  return screen.getByText(`${label}:`).nextElementSibling?.textContent?.replace(/\s+/g, " ").trim();
}

export function alertText() {
  return screen.getByRole("alert").textContent;
}

export function textField(name: string) {
  return screen.getByRole("textbox", { name }) as HTMLInputElement;
}

export function fill(name: string, value: string) {
  fireEvent.change(textField(name), { target: { value } });
}

export function button(name: string | RegExp) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

export function stepHeading(title: string | RegExp) {
  return screen.findByRole("heading", { level: 2, name: title });
}

export async function selectOption(user: UserEvent, field: RegExp, option: string) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(within(await screen.findByRole("listbox")).getByRole("option", { name: option }));
}

export function fillContact() {
  fill(NAME_FIELD, PERSONAL.nameInput);
  fill(EMAIL_FIELD, PERSONAL.emailInput);
  fill(PHONE_FIELD, PERSONAL.phoneInput);
}

async function fillPersonalData(user: UserEvent) {
  fillContact();
  await selectOption(user, /Estado/, PERSONAL.uf);
  await selectOption(user, /Cidade/, PERSONAL.city);
}

export async function goToDetails(user: UserEvent, detailsHeading: RegExp) {
  await fillPersonalData(user);
  await user.click(button(CONTINUE));
  await stepHeading(detailsHeading);
}

// Each consent checkbox is matched by a unique fragment of its label, so the
// three stay independent in the tests just like they are in the UI.
export function termsCheckbox() {
  return screen.getByRole("checkbox", { name: /concordo com os/i });
}

export function lgpdEssentialCheckbox() {
  return screen.getByRole("checkbox", { name: /dados pessoais essenciais/i });
}

export function marketingCheckbox() {
  return screen.getByRole("checkbox", { name: /receber comunicações/i });
}

export async function acceptTerms(user: UserEvent) {
  await user.click(termsCheckbox());
}

export async function acceptLgpdEssential(user: UserEvent) {
  await user.click(lgpdEssentialCheckbox());
}

// Both mandatory consents (terms + LGPD essential) must be checked for the
// submit button to enable, so every flow that submits goes through this helper.
export async function acceptRequiredConsents(user: UserEvent) {
  await acceptTerms(user);
  await acceptLgpdEssential(user);
}
