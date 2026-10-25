# Plano: UX do aluno (clareza e orientação)

- **status:** em-andamento (rascunho aprovado pelo mantenedor em 2026-10-21 após ver o exemplo visual; Fase 1 aprovada em 2026-10-24, PR 161)
- **revisado em:** 2026-10-24, após atualizar o `main`: seção "O que eu busco" e tema novo. Exemplo visual v3 aprovado pelo mantenedor.
- **data:** 2026-10-21
- **total de fases:** 6
- **slug:** ux-aluno

## 1. Problema

A parte do aluno é confusa. Diagnóstico feito **só pela leitura do código** (a tela não foi aberta com uma conta de aluno):

1. `/meu-perfil` é uma coluna de 12 cartões sem prioridade nem índice: dados básicos, sobre, contato, trajetória, competências, idiomas, o que eu busco, projetos, currículo, privacidade, exclusão.
2. Nome e cidade aparecem duas vezes (cabeçalho e cartão "Dados básicos"), com dois lugares de edição.
3. Privacidade e "excluir conta" ficam no fim do perfil, misturadas com dados profissionais.
4. O menu do aluno tem 1 item (`NAV_BY_ROLE.ALUNO`); senha e privacidade ficam escondidas no menu da conta.
5. Nada explica quem vê o perfil nem para que serve cada seção.
6. A Trajetória edita com ícones soltos (padrão diferente das outras seções); "Rio Pomba Valley", certificado e validação aparecem sem explicação.
7. Primeiro acesso: ativação diz "Você já pode fazer login", e o login cai num perfil vazio.

## 2. Decisões do mantenedor

| Tema | Decisão |
|---|---|
| O que confunde | Página longa sem prioridade; não sabe quem vê o perfil; primeiro acesso. |
| Alcance | Perfil + primeiro acesso + Conta. |
| Regras do UX aprovado que podem mudar | **Só a "página de início do aluno"** (hoje proibida). Continuam proibidos: % de preenchimento, "ver como recrutador", CV gerado. |
| Relação com a gamificação | **Plano separado.** Colide em menu e destino do login com o plano `gamificacao`; quem entrar depois ajusta. |
| Propostas vistas no exemplo visual (aprovadas com "excelente") | Conteúdo do início (aviso de privacidade, próximos passos feito/pendente sem % nem barra, texto "como os recrutadores encontram você", data da última atualização); ordem das seções espelhando a do recrutador; boas-vindas do primeiro acesso só enquanto o perfil estiver vazio, sem guardar nada; privacidade e exclusão movidas para "Minha conta". |
| Tema (revisão de 2026-10-24) | As telas novas usam o tema do `main` (commit `df96f0f`): fundo `#0A0B0C` e cartões `#131517` (separados do fundo só pela borda), verde vivo sólido `#3DDC84` com texto escuro em botões, selos e ícones, faixa verde de 3px no topo dos blocos em destaque. Só tokens do tema (`vivid`, `surface`), sem cor escrita no código. |
| "O que eu busco" (revisão de 2026-10-24) | A seção que era "Disponibilidade" já existe no `main` (plano `busca-aluno`, concluído). Fica no bloco "Para os recrutadores", com a edição no mesmo diálogo de hoje (`BuscaForm`). Este plano não muda os campos nem as regras dela. |

**Ainda em aberto:** conta de aluno de teste local para conferir visualmente (padrão: partir só do código e conferir no navegador ao fim de cada fase). Os textos finais das telas são propostas minhas; o mantenedor ajusta na revisão de cada fase.

## 3. Conflitos com regras aprovadas (atualizar documentos na fase indicada)

