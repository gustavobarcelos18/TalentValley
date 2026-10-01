import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = { title: "Termos de Uso | Talent Valley" };

// Placeholder text pending institutional review.
const sections: LegalSection[] = [
  {
    title: "1. Identidade e Contato",
    paragraphs: [
      "O Talent Valley é a plataforma de carreira do Rio Pomba Valley, gerida pela instituição responsável pelo projeto. Dúvidas sobre estes termos: contato@talentvalley.test.",
    ],
  },
  {
    title: "2. Aceitação e Cadastro",
    paragraphs: [
      "O acesso depende de solicitação de cadastro e aprovação da instituição. Ao solicitar acesso, você declara ter lido e concordado com estes Termos e com a Política de Privacidade.",
      "As informações fornecidas devem ser verdadeiras e atualizadas. Você é responsável por manter a confidencialidade da sua senha.",
    ],
  },
  {
    title: "3. Uso da Plataforma",
    paragraphs: [
      "Alunos mantêm perfis profissionais e evidências de sua trajetória. Recrutadores autorizados descobrem talentos por busca estruturada e entram em contato por canais externos à plataforma.",
      "É proibido usar a plataforma para fins diferentes dos previstos, copiar dados de forma automatizada, compartilhar credenciais ou divulgar dados de alunos a terceiros sem autorização.",
    ],
  },
  {
    title: "4. Dados Pessoais",
    paragraphs: [
      "O tratamento de dados pessoais segue a Política de Privacidade, incluindo as finalidades, o prazo de retenção e os direitos do titular.",
    ],
  },
  {
    title: "5. Suspensão e Exclusão",
    paragraphs: [
      "A instituição pode bloquear ou encerrar contas que violem estes termos. Alunos podem excluir a conta a qualquer momento em Meu perfil, de forma definitiva e irreversível.",
    ],
  },
  {
    title: "6. Alterações e Contato",
    paragraphs: [
      "Estes termos podem ser atualizados; mudanças relevantes serão informadas na plataforma. Contato: contato@talentvalley.test.",
    ],
  },
];

export default function TermosPage() {
  return (
    <LegalDocument
      title="Termos de Uso"
      effective="a partir da publicação (implantação)"
      sections={sections}
      lastUpdated="data da implantação"
    />
  );
}
