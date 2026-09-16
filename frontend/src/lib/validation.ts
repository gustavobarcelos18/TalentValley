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

export function sanitizePersonName(value: string): string {
  return value.replace(/[^\p{L} ]/gu, "").slice(0, 150);
}

export function sanitizeCityName(value: string): string {
  return value.replace(/[^\p{L} ]/gu, "").slice(0, 120);
}

export function validatePersonName(value: string): string | null {
  const name = value.trim();
  if (name.length < 3 || name.length > 150) {
    return "O nome completo deve ter entre 3 e 150 caracteres.";
  }
  if (!/^[\p{L} ]+$/u.test(name)) {
    return "Use somente letras e espaços no nome completo.";
  }
  return null;
}

export function validateCityName(value: string): string | null {
  const city = value.trim();
  if (city.length < 2 || city.length > 120) {
    return "A cidade deve ter entre 2 e 120 caracteres.";
  }
  if (!/^[\p{L} ]+$/u.test(city)) {
    return "Use somente letras e espaços no nome da cidade.";
  }
  return null;
}

const emojiPattern = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\u20E3\u{E0020}-\u{E007F}]/gu;
const keycapPattern = /[#*0-9]\uFE0F?\u20E3/gu;

export function sanitizeBio(value: string): string {
  return value.replace(keycapPattern, "").replace(emojiPattern, "").slice(0, 1500);
}
