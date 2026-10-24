# Plano: Importar perfil do LinkedIn (ZIP e PDF)

- **status:** em-andamento
- **data:** 2026-10-23
- **total de fases:** 4
- **aprovado por:** Camile Alves (mantenedora), em 2026-10-23

## Objetivo

Permitir que o aluno envie o arquivo exportado do LinkedIn (ZIP "Baixar seus dados" ou PDF "Salvar como PDF") e o sistema sugira o preenchimento do perfil. O aluno revisa e confirma antes de qualquer gravação.

## Decisões já tomadas (não perguntar de novo)

- Fontes: **ZIP (principal) e PDF (alternativa)**.
- Só na tela **Meu perfil** (não mexe no cadastro público).
- **Só preenche o que está vazio.** Em experiências e formações, traz **só itens novos** (compara empresa+cargo+início, ou curso+instituição+início). Item já cadastrado nunca é alterado.
- Certificações do LinkedIn viram **Formação `CURSO_LIVRE`** (sem certificado em PDF, nunca RPV).
- Projetos do LinkedIn são importados; o **aluno escolhe até 2** (descontando os que já tem). Descrição acima de 1000 caracteres é cortada com aviso.
- **Toda seção é opcional**: perfil incompleto não gera erro.
- Servidor só gera **pré-visualização** (nada é salvo, arquivo não é guardado nem registrado em log). A gravação usa os **endpoints que já existem**.
- Nunca importar: validação/marcação RPV, PCD, CNH, "O que eu busco", foto, telefone se não vier.
- Sem migration (sem mudança de banco).
- Dependências: ZIP e CSV sem pacote novo (`System.IO.Compression` + leitor próprio). **PDF exige biblioteca nova**; sugestão: PdfPig (decisão da mantenedora, confirmar no início da fase 4).

## A confirmar durante a execução (não decidido)

- Fase 2: tabela de níveis de idioma (LinkedIn -> `NivelIdioma`); certificação usar a data de emissão como início e fim e status `CONCLUIDO`; links de projeto não preenchidos automaticamente.
- Fase 4: escolha final do pacote de leitura de PDF.

## Tabela de fases

