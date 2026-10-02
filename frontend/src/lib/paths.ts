import type { UserRole } from "@/types/auth";

export const AppPaths = {
  protected: ["/meu-perfil", "/recrutador", "/admin"],
  guestOnly: ["/login", "/esqueci-senha", "/redefinir-senha", "/ativar-conta", "/reenviar-ativacao"],
} as const;

// Authenticated home of each role. Single source for every redirect or link
// that sends a signed-in user to "their area".
export function getRoleDestination(role: UserRole): string {
  switch (role) {
    case "ALUNO":
      return "/meu-perfil";
    case "RECRUTADOR":
      return "/recrutador";
    case "ADMIN":
      return "/admin";
    default:
      return "/login";
  }
}
