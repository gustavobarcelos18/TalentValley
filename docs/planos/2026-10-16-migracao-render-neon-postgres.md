# Plano de Implementação: Migração Railway/SQLite → Render + Neon (PostgreSQL) + Cloudflare R2

> **Total: 8 fases.** Fases 1–3 formam o núcleo da troca de banco e só ficam verdes no CI juntas (ver "Abordagem"). Fases 4–5 trocam o storage e criam a ferramenta de dados. Fases 6–7 são infraestrutura e virada. Fase 8 é documentação.

## Visão Geral

O backend (.NET 10, EF Core) hoje roda na Railway com SQLite em um volume `/data`, que guarda também os uploads dos alunos e as chaves do DataProtection. Vamos:

1. trocar o banco para **PostgreSQL no Neon** (plano Free);
2. trocar o host da API para **Render** (Docker, plano Free, sem disco persistente);
3. mover os **arquivos privados** (fotos, currículos, certificados) para o **Cloudflare R2**;
4. mover as **chaves do DataProtection** para o próprio Postgres;
5. **preservar os dados atuais** (decisão do maintainer) com uma ferramenta de migração SQLite → Postgres + volume → R2.

Decisões já tomadas pelo maintainer (confirmadas na conversa de 2026-10-16): o usuário é o maintainer; os dados da Railway **devem ser preservados**; storage em **Cloudflare R2**; testes rodam contra **Postgres real**.

## Análise do Estado Atual

### Descobertas Principais

- **Provider e inicialização SQLite**: [DatabaseRegistration.cs:8-54](../../backend/TalentValley.Api/Data/DatabaseRegistration.cs) (connection string SQLite, `PRAGMA journal_mode=WAL`) e [SqliteConnectionInterceptor.cs](../../backend/TalentValley.Api/Data/SqliteConnectionInterceptor.cs) (`synchronous=NORMAL` e funções `tv_normalize_name`/`tv_utc_timestamp` usadas só por migration). Chamado em [Program.cs:44](../../backend/TalentValley.Api/Program.cs) e [Program.cs:79](../../backend/TalentValley.Api/Program.cs).
- **Pacotes**: [TalentValley.Api.csproj](../../backend/TalentValley.Api/TalentValley.Api.csproj) usa `Microsoft.EntityFrameworkCore.Sqlite` e `SQLitePCLRaw.bundle_e_sqlite3`.
- **SQL bruto específico de SQLite**:
  - [FavoriteService.cs:22-28](../../backend/TalentValley.Api/Services/FavoriteService.cs): `INSERT OR IGNORE`, `"Ativo" = 1`.
  - [TalentDiscoveryService.cs:75,117-200](../../backend/TalentValley.Api/Services/TalentDiscoveryService.cs): `EF.Functions.Collate(..., "NOCASE")`, `COLLATE NOCASE`, `instr()`, `= 1`. Ordenação de `DateTimeOffset` feita à mão em SQL.
  - [AdminRpvValidationService.cs:36-45](../../backend/TalentValley.Api/Services/AdminRpvValidationService.cs) e [AdminDashboardService.cs:24-30](../../backend/TalentValley.Api/Services/AdminDashboardService.cs): SQL cru para contornar `DateTimeOffset` como texto; `= 1`.
  - [TalentVisibility.cs:17](../../backend/TalentValley.Api/Services/TalentVisibility.cs): `a."Ativo" = 1 AND u."EmailConfirmed" = 1` (booleanos viram `boolean` no Postgres).
  - [SolicitacaoCadastroService.cs:64-72,80](../../backend/TalentValley.Api/Services/SolicitacaoCadastroService.cs): `EF.Functions.Like` (no SQLite ignora maiúsculas; no Postgres não) e `ThenByDescending(x => x.CriadoEm.ToString())`.
- **Tratamento de erro de duplicidade** com `SqliteException 2067`: [AdminAccountService.cs:35-38](../../backend/TalentValley.Api/Services/AdminAccountService.cs) e [SolicitacaoCadastroService.cs:52-53](../../backend/TalentValley.Api/Services/SolicitacaoCadastroService.cs). No Postgres vira `PostgresException` com `SqlState = "23505"` e `ConstraintName`.
- **Concorrência apoiada no write-lock do SQLite** (comentários "SQLite's non-deferred transaction serializes…"): [AdminAlunoService.cs:33](../../backend/TalentValley.Api/Services/AdminAlunoService.cs) (alocação de slug), [FormacaoService.cs:19](../../backend/TalentValley.Api/Services/FormacaoService.cs) (formação principal), [ProjetoService.cs:18](../../backend/TalentValley.Api/Services/ProjetoService.cs) (ordem dos projetos). Há 18 usos de `BeginTransactionAsync` no total (lista na Fase 2). O Postgres usa READ COMMITTED e **não serializa** essas seções sozinho.
- **Filtros de índice parcial e check constraint em sintaxe SQLite**: [FormacaoConfiguration.cs:41](../../backend/TalentValley.Api/Data/Configurations/FormacaoConfiguration.cs) (`"Principal" = 1`), [SolicitacaoCadastroConfiguration.cs:35](../../backend/TalentValley.Api/Data/Configurations/SolicitacaoCadastroConfiguration.cs), [ProjetoConfiguration.cs:12](../../backend/TalentValley.Api/Data/Configurations/ProjetoConfiguration.cs). Hack de `DateTimeOffset→DateTime` em [AuditoriaConfiguration.cs:22-25](../../backend/TalentValley.Api/Data/Configurations/AuditoriaConfiguration.cs).
- **Migrations**: 7 migrations SQLite + snapshot em [Data/Migrations/](../../backend/TalentValley.Api/Data/Migrations), incluindo `Annotation("Sqlite:Autoincrement")` e `Sql(...)` com funções `tv_*` ([20260911122211_AdminAccountProvisioning.cs:25-38](../../backend/TalentValley.Api/Data/Migrations/20260911122211_AdminAccountProvisioning.cs)). Não rodam no Postgres.
- **DataProtection em disco**: [SecurityRegistration.cs:20-32](../../backend/TalentValley.Api/Authorization/SecurityRegistration.cs) exige `DataProtection:KeysPath` em Production.
- **Storage local**: [IFileStorage.cs](../../backend/TalentValley.Api/Storage/IFileStorage.cs) (4 métodos) implementado só por [LocalFileStorage.cs](../../backend/TalentValley.Api/Storage/LocalFileStorage.cs); registrado em [Program.cs:30](../../backend/TalentValley.Api/Program.cs). Chaves no banco são `{guid32}.{ext}` (regex em `LocalFileStorage.cs`) e a pasta por categoria é `fotos`/`curriculos`/`certificados`.
- **Testes**: [ApiFactory.cs:34-46](../../backend/TalentValley.Api.Tests/ApiFactory.cs) cria um `.db` SQLite temporário por factory e chama `Migrate()`. Usam SQLite diretamente: `AdminDatabaseTests` (in-memory e erro 2067), triggers `RAISE(ABORT)` em `AdminDeletionTests` (3x), `AdminProvisioningTests:228`, `AdminRpvValidationTests:286`, `StudentFileTests:236`, `StudentTrajectoryTests:608`; `FoundationTests:238` (`Openapi_and_sqlite_startup_preserve_phase_one`).
- **CI**: [ci.yml](../../.github/workflows/ci.yml) (job `backend` roda `dotnet test` e `ef migrations has-pending-model-changes`) e [sonar.yml](../../.github/workflows/sonar.yml) (também roda `dotnet test` com cobertura). **Os dois precisam de um Postgres.**
- **Regras do repositório que afetam o plano** ([AGENTS.md](../../AGENTS.md)): pacotes, `.github/`, deploy e regeneração de migration da `main` são decisões do maintainer (o usuário confirmou ser o maintainer); "SQLite with WAL" consta como stack aprovada e será atualizada na Fase 8; nunca commitar segredos/`.env`; nunca pular/desabilitar testes; um branch por fase partindo de `origin/main`; checks reais antes de dizer "passou".

