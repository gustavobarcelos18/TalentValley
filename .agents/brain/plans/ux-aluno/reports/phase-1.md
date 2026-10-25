# Relatório da Fase 1: Estrutura do perfil (plano ux-aluno)

- **Branch:** `feat/ux-aluno-phase-1-profile-structure`
- **Commit:** e756c6a (aprovado pelo mantenedor em 2026-10-24)
- **PR:** https://github.com/gustavobarcelos18/TalentValley/pull/161

## O que mudou
- Cartão "Dados básicos" removido; nome e cidade/UF são editados pelo botão "Editar nome e localização" do cabeçalho (mesmo diálogo).
- Seções em 3 blocos titulados: Apresentação (Sobre, Contato); Formação e experiência (Trajetória, Competências, Idiomas); Para os recrutadores (O que eu busco, Projetos, Currículo).
- Índice da página: lista lateral fixa a partir de `xl`, chips fixos sob a barra do topo abaixo disso; links comuns, `aria-current="location"` na seção visível (IntersectionObserver); o item clicado é liberado na primeira rolagem (roda, toque, ponteiro ou tecla).
- Âncoras `secao-<id>` em cada seção.
- `approved-ux.md` atualizado nas duas cópias (`.agents/skills` e `.claude/skills`), conflito C2.

## Arquivos
- Criados: `frontend/src/components/profile/ProfileIndex.tsx`, `frontend/src/components/profile/profileSections.ts`.
- Renomeados: `DadosBasicosSection.tsx` -> `DadosBasicosForm.tsx`; `DadosBasicosSection.test.tsx` -> `DadosBasicosForm.test.tsx`.
- Editados: `ProfileHeader.tsx`, `StudentProfile.tsx`, `StudentProfile.test.tsx`, `ProfileHeader.test.tsx`, `approved-ux.md` (2 cópias).
- Excluídos: nenhum. Sem migrations, pacotes ou backend.

## Checagens locais (resultado real)
- `npx eslint` nos arquivos alterados: sem problemas.
- `npm run typecheck`: passou.
- `npx vitest run src/__tests__/components/profile`: 14 arquivos, 487 testes passando na última execução. Numa execução intermediária, sob carga, 3 testes de arquivos não tocados falharam por lentidão; repetidos, passaram.
- Não rodados localmente: `npm run build`, bateria completa (CI). Sem conferência visual no navegador.

## Revisão independente (opus)
Sem problema bloqueante. Corrigido: item clicado não era liberado por teclado/barra de rolagem (A1), constantes nomeadas, `Readonly` nas props, contorno de foco cortado, nome acessível do botão, helper de teste renomeado, stub de IntersectionObserver deduplicado. Ficaram sem corrigir (baixa prioridade): chip ativo fora da faixa visível no celular, títulos dos blocos como group e não heading, borda do observer em celular muito baixo com banner de demonstração.

## CI e SonarQube no PR 161
- Em 2026-10-24: Backend (.NET), Docker build, Manifesto de skills, Vercel e Frontend (Next.js, execução do PR) passaram.
- SonarQube Cloud (lido pela API, PR 161): Quality Gate OK; 0 issues abertas; 0 security hotspots; cobertura em código novo 94,3% (limite 80%); duplicação 0,0%; ratings de confiabilidade, segurança e manutenibilidade nota 1. Nada a corrigir.
