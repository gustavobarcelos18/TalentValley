"use client";

export interface LgpdTermsSection {
  title: string;
  paragraphs: string[];
}

// Texto provisório de privacidade exibido no modal "Ler Termos da LGPD".
// Troque o conteúdo desta constante pelo texto oficial quando ele for aprovado;
// nenhum outro arquivo do cadastro precisa mudar por causa do texto.
export const LGPD_TERMS_PLACEHOLDER = {
  title: "Termos da LGPD",
  intro:
    "Este é um texto provisório. Aqui explicamos, de forma simples, como o Talent Valley coleta e usa os seus dados pessoais essenciais para o funcionamento da plataforma.",
  sections: [
    {
      title: "1. Quais dados coletamos",
      paragraphs: [
        "Dados de cadastro (nome, e-mail, telefone, cidade e UF) e informações acadêmicas/profissionais que você informa no cadastro. Para recrutadores, coletamos nome, e-mail, empresa, cargo e contato.",
      ],
    },
    {
      title: "2. Para que usamos",
      paragraphs: [
        "Manter perfis atualizados e permitir que recrutadores autorizados encontrem talentos. Perfis de alunos não são públicos: só recrutadores aprovados e administradores têm acesso.",
      ],
    },
    {
      title: "3. Seus direitos",
      paragraphs: [
        "Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode acessar, corrigir e solicitar a exclusão dos seus dados, além de revogar o consentimento a qualquer momento.",
      ],
    },
  ] as LgpdTermsSection[],
  contact: "Dúvidas sobre privacidade: privacy@talentvalley.test.",
};

export const LGPD_ESSENTIAL_LABEL =
  "Autorizo a coleta e o tratamento dos meus dados pessoais essenciais para usar a plataforma. (obrigatório)";

export const LGPD_MARKETING_LABEL =
  "Quero receber comunicações, avisos, cursos e campanhas do Talent Valley. (opcional)";