### Restrições descobertas

- Render Free: **sem disco persistente**, dorme após 15 min sem tráfego (acorda em ~1 min), 750 h/mês.
- Neon Free: 0,5 GB de storage por projeto, 100 CU-h/mês, suspende após 5 min sem uso (acorda em ~0,5 s).
- Cloudflare R2 Free: 10 GB; a conta Cloudflare exige cartão cadastrado.
- A Railway hoje faz deploy da `main`. Quando esta migração entrar na `main`, a Railway quebraria (sem SQLite). É preciso **congelar a Railway num branch/tag legado antes do merge** (Fase 7), para o rollback continuar possível.

## Estado Final Desejado

- API roda no Render (Docker, Free) e fala com Postgres no Neon por TLS verificado.
- `dotnet build`, `dotnet test` (contra Postgres real) e `dotnet ef migrations has-pending-model-changes` passam localmente e no CI (`ci.yml` e `sonar.yml`).
- Existem 2 migrations Postgres (`InitialCreate` baseline e `AddDataProtectionKeys`); as 7 antigas de SQLite saem do repositório.
- Uploads vão para um bucket privado do R2; nenhum arquivo é gravado no disco do Render em Production.
- Chaves do DataProtection ficam na tabela `DataProtectionKeys`.
- Todos os dados da Railway (banco + arquivos) estão no Neon/R2, com contagens conferidas.
- Vercel aponta para a URL do Render; a Railway fica intacta por 7 dias como rollback.
- `AGENTS.md`, skills, `README.md` e `DEPLOY_DEMO.md` descrevem Postgres/Render/R2.

**Como verificar**: suíte completa verde no CI; `/health` responde no Render; login do admin funciona; upload/download de um certificado funciona; contagem de linhas por tabela e de objetos no bucket igual ao SQLite/volume de origem.

## O Que NÃO Estamos Fazendo

- Nenhuma mudança de funcionalidade, DTO, regra de negócio, autenticação, JWT, CSRF ou roles.
- Nenhuma mudança no frontend, exceto a variável `BACKEND_API_URL` na Vercel (configuração, não código).
- Sem PgBouncer / endpoint "pooled" do Neon: usamos o endpoint **direto** (as migrations do EF usam advisory lock de sessão, incompatível com pooler em modo transação).
- Sem `EnableRetryOnFailure` do EF (incompatível com as transações manuais do código atual).
- Sem papéis separados de banco (app × migrations): demo com um único papel (desvio registrado na seção de segurança).
- Sem criptografia adicional das chaves do DataProtection (certificado/KMS): ficam em texto no banco; desvio registrado.
- Sem antimalware nos uploads (lacuna que já existe hoje).
- Sem mudar o Dockerfile para usuário não-root (recomendação, fica para outro PR).
- Sem corrigir o log temporário `RateLimitDebug` em [Program.cs:58-64](../../backend/TalentValley.Api/Program.cs) nem habilitar `ForwardedHeaders` (continuam como hoje; ver Riscos).
- Sem plano pago em nenhum serviço.

## Abordagem de Implementação

**Branch de integração.** As fases 1–3 não ficam verdes isoladamente (a troca de provider quebra os testes SQLite até a Fase 2 terminar). Por isso:

1. Criar `feat/postgres-migration` a partir de `origin/main` (sem commits próprios, nunca vai para `main` até a Fase 5).
2. Cada fase tem seu branch `feat/postgres-phase-<n>-<slug>`, criado a partir de `feat/postgres-migration` atualizado, e seu PR **para `feat/postgres-migration`** (Sonar roda nesses PRs).
3. Ao fim da Fase 5, um PR final `feat/postgres-migration` → `main`. Só o maintainer faz o merge, e **somente depois** da pré-condição da Fase 7 (congelar a Railway).
4. No branch de integração o CI pode ficar vermelho entre as Fases 1 e 2; **nenhum teste é pulado, removido ou desabilitado** (regra "Never do"); a lista dos que ainda falham vai no relatório da Fase 1.

> Este fluxo é uma exceção justificada à regra "uma fase parte de `origin/main`" da skill `talent-valley-phased-delivery`. O usuário aprova a exceção ao aprovar este plano.

**Estratégia técnica**

- **Migrations: reset para baseline Postgres.** Apagar as 7 migrations SQLite e o snapshot e gerar um novo `InitialCreate`. Justificativa: a cadeia antiga contém SQL só-SQLite e o banco de produção será recriado no Postgres e populado pela ferramenta da Fase 5. Decisão do maintainer registrada aqui (AGENTS.md exige essa decisão para migration já na `main`; o protocolo "uma migration por PR" é mantido: Fase 1 gera `InitialCreate`, Fase 3 gera `AddDataProtectionKeys`).
- **SQL bruto continua SQL bruto parametrizado**, só traduzido para Postgres (menor mudança de comportamento). Exceção: onde o SQL cru existia só por causa de `DateTimeOffset`, volta para LINQ.
- **Concorrência**: substituir o write-lock do SQLite por `pg_advisory_xact_lock(hashtextextended(chave, 0))` no início das transações que dependem de serialização, com as constraints únicas existentes como rede de segurança.
- **Banco de teste**: variável `TALENT_VALLEY_TEST_POSTGRES` (connection string de servidor com permissão de `CREATE DATABASE`). Um *template database* com migrations aplicadas é criado uma vez por execução; cada `ApiFactory` faz `CREATE DATABASE ... TEMPLATE` (rápido) e `DROP DATABASE ... WITH (FORCE)` no `Dispose`. Sem pacote novo de testes (nada de Testcontainers): localmente `docker run postgres:17`, no CI um `services: postgres`.
- **Storage**: `LocalFileStorage` permanece para Development/testes; `R2FileStorage` (novo, usa `AWSSDK.S3`) é obrigatório em Production (falha rápida na inicialização, como já ocorre com `KeysPath`).
- **Neon**: endpoint direto, `SSL Mode=VerifyFull`, `Maximum Pool Size=10`, `Connection Idle Lifetime=30` (poda conexões ociosas antes do Neon suspender o compute em 5 min), `Timeout=30`.

## Requisitos de Segurança (dev-sec-ops)

Categoria: infraestrutura + dados + arquivos. Exposição: internet. Dado tratado: **PII de alunos e recrutadores** e documentos pessoais (certificados, currículos).

