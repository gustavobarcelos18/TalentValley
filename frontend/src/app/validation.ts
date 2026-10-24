export const validateLattesUrl = (url: string): string | null => {
  if (!url) return null;

  try {
    new URL(url);
  } catch {
    return "URL inválida";
  }

  // Apenas permite hosts do CNPq
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname !== "lattes.cnpq.br" &&
      hostname !== "buscatextual.cnpq.br"
    ) {
      return "URL do Lattes deve ser de um host do CNPQ (lattes.cnpq.br ou buscatextual.cnpq.br)";
    }
  } catch {
    return "URL inválida";
  }

  return null;
};

export const validateStudentForm = (data: {
  name: string;
  email: string;
  lattesUrl?: string;
}): string | null => {
  if (!data.name?.trim()) return "Nome é obrigatório";
  if (!data.email?.trim()) return "Email é obrigatório";
  if (data.lattesUrl) {
    const validation = validateLattesUrl(data.lattesUrl);
    if (validation) return validation;
  }
  return null;
};