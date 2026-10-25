// The sections of the student profile page, grouped in the three blocks shown on it.
// The `id` is the anchor of the section on the page, so the index (and later the
// "next steps" of the student home) can link straight to it.

export type ProfileSectionId =
  | "sobre"
  | "contato"
  | "trajetoria"
  | "competencias"
  | "idiomas"
  | "busca"
  | "projetos"
  | "curriculo";

export interface ProfileSectionLink {
  id: ProfileSectionId;
  label: string;
}

export interface ProfileBlock {
  title: string;
  sections: ProfileSectionLink[];
}

export const PROFILE_BLOCKS: ProfileBlock[] = [
  {
    title: "Apresentação",
    sections: [
      { id: "sobre", label: "Sobre" },
      { id: "contato", label: "Contato" },
    ],
  },
  {
    title: "Formação e experiência",
    sections: [
      { id: "trajetoria", label: "Trajetória" },
      { id: "competencias", label: "Competências" },
      { id: "idiomas", label: "Idiomas" },
    ],
  },
  {
    title: "Para os recrutadores",
    sections: [
      { id: "busca", label: "O que eu busco" },
      { id: "projetos", label: "Projetos" },
      { id: "curriculo", label: "Currículo" },
    ],
  },
];

/** Page anchor of a profile section. */
export function profileSectionAnchor(id: ProfileSectionId): string {
  return `secao-${id}`;
}