| # | Requisito | Fase | Cláusula |
|---|---|---|---|
| S1 | Connection string, credenciais R2 e chave JWT só em variáveis secretas do Render / user-secrets; nada em `appsettings*.json`, Dockerfile, workflow ou commit. `appsettings.Development.json` perde a connection string SQLite e **não** ganha senha. | 1, 4, 6 | [Norma 4.4.2.5.g] [Norma 4.4.2.1.d] [Norma 4.4.10.1.a] [ASVS V14.6] |
| S2 | Conexão com o Neon com `SSL Mode=VerifyFull`; proibido `Trust Server Certificate=true`. | 1, 6 | [Norma 4.4.2.3.a] [Norma 4.4.2.3.b] [Norma 4.4.2.1.f] [ASVS V9] |
| S3 | Todo SQL novo/traduzido continua parametrizado (interpolação do EF ou `DbParameter`); o `pg_advisory_xact_lock` usa parâmetro, nunca concatenação. | 2, 3 | [Norma 4.4.2.5.a] [Norma 4.4.2.5.b] [Norma 4.4.13.1.b] [ASVS V5] |
| S4 | Bucket R2 **privado**: sem domínio público, sem `r2.dev`, token de API restrito a esse bucket com permissão de leitura/escrita de objetos; entrega somente pelos endpoints autenticados que já existem (autorização por recurso, chaves por GUID, nunca caminho). | 4, 6 | [Norma 4.4.2.6.e] [Norma 4.4.2.6.k] [Norma 4.4.2.6.l] [Norma 4.4.2.4] [Norma 4.4.2.1.r] [ASVS V4] |
| S5 | Validação de upload (magic bytes, tamanho, extensão) permanece intacta em `FileUploadValidator`; `R2FileStorage` repete a validação de chave (regex) e de extensão do `LocalFileStorage` para impedir chaves arbitrárias. | 4 | [Norma 4.4.2.6.b] [Norma 4.4.2.6.c] [Norma 4.4.2.6.d] [Norma 4.4.2.6.k] |
| S6 | Logs e erros não imprimem connection string, credenciais R2 nem mensagens de exceção do Npgsql/AWSSDK para o cliente (handler genérico existente); verificar nos logs do Render. | 1, 4, 6 | [Norma 4.4.1.a] [Norma 4.4.1.b] [Norma 4.4.1.f] |
| S7 | Dependências novas (`Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore`, `AWSSDK.S3`) com versão fixa e `dotnet list package --vulnerable --include-transitive` limpo (já existe no CI). Aprovação do maintainer registrada neste plano. | 1, 3, 4 | [Norma 4.6.3.k] [Norma 4.4.2.7.k] [Norma 4.6.3.b] |
| S8 | Credenciais do Postgres de CI são descartáveis (service container efêmero) e imagem com tag fixa (`postgres:17`); marcar a linha com allowlist do secret-scanner se acusar. Nenhum segredo real em `.github/`. | 1 | [Norma 4.4.2.1.d] [Norma 4.4.2.4] |
| S9 | Migração de dados com PII: a ferramenta roda só na máquina do maintainer, cópias do SQLite e dos arquivos ficam fora do repositório (diretório temporário), são apagadas após o cutover validado; a ferramenta nunca imprime valores de campos pessoais, só contagens. | 5, 7 | [Norma 4.5] [Norma 4.3] [Norma 4.4.1.f] |
| S10 | Chaves do DataProtection no banco: o banco é privado (TLS + credencial secreta). | 3 | [Norma 4.4.5.e] — **desvio aceito 🟡**: chaves em texto no Postgres (sem KMS/certificado). Registrar como exceção. [Norma 4.11] |
| S11 | Papel único de banco com DDL (necessário para `ApplyMigrationsOnStartup=true` do demo). | 6 | [Norma 4.4.2.5.e] [Norma 4.4.2.5.m] — **desvio aceito 🟡**, SLA de médio risco [Norma 4.9.b]; reavaliar antes de produção real. |
| S12 | Headers de segurança, HSTS, cookie HttpOnly/Secure, CORS, rate limit, antiforgery: **sem alteração**; validar que continuam nos testes. Atrás do proxy do Render o rate limit por IP pode particionar pelo IP do proxy (ver Riscos). | 7 | [Norma 4.4.11.g] [Norma 4.4.5.b] [Norma 4.4.2.2.aa] [Norma 4.4.5.a] |
| S13 | Sessão e links já emitidos: JWT usa a mesma `Jwt__SigningKey`, então sessões continuam válidas; links de ativação/reset emitidos antes do cutover (protegidos por chaves antigas do DataProtection) deixam de valer e usuários precisam pedir novo link. | 7 | [Norma 4.4.11.h] [Norma 4.4.2.2.dd] |

> Itens 🟡 não bloqueiam a execução, mas devem constar no relatório das fases 3 e 6 e na `DEPLOY_DEMO.md`.

---

<!-- FASE: 1 -->
## Fase 1: Fundação PostgreSQL (provider, baseline, harness de testes, CI)

**Branch**: `feat/postgres-phase-1-provider-baseline` (base: `feat/postgres-migration`).

### Visão Geral

Trocar o provider do EF Core para Npgsql, gerar a migration baseline, adaptar as entity configurations e montar a infraestrutura de testes e CI com Postgres. Os services (SQL bruto/concorrência) ficam para a Fase 2.

### Mudanças Necessárias

#### 1. Pacotes (decisão do maintainer, requisito S7)
**Arquivo**: `backend/TalentValley.Api/TalentValley.Api.csproj`
**Mudanças**: remover `Microsoft.EntityFrameworkCore.Sqlite` e `SQLitePCLRaw.bundle_e_sqlite3`; adicionar `Npgsql.EntityFrameworkCore.PostgreSQL` na versão 10.x compatível com EF Core 10.0.12 (confirmar a versão exata com `dotnet add package` e fixá-la). O `dotnet-ef` em [dotnet-tools.json](../../dotnet-tools.json) já está em 10.0.12.

#### 2. Registro do banco
**Arquivo**: `backend/TalentValley.Api/Data/DatabaseRegistration.cs`
**Mudanças**: `UseNpgsql(connectionString)`; sem `AddInterceptors`; remover `InitializeSqliteAsync`. Manter a exigência de `ConnectionStrings:DefaultConnection`.

```csharp
services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));
```

**Remover**: `backend/TalentValley.Api/Data/SqliteConnectionInterceptor.cs` (as funções `tv_*` só serviam às migrations antigas).
**Arquivo**: `backend/TalentValley.Api/Program.cs` — remover a chamada `DatabaseRegistration.InitializeSqliteAsync(database)` (linha 79).

#### 3. Configurações de entidade
- `FormacaoConfiguration.cs:41`: `HasFilter("\"Principal\" = TRUE")`.
- `SolicitacaoCadastroConfiguration.cs:34-35`: ajustar o comentário (índice parcial único no Postgres); o filtro `"Status" = 'PENDENTE'` já é válido.
- `ProjetoConfiguration.cs:12`: `"Ordem" IN (1, 2)` já é válido; manter.
- `AuditoriaConfiguration.cs:22-25`: remover o `HasConversion` de `CriadoEm` (o Npgsql mapeia `DateTimeOffset` UTC para `timestamptz`) e o comentário SQLite.
- Revisar `HasMaxLength`: no SQLite era ignorado; no Postgres vira `varchar(n)` (a Fase 5 detecta dados maiores que o limite).

#### 4. Appsettings
**Arquivo**: `backend/TalentValley.Api/appsettings.Development.json` — remover `ConnectionStrings` (sem senha no repositório, S1). Desenvolvedor define via user-secrets (`UserSecretsId` já existe no csproj):

```
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=talent_valley_dev;Username=postgres;Password=<SUA-SENHA-LOCAL>" --project backend/TalentValley.Api
docker run --name tv-pg -e POSTGRES_PASSWORD=<SUA-SENHA-LOCAL> -p 5432:5432 -d postgres:17
```

#### 5. Migration baseline
**Remover** os 14 arquivos de `Data/Migrations/` (7 migrations + Designers) e `AppDbContextModelSnapshot.cs`; depois, com `ASPNETCORE_ENVIRONMENT=Development` e a connection string em variável de ambiente:

```
dotnet tool restore
dotnet ef migrations add InitialCreate --project backend/TalentValley.Api --output-dir Data/Migrations
dotnet ef migrations has-pending-model-changes --project backend/TalentValley.Api
```

Conferir no SQL gerado: `uuid`, `boolean`, `timestamp with time zone`, `date`, identity (`IdentityByDefaultColumn`) nas chaves inteiras (`Competencias`, `Idiomas` etc.), índices parciais e o check de `Projetos.Ordem`.