| # | Regra atual | Mudança | Fase |
|---|---|---|---|
| C1 | `approved-ux.md` e `mvp-rules.md`: "sem dashboard do aluno; login vai direto a `/meu-perfil`" | Entra a tela de Início do aluno e o login passa a levá-la. Sem métricas, sem %. | 4 |
| C2 | `approved-ux.md` lista a ordem das seções do aluno (cabeçalho, sobre, contato, formação, experiência, competências, idiomas, disponibilidade, projetos, CV) | Nova ordem em 3 blocos (ver Fase 1). | 1 |
| C3 | `approved-ux.md`: proíbe "% de preenchimento", "ver como recrutador" | **Mantida.** O texto "como os recrutadores encontram você" é só explicação, sem prévia do perfil. | 4 |
| C4 | Plano `gamificacao` (R1) mantém login em `/meu-perfil` e a barra de nível/`/configuracoes` no menu | Conflito de rota de login e de itens de menu; resolver quando a gamificação voltar. | 3 e 4 |
| C5 | Plano `busca-aluno`: o aviso de situação de busca a vencer fica só dentro da seção "O que eu busco" (sem e-mail, sem rotina) | **Em aberto, decisão do mantenedor:** mostrar um lembrete no Início. Não está no exemplo aprovado. Padrão: não repetir no Início. | 4 |

Não muda: papéis, autenticação, JWT em cookie HttpOnly, CSRF, backend, banco. Nenhum pacote novo. Se alguma fase precisar de backend ou de mexer em autenticação, parar e perguntar ao mantenedor.

## 4. Tabela de fases

| Fase | Nome | Branch | Status | Commit |
|---|---|---|---|---|
| 1 | Estrutura do perfil | `feat/ux-aluno-phase-1-profile-structure` | aprovada (PR 161 aberto; Sonar OK, 0 issues) | e756c6a |
| 2 | Textos de ajuda e padrão de edição | `feat/ux-aluno-phase-2-help-and-editing` | pendente | - |
| 3 | Minha conta | `feat/ux-aluno-phase-3-my-account` | pendente | - |
| 4 | Início do aluno | `feat/ux-aluno-phase-4-student-home` | pendente | - |
| 5 | Primeiro acesso | `feat/ux-aluno-phase-5-first-access` | pendente | - |
| 6 | Polimento | `feat/ux-aluno-phase-6-polish` | pendente | - |

**Regras de todas as fases:** branch nova a partir de `origin/main` atualizado; árvore limpa antes de criar; relatório da fase + revisão independente (subagente opus) antes de mostrar ao usuário; parar e esperar aprovação; só então commit, push, PR e verificação SonarQube (`talent-valley-phased-delivery` seções 3-4 e `talent-valley-quality-gate` seção 8). Textos de tela sempre em pt-BR.

**Checks de todas as fases (só frontend, dentro de `frontend/`):** `npx eslint <arquivos alterados>`, `npm run typecheck`, `npx vitest run <testes das telas alteradas>`. Bateria completa (`npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`) na Fase 6 ou quando a fase mexer em layout/menu/rotas compartilhados (Fases 3 e 4). Conferir visualmente claro/escuro e celular com o servidor de desenvolvimento.

**Skills em todas as fases:** `talent-valley-frontend-ui` (+ `references/approved-ux.md`), `talent-valley-quality-gate`, `talent-valley-phased-delivery`. Ler `frontend/AGENTS.md` e os docs do Next em `frontend/node_modules/next/dist/docs/` antes de escrever frontend.

---

## Fase 1: Estrutura do perfil

**Where:** `frontend/src/components/profile/StudentProfile.tsx`, `ProfileHeader.tsx`, `DadosBasicosSection.tsx` (some como cartão; a edição de nome/cidade/UF passa para o cabeçalho), novo componente de índice em `components/profile/`, testes em `frontend/src/__tests__/components/profile/`. Documento: `approved-ux.md` (C2).

**What:**
- Cabeçalho único (foto, nome, cidade/UF, data de atualização) com um botão "Editar" que abre o mesmo diálogo hoje usado por "Dados básicos".
- Seções em 3 blocos com título: **Apresentação** (Sobre, Contato), **Formação e experiência** (Trajetória, Competências, Idiomas), **Para os recrutadores** (O que eu busco, Projetos, Currículo). Ordem final exata a confirmar com o mantenedor no relatório da fase (espelhar a do recrutador: sobre, competências, trajetória, projetos, idiomas, contato, o que eu busco, currículo).
- Índice da página (o item da seção chama-se "O que eu busco"): lateral e fixo no computador; chips no celular; marca a seção visível; navegável por teclado.
- Nenhuma função nova de dados.

