import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RecruiterCompanyStep,
  recruiterCompanyBlank,
  type RecruiterCompanyForm,
} from "@/components/registration/RecruiterCompanyStep";
import { EMOJI, createStepHandlers, field, useExecCommandSpy } from "./stepTestHelpers";

vi.setConfig({ testTimeout: 15_000 });

const SITE_HINT = "Opcional; use um endereço HTTP ou HTTPS.";
const COMPANY_LABEL = "Empresa";
const ROLE_LABEL = "Cargo";
const SITE_LABEL = "Site da empresa";

const handlers = createStepHandlers();

function renderStep(props: { value?: RecruiterCompanyForm; errors?: Record<string, string | null>; disabled?: boolean } = {}) {
  return render(
    <RecruiterCompanyStep
      value={props.value ?? recruiterCompanyBlank}
      errors={props.errors ?? {}}
      onChange={handlers.onChange}
      onBlur={handlers.onBlur}
      registerFieldRef={handlers.registerFieldRef}
      disabled={props.disabled ?? false}
    />,
  );
}

describe("RecruiterCompanyStep", () => {
  const execCommand = useExecCommandSpy();

  beforeEach(handlers.reset);

  it("renders every field empty by default", () => {
    renderStep();

    for (const label of [COMPANY_LABEL, ROLE_LABEL, SITE_LABEL]) expect(field(label).value).toBe("");
  });

  it("shows the current values and marks only the website as optional", () => {
    renderStep({ value: { empresa: "Acme", cargo: "Recrutadora", siteEmpresa: "https://acme.com" } });

    expect(field(COMPANY_LABEL).value).toBe("Acme");
    expect(field(ROLE_LABEL).value).toBe("Recrutadora");
    expect(field(SITE_LABEL).value).toBe("https://acme.com");
    expect(field(COMPANY_LABEL).required).toBe(true);
    expect(field(ROLE_LABEL).required).toBe(true);
    expect(field(SITE_LABEL).required).toBe(false);
  });

  it("configures each field for browsers and assistive input", () => {
    renderStep();

    expect(field(COMPANY_LABEL).getAttribute("autocomplete")).toBe("organization");
    expect(field(COMPANY_LABEL).maxLength).toBe(150);
    expect(field(ROLE_LABEL).getAttribute("autocomplete")).toBe("organization-title");
    expect(field(ROLE_LABEL).maxLength).toBe(120);
    expect(field(SITE_LABEL).type).toBe("url");
    expect(field(SITE_LABEL).getAttribute("inputmode")).toBe("url");
    expect(field(SITE_LABEL).maxLength).toBe(2048);
  });

  it.each([
    { label: COMPANY_LABEL, key: "empresa", limit: 150 },
    { label: ROLE_LABEL, key: "cargo", limit: 120 },
    { label: SITE_LABEL, key: "siteEmpresa", limit: 2048 },
  ])("reports $key without emoji and capped at $limit characters", ({ label, key, limit }) => {
    renderStep();

    fireEvent.change(field(label), { target: { value: `a${EMOJI}b` } });
    expect(handlers.onChange).toHaveBeenLastCalledWith(key, "ab");

    fireEvent.change(field(label), { target: { value: "x".repeat(limit + 10) } });
    expect(handlers.onChange).toHaveBeenLastCalledWith(key, "x".repeat(limit));
  });

  it.each([
    { label: COMPANY_LABEL, key: "empresa" },
    { label: ROLE_LABEL, key: "cargo" },
    { label: SITE_LABEL, key: "siteEmpresa" },
  ])("reports the blur of $key", ({ label, key }) => {
    renderStep();

    fireEvent.blur(field(label));

    expect(handlers.onBlur).toHaveBeenCalledExactlyOnceWith(key);
  });

  it("registers each input under its field key", () => {
    renderStep();

    expect([...handlers.refs.keys()]).toEqual(expect.arrayContaining(["empresa", "cargo", "siteEmpresa"]));
    expect(handlers.refs.get("empresa")).toHaveBeenCalledWith(field(COMPANY_LABEL));
    expect(handlers.refs.get("cargo")).toHaveBeenCalledWith(field(ROLE_LABEL));
    expect(handlers.refs.get("siteEmpresa")).toHaveBeenCalledWith(field(SITE_LABEL));
  });

  it("removes emoji from pasted text", () => {
    renderStep();

    const accepted = fireEvent.paste(field(COMPANY_LABEL), { clipboardData: { getData: () => `Acme${EMOJI}` } });

    expect(accepted).toBe(false);
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "Acme");
  });

  it("shows validation errors on their fields and flags them invalid", () => {
    renderStep({ errors: { empresa: "Informe a empresa.", cargo: "Informe o cargo.", siteEmpresa: "Site inválido." } });

    expect(screen.getByText("Informe a empresa.")).toBeTruthy();
    expect(screen.getByText("Informe o cargo.")).toBeTruthy();
    expect(screen.getByText("Site inválido.")).toBeTruthy();
    expect(screen.queryByText(SITE_HINT)).toBeNull();
    expect(field(COMPANY_LABEL).getAttribute("aria-invalid")).toBe("true");
    expect(field(ROLE_LABEL).getAttribute("aria-invalid")).toBe("true");
    expect(field(SITE_LABEL).getAttribute("aria-invalid")).toBe("true");
  });

  it("explains the optional website while it has no error", () => {
    renderStep();

    expect(screen.getByText(SITE_HINT)).toBeTruthy();
    expect(field(COMPANY_LABEL).getAttribute("aria-invalid")).toBe("false");
  });

  it("disables every field", () => {
    renderStep({ disabled: true });

    for (const label of [COMPANY_LABEL, ROLE_LABEL, SITE_LABEL]) expect(field(label).disabled).toBe(true);
  });
});
