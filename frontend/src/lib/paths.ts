import type { UserRole } from "@/types/auth";

export const AppPaths = {
  protected: ["/meu-perfil", "/recrutador", "/admin", "/conta", "/aceitar-termos"],
  guestOnly: ["/login", "/esqueci-senha", "/redefinir-senha", "/ativar-conta", "/reenviar-ativacao", "/cadastro", "/cadastro/aluno", "/cadastro/recrutador"],
} as const;

// Where a student or recruiter who has not accepted the current terms is sent.
export const TERMS_ACCEPTANCE_PATH = "/aceitar-termos";

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
