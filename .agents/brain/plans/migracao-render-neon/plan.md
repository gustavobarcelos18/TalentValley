# Plano: Migração Railway/SQLite → Render + Neon (PostgreSQL) + Cloudflare R2

status: em-andamento
data: 2026-10-16
total de fases: 8
plano completo (fonte): docs/planos/2026-10-16-migracao-render-neon-postgres.md

| Fase | Nome | Branch | Status | Commit |
|---|---|---|---|---|
| 1 | Fundação PostgreSQL | feat/postgres-phase-1-provider-baseline | mergeada em main | f650e55 |
| 2 | SQL, concorrência e testes | feat/postgres-phase-2-sql-concurrency | mergeada em main (PR #102) | ec00613 (merge b2ccbd3) |
| 3 | DataProtection no banco | feat/postgres-phase-3-dataprotection-db | mergeada em main (PR #103) | 2d3c0fa (merge d078b9c) |
| 4 | Storage R2 | feat/postgres-phase-4-r2-storage | mergeada em main (PR #104) | 3f2aa98 (merge d3a4aad) |
| 5 | Ferramenta de migração de dados | feat/postgres-phase-5-data-migrator | mergeada em main (commit b0927f5); revisão independente e suíte completa sem resultado registrado | b0927f5 |
| 6 | Provisionar Neon/R2/Render + DEPLOY_DEMO | docs/postgres-phase-6-render-deploy | pendente | |
| 7 | Cutover (operação) | — | pendente | |
| 8 | Documentação | docs/postgres-phase-8-documentation | pendente | |

ATENÇÃO: as fases 1, 2, 3 e 4 foram mergeadas direto em main (PR #102, #103 e #104), não na branch de integração feat/postgres-migration. Fases seguintes devem partir de origin/main.

Resume prompt: `Retomar o plano migracao-render-neon na fase <n>`

Refs: abrir a seção da fase em docs/planos/2026-10-16-migracao-render-neon-postgres.md (arquivos e linhas estão lá).

## Ambiente de teste (notas gerais)
- Sem Docker/psql na máquina de desenvolvimento: usar um Postgres 17 portátil (zonky, Maven Central). Detalhes de caminhos e portas ficam fora do repositório (dados locais da máquina).
- Usar um cluster com locale en-US (Unicode) para a suíte completa: com locale C o teste City_filter_ignores_case_and_surrounding_spaces_with_accents falha porque lower() não converte acentos; no CI (postgres:17) passa.
- CI usa Postgres com autenticação trust (sem senha), porque o Sonar bloqueia senhas fixas em YAML (S2068).
- Resultados de CI/Sonar sem gh: API pública do GitHub (check-runs do commit) e API do SonarCloud (issues do pull request); no Windows, curl --ssl-no-revoke.
- Testes: variável TALENT_VALLEY_TEST_POSTGRES com a connection string do Postgres local. Suíte completa ~15 min (rodar em background).
- gh CLI NÃO instalado: PR é aberto pelo usuário (link compare do GitHub).

## Pendências levantadas na Fase 1 (para a Fase 2)
- 56 testes falham por SQL/trigger SQLite (AdminDashboard 15, TalentDiscovery+Visibility 8, RecruiterPhase9 5, AdminRpvValidation 4, AdminDeletion/AdminProvisioning/StudentFile 11, StudentTrajectory 13).
- StudentTrajectoryTests.Optional_workload_migration_preserves_existing_formation_data_and_principal_index testa migration SQLite removida: remover e avisar o usuário (como foi feito com Phase_three_migration_backfills em AdminDatabaseTests).
- Erro de duplicidade em AdminAccountService/SolicitacaoCadastroService já traduzido para Npgsql na Fase 1.

## Pendências: remover referências à Railway (pedido do usuário em 2026-10-16: "não utilizaremos o railway")
- DEPLOY_DEMO.md e README.md:108 (Fase 6/8 já cobrem os docs).
- frontend/.env.example:5 (`YOUR-RAILWAY-SERVICE.up.railway.app` -> URL do Render).
- backend/TalentValley.Api/Program.cs:58-59: log TEMPORÁRIO "Vercel -> Railway" (B1 rollout). Remover ou adaptar; os saltos de proxy do Render são diferentes — REVALIDAR a resolução de IP do cliente/rate limit atrás de Vercel -> Render (Fase 6/7).
- backend/TalentValley.Api.Tests/ForwardedHeadersTests.cs: constante `RailwayEdge` (apenas nome; renomear para algo neutro, ex.: PlatformEdge).
- Nota: a Fase 7 assume a Railway congelada como rollback por 7 dias. Se a Railway não será mais usada, decidir com o usuário se o rollback continua existindo; main já tem as Fases 1-2 (só Postgres).
