import { profileSectionAnchor, type ProfileSectionId } from "@/components/profile/profileSections";
import { buscaEstaVazia } from "@/lib/busca";
import type { MeResponse } from "@/types/student";

// "Próximos passos" of the student home: one step per profile section, in the order of the profile page.
// A step is done when its section has any content; the rule is the same one each section uses for its empty state.

export interface HomeStep {
  id: ProfileSectionId;
  label: string;
  hint: string;
  done: boolean;
  /** Link to the section on the profile page. */
  href: string;
}

export const PROFILE_PATH = "/meu-perfil";

const STEP_TEXTS: Omit<HomeStep, "done" | "href">[] = [
  { id: "sobre", label: "Escrever sobre você", hint: "Conte quem você é e o que quer fazer." },
  { id: "contato", label: "Informar como falar com você", hint: "Telefone, e-mail ou links profissionais." },
  { id: "trajetoria", label: "Adicionar formação ou experiência", hint: "Cursos, certificados, estágios e empregos." },
  { id: "competencias", label: "Escolher suas competências", hint: "Os recrutadores filtram a busca por elas." },
  { id: "idiomas", label: "Informar seus idiomas", hint: "Com o nível de cada um." },
  { id: "busca", label: "Contar o que você busca", hint: "Evita contato que não combina com você." },
  { id: "projetos", label: "Destacar um projeto", hint: "Até dois trabalhos que mostram o que você faz." },
  { id: "curriculo", label: "Enviar seu currículo em PDF", hint: "Os recrutadores podem baixar o arquivo." },
];

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function buildHomeSteps(profile: MeResponse): HomeStep[] {
  const { contato } = profile;
  const done: Record<ProfileSectionId, boolean> = {
    sobre: hasText(profile.sobre.bio),
    contato: [contato.telefone, contato.emailProfissional, contato.linkedInUrl, contato.gitHubUrl, contato.portfolioUrl].some(hasText),
    trajetoria: profile.formacoes.length + profile.experiencias.length > 0,
    competencias: profile.competencias.length > 0,
    idiomas: profile.idiomas.length > 0,
    busca: !buscaEstaVazia(profile.busca, profile.disponibilidades, profile.modalidades),
    projetos: profile.projetos.length > 0,
    curriculo: profile.curriculo.possuiCurriculo,
  };

  return STEP_TEXTS.map((step) => ({ ...step, done: done[step.id], href: `${PROFILE_PATH}#${profileSectionAnchor(step.id)}` }));
}
