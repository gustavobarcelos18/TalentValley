# Relatório Fase 3 - Chaves do DataProtection no banco (aprovada)
Branch: feat/postgres-phase-3-dataprotection-db | Commit: 2d3c0fa | PR #103 mergeado em main (merge d078b9c)

Mudou: pacote Microsoft.AspNetCore.DataProtection.EntityFrameworkCore **10.0.13** (desvio do plano, que dizia 10.0.12: a 10.0.12 traz System.Security.Cryptography.Xml/Pkcs transitivos vulneráveis e o CI reprovaria; aprovado pelo usuário), AppDbContext implementa IDataProtectionKeyContext, SecurityRegistration usa PersistKeysToDbContext quando não há DataProtection:KeysPath (removido o throw em Production), migration AddDataProtectionKeys (20261016161725), ApiFactory ganhou construtor que compartilha o banco de outra instância, testes ajustados em FoundationTests (Production sem KeysPath sobe e grava no banco; token de ativação válido em segunda instância; migrations aplicadas = 2).
Checks reais: build 0 erros/0 avisos; has-pending-model-changes limpo; suíte completa 422/422 (PG17 en-US); pacotes vulneráveis: nenhum.
CI no PR: todos os checks verdes; SonarCloud: 0 issues abertas, quality gate OK.
Desvios aceitos: S10 (chaves em texto no banco, registrar na DEPLOY_DEMO na Fase 6); S13 (links de ativação/reset antigos invalidam no cutover).
Revisão independente por subagente: NÃO executada (política da sessão); revisão própria do diff.
Não alterado (fica para Fases 6/8): DEPLOY_DEMO.md e README ainda citam DataProtection__KeysPath/volume.
