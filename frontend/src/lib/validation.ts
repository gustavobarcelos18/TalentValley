export const PASSWORD_HELPER_TEXT = "Mínimo de 8 caracteres, com maiúscula, minúscula e dígito.";

export function validatePassword(senha: string): string | null {
  if (senha.length < 8) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }
  if (!/[A-Z]/.test(senha)) {
    return "A senha deve conter pelo menos uma letra maiúscula.";
  }
  if (!/[a-z]/.test(senha)) {
    return "A senha deve conter pelo menos uma letra minúscula.";
  }
  if (!/\d/.test(senha)) {
    return "A senha deve conter pelo menos um dígito.";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) {
    return "Informe seu e-mail.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Informe um e-mail válido.";
  }
  return null;
}