#### 6. Harness de testes
**Arquivo**: `backend/TalentValley.Api.Tests/ApiFactory.cs` (e um helper novo `PostgresTestDatabase.cs` no projeto de testes).
**Mudanças**:
- Ler `TALENT_VALLEY_TEST_POSTGRES`; se ausente, falhar com mensagem clara em pt-BR dizendo como subir o Postgres (não pular o teste).
- `static Lazy` cria uma vez por execução o banco `tv_template_<guid>` e aplica `Migrate()`.
- Cada `ApiFactory`: `CREATE DATABASE tv_test_<guid> TEMPLATE tv_template_<guid>`; `Dispose` faz `NpgsqlConnection.ClearAllPools()` + `DROP DATABASE ... WITH (FORCE)`.
- Remover `UseSqlite`, `SqliteConnectionInterceptor` e `Pooling=False/Foreign Keys=True` da connection string; usar `Maximum Pool Size=5`.
- Limpeza de bancos órfãos `tv_test_*`/`tv_template_*` no início da execução local.
- Renomear `FoundationTests.Openapi_and_sqlite_startup_preserve_phase_one` para um nome sem "sqlite" mantendo a verificação de OpenAPI e inicialização.

#### 7. CI (`.github/`, decisão do maintainer)
**Arquivos**: `.github/workflows/ci.yml` (job `backend`) e `.github/workflows/sonar.yml`.
**Mudanças**: adicionar `services: postgres` (`image: postgres:17`, credenciais descartáveis, health-check `pg_isready`) e `env: TALENT_VALLEY_TEST_POSTGRES: Host=localhost;Username=postgres;Password=<descartável>`. No passo "Verificar migrações pendentes" adicionar `ConnectionStrings__DefaultConnection` (valor fictício; o comando não conecta ao banco). O job `docker` não muda.

> Parâmetro: `max_connections` padrão do Postgres é 100; com `Maximum Pool Size=5` e ~4 classes de teste em paralelo não deve estourar. Se estourar, reduzir paralelismo, não aumentar o pool.

### Critérios de Sucesso

#### Verificação Automatizada:
- [x] `dotnet build backend/TalentValley.slnx` compila sem warnings novos.
- [x] `dotnet ef migrations has-pending-model-changes --project backend/TalentValley.Api` informa nenhuma mudança pendente.
- [x] `dotnet ef database update` aplica `InitialCreate` em um Postgres local vazio sem erro.
- [x] `dotnet test backend/TalentValley.slnx --filter "FullyQualifiedName~FoundationTests|FullyQualifiedName~AuthTests|FullyQualifiedName~SecurityHeadersTests|FullyQualifiedName~AntiforgeryTests|FullyQualifiedName~SecurityStampTests"` passa (classes que não dependem do SQL bruto da Fase 2).
- [x] `dotnet list backend/TalentValley.slnx package --vulnerable --include-transitive` sem vulneráveis.
- [x] `git grep -i sqlite -- backend` não encontra referências restantes **em código de produção desta fase** (restam as da Fase 2 e testes, listadas no relatório).
- [x] Nenhum arquivo com senha/segredo real no diff (S1, S8).

#### Verificação Manual (APENAS SE APLICÁVEL):
- [ ] Abrir o `InitialCreate.cs` gerado e confirmar visualmente os tipos citados no item 5 (tipos e índices parciais não são cobertos por teste automatizado até a Fase 2).

#### ⛔ Pausa Obrigatória
- [ ] Aguardar confirmação explícita do usuário ou orquestrador antes de iniciar a próxima fase. **Não avançar sem receber um comando explícito. Esta pausa só pode ser omitida se o usuário ou orquestrador tiver solicitado explicitamente execução contínua sem pausas (ex.: "execute todas as fases sem parar", "modo contínuo", "sem pausas"). Ausência de instrução contrária NÃO é permissão para avançar.**

---

<!-- FASE: 2 -->
## Fase 2: SQL, concorrência e suíte de testes completa no Postgres

**Branch**: `feat/postgres-phase-2-sql-concurrency` (base: `feat/postgres-migration` com a Fase 1 integrada).

### Visão Geral

Traduzir o SQL bruto, o tratamento de erros de duplicidade e as seções de concorrência para Postgres, e portar todos os testes que dependem de SQLite. Ao final, a suíte completa passa.

### Mudanças Necessárias

#### 1. Booleanos e SQL bruto
- `TalentVisibility.cs:17`: `a."Ativo" = TRUE AND u."EmailConfirmed" = TRUE` (ou apenas `a."Ativo" AND u."EmailConfirmed"`).
- `FavoriteService.cs:22-28`: `INSERT OR IGNORE` → `INSERT ... ON CONFLICT ("RecrutadorId", "AlunoId") DO NOTHING`; `= 1` → `= TRUE`.
- `AdminDashboardService.cs:24-30`: voltar para LINQ (`CountAsync(x => x.Ativo && x.AtualizadoEm >= cutoff)`), pois `DateTimeOffset` é `timestamptz`; remover o comentário SQLite.
- `AdminRpvValidationService.cs:36-45`: voltar para LINQ com `OrderBy(AtualizadoEm).ThenBy(NomeBusca).ThenBy(Id).Skip().Take()`, ou manter SQL traduzido (`LIMIT/OFFSET` já é válido; `= 1` → `= TRUE`). Escolher o que mantém o código mais simples e testes passando.
- `TalentDiscoveryService.cs`:
  - `ApplyFilters` (linha 75): trocar `EF.Functions.Collate(x.Cidade.Trim(), "NOCASE") == request.City` por comparação case-insensitive traduzível (`x.Cidade.Trim().ToLower() == request.City.ToLower()`).
  - `LoadOrderedPageIdsAsync` (linhas 117-200): `instr(col, @p) > 0` → `strpos(col, @p) > 0`; `trim(a."Cidade") COLLATE NOCASE = @p` → `lower(btrim(a."Cidade")) = lower(@p)`; `"EhRioPombaValley" = 1` → `= TRUE`; conferir os parâmetros (`NpgsqlParameter` via `DbCommand.CreateParameter`, nomes `@p0..`) e o `ORDER BY a."AtualizadoEm"`.
- `SolicitacaoCadastroService.cs`: `EF.Functions.Like` → `EF.Functions.ILike` (paridade com o `LIKE` do SQLite); `ThenByDescending(x => x.CriadoEm.ToString())` → `ThenByDescending(x => x.CriadoEm)`; a limpeza `CleanUpExpiredRejectedAsync` pode filtrar `AnalisadoEm < cutoff` direto no banco (opcional, só se simplificar).

> Atenção (risco R3): `lower()` no Postgres depende da collation do banco. Incluir teste com cidade acentuada ("São Paulo" × "SÃO PAULO"). Se falhar, usar collation ICU não determinística ou `citext` e registrar no relatório.

#### 2. Erros de duplicidade
- `AdminAccountService.cs:35-38` e `SolicitacaoCadastroService.cs:52-53`: capturar `DbUpdateException` com `InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg` e `pg.ConstraintName` igual ao índice correspondente (`EmailIndex`/`UserNameIndex` do Identity e o índice de `SolicitacoesCadastro.EmailNormalizado`). Conferir os nomes reais no `InitialCreate`.

#### 3. Concorrência (advisory locks)
**Arquivo novo**: `backend/TalentValley.Api/Data/AdvisoryLock.cs` — extensão `Task AcquireTransactionLockAsync(this DatabaseFacade database, string key, CancellationToken ct = default)` que executa, dentro da transação aberta:

```csharp
await database.ExecuteSqlInterpolatedAsync(
    $"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", ct);
```

Revisar os 18 usos de `BeginTransactionAsync` e classificar (a classificação final vai no relatório):

| Local | Serializa o quê | Lock |
|---|---|---|
| `AdminAlunoService.cs:34` (`CreateAsync`) | alocação de slug | `"aluno-slug"` |
| `SolicitacaoCadastroService.cs:102` (aprovação) | cria conta + slug | `"aluno-slug"` se criar aluno |
| `FormacaoService.cs:20,35,61` | formação principal por aluno | `$"formacao:{alunoId}"` |
| `ProjetoService.cs:19,43,79` | contagem/ordem de projetos | `$"projeto:{alunoId}"` |
| `AdminAlunoService.cs:70,86`, `AdminRecrutadorService.cs:24,70,86`, `AdminRpvValidationService.cs:201`, `AlunoService.cs:31`, `RecrutadorDeletionService.cs:54`, `AccountTokenService.cs:54`, `IdentityBootstrap.cs:58` | atomicidade (conta + auditoria + arquivos) | só transação; verificar se há leitura-depois-escrita que precise de lock |

