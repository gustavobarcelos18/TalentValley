import { beforeEach, describe, expect, it, vi } from "vitest";
import * as student from "@/lib/student";
import { apiGet, apiMutation, apiUpload, ensureCsrfToken } from "@/lib/api";

vi.mock("@/lib/api");

const ID = "42";
const ME = "/api/alunos/me";
const FORMACOES = `${ME}/formacoes`;
const EXPERIENCIAS = `${ME}/experiencias`;
const PROJETOS = `${ME}/projetos`;
const request = { campo: "valor" } as never;
const file = new File(["x"], "a.png");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("student reads", () => {
  it.each([
    ["fetchMyProfile", () => student.fetchMyProfile(), ME],
    ["fetchCompetenciaCatalog", () => student.fetchCompetenciaCatalog(), "/api/competencias"],
    ["fetchIdiomaCatalog", () => student.fetchIdiomaCatalog(), "/api/idiomas"],
    ["fetchTrajectory", () => student.fetchTrajectory(), `${ME}/trajetoria`],
    ["fetchFormacoes", () => student.fetchFormacoes(), FORMACOES],
    ["fetchExperiencias", () => student.fetchExperiencias(), EXPERIENCIAS],
    ["fetchProjetos", () => student.fetchProjetos(), PROJETOS],
  ])("%s", (_name, call, path) => {
    call();

    expect(apiGet).toHaveBeenCalledWith(path);
  });
});

describe("student mutations", () => {
  it.each([
    ["updateDadosBasicos", () => student.updateDadosBasicos(request), "PUT", `${ME}/dados-basicos`, request],
    ["updateSobre", () => student.updateSobre(request), "PUT", `${ME}/sobre`, request],
    ["updateContato", () => student.updateContato(request), "PUT", `${ME}/contato`, request],
    ["updateCompetencias", () => student.updateCompetencias(request), "PUT", `${ME}/competencias`, request],
    ["updateIdiomas", () => student.updateIdiomas(request), "PUT", `${ME}/idiomas`, request],
    ["updateDisponibilidade", () => student.updateDisponibilidade(request), "PUT", `${ME}/disponibilidade`, request],
    ["deleteStudentPhoto", () => student.deleteStudentPhoto(), "DELETE", `${ME}/foto`, undefined],
    ["deleteStudentCurriculum", () => student.deleteStudentCurriculum(), "DELETE", `${ME}/curriculo`, undefined],
    ["createFormacao", () => student.createFormacao(request), "POST", FORMACOES, request],
    ["updateFormacao", () => student.updateFormacao(ID, request), "PUT", `${FORMACOES}/${ID}`, request],
    ["deleteFormacao", () => student.deleteFormacao(ID), "DELETE", `${FORMACOES}/${ID}`, undefined],
    ["deleteFormationCertificate", () => student.deleteFormationCertificate(ID), "DELETE", `${FORMACOES}/${ID}/certificado`, undefined],
    ["createExperiencia", () => student.createExperiencia(request), "POST", EXPERIENCIAS, request],
    ["updateExperiencia", () => student.updateExperiencia(ID, request), "PUT", `${EXPERIENCIAS}/${ID}`, request],
    ["deleteExperiencia", () => student.deleteExperiencia(ID), "DELETE", `${EXPERIENCIAS}/${ID}`, undefined],
    ["createProjeto", () => student.createProjeto(request), "POST", PROJETOS, request],
    ["updateProjeto", () => student.updateProjeto(ID, request), "PUT", `${PROJETOS}/${ID}`, request],
    ["deleteProjeto", () => student.deleteProjeto(ID), "DELETE", `${PROJETOS}/${ID}`, undefined],
  ])("%s", (_name, call, method, path, body) => {
    call();

    expect(apiMutation).toHaveBeenCalledWith(...(body === undefined ? [method, path] : [method, path, body]));
  });
});

describe("student uploads", () => {
  it.each([
    ["uploadStudentPhoto", () => student.uploadStudentPhoto(file), `${ME}/foto`],
    ["uploadStudentCurriculum", () => student.uploadStudentCurriculum(file), `${ME}/curriculo`],
    ["uploadFormationCertificate", () => student.uploadFormationCertificate(ID, file), `${FORMACOES}/${ID}/certificado`],
  ])("%s sends the file as multipart form data", (_name, call, path) => {
    call();

    expect(apiUpload).toHaveBeenCalledWith(path, expect.any(FormData));
    const formData = vi.mocked(apiUpload).mock.calls[0]![1];
    expect((formData.get("file") as File).name).toBe("a.png");
  });
});

describe("deleteOwnAccount", () => {
  it("ensures the CSRF token before sending the current password", async () => {
    const calls: string[] = [];
    vi.mocked(ensureCsrfToken).mockImplementation(async () => { calls.push("csrf"); });
    vi.mocked(apiMutation).mockImplementation(async () => { calls.push("delete"); return undefined; });

    await student.deleteOwnAccount("segredo");

    expect(calls).toEqual(["csrf", "delete"]);
    expect(apiMutation).toHaveBeenCalledWith("DELETE", ME, { senhaAtual: "segredo" });
  });
});
