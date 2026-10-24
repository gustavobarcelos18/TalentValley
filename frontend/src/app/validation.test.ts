import { validateLattesUrl, validateStudentForm } from "./validation";

describe("validateLattesUrl", () => {
  test("retorna null para URL válida do lattes.cnpq.br", () => {
    const result = validateLattesUrl("https://lattes.cnpq.br/xxxx");
    expect(result).toBeNull();
  });

  test("retorna null para URL válida do buscatextual.cnpq.br", () => {
    const result = validateLattesUrl("https://buscatextual.cnpq.br/xxxx");
    expect(result).toBeNull();
  });

  test("retorna erro para URL de host diferente", () => {
    const result = validateLattesUrl("https://example.com/xxx");
    expect(result).toBe("URL do Lattes deve ser de um host do CNPQ (lattes.cnpq.br ou buscatextual.cnpq.br)");
  });

  test("retorna erro para URL inválida", () => {
    const result = validateLattesUrl("not-a-url");
    expect(result).toBe("URL inválida");
  });

  test("retorna null para URL vazia", () => {
    const result = validateLattesUrl("");
    expect(result).toBeNull();
  });
});

describe("validateStudentForm", () => {
  test("retorna null para dados válidos com URL do Lattes", () => {
    const result = validateStudentForm({
      name: "João Silva",
      email: "joao@email.com",
      lattesUrl: "https://lattes.cnpq.br/xxxx",
    });
    expect(result).toBeNull();
  });

  test("retorna null para dados válidos sem URL do Lattes", () => {
    const result = validateStudentForm({
      name: "João Silva",
      email: "joao@email.com",
      lattesUrl: undefined,
    });
    expect(result).toBeNull();
  });

  test("retorna erro quando nome está vazio", () => {
    const result = validateStudentForm({
      name: "",
      email: "joao@email.com",
      lattesUrl: "https://lattes.cnpq.br/xxxx",
    });
    expect(result).toBe("Nome é obrigatório");
  });

  test("retorna erro quando email está vazio", () => {
    const result = validateStudentForm({
      name: "João Silva",
      email: "",
      lattesUrl: "https://lattes.cnpq.br/xxxx",
    });
    expect(result).toBe("Email é obrigatório");
  });

  test("retorna erro quando URL do Lattes tem host inválido", () => {
    const result = validateStudentForm({
      name: "João Silva",
      email: "joao@email.com",
      lattesUrl: "https://invalid-host.com/xxx",
    });
    expect(result).toBe("URL do Lattes deve ser de um host do CNPQ (lattes.cnpq.br ou buscatextual.cnpq.br)");
  });
});