Trocar os comentários "SQLite's non-deferred transaction…" por comentários descrevendo o lock.

#### 4. Testes
- `AdminDatabaseTests.cs`: reescrever para Postgres (sem `:memory:`, sem `SqliteException`); asserir `PostgresException` `23505`.
- Helper de teste para "falha injetada": função plpgsql `tv_test_fail()` + `CREATE TRIGGER ... BEFORE DELETE/INSERT/UPDATE ... FOR EACH ROW EXECUTE FUNCTION tv_test_fail()` e `DROP TRIGGER` ao final, substituindo os `CREATE TRIGGER ... RAISE(ABORT)` em `AdminDeletionTests` (3x), `AdminProvisioningTests:228`, `AdminRpvValidationTests:286`, `StudentFileTests:236`, `StudentTrajectoryTests:608`. Tabelas e colunas entre aspas duplas (`"AspNetUsers"`, `"Auditorias"`, `"Alunos"`).
- Novos testes de concorrência (requisições paralelas): dois `CreateAsync` de aluno com o mesmo nome geram slugs distintos; duas formações `Principal` simultâneas deixam exatamente uma principal; dois projetos simultâneos respeitam o limite de 2 e ordens 1/2.
- Teste de busca por cidade com acento/caixa diferente; teste de busca em `SolicitacaoCadastro` insensível a maiúsculas.

### Critérios de Sucesso

#### Verificação Automatizada:
- [ ] `dotnet build backend/TalentValley.slnx` sem warnings novos.
- [ ] `dotnet test backend/TalentValley.slnx` — **suíte completa verde** contra Postgres 17 local (nenhum teste pulado/removido; a contagem de testes não diminui em relação à `main`, informar números reais no relatório).
- [ ] `git grep -n -i "sqlite" -- backend` retorna só menções intencionais (ex.: `"SQLite"` como item do catálogo de competências em `CatalogSeedService.cs:29`).
- [ ] `dotnet ef migrations has-pending-model-changes` sem pendências.
- [ ] Nenhum SQL novo por concatenação de string com entrada de usuário (S3), revisado no diff.

#### ⛔ Pausa Obrigatória
- [ ] Aguardar confirmação explícita do usuário ou orquestrador antes de iniciar a próxima fase. **Não avançar sem receber um comando explícito. Esta pausa só pode ser omitida se o usuário ou orquestrador tiver solicitado explicitamente execução contínua sem pausas (ex.: "execute todas as fases sem parar", "modo contínuo", "sem pausas"). Ausência de instrução contrária NÃO é permissão para avançar.**

---

<!-- FASE: 3 -->
## Fase 3: Chaves do DataProtection no banco

**Branch**: `feat/postgres-phase-3-dataprotection-db`.

### Visão Geral

Sem disco persistente no Render, as chaves que protegem os tokens de ativação/reset de senha precisam sair do filesystem. Persistir no Postgres.

### Mudanças Necessárias

#### 1. Pacote (S7)
`backend/TalentValley.Api/TalentValley.Api.csproj`: adicionar `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` (10.0.12, mesma versão dos demais pacotes ASP.NET).

#### 2. DbContext e registro
- `Data/AppDbContext.cs`: implementar `IDataProtectionKeyContext` e expor `DbSet<DataProtectionKey> DataProtectionKeys`.
- `Authorization/SecurityRegistration.cs:20-32`: se `DataProtection:KeysPath` estiver definido, manter `PersistKeysToFileSystem` (Development e testes); caso contrário, `PersistKeysToDbContext<AppDbContext>()` em **todos** os ambientes, inclusive Production. Remover o `throw` que exigia `KeysPath` em Production; o aviso de que reiniciar invalidava links deixa de valer.
- Nova migration `AddDataProtectionKeys` (`dotnet ef migrations add AddDataProtectionKeys ...` + `has-pending-model-changes`).
- Ordem de inicialização: confirmar que `MigrateAsync` (Program.cs:77) roda antes de qualquer uso das chaves (geração de token) na inicialização.

#### 3. Testes
Ajustar [FoundationTests.cs](../../backend/TalentValley.Api.Tests/FoundationTests.cs) (usa `KeysPathSetting` na linha 20 e há teste de Production sem `KeysPath`): trocar a expectativa de "falha sem KeysPath" por "sobe e persiste chave no banco"; novo teste: um token de ativação gerado por uma instância é válido numa segunda instância que usa o mesmo banco (simula reinício do Render).

### Critérios de Sucesso

#### Verificação Automatizada:
- [ ] `dotnet build` e `dotnet test backend/TalentValley.slnx` verdes.
- [ ] `dotnet ef migrations has-pending-model-changes` sem pendências.
- [ ] Teste de dois hosts compartilhando o banco valida o mesmo token.
- [ ] `dotnet list ... package --vulnerable --include-transitive` limpo.

#### ⛔ Pausa Obrigatória
- [ ] Aguardar confirmação explícita do usuário ou orquestrador antes de iniciar a próxima fase. **Não avançar sem receber um comando explícito. Esta pausa só pode ser omitida se o usuário ou orquestrador tiver solicitado explicitamente execução contínua sem pausas (ex.: "execute todas as fases sem parar", "modo contínuo", "sem pausas"). Ausência de instrução contrária NÃO é permissão para avançar.**

---

<!-- FASE: 4 -->
## Fase 4: Storage de arquivos no Cloudflare R2

**Branch**: `feat/postgres-phase-4-r2-storage`.

### Visão Geral

Implementar `IFileStorage` sobre o R2 (API S3), mantendo o contrato, as chaves e os endpoints protegidos existentes.

### Mudanças Necessárias

#### 1. Pacote (S7)
`TalentValley.Api.csproj`: `AWSSDK.S3` (versão estável fixa; checar vulnerabilidades).

#### 2. Implementação
**Arquivos novos**: `Storage/R2FileStorage.cs` e `Storage/R2Options.cs`.
- Configuração (`Storage:Provider`, `Storage:R2:AccountId`, `BucketName`, `AccessKeyId`, `SecretAccessKey`): `Provider=R2` usa R2; ausente/`Local` usa `LocalFileStorage`.
- Cliente S3 com `ServiceURL = https://<AccountId>.r2.cloudflarestorage.com`, `ForcePathStyle = true`, região `auto`, e `RequestChecksumCalculation`/`ResponseChecksumValidation` = `WHEN_REQUIRED` (AWSSDK recente envia checksums que o R2 pode rejeitar; confirmar no teste manual e ajustar).
- Chave do objeto = `{pasta-da-categoria}/{storageKey}` com as mesmas pastas (`fotos`, `curriculos`, `certificados`) do `LocalFileStorage`; valida `storageKey` com o mesmo regex `^[a-f0-9]{32}\.(jpg|png|webp|pdf)$` e a mesma regra de extensão por categoria (S5). Reaproveitar essa lógica sem duplicar (extrair para um helper compartilhado no namespace `Storage`, pois o `LocalFileStorage` também a usa).
- `StoreAsync` gera `Guid.NewGuid():N` + extensão; `OpenReadAsync` devolve o stream do `GetObject` (quando não existir, `null`); `ExistsAsync` via `GetObjectMetadata`; `DeleteAsync` idempotente.
- `Program.cs:30`: registrar `R2FileStorage` quando `Provider=R2`; em Production sem `Provider=R2`, falhar na inicialização com mensagem clara (mesmo padrão do antigo `KeysPath`).

