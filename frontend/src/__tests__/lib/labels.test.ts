import { describe, expect, it } from "vitest";
import { DISPONIBILIDADE_OPCOES, MODALIDADE_OPCOES, NIVEL_IDIOMA_OPCOES, ROLE_LABELS } from "@/lib/labels";

describe("labels", () => {
  it("labels every role", () => {
    expect(ROLE_LABELS).toEqual({ ALUNO: "Aluno", RECRUTADOR: "Recrutador", ADMIN: "Admin" });
  });

  it("lists the options in the order the labels are declared", () => {
    expect(DISPONIBILIDADE_OPCOES).toEqual(["ESTAGIO", "CLT", "PJ", "FREELANCER", "TRAINEE"]);
    expect(MODALIDADE_OPCOES).toEqual(["PRESENCIAL", "HIBRIDO", "REMOTO"]);
    expect(NIVEL_IDIOMA_OPCOES).toEqual(["BASICO", "INTERMEDIARIO", "AVANCADO", "FLUENTE", "NATIVO"]);
  });
});