**Checks:** eslint, typecheck, vitest das telas do perfil.

**Refs:**
- `frontend/src/components/profile/DisponibilidadeSection.tsx` (hoje a seção "O que eu busco") e `BuscaForm.tsx`: só ler, não mudar campos nem regras
- `frontend/src/components/profile/StudentProfile.tsx` (ordem das seções nas linhas 69-84), `ProfileHeader.tsx`, `DadosBasicosSection.tsx` (cartão linhas 22-58, formulário 66+), `SectionCard.tsx`, `FormDialog.tsx`, `sectionProps.ts`
- `frontend/src/components/common/SurfaceCard.tsx`, `Reveal.tsx`, `surfaceGradient.ts`; `components/layout/contentWidth.ts`
- Testes existentes: `frontend/src/__tests__/components/profile/` (conferir nomes ao abrir)
- `.agents/skills/talent-valley-frontend-ui/references/approved-ux.md` (seção Student)
- solved/: nenhum | Relatórios anteriores: nenhum

---

## Fase 2: Textos de ajuda e padrão de edição

**Where:** `SectionCard.tsx` (linha de ajuda por seção), cada `*Section.tsx` em `components/profile/`, `TrajetoriaSection.tsx`, novo aviso de privacidade (componente em `components/profile/` ou `common/`), testes.

**What:**
- Cada seção ganha uma linha curta dizendo para que serve e quem vê (ex.: "Os recrutadores filtram a busca por elas").
- Aviso discreto e permanente: "Perfil privado: só recrutadores aprovados veem."
- Estados vazios viram convite (título + 1 linha + verbo), como no exemplo visual.
- "O que eu busco" ganha só a linha de ajuda ("Diz o que você procura agora. Evita contato que não combina com você."). O convite de vazio e o aviso de situação de busca que já existem no `main` ficam como estão.
- Trajetória passa a editar no mesmo padrão das outras seções (sem mudar as funções de formação, experiência e certificado).
- Explicação curta de "Rio Pomba Valley", certificado e validação RPV dentro do formulário de formação.

**Checks:** eslint, typecheck, vitest das seções alteradas.

**Refs:**
- `frontend/src/components/profile/SectionCard.tsx`, `TrajetoriaSection.tsx` (linhas 52-145; formulário de formação a partir da 147), `CompetenciasSection.tsx`, `SobreSection.tsx`, `ContatoSection.tsx`, `IdiomasSection.tsx`, `DisponibilidadeSection.tsx`, `ProjetosSection.tsx`, `CurriculoSection.tsx`
- `frontend/src/components/common/EmptyState.tsx`
- `.agents/skills/talent-valley-domain-rules/references/mvp-rules.md` (RPV, perfil privado)
- Relatórios anteriores: `reports/phase-1.md`

---

## Fase 3: Minha conta

**Where:** `frontend/src/components/layout/navigation.tsx` (item "Minha conta" para ALUNO), `components/profile/StudentProfile.tsx` (remove Privacidade e Exclusão do perfil), `components/account/PrivacidadeSection.tsx`, `components/profile/ExclusaoSection.tsx`, `app/(app)/conta/` (página de conta do aluno; reaproveitar `conta/senha` e `conta/privacidade`), `components/layout/AppShell.tsx` (menu da conta, se precisar), testes.

**What:**
- Página "Minha conta" para o aluno com: alterar senha, privacidade/exportar dados/newsletter, excluir conta (mesmos componentes, sem mudar regra).
- Menu do aluno ganha o item; perfil deixa de ter esses dois blocos.
- Aviso de risco: exclusão de conta é LGPD; o comportamento (pedir senha, redirecionar ao login) **não muda**, só o lugar.
- Verificar se `/conta/privacidade` aceita ALUNO (`navigation.tsx` comenta "Recruiters only: students have the same section inside Meu perfil").