#### 3. Testes
- Testes unitários da validação de chave/extensão/montagem do objeto do `R2FileStorage` (funções puras), cobrindo path traversal e extensões inválidas.
- Testes existentes de arquivos ([StudentFileTests.cs](../../backend/TalentValley.Api.Tests/StudentFileTests.cs), `LocalFileStorageTests`) continuam usando `LocalFileStorage`.
- Verificar que Production sem `Storage:Provider=R2` falha ao subir.

### Critérios de Sucesso

#### Verificação Automatizada:
- [ ] `dotnet build` e `dotnet test backend/TalentValley.slnx` verdes.
- [ ] `dotnet list ... package --vulnerable --include-transitive` limpo.
- [ ] Teste: Production sem R2 configurado falha na inicialização; Development sem `Provider` usa `LocalFileStorage`.

#### Verificação Manual (APENAS SE APLICÁVEL):
> Integração externa (R2) não é coberta por teste automático. Usar um bucket de **teste** privado, nunca o de produção.
- [ ] Com credenciais de um bucket de teste (variáveis de ambiente locais, nada commitado), subir a API local com `Storage__Provider=R2`, enviar foto, currículo e certificado por um aluno, baixá-los pelos endpoints autenticados e confirmar que um acesso sem login ou de outro aluno/recrutador sem permissão é negado.
- [ ] Confirmar no painel do R2 que o bucket não tem acesso público nem domínio público e que o token é restrito ao bucket (S4).

#### ⛔ Pausa Obrigatória
- [ ] Aguardar confirmação explícita do usuário ou orquestrador antes de iniciar a próxima fase. **Não avançar sem receber um comando explícito. Esta pausa só pode ser omitida se o usuário ou orquestrador tiver solicitado explicitamente execução contínua sem pausas (ex.: "execute todas as fases sem parar", "modo contínuo", "sem pausas"). Ausência de instrução contrária NÃO é permissão para avançar.**

---

<!-- FASE: 5 -->
## Fase 5: Ferramenta de migração de dados (SQLite → Postgres, volume → R2)

**Branch**: `feat/postgres-phase-5-data-migrator`. Ao final desta fase, abrir o PR `feat/postgres-migration` → `main` **mas não mergear** (o merge é pré-condição da Fase 7, após congelar a Railway).

### Visão Geral

Programa de linha de comando de uso único que copia o banco SQLite da Railway para o Postgres do Neon e os arquivos de `/data/storage` para o bucket R2, com conferência de contagens. Vive em `backend/tools/SqliteToPostgresMigrator/`, **fora** de `backend/TalentValley.slnx` (não entra no CI/Sonar) e é removido num PR posterior, depois do cutover validado.

### Mudanças Necessárias

#### 1. Projeto da ferramenta
Console .NET 10 com `Microsoft.Data.Sqlite` (leitura) e `Npgsql` (escrita) e `AWSSDK.S3` (arquivos); pacotes só deste projeto (S7). Argumentos por variável de ambiente/linha de comando (`--sqlite <arquivo>`, `--storage-dir <pasta>`; `TARGET_POSTGRES`, `R2_*`), **nunca** por arquivo versionado.

#### 2. Regras da cópia
- Pré-condições: o alvo foi criado com `dotnet ef database update` (sem rodar a API, logo sem seed); **todas as tabelas de dados estão vazias** (senão aborta). Mostra o tamanho do SQLite e aborta se o total estimado passar de ~400 MB (limite Free do Neon é 0,5 GB).
- Ordem por dependência de FK: `AspNetUsers`, `AspNetRoles`, `AspNetUserRoles`/claims/logins/tokens do Identity, catálogos (`Competencias`, `Idiomas`), `Alunos`, `Recrutadores`, `Formacoes`, `Experiencias`, `Projetos`, tabelas de junção, `Favoritos`, `SolicitacoesCadastro`, `Auditorias`, tabelas de disponibilidade/modalidade. Lista final obtida do `InitialCreate`.
- Conversões: GUID texto→`uuid`; `0/1`→`boolean`; `DateTimeOffset` texto→`timestamptz` (normalizar para offset 0); `DateOnly`→`date`; enums permanecem texto; senhas do Identity (hashes) copiadas sem alteração.
- **Preservar IDs inteiros dos catálogos** (`AlunoCompetencias` os referencia) inserindo valores explícitos e depois ajustando as sequências com `setval(pg_get_serial_sequence(...), max(id))`.
- Detectar valores acima do `HasMaxLength` da coluna destino e abortar listando só tabela/coluna/contagem (S9: nunca imprimir PII).
- Tudo numa única transação Postgres (ou por tabela com `COPY`/`INSERT` em lote e rollback total se falhar).
- Arquivos: copiar `/data/storage/{fotos,curriculos,certificados}/*` para o bucket com as mesmas chaves (`pasta/arquivo`); conferir que toda `FotoStorageKey`/`CurriculoStorageKey`/`CertificadoStorageKey` referenciada no banco existe no bucket e relatar órfãos em ambos os sentidos.
- Relatório final: contagem por tabela (origem × destino) e de objetos, sem dados pessoais.
- Chaves antigas do DataProtection **não** são migradas (S13).

#### 3. Testes da ferramenta
Teste de ensaio automatizado com um SQLite de fixture gerado a partir da migration antiga (commit anterior) com dados sintéticos mínimos e um Postgres local: valida conversões, preservação de IDs, sequências e a recusa quando o alvo não está vazio. Fixture só com dados fictícios.

### Critérios de Sucesso

#### Verificação Automatizada:
- [ ] `dotnet build backend/tools/SqliteToPostgresMigrator` compila.
- [ ] Teste de ensaio com dados sintéticos passa: contagens iguais, IDs de catálogo preservados, `INSERT` posterior em catálogo usa o próximo ID correto.
- [ ] `dotnet build backend/TalentValley.slnx` e `dotnet test backend/TalentValley.slnx` continuam verdes (a ferramenta não entra na solution).
- [ ] Diff sem dados reais, sem segredos, sem arquivos `.db` (S1, S9); `.gitignore` cobre `*.db`.

#### Verificação Manual (APENAS SE APLICÁVEL):
- [ ] Ensaio com uma **cópia real** do banco da Railway restaurada em um Postgres local e um bucket de teste: conferir o relatório de contagens, fazer login como admin e abrir um perfil de aluno com certificado. Apagar a cópia local ao terminar (S9).

#### ⛔ Pausa Obrigatória
- [ ] Aguardar confirmação explícita do usuário ou orquestrador antes de iniciar a próxima fase. **Não avançar sem receber um comando explícito. Esta pausa só pode ser omitida se o usuário ou orquestrador tiver solicitado explicitamente execução contínua sem pausas (ex.: "execute todas as fases sem parar", "modo contínuo", "sem pausas"). Ausência de instrução contrária NÃO é permissão para avançar.**

---

<!-- FASE: 6 -->
## Fase 6: Provisionar Neon, R2 e Render; atualizar a configuração de deploy

**Branch**: `docs/postgres-phase-6-render-deploy` (altera `DEPLOY_DEMO.md`, decisão de deploy do maintainer). A parte de painel (Neon, R2, Render) é operação manual guiada.

### Visão Geral

Criar a infraestrutura nova sem tirar a Railway do ar e validar a API num ambiente de ensaio.

### Mudanças Necessárias

#### 1. Neon (painel)
- Projeto único, região AWS `us-east-2` (par do Render Ohio). Banco `talent_valley`. Branch `main` (produção) e uma branch filha `rehearsal` para o ensaio.
- Copiar a connection string do endpoint **direto** (sem `-pooler`) e montar:
  `Host=<host>;Database=<db>;Username=<papel>;Password=<SEGREDO>;SSL Mode=VerifyFull;Maximum Pool Size=10;Connection Idle Lifetime=30;Timeout=30;Command Timeout=30`
- Confirmar `SSL Mode=VerifyFull` funcionando com os certificados da imagem `mcr.microsoft.com/dotnet/aspnet:10.0` (S2). Se falhar, **não** usar `Trust Server Certificate`; instalar a CA correta na imagem e informar o maintainer.

