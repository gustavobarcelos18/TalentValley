import type { LegalSection } from "./LegalDocument";

// Textos jurídicos provisórios (pendentes de revisão institucional).
// Ficam aqui para serem usados pelas páginas /privacidade e /termos e pelo
// LegalTextDialog do cadastro, sem duplicar o conteúdo.
export const PRIVACY_SECTIONS: LegalSection[] = [
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
      "Alunos podem corrigir seus dados em Meu perfil e excluir a conta em Minha conta. Para os demais direitos, utilize o contato informado abaixo.",
    ],
  },
  {
    title: "6. Contato",
    paragraphs: [
      "Encarregado pelo tratamento de dados: privacy@talentvalley.test. Responderemos às solicitações em prazo razoável, conforme a legislação aplicável.",
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
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
      "A instituição pode bloquear ou encerrar contas que violem estes termos. Alunos podem excluir a conta a qualquer momento em Minha conta, de forma definitiva e irreversível.",
    ],
  },
  {
    title: "6. Alterações e Contato",
    paragraphs: [
      "Estes termos podem ser atualizados; mudanças relevantes serão informadas na plataforma. Contato: contato@talentvalley.test.",
    ],
  },
];