**Checks:** eslint, typecheck, vitest + bateria completa (mexe em menu compartilhado).

**Refs:**
- `frontend/src/components/layout/navigation.tsx` (`NAV_BY_ROLE`, `PRIVACY_HREF`, `CHANGE_PASSWORD_HREF`), `AppShell.tsx` (menu da conta ~linhas 170-210), `AppShell.test.tsx`
- `frontend/src/app/(app)/conta/senha/page.tsx`, `conta/privacidade/page.tsx` (a ler: a descobrir se filtra por papel)
- `frontend/src/components/account/PrivacidadeSection.tsx`, `ChangePasswordForm.tsx`; `components/profile/ExclusaoSection.tsx`
- Skills extra: `talent-valley-auth-security` apenas para confirmar que não se muda autorização
- Relatórios anteriores: `reports/phase-1.md`, `reports/phase-2.md`

---

## Fase 4: Início do aluno

**Where:** nova rota em `frontend/src/app/(app)/` (nome a definir com o mantenedor, sugestão `/inicio`) protegida para ALUNO, `frontend/src/lib/paths.ts` (destino do login do aluno, linha 16), `frontend/src/proxy.ts` (matcher, linha 23), `navigation.tsx` (item "Início"), componente da tela em `components/student/` ou `components/profile/`, testes; documentos: `approved-ux.md` e `mvp-rules.md` (C1).

**What:**
- Tela com: saudação, aviso de privacidade, "Próximos passos" em lista feito/pendente (calculada no navegador a partir do perfil já carregado; **sem %, sem barra, sem contador**), texto "Como os recrutadores encontram você", data da última atualização.
- Cada passo pendente leva à seção do perfil (âncora do índice da Fase 1).
- O passo "Informar sua disponibilidade" vira "Contar o que você busca". Conta como feito se qualquer campo da seção estiver preenchido (mesma regra de `buscaEstaVazia` em `lib/busca.ts`) e leva à âncora dessa seção.
- Login do aluno passa a ir para essa rota. Rota `/meu-perfil` continua.
- Atenção: mexe no roteamento pós-login; **não** mexe em autenticação, JWT, cookie ou CSRF. Se `paths.ts`/`proxy.ts` exigirem mais que trocar o destino, parar e perguntar ao mantenedor (AGENTS.md: autenticação é decisão dele).
- Atualizar `approved-ux.md` e `mvp-rules.md` (C1) e os testes que esperam login em `/meu-perfil`.

**Checks:** eslint, typecheck, vitest + bateria completa (rotas e menu compartilhados).

**Refs:**
- `frontend/src/lib/paths.ts` (linhas 4 e 16), `frontend/src/proxy.ts` (linha 23), `navigation.tsx`, `components/auth/ProtectedRoute.tsx`, `hooks/useStudentProfile.ts`
- `frontend/src/app/(app)/meu-perfil/page.tsx` (modelo de página protegida para ALUNO)
- `.agents/skills/talent-valley-frontend-ui/references/approved-ux.md`, `.agents/skills/talent-valley-domain-rules/references/mvp-rules.md` (linha 59 "No student dashboard")
- Plano `gamificacao` (R1, missão "Primeiros passos" lista feito/pendente) como modelo de texto/ícones
- Relatórios anteriores: fases 1 a 3

---

## Fase 5: Primeiro acesso

**Where:** `frontend/src/app/(auth)/ativar-conta/page.tsx` (tela "Conta ativada", linhas 128-139), tela de Início (Fase 4), testes em `__tests__/app/(auth)/`.

**What:**
- "Conta ativada" explica o que vem depois (entrar, completar o perfil, quem vê) em 2 ou 3 frases.
- No Início, enquanto o perfil estiver vazio, aparece um bloco de boas-vindas; some sozinho quando o perfil tiver conteúdo. **Não guarda nada** (nem no servidor nem no navegador).
- Texto da tela de aprovação de cadastro/solicitação: só revisar se estiver confuso (a descobrir; não alterar o fluxo `PEDIDO PÚBLICO → APROVAÇÃO → CRIAÇÃO → ATIVAÇÃO → LOGIN`).