#### 2. Cloudflare R2 (painel)
Criar bucket **privado** (ex.: `talent-valley-files`) e outro `talent-valley-files-rehearsal`; criar token de API restrito a cada bucket (Object Read & Write). Sem domínio público nem `r2.dev` (S4).

#### 3. Render (painel)
- Web Service a partir do repositório, runtime **Docker**, plano **Free**, Root Directory `backend/TalentValley.Api`, Health Check Path `/health`, região Ohio. Ensaio: branch `feat/postgres-migration`.
- Variáveis (segredos marcados como secret/`sync: false`):

```text
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=<SEGREDO: connection string do Neon>
Storage__Provider=R2
Storage__R2__AccountId=<ID DA CONTA CLOUDFLARE>
Storage__R2__BucketName=<BUCKET>
Storage__R2__AccessKeyId=<SEGREDO>
Storage__R2__SecretAccessKey=<SEGREDO>
Deployment__ApplyMigrationsOnStartup=true
Deployment__ForwardedHeaders__Enabled=false
Jwt__Issuer=TalentValley.Api
Jwt__Audience=TalentValley.Frontend
Jwt__SigningKey=<MESMO VALOR ATUAL DA RAILWAY>
Jwt__ExpirationHours=8
Frontend__BaseUrl=<ORIGEM EXATA DA VERCEL>
AllowedHosts=<servico>.onrender.com
BootstrapAdmin__Enabled=true
BootstrapAdmin__Email=<...>
BootstrapAdmin__Name=<...>
BootstrapAdmin__Password=<SEGREDO>
Brevo__ApiKey=<SEGREDO>
Brevo__SenderAddress=<...>
Brevo__SenderName=<...>
```

Removidas em relação à Railway: `Storage__RootPath`, `DataProtection__KeysPath`. Não definir `PORT` (o Render injeta e o `Dockerfile` já usa `${PORT}`).
- Ensaio: `ConnectionStrings__DefaultConnection` apontando para a branch `rehearsal` do Neon e bucket `-rehearsal`; Vercel **não** é alterada nesta fase.
- Monitor de uptime gratuito (ex.: UptimeRobot) chamando `GET /health` a cada 5–10 min para reduzir o *cold start* (o `/health` não toca o banco, então o Neon pode dormir; é intencional).

#### 4. Documentação de deploy
**Arquivo**: `DEPLOY_DEMO.md`. Reescrever a seção "Railway backend" para Render + Neon + R2 (passos acima, sem valores reais), manter a seção da Vercel (trocando "Railway" por "Render" onde aplicável), a sequência de primeiro deploy e as notas de e-mail (Brevo). Registrar os desvios 🟡 S10 e S11.

### Critérios de Sucesso

#### Verificação Automatizada:
- [ ] `git grep -n -i "railway" -- DEPLOY_DEMO.md` só encontra menções intencionais (ex.: nota de rollback).
- [ ] `git diff` sem segredos nem valores reais nas variáveis (S1).
- [ ] `dotnet build backend/TalentValley.slnx` e `dotnet test backend/TalentValley.slnx` verdes.

#### Verificação Manual (APENAS SE APLICÁVEL):
- [ ] Deploy de ensaio no Render conclui; `GET https://<servico>.onrender.com/health` retorna `{"status":"ok"}`.
- [ ] Logs do Render mostram migrations aplicadas na branch `rehearsal` do Neon, sem imprimir connection string ou credenciais (S6).
- [ ] Login com o admin do bootstrap funciona no ensaio e um upload/download de certificado passa pelo R2 de ensaio.
- [ ] Medir e anotar o tempo do *cold start* e da primeira requisição ao Neon acordando.

#### ⛔ Pausa Obrigatória
- [ ] Aguardar confirmação explícita do usuário ou orquestrador antes de iniciar a próxima fase. **Não avançar sem receber um comando explícito. Esta pausa só pode ser omitida se o usuário ou orquestrador tiver solicitado explicitamente execução contínua sem pausas (ex.: "execute todas as fases sem parar", "modo contínuo", "sem pausas"). Ausência de instrução contrária NÃO é permissão para avançar.**

---

<!-- FASE: 7 -->
## Fase 7: Virada (cutover), validação e rollback

**Operação, sem branch de código.** Executar em horário de pouco uso. Cada passo marcado com ⚠️ só avança com confirmação do usuário.

### Visão Geral

Congelar a Railway, copiar os dados reais, trocar o tráfego para o Render e validar. A Railway permanece intacta por 7 dias.

### Passos

1. **Pré-condição de rollback (antes de mergear na `main`)**: criar o branch `legacy/railway-sqlite` a partir do último commit atual da `main` e apontar a Railway para esse branch (ou desligar o auto-deploy dela). Confirmar que um redeploy da Railway ainda sobe com SQLite. ⚠️
2. Mergear `feat/postgres-migration` → `main` (somente o maintainer). Render (produção) passa a seguir a `main`.
3. Colocar a Railway em manutenção/somente leitura (parar o serviço ou bloquear escrita) para congelar o banco. ⚠️
4. Obter cópia consistente do banco e de `/data/storage` da Railway (via `railway ssh`/CLI: `sqlite3 ... ".backup"` e arquivo `tar` do diretório de storage), para um diretório temporário **fora do repositório** (S9). Validar o método num ensaio antes (Fase 5 manual).
5. Criar o schema na branch `main` do Neon: `dotnet ef database update --connection "<direto>" --project backend/TalentValley.Api`.
6. Rodar a ferramenta da Fase 5 apontando para o Neon (produção) e o bucket de produção; conferir o relatório de contagens. ⚠️ Se qualquer contagem divergir, parar e acionar o rollback.
7. Iniciar o serviço Render de produção (migrations já aplicadas; seed e bootstrap são idempotentes) e conferir os logs.
8. Atualizar na Vercel `BACKEND_API_URL=https://<servico>.onrender.com` e fazer redeploy. Atualizar `Frontend__BaseUrl` no Render se a origem da Vercel mudou. Sem barra final.
9. **Smoke test** (usuário): login admin; listar alunos/recrutadores; buscar talentos com filtros (cidade, competência); abrir um perfil e baixar certificado/currículo/foto; criar uma solicitação de cadastro e aprovar; reenviar ativação e conferir e-mail (Brevo); favoritar/desfavoritar.
10. Cadastrar o monitor de uptime em `/health`.
11. Remover a cópia local do SQLite e dos arquivos (S9) e anotar a data do cutover.
12. Após **7 dias** estáveis: desligar a Railway e só então apagar o volume; abrir PR removendo `backend/tools/SqliteToPostgresMigrator/` e o branch `legacy/railway-sqlite` (⚠️ confirmar).

### Critérios de Sucesso

#### Verificação Manual (todos necessários: integração externa ponta a ponta, não coberta por testes):
- [ ] Contagens por tabela e de objetos do relatório da ferramenta batem origem × destino.
- [ ] Smoke test do passo 9 completo sem erros.
- [ ] Nos logs do Render: sem erros de TLS/Npgsql; sem credenciais; observar o log `RateLimitDebug` para ver qual IP o rate limit enxerga (Riscos R4).
- [ ] Primeira requisição após 20 min de ociosidade termina dentro do tempo aceitável (registrar o tempo; ver R2).
- [ ] Usuários com links de ativação/reset antigos conseguem pedir um novo (S13).

#### Rollback (se qualquer item acima falhar)
- Vercel: voltar `BACKEND_API_URL` para o domínio da Railway e redeploy; religar a Railway (branch `legacy/railway-sqlite`). Escritas feitas no Render/Neon após o cutover não voltam para o SQLite; por isso a janela de validação é curta e a Railway fica congelada, sem escritas, até o fim dos 7 dias.