| Fase | Nome | Branch | Status | Commit |
| --- | --- | --- | --- | --- |
| 1 | Leitor do ZIP (backend) | `feat/importacao-linkedin-phase-1-leitor-zip` | aprovada (mesclada no main, PR #147; sem relatório salvo) | 7b26493, 8d9f6d1, 16ff0c6 (merge 6db07b8) |
| 2 | Tradução e endpoint de pré-visualização (backend) | `feat/importacao-linkedin-phase-2-previa` | em-execucao | - |
| 3 | Tela "Importar do LinkedIn" (frontend) | `feat/importacao-linkedin-phase-3-tela` | pendente | - |
| 4 | Leitura do PDF + documentação | `feat/importacao-linkedin-phase-4-pdf` | pendente | - |

Cada fase só começa depois que a anterior foi mesclada no `main` (só a mantenedora mescla).

---

## Fase 1: Leitor do ZIP (backend)

**Onde**
- `backend/TalentValley.Api/Storage/FileUploadValidator.cs` (novo tipo ZIP)
- novo `backend/TalentValley.Api/Services/LinkedInExportReader.cs`
- novo modelo interno de dados importados (contato, bio, experiências, formações, certificações, competências, idiomas, projetos)
- testes em `backend/TalentValley.Api.Tests/`

**O quê**
- Valida o ZIP: assinatura (`PK\x03\x04`), tamanho máximo, limite de tamanho descompactado (proteção contra zip bomb), só entradas esperadas por nome, sem extrair para disco.
- Leitor próprio de CSV (aspas, vírgulas e quebras de linha dentro de campo).
- Lê os CSVs do LinkedIn (Profile, Positions, Education, Certifications, Skills, Languages, Projects) e devolve o modelo comum. Arquivo ausente = seção vazia.
- Testes com ZIP **fictício** montado no teste. Verificação local com o ZIP real (fora do Git).

**Checagens**
- `dotnet build backend/TalentValley.slnx`
- `dotnet test backend/TalentValley.slnx --filter <testes novos>`

**Refs**
- `backend/TalentValley.Api/Storage/FileUploadValidator.cs` (UploadKind, ValidateAsync, assinatura de arquivo)
- `backend/TalentValley.Api/Services/StudentFileService.cs` (padrão de upload)
- Skills: `talent-valley-backend-api`, `talent-valley-auth-security` (arquivos), `talent-valley-quality-gate`
- Amostra real do ZIP (local, fora do Git): `.agents/brain/amostras/` (a mantenedora vai colocar)
- Testes de referência: `backend/TalentValley.Api.Tests/AlunoProfileTests.cs`
- Relatórios anteriores: nenhum

---

## Fase 2: Tradução e endpoint de pré-visualização (backend)

**Onde**
- novo serviço de importação em `backend/TalentValley.Api/Services/`
- novo controller em `backend/TalentValley.Api/Controllers/` (rota `api/alunos/me/importacao-linkedin`)
- novos DTOs em `backend/TalentValley.Api/DTOs/` (sem expor entidades)
- registro do serviço em `backend/TalentValley.Api/Program.cs`
- testes em `backend/TalentValley.Api.Tests/`

**O quê**
- `POST /api/alunos/me/importacao-linkedin/previa` (multipart), policy `RequireActiveStudent`, `ResponseCache NoStore`, limite de tamanho.
- Traduz para o domínio:
  - estado por extenso -> UF; cidade;
  - experiência: `ESTAGIO` quando o cargo indicar, senão `PROFISSIONAL`; datas mês/ano -> dia 1; "Present" -> `Atual`;
  - formação: tipo (`TECNICO`, `TECNOLOGO`, `GRADUACAO`, `POS_GRADUACAO`, `CURSO_LIVRE`) e status (`EM_ANDAMENTO`/`CONCLUIDO`) pelas datas;
  - certificação -> `CURSO_LIVRE` (ver "A confirmar");
  - competências e idiomas casados com o catálogo (por `NomeBusca`); o que não casar vai numa lista "não reconhecidos";
  - projetos: nome, datas, descrição (corta em 1000).
- Marca cada item como `novo` ou `ja_existe` e respeita vagas de projeto (máx. 2).
- Nunca preenche RPV, PCD, CNH, "O que eu busco".
- Tabela de níveis de idioma proposta e confirmada com a mantenedora durante a fase.

**Checagens**
- `dotnet build backend/TalentValley.slnx`
- `dotnet test backend/TalentValley.slnx --filter <testes novos>` (acesso só do aluno dono, outro papel recebe 403, ZIP inválido recebe 400, duplicados, limites)

**Refs**
- `backend/TalentValley.Api/Controllers/FormacoesController.cs` (padrão de controller, `CurrentUserId`, tratamento de `UploadValidationException`)
- `backend/TalentValley.Api/Services/AlunoService.cs` (`UpdateContatoAsync`, `UpdateCompetenciasAsync`, `UpdateIdiomasAsync`, `GetCompetenciasAsync`)
- `backend/TalentValley.Api/Services/FormacaoService.cs`, `ExperienciaService.cs`, `ProjetoService.cs` (regras de validação)
- `backend/TalentValley.Api/Services/NameNormalizer.cs`, `backend/TalentValley.Api/Domain/Entities/Competencia.cs` (`NomeBusca`)
- `backend/TalentValley.Api/Domain/Enums/` (`TipoFormacao`, `StatusFormacao`, `TipoExperiencia`, `NivelIdioma`)
- `backend/TalentValley.Api/DTOs/TrajetoriaDtos.cs`, `AlunoDtos.cs` (padrão de DTO)
- Skills: `talent-valley-backend-api`, `talent-valley-domain-rules` (`references/mvp-rules.md`: seções Formation, Experience, Projects, Languages), `talent-valley-auth-security`
- Relatório da fase 1: `reports/phase-1.md`

---

## Fase 3: Tela "Importar do LinkedIn" (frontend)

**Onde**
- novo componente em `frontend/src/components/profile/` (diálogo de importação)
- botão em `frontend/src/components/profile/StudentProfile.tsx`
- função de API em `frontend/src/lib/student.ts`
- tipos em `frontend/src/types/student.ts`
- testes em `frontend/src/__tests__/components/profile/`

**O quê**
- Passo a passo de como baixar o ZIP no LinkedIn, escolha do arquivo, pré-visualização por grupo (contato/bio, experiências, formações, certificações, competências, idiomas, projetos) com caixas de marcação.
- Itens `ja_existe` aparecem desmarcados e identificados; "não reconhecidos" listados à parte.
- Projetos: a tela não deixa marcar mais do que as vagas livres (servidor valida de novo pelos endpoints existentes).
- "Importar selecionados" grava pelos endpoints existentes, mesclando listas inteiras onde o endpoint substitui tudo (competências, idiomas), e mostra o resultado item a item (sucesso ou erro).
- Visual MUI do projeto, sem novas dependências; todos os textos em pt-BR.

**Checagens**
- `npx eslint <arquivos alterados>`, `npm run typecheck`, `npx vitest run <testes dos arquivos alterados>`
- Suíte completa local (mexe no cliente de API): `npm ci` se necessário, `npm run build` e `npm test`

**Refs**
- Ler antes: `frontend/AGENTS.md` e `frontend/node_modules/next/dist/docs/` (rodar `npm ci` se faltar)
- `frontend/src/components/profile/CurriculoSection.tsx` (padrão de upload com validação no cliente)
- `frontend/src/components/profile/StudentProfile.tsx`, `sectionProps.ts`
- `frontend/src/lib/student.ts` (funções `createExperiencia`, `createFormacao`, `createProjeto`, `updateCompetencias`, `updateIdiomas`, `updateContato`, `updateSobre`), `frontend/src/lib/api.ts`
- `frontend/src/types/student.ts`, `frontend/src/hooks/useStudentProfile.ts`
- Skills: `talent-valley-frontend-ui`
- Relatórios: `reports/phase-1.md`, `reports/phase-2.md`

---

## Fase 4: Leitura do PDF + documentação

**Onde**
- novo leitor de PDF em `backend/TalentValley.Api/Services/`
- `backend/TalentValley.Api/Storage/FileUploadValidator.cs` / endpoint da fase 2 (aceitar PDF além de ZIP)
- `backend/TalentValley.Api/*.csproj` (**pacote novo, decisão da mantenedora**) e lockfiles se houver
- diálogo da fase 3 aceitando `.pdf`
- documentação: `.agents/skills/talent-valley-domain-rules/references/mvp-rules.md` e a cópia em `.claude/skills/talent-valley-domain-rules/references/mvp-rules.md`
- testes backend e frontend

**O quê**
- Lê o texto do PDF e identifica seções em inglês e português (Contact, Top Skills, Languages, Summary, Experience, Education, Certifications, Projects).
- Junta e-mail e link do LinkedIn quebrados em duas linhas; converte datas `May 2026 - Present (6 months)` e `(January 2025 - December 2028)`; separa cidade/estado/país.
- Entrega o **mesmo modelo comum** da fase 1, reaproveitando tradução, pré-visualização e tela.
- Seções ausentes são ignoradas. Limitação conhecida: o PDF traz só 3 "Top Skills" e pode não ter telefone/idiomas; isso é avisado na tela.
- Documenta a regra "Importação do LinkedIn" no `mvp-rules.md`.

**Checagens**
- Backend: `dotnet build backend/TalentValley.slnx`, `dotnet test backend/TalentValley.slnx --filter <testes novos>`
- Frontend: `npx eslint`, `npm run typecheck`, `npx vitest run` dos arquivos alterados
- Suíte completa local (dependência nova): `dotnet test` completo, `npm run build`, `npm test`

**Refs**
- Estrutura real do PDF (exemplo do dono do projeto, fora do Git, não copiar dados reais): arquivo `Profile.pdf` na pasta Downloads da mantenedora. Seções vistas: Contact, Top Skills, Summary, Experience, Education; texto em ordem de leitura traz e-mail partido ("...gmail.co m") e URL partida.
- `backend/TalentValley.Api/Services/` (serviço da fase 2, modelo comum da fase 1)
- `backend/TalentValley.Api/Storage/FileUploadValidator.cs` (assinatura `%PDF-`)
- `.agents/skills/talent-valley-domain-rules/SKILL.md` (copiar para `.claude/skills/` na mesma PR)
- Skills: `talent-valley-architecture` (dependência nova), `talent-valley-backend-api`, `talent-valley-frontend-ui`, `talent-valley-domain-rules`
- Relatórios: `reports/phase-1.md`, `reports/phase-2.md`, `reports/phase-3.md`

---

## Prompt para retomar

`Retomar o plano importacao-linkedin na fase 2`

(Atualizar este prompt a cada fase aprovada.)
