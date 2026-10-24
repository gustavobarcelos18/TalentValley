export interface Student {
  id: string;
  name: string;
  email: string;
  curriculo?: {
    lattesUrl?: string;
    possuiCurriculo: boolean;
    // Outros campos do currículo...
  };
  // Outros campos do estudante...
}