#### ⛔ Pausa Obrigatória
- [ ] Aguardar confirmação explícita do usuário ou orquestrador antes de iniciar a próxima fase. **Não avançar sem receber um comando explícito. Esta pausa só pode ser omitida se o usuário ou orquestrador tiver solicitado explicitamente execução contínua sem pausas (ex.: "execute todas as fases sem parar", "modo contínuo", "sem pausas"). Ausência de instrução contrária NÃO é permissão para avançar.**

---

<!-- FASE: 8 -->
## Fase 8: Atualização da Documentação

**Branch**: `docs/postgres-phase-8-documentation`. **Esta fase é obrigatória e roda depois de todas as anteriores (incluindo o cutover) estarem concluídas com sucesso.**

Documentos que descrevem SQLite/Railway e precisam refletir o estado real (a lista foi levantada com `grep` e deve ser reconferida):

- [AGENTS.md](../../AGENTS.md): "Approved stack → SQLite with WAL" passa a "PostgreSQL (Neon)"; seção "Checks before saying a task is done" (comandos de migration precisam da connection string por user-secrets/variável de ambiente e de um Postgres local; testes precisam de `TALENT_VALLEY_TEST_POSTGRES`). Mudança de `AGENTS.md` é decisão do maintainer (já tomada).
- `.agents/skills/talent-valley-database/SKILL.md` e `references/schema-rules.md`: trocar "Use SQLite", "Enable WAL, foreign keys, and synchronous=NORMAL" e a seção "SQLite initialization" por regras de Postgres (tipos, `timestamptz`, advisory locks, migrations baseline `InitialCreate`).
- `.agents/skills/talent-valley-architecture/references/approved-architecture.md` (linhas 40 e 42): SQLite/WAL → PostgreSQL; incluir Render, Neon e R2.
- Demais skills (`talent-valley-quality-gate`, `talent-valley-contribution-workflow`, `talent-valley-auth-security`): reconferir menções a SQLite, storage em disco, DataProtection em arquivo.
- [README.md](../../README.md) (linhas 8, 190, 211 e demais): backend com PostgreSQL/Npgsql; como rodar Postgres local; testes com Postgres; remover a explicação de `Foreign Keys=True`/interceptor; documentar `Storage__Provider` e R2 e a persistência de chaves no banco.
- [DEPLOY_DEMO.md](../../DEPLOY_DEMO.md): conferir que reflete o estado final (Render/Neon/R2, rollback encerrado).
- `SKILLS-MANIFEST.json`: só atualizar se arquivos de skill forem criados/removidos (o CI valida a lista; editar conteúdo não exige).
- Cérebro do projeto (`.agents/brain/`, local e não versionado): salvar este plano, os relatórios de fase e os problemas resolvidos, conforme `talent-valley-project-brain`.

### Critérios de Sucesso

#### Verificação Automatizada:
- [ ] `git grep -n -i "sqlite\|railway" -- . ':!docs/planos' ':!backend/tools'` retorna só menções intencionais (ex.: item "SQLite" do catálogo de competências, nota histórica).
- [ ] Job `skills-manifest` do CI passa (`SKILLS-MANIFEST.json` consistente).
- [ ] `dotnet build` e `dotnet test backend/TalentValley.slnx` verdes.

#### Verificação Manual:
- [ ] Nenhum documento descreve a migração como "planejada" ou "pendente"; tudo consta como implementado.
- [ ] Comandos documentados (Postgres local, user-secrets, testes, `dotnet ef`) funcionam em uma máquina limpa seguindo só o README.

#### ⛔ Pausa Obrigatória
- [ ] Aguardar confirmação explícita do usuário ou orquestrador antes de encerrar o plano. **Esta pausa só pode ser omitida se o usuário ou orquestrador tiver solicitado explicitamente execução contínua sem pausas.**

---

## Estratégia de Testes

### Testes Unitários
- Validação de chave/extensão e montagem do objeto no `R2FileStorage`.
- Helper de advisory lock e tradução de `PostgresException 23505` para as exceções de domínio existentes.
- Conversões da ferramenta de migração (Fase 5).

### Testes de Integração (contra Postgres real)
- Suíte atual inteira (~30 arquivos) portada: Identity/JWT/antiforgery, perfis, trajetória, descoberta de talentos, favoritos, exclusões, validação RPV, solicitações de cadastro.
- Novos: concorrência (slug, formação principal, limite de projetos), busca com acento/caixa, busca de solicitações insensível a caixa, DataProtection compartilhado entre hosts, falha de Production sem R2.

### Etapas de Teste Manual
1. Upload/download real no bucket R2 de teste (Fase 4).
2. Ensaio da ferramenta com cópia real do banco (Fase 5).
3. Deploy de ensaio no Render + Neon `rehearsal` (Fase 6).
4. Smoke test pós-cutover (Fase 7).

## Considerações de Performance

- Neon suspende após 5 min: a primeira query depois disso paga ~0,5 s; `Connection Idle Lifetime=30` evita reutilizar conexões que o Neon já derrubou.
- Render Free dorme após 15 min: ~1 min na primeira requisição; mitigado por ping em `/health` a cada 5–10 min.
- `Maximum Pool Size=10` por instância (uma instância) respeita o limite de conexões do Neon Free.
- Cota de 100 CU-h/mês do Neon: um banco com tráfego baixo e suspensão automática costuma caber; acompanhar o consumo no painel nas primeiras semanas.

## Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Seções críticas perdem a serialização do SQLite e geram duplicidade/corrida | Advisory locks + constraints únicas + testes de concorrência (Fase 2) |
| R2 | *Cold start* do Render (~1 min) pode estourar o tempo do proxy/rewrite da Vercel na primeira requisição | Ping em `/health`; medir na Fase 6/7; se persistir, avaliar chamada direta ao Render ou plano pago (decisão do usuário) |
| R3 | `lower()` do Postgres não dobrar acentos conforme a collation do banco | Teste com acento (Fase 2); fallback ICU/`citext` |
| R4 | Atrás do proxy do Render, o rate limit por IP pode agrupar todos os usuários no IP do proxy (como já ocorre hoje com `ForwardedHeaders` desabilitado) | Fora do escopo; observar o log `RateLimitDebug` e abrir tarefa à parte para configurar `ForwardedHeaders` |
| R5 | Banco com mais de 0,5 GB não cabe no Neon Free | Ferramenta aborta com aviso (Fase 5); nesse caso parar e decidir com o usuário |
| R6 | Railway quebra ao mergear na `main` | Branch `legacy/railway-sqlite` antes do merge (Fase 7, passo 1) |
| R7 | AWSSDK.S3 × R2 (checksums, path-style) | Configuração explícita + teste manual com bucket de teste (Fase 4) |
| R8 | Conexões ociosas do pool quebradas pelo auto-suspend do Neon | `Connection Idle Lifetime=30`; sem `EnableRetryOnFailure` por causa das transações manuais |

## Referências

- Conversa de 2026-10-16 (decisões: maintainer, preservar dados, R2, testes com Postgres real).
- Limites dos planos gratuitos: [Render – Deploy for Free](https://render.com/docs/free), [Neon – free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas).
- Código de referência: [DatabaseRegistration.cs](../../backend/TalentValley.Api/Data/DatabaseRegistration.cs), [ApiFactory.cs](../../backend/TalentValley.Api.Tests/ApiFactory.cs), [LocalFileStorage.cs](../../backend/TalentValley.Api/Storage/LocalFileStorage.cs), [SecurityRegistration.cs](../../backend/TalentValley.Api/Authorization/SecurityRegistration.cs), [DEPLOY_DEMO.md](../../DEPLOY_DEMO.md).
- Regras do repositório: [AGENTS.md](../../AGENTS.md), skills `talent-valley-phased-delivery`, `talent-valley-database`, `talent-valley-quality-gate`, `talent-valley-contribution-workflow`.