**Checks:** eslint, typecheck, vitest das telas alteradas.

**Refs:**
- `frontend/src/app/(auth)/ativar-conta/page.tsx`, `components/auth/AuthResultPage.tsx`, `components/registration/StudentRegistrationWizard.tsx` (a ler só se houver texto a revisar)
- Tela de Início (Fase 4); relatórios anteriores: fases 1 a 4

---

## Fase 6: Polimento

**Where:** telas das fases 1 a 5, testes.

**What:** acessibilidade (teclado, leitor de tela, contraste AA, foco ao navegar pelo índice), celular, claro/escuro, "reduzir movimento"; textos pt-BR revisados; testes que faltarem; sincronizar `.agents/skills` e `.claude/skills` se algum documento de skill mudar (regra do AGENTS.md). Tema preto: conferir contraste e visibilidade das bordas (cartão `#131517` sobre fundo `#0A0B0C` tem diferença de só 1,08; texto secundário `#8F9A96` sobre o cartão tem 6,3, passa AA).

**Checks:** bateria completa do frontend (`npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`).

**Refs:** relatórios das fases 1 a 5; `frontend/src/components/common/`, `frontend/src/theme/theme.ts`.

---

## 5. Riscos

- **Login e rotas (Fase 4):** trocar o destino pós-login pode quebrar testes e o redirecionamento; manter `/meu-perfil` funcionando e não tocar em autenticação.
- **Exclusão de conta (Fase 3):** só muda de lugar; testar que o fluxo (senha, 400/423, redirecionamento) continua igual.
- **Colisão com a gamificação:** menu, destino do login e `/configuracoes`; combinar com o mantenedor antes de reabrir aquele plano.
- **Diagnóstico sem tela real:** conferir no navegador ao fim de cada fase.
- **Fora deste plano (observado em 2026-10-24, avisar o mantenedor):** `frontend/src/app/globals.css` ainda tem o fundo cinza antigo `#26292C` e `frontend/src/app/page.tsx` define a cor da barra do celular como `#0d1114`. Falta abrir o site para saber se isso causa um piscar de cor ao carregar. Não mexer aqui sem decisão dele.

## 6. Prompt para retomar

`Retomar o plano ux-aluno na fase 2`

Antes de iniciar: confirmar `git status` limpo e o estado do `main` (a Fase 1, PR 161, precisa estar mergeada em `main`; senão parar e perguntar); ler só este arquivo e os Refs da fase.

## 7. Decisões e fatos da Fase 1 (para as próximas fases)

- Índice lateral só a partir de `xl` (1536 px); abaixo disso, chips fixos sob a barra do topo. Decisão do mantenedor em 2026-10-24.
- Ordem das seções = a do plano, em 3 blocos (Apresentação; Formação e experiência; Para os recrutadores). Decisão do mantenedor.
- Componentes novos: `components/profile/ProfileIndex.tsx` (exporta `ProfileIndex` e `SECTION_SCROLL_MARGIN`) e `profileSections.ts` (`PROFILE_BLOCKS`, `profileSectionAnchor(id)`, tipo `ProfileSectionId`). Âncoras no formato `secao-<id>`; ids: sobre, contato, trajetoria, competencias, idiomas, busca, projetos, curriculo. A Fase 4 deve linkar para elas.
- `DadosBasicosSection` virou `DadosBasicosForm` (só o diálogo), aberto pelo botão "Editar nome e localização" do `ProfileHeader`.
- Privacidade e Exclusão continuam no fim de `StudentProfile.tsx` (saem na Fase 3).
- Não feito na Fase 1 (baixa prioridade, vindo da revisão): chip ativo não rola para dentro da faixa visível no celular; títulos dos blocos são `role="group"` e não headings; faixa de leitura do observer pode marcar a seção anterior em celular muito baixo com o banner de demonstração. Candidatos para a Fase 6.
- Conferência visual no navegador NÃO foi feita (sem conta de aluno/backend local). Fazer na Fase 2 ou 6 se houver ambiente.
