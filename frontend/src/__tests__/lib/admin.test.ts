import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminApi, registrationApi } from "@/lib/admin";
import { apiGet, apiMutation, ensureCsrfToken } from "@/lib/api";
import type { RecruiterRegistrationRequest, StudentRegistrationRequest } from "@/types/registration";

vi.mock("@/lib/api");

const ID = "abc";
const REQUESTS_PATH = "/api/admin/solicitacoes-cadastro";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("adminApi reads", () => {
  it.each([
    ["dashboard", () => adminApi.dashboard(), "/api/admin/dashboard"],
    ["registrationRequest", () => adminApi.registrationRequest(ID), `${REQUESTS_PATH}/${ID}`],
    ["student", () => adminApi.student(ID), `/api/admin/alunos/${ID}`],
    ["recruiter", () => adminApi.recruiter(ID), `/api/admin/recrutadores/${ID}`],
    ["validations", () => adminApi.validations(3), "/api/admin/validacoes-rpv?page=3"],
    ["validation", () => adminApi.validation(ID), `/api/admin/validacoes-rpv/${ID}`],
    ["audit", () => adminApi.audit(2), "/api/admin/auditoria?page=2"],
  ])("%s requests the expected path", (_name, call, path) => {
    call();

    expect(apiGet).toHaveBeenCalledWith(path);
  });

  it("omits empty filters and page 1 from the query string", () => {
    adminApi.students(1, "");
    adminApi.registrationRequests(1, "", "", "");
    adminApi.recruiters(1, "", "");

    expect(apiGet).toHaveBeenNthCalledWith(1, "/api/admin/alunos");
    expect(apiGet).toHaveBeenNthCalledWith(2, REQUESTS_PATH);
    expect(apiGet).toHaveBeenNthCalledWith(3, "/api/admin/recrutadores");
  });

  it("serializes page and filters when present", () => {
    adminApi.students(2, "ana maria");
    adminApi.registrationRequests(3, "bob", "ALUNO", "PENDENTE");
    adminApi.recruiters(2, "", "ATIVO");

    expect(apiGet).toHaveBeenNthCalledWith(1, "/api/admin/alunos?page=2&search=ana+maria");
    expect(apiGet).toHaveBeenNthCalledWith(2, `${REQUESTS_PATH}?page=3&search=bob&tipo=ALUNO&status=PENDENTE`);
    expect(apiGet).toHaveBeenNthCalledWith(3, "/api/admin/recrutadores?page=2&status=ATIVO");
  });
});

describe("adminApi mutations", () => {
  it.each([
    ["approveRegistration", () => adminApi.approveRegistration(ID), "POST", `${REQUESTS_PATH}/${ID}/aprovar`, undefined],
    ["rejectRegistration without reason", () => adminApi.rejectRegistration(ID), "POST", `${REQUESTS_PATH}/${ID}/rejeitar`, {}],
    ["rejectRegistration with reason", () => adminApi.rejectRegistration(ID, "dados"), "POST", `${REQUESTS_PATH}/${ID}/rejeitar`, { motivo: "dados" }],
    ["createStudent", () => adminApi.createStudent({ nomeCompleto: "Ana", email: "a@b.c" }), "POST", "/api/admin/alunos", { nomeCompleto: "Ana", email: "a@b.c" }],
    ["studentAction", () => adminApi.studentAction(ID, "bloquear"), "POST", `/api/admin/alunos/${ID}/bloquear`, undefined],
    ["deleteStudent", () => adminApi.deleteStudent(ID), "DELETE", `/api/admin/alunos/${ID}`, undefined],
    ["createRecruiter", () => adminApi.createRecruiter({ nome: "Bob" }), "POST", "/api/admin/recrutadores", { nome: "Bob" }],
    ["recruiterAction", () => adminApi.recruiterAction(ID, "reativar"), "POST", `/api/admin/recrutadores/${ID}/reativar`, undefined],
    ["deleteRecruiter", () => adminApi.deleteRecruiter(ID), "DELETE", `/api/admin/recrutadores/${ID}`, undefined],
    ["resendActivation", () => adminApi.resendActivation(ID), "POST", `/api/admin/usuarios/${ID}/reenviar-ativacao`, undefined],
    ["validationAction", () => adminApi.validationAction(ID, "remover-validacao"), "POST", `/api/admin/validacoes-rpv/${ID}/remover-validacao`, undefined],
  ])("%s", (_name, call, method, path, body) => {
    call();

    expect(apiMutation).toHaveBeenCalledWith(...(body === undefined ? [method, path] : [method, path, body]));
  });
});

describe("registrationApi", () => {
  it("fetches the CSRF token before posting a student registration", async () => {
    const calls: string[] = [];
    vi.mocked(ensureCsrfToken).mockImplementation(async () => { calls.push("csrf"); });
    vi.mocked(apiMutation).mockImplementation(async () => { calls.push("post"); return undefined; });
    const body = { nomeCompleto: "Ana" } as StudentRegistrationRequest;

    await registrationApi.student(body);

    expect(calls).toEqual(["csrf", "post"]);
    expect(apiMutation).toHaveBeenCalledWith("POST", "/api/cadastro/aluno", body);
  });

  it("fetches the CSRF token before posting a recruiter registration", async () => {
    const calls: string[] = [];
    vi.mocked(ensureCsrfToken).mockImplementation(async () => { calls.push("csrf"); });
    vi.mocked(apiMutation).mockImplementation(async () => { calls.push("post"); return undefined; });
    const body = { nomeCompleto: "Bob" } as RecruiterRegistrationRequest;

    await registrationApi.recruiter(body);

    expect(calls).toEqual(["csrf", "post"]);
    expect(apiMutation).toHaveBeenCalledWith("POST", "/api/cadastro/recrutador", body);
  });
});
