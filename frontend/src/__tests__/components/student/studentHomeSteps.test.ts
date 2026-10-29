import { describe, expect, it } from "vitest";
import { buildHomeSteps } from "@/components/student/studentHomeSteps";
import type { MeResponse } from "@/types/student";
import { makeBusca, makeProfile } from "../profile/profileFixtures";

const EMPTY_CONTACT = { telefone: null, emailProfissional: null, linkedInUrl: null, gitHubUrl: null, portfolioUrl: null };

/** A profile with every section empty, as a student has right after the first login. */
function emptyProfile(overrides: Partial<MeResponse> = {}): MeResponse {
  return makeProfile({
    sobre: { bio: null },
    contato: EMPTY_CONTACT,
    competencias: [],
    idiomas: [],
    disponibilidades: [],
    modalidades: [],
    busca: makeBusca(),
    ...overrides,
  });
}

function doneOf(profile: MeResponse) {
  return Object.fromEntries(buildHomeSteps(profile).map((step) => [step.id, step.done]));
}

describe("buildHomeSteps", () => {
  it("lists one step per profile section, in the order of the profile page", () => {
    expect(buildHomeSteps(emptyProfile()).map((step) => step.id)).toEqual([
      "sobre",
      "contato",
      "trajetoria",
      "competencias",
      "idiomas",
      "busca",
      "projetos",
      "curriculo",
    ]);
  });

  it("leaves every step pending on an empty profile", () => {
    expect(buildHomeSteps(emptyProfile()).every((step) => !step.done)).toBe(true);
  });

  it("links each step to its section on the profile page", () => {
    const hrefs = buildHomeSteps(emptyProfile()).map((step) => step.href);

    expect(hrefs[0]).toBe("/meu-perfil#secao-sobre");
    expect(hrefs[5]).toBe("/meu-perfil#secao-busca");
    expect(new Set(hrefs).size).toBe(8);
  });

  it("marks every step done on a full profile", () => {
    const full = makeProfile({
      formacoes: [{ id: "f1" } as MeResponse["formacoes"][number]],
      projetos: [{ id: "p1" } as MeResponse["projetos"][number]],
      curriculo: { possuiCurriculo: true, nomeArquivo: "cv.pdf" },
    });

    expect(buildHomeSteps(full).every((step) => step.done)).toBe(true);
  });

  it("does not count a blank bio as done", () => {
    expect(doneOf(emptyProfile({ sobre: { bio: "   " } })).sobre).toBe(false);
    expect(doneOf(emptyProfile({ sobre: { bio: "Olá" } })).sobre).toBe(true);
  });

  it("counts contact as done with any single field filled", () => {
    expect(doneOf(emptyProfile({ contato: { ...EMPTY_CONTACT, gitHubUrl: "https://github.com/maria" } })).contato).toBe(true);
    expect(doneOf(emptyProfile({ contato: { ...EMPTY_CONTACT, telefone: " " } })).contato).toBe(false);
  });

  it("counts the trajectory as done with a formation or an experience", () => {
    expect(doneOf(emptyProfile({ experiencias: [{ id: "e1" } as MeResponse["experiencias"][number]] })).trajetoria).toBe(true);
    expect(doneOf(emptyProfile({ formacoes: [{ id: "f1" } as MeResponse["formacoes"][number]] })).trajetoria).toBe(true);
    expect(doneOf(emptyProfile()).trajetoria).toBe(false);
  });

  it("counts 'o que eu busco' as done with any field filled, like the section itself", () => {
    expect(doneOf(emptyProfile({ busca: makeBusca({ status: "ABERTO_A_PROPOSTAS" }) })).busca).toBe(true);
    expect(doneOf(emptyProfile({ modalidades: ["REMOTO"] })).busca).toBe(true);
    expect(doneOf(emptyProfile()).busca).toBe(false);
  });

  it("counts the resume only when a file was sent", () => {
    expect(doneOf(emptyProfile({ curriculo: { possuiCurriculo: true, nomeArquivo: "cv.pdf" } })).curriculo).toBe(true);
    expect(doneOf(emptyProfile()).curriculo).toBe(false);
  });
});
