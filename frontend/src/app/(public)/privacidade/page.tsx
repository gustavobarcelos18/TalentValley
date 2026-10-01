import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = { title: "Política de Privacidade | Talent Valley" };

// Placeholder text pending institutional review.
const sections: LegalSection[] = [
  {
    title: "1. Identidade e Contato",
    paragraphs: [
      "O Talent Valley é a plataforma de carreira do Rio Pomba Valley, gerida pela instituição responsável pelo projeto, que atua como controladora dos dados pessoais tratados aqui.",
      "Para dúvidas ou solicitações sobre privacidade, escreva para privacy@talentvalley.test.",
    ],
  },
  {
    title: "2. Dados Coletados",
    paragraphs: [
      "Coletamos dados de cadastro (nome, e-mail, telefone, cidade e UF), dados acadêmicos e profissionais informados pelo aluno (formações, competências, idiomas, projetos) e arquivos enviados por ele, como foto e currículo.",
      "Para recrutadores, coletamos nome, e-mail, empresa, cargo e dados de contato. Também registramos dados técnicos de acesso necessários à segurança da conta.",
    ],
  },
  {
    title: "3. Finalidades",
    paragraphs: [
      "Os dados de alunos são usados para manter perfis profissionais atualizados e permitir que recrutadores autorizados encontrem talentos e analisem evidências. Os dados de recrutadores servem para autorizar e identificar o acesso à plataforma.",
      "Perfis de alunos não são públicos: somente recrutadores aprovados pela instituição e administradores têm acesso. A plataforma não é um sistema de vagas nem de mensagens; o contato ocorre externamente.",
    ],
  },
  {
    title: "4. Retenção",
    paragraphs: [
      "Os dados do perfil são mantidos enquanto a conta existir. O aluno pode excluir a conta a qualquer momento, o que remove definitivamente seus dados e arquivos.",
      "Solicitações de cadastro rejeitadas são excluídas após 30 dias. Registros de auditoria administrativa podem ser mantidos para fins de segurança.",
    ],
  },
  {
    title: "5. Direitos do Titular",
    paragraphs: [
      "Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode confirmar a existência de tratamento, acessar, corrigir e solicitar a exclusão dos seus dados, além de revogar o consentimento.",
      "Alunos podem corrigir seus dados e excluir a conta diretamente em Meu perfil. Para os demais direitos, utilize o contato informado abaixo.",
    ],
  },
  {
    title: "6. Contato",
    paragraphs: [
      "Encarregado pelo tratamento de dados: privacy@talentvalley.test. Responderemos às solicitações em prazo razoável, conforme a legislação aplicável.",
    ],
  },
];

export default function PrivacidadePage() {
  return (
    <LegalDocument
      title="Política de Privacidade"
      effective="a partir da publicação (implantação)"
      sections={sections}
      lastUpdated="data da implantação"
    />
  );
}
