using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Services;

internal sealed record DemoFormation(TipoFormacao Tipo, string Nome, string Instituicao, DateOnly Inicio, DateOnly? Fim,
    int? CargaHoraria, StatusFormacao Status, bool Principal = false, bool RioPombaValley = false);

internal sealed record DemoExperience(string Empresa, string Cargo, TipoExperiencia Tipo, DateOnly Inicio, DateOnly? Fim,
    string Descricao);

internal sealed record DemoProject(string Nome, DateOnly Inicio, DateOnly? Fim, string Descricao, string[] Tecnologias,
    string? DemoUrl = null, string? RepositorioUrl = null);

internal sealed record DemoLanguage(string Nome, NivelIdioma Nivel);

// DisponivelEmDias null means available immediately. No sensitive (PCD) data is ever part of the demo.
internal sealed record DemoSearch(StatusBusca Status, string Objetivo, AreaInteresse[] Areas, int? DisponivelEmDias,
    CargaHorariaSemanal CargaHoraria, int ConfirmadoHaDias, bool AceitaViajar, bool AceitaMudarDeCidade,
    CategoriaCnh[] CategoriasCnh, bool PossuiVeiculoProprio);

internal sealed record DemoStudent(string Nome, string Email, string Cidade, string Uf, string Telefone, string Bio,
    int AtualizadoHaDias, string[] Competencias, DemoLanguage[] Idiomas, TipoDisponibilidade[] Disponibilidades,
    ModalidadeTrabalho[] Modalidades, DemoFormation[] Formacoes, DemoExperience[] Experiencias, DemoProject[] Projetos,
    DemoSearch Busca);

internal sealed record DemoRecruiter(string Nome, string Email, string Empresa, string Cargo, string Telefone,
    string Cidade, string Uf);

// Fictitious people and companies for the presentation mode. Nothing here is real personal data.
// Every account uses the reserved ".invalid" domain and has no password, photo, résumé or certificate.
internal static class DemoData
{
    public const string EmailDomain = "demo.invalid";

    private const string Portuguese = "Português", English = "Inglês", RioPombaValleyName = "Rio Pomba Valley",
        PostgreSql = "PostgreSQL", DockerTool = "Docker", AspNetCore = "ASP.NET Core", RioPomba = "Rio Pomba",
        Tailwind = "Tailwind CSS", PowerBi = "Power BI", FigmaTool = "Figma";

    private static DateOnly D(int year, int month, int day) => new(year, month, day);

    // Course taken at Rio Pomba Valley: always marked as RPV and, without a certificate, left pending.
    private static DemoFormation RpvCourse(string name, DateOnly start, DateOnly end, int hours) =>
        new(TipoFormacao.CURSO_LIVRE, name, RioPombaValleyName, start, end, hours, StatusFormacao.CONCLUIDO,
            RioPombaValley: true);

    public static readonly DemoRecruiter Recruiter = new("Helena Martins Rocha", $"helena.rocha@{EmailDomain}",
        "Vale Tecnologia Demonstração", "Analista de Recrutamento", "32900000000", RioPomba, "MG");

    public static readonly IReadOnlyList<DemoStudent> Students =
    [
        new("Marina Alves Couto", $"marina.couto@{EmailDomain}", RioPomba, "MG", "32900000001",
            "Desenvolvedora full stack em formação, apaixonada por produtos que resolvem problemas reais da minha região. " +
            "Gosto de transformar ideias em interfaces claras e de cuidar da qualidade do código, dos testes e da " +
            "experiência de quem usa. Busco um estágio ou primeira vaga em que possa aprender com um time experiente " +
            "e contribuir desde o início.",
            1,
            ["React", "TypeScript", "Next.js", Tailwind, "C#", AspNetCore, PostgreSql, "Git", DockerTool,
                "Unit Testing", "Scrum", "Clean Code"],
            [new(Portuguese, NivelIdioma.NATIVO), new(English, NivelIdioma.AVANCADO), new("Espanhol", NivelIdioma.BASICO)],
            [TipoDisponibilidade.ESTAGIO, TipoDisponibilidade.CLT],
            [ModalidadeTrabalho.HIBRIDO, ModalidadeTrabalho.REMOTO],
            [
                new(TipoFormacao.GRADUACAO, "Sistemas de Informação", "Universidade Federal Demonstração",
                    D(2023, 2, 1), null, 3200, StatusFormacao.EM_ANDAMENTO, Principal: true),
                RpvCourse("Desenvolvimento Web Full Stack", D(2024, 3, 4), D(2025, 6, 27), 240),
                new(TipoFormacao.CURSO_LIVRE, "Lógica de Programação", "Escola Digital Exemplo",
                    D(2022, 8, 1), D(2022, 11, 30), 40, StatusFormacao.CONCLUIDO)
            ],
            [
                new("Agência Horizonte Digital", "Estagiária de Desenvolvimento", TipoExperiencia.ESTAGIO,
                    D(2025, 8, 1), null,
                    "Desenvolvimento de telas em React e integração com APIs REST, com revisão de código semanal."),
                new("Cooperativa Vale Verde", "Auxiliar de Suporte de TI", TipoExperiencia.PROFISSIONAL,
                    D(2023, 3, 1), D(2025, 7, 31),
                    "Atendimento a usuários, manutenção de computadores e apoio na organização do inventário de equipamentos.")
            ],
            [
                new("Vitrine Local", D(2025, 2, 1), null,
                    "Plataforma para pequenos comércios da região divulgarem produtos e receberem pedidos por mensagem. " +
                    "Cadastro de lojas, catálogo, busca por categoria e painel simples de pedidos.",
                    ["React", "TypeScript", PostgreSql, AspNetCore], "https://example.com/vitrine-local",
                    "https://example.com/repositorio/vitrine-local"),
                new("Agenda Saúde", D(2024, 6, 1), D(2024, 11, 30),
                    "Aplicativo web para agendar consultas em uma unidade de saúde comunitária, com lembretes e " +
                    "confirmação de presença.",
                    ["Next.js", Tailwind, "Git"], null, "https://example.com/repositorio/agenda-saude")
            ],
            new(StatusBusca.BUSCANDO_ATIVAMENTE, "Conseguir um estágio ou primeira vaga como desenvolvedora full stack.",
                [AreaInteresse.DesenvolvimentoFullStack, AreaInteresse.DesenvolvimentoFrontend,
                    AreaInteresse.DesenvolvimentoBackend], null,
                CargaHorariaSemanal.ATE_30H, 2, AceitaViajar: false, AceitaMudarDeCidade: true, [CategoriaCnh.B], PossuiVeiculoProprio: false)),

        new("Rafael Teixeira Nunes", $"rafael.nunes@{EmailDomain}", "Ubá", "MG", "32900000002",
            "Estudante de gestão com foco em dados e processos. Gosto de organizar informações, montar painéis que " +
            "ajudam a decidir melhor e melhorar rotinas de equipes comerciais. Procuro estágio na área administrativa " +
            "ou de análise de dados.",
            3,
            ["Microsoft Excel", PowerBi, "SQL", "Data Analysis", "Data Visualization", "Agile", "Trello"],
            [new(Portuguese, NivelIdioma.NATIVO), new(English, NivelIdioma.INTERMEDIARIO)],
            [TipoDisponibilidade.ESTAGIO, TipoDisponibilidade.TRAINEE],
            [ModalidadeTrabalho.PRESENCIAL, ModalidadeTrabalho.HIBRIDO],
            [
                new(TipoFormacao.TECNOLOGO, "Gestão Comercial", "Faculdade Vale do Ubá Demonstração",
                    D(2024, 2, 1), null, 1600, StatusFormacao.EM_ANDAMENTO, Principal: true),
                RpvCourse("Análise de Dados com Power BI", D(2025, 3, 3), D(2025, 6, 20), 60)
            ],
            [
                new("Mercado Central Ubá", "Estagiário Administrativo", TipoExperiencia.ESTAGIO,
                    D(2025, 4, 1), null,
                    "Controle de estoque em planilhas, relatórios mensais de vendas e apoio ao atendimento de fornecedores.")
            ],
            [
                new("Painel de Vendas", D(2025, 5, 1), D(2025, 9, 15),
                    "Painel interativo com vendas por região, produto e vendedor, criado a partir de dados fictícios de " +
                    "um comércio local.",
                    [PowerBi, "Microsoft Excel", "SQL"])
            ],
            new(StatusBusca.BUSCANDO_ATIVAMENTE, "Estagiar em análise de dados e processos de uma área comercial ou administrativa.",
                [AreaInteresse.DadosAnalytics, AreaInteresse.Administracao, AreaInteresse.VendasComercial,
                    AreaInteresse.ProcessosQualidade], 20,
                CargaHorariaSemanal.ATE_30H, 4, AceitaViajar: true, AceitaMudarDeCidade: false, [CategoriaCnh.B], PossuiVeiculoProprio: false)),

        new("Camila Ferraz Duarte", $"camila.duarte@{EmailDomain}", "Juiz de Fora", "MG", "32900000003",
            "Designer de interfaces com olhar para acessibilidade e consistência visual. Gosto de trabalhar perto de " +
            "quem desenvolve, entregando protótipos claros e componentes reutilizáveis.",
            6,
            [FigmaTool, "HTML", "CSS", "Responsive Web Design", "Web Accessibility", Tailwind, "Jira"],
            [new(Portuguese, NivelIdioma.NATIVO), new(English, NivelIdioma.AVANCADO), new("Francês", NivelIdioma.BASICO)],
            [TipoDisponibilidade.ESTAGIO, TipoDisponibilidade.FREELANCER, TipoDisponibilidade.PJ],
            [ModalidadeTrabalho.REMOTO],
            [
                new(TipoFormacao.GRADUACAO, "Design Digital", "Centro Universitário Zona da Mata Demonstração",
                    D(2022, 2, 1), D(2025, 12, 12), 2800, StatusFormacao.CONCLUIDO, Principal: true),
                new(TipoFormacao.CURSO_LIVRE, "UX e Interfaces Acessíveis", "Instituto Exemplo de Design",
                    D(2024, 9, 2), D(2024, 12, 13), 80, StatusFormacao.CONCLUIDO)
            ],
            [
                new("Estúdio Papel & Pixel", "Designer Júnior", TipoExperiencia.PROFISSIONAL,
                    D(2026, 1, 12), null,
                    "Protótipos no Figma, biblioteca de componentes e acompanhamento da implementação com o time de front-end.")
            ],
            [
                new("Sistema de Design Vale", D(2025, 8, 1), D(2025, 11, 20),
                    "Biblioteca de componentes e guia de estilo para um site institucional, com foco em contraste e " +
                    "navegação por teclado.",
                    [FigmaTool, "CSS", "Web Accessibility"], "https://example.com/sistema-de-design", null)
            ],
            new(StatusBusca.BUSCANDO_ATIVAMENTE, "Projetar interfaces acessíveis e consistentes em um time de produto.",
                [AreaInteresse.DesignInterfacesUiUx, AreaInteresse.DesignGrafico], null,
                CargaHorariaSemanal.ATE_30H, 45, AceitaViajar: false, AceitaMudarDeCidade: true, [CategoriaCnh.B], PossuiVeiculoProprio: false)),

        new("Lucas Meireles Prado", $"lucas.prado@{EmailDomain}", "Viçosa", "MG", "32900000004",
            "Engenheiro de produção em fim de curso, com interesse em ciência de dados aplicada à indústria. " +
            "Tenho experiência em análise exploratória, previsão de demanda e automação de relatórios.",
            9,
            ["Python", "Pandas", "NumPy", "Jupyter", "SQL", "Machine Learning", PowerBi, "Data Analysis", "Git"],
            [new(Portuguese, NivelIdioma.NATIVO), new(English, NivelIdioma.FLUENTE), new("Alemão", NivelIdioma.BASICO)],
            [TipoDisponibilidade.CLT, TipoDisponibilidade.TRAINEE],
            [ModalidadeTrabalho.HIBRIDO, ModalidadeTrabalho.PRESENCIAL, ModalidadeTrabalho.REMOTO],
            [
                new(TipoFormacao.GRADUACAO, "Engenharia de Produção", "Universidade Exemplo de Viçosa",
                    D(2021, 3, 1), D(2026, 7, 10), 3600, StatusFormacao.CONCLUIDO, Principal: true),
                new(TipoFormacao.POS_GRADUACAO, "Ciência de Dados", "Instituto Exemplo de Tecnologia",
                    D(2026, 8, 3), null, 360, StatusFormacao.EM_ANDAMENTO)
            ],
            [
                new("Laticínios Serra Azul", "Estagiário de Planejamento", TipoExperiencia.ESTAGIO,
                    D(2024, 2, 1), D(2025, 1, 31),
                    "Análise de perdas na produção e criação de relatórios automáticos em Python para a diretoria.")
            ],
            [
                new("Previsão de Demanda", D(2025, 3, 1), D(2025, 8, 30),
                    "Modelo simples de previsão de demanda semanal para uma linha de produtos, com comparação de " +
                    "métodos e visualização dos erros.",
                    ["Python", "Pandas", "Machine Learning"], null, "https://example.com/repositorio/previsao-demanda")
            ],
            new(StatusBusca.ABERTO_A_PROPOSTAS, "Aplicar dados e automação para melhorar processos industriais.",
                [AreaInteresse.CienciaDadosIa, AreaInteresse.DadosAnalytics, AreaInteresse.AutomacaoIot], 60,
                CargaHorariaSemanal.ATE_40H, 5, AceitaViajar: true, AceitaMudarDeCidade: true, [CategoriaCnh.A, CategoriaCnh.B], PossuiVeiculoProprio: true)),

        new("Beatriz Souza Lacerda", $"beatriz.lacerda@{EmailDomain}", "Cataguases", "MG", "32900000005",
            "Desenvolvedora mobile em início de carreira. Criei aplicativos Flutter para uso comunitário e gosto de " +
            "aprender rápido, trabalhar em equipe e cuidar do detalhe da experiência no celular.",
            12,
            ["Flutter", "Dart", "Firebase", "Android", "Git", FigmaTool, "Scrum"],
            [new(Portuguese, NivelIdioma.NATIVO), new(English, NivelIdioma.INTERMEDIARIO)],
            [TipoDisponibilidade.ESTAGIO, TipoDisponibilidade.CLT],
            [ModalidadeTrabalho.REMOTO, ModalidadeTrabalho.HIBRIDO],
            [
                new(TipoFormacao.TECNICO, "Técnico em Informática", "Escola Técnica Cataguases Demonstração",
                    D(2023, 2, 1), D(2025, 12, 5), 1200, StatusFormacao.CONCLUIDO, Principal: true),
                RpvCourse("Desenvolvimento Mobile com Flutter", D(2025, 8, 4), D(2025, 11, 28), 120)
            ],
            [],
            [
                new("Feira Digital", D(2025, 9, 1), D(2025, 12, 10),
                    "Aplicativo para feirantes divulgarem produtos do dia e clientes reservarem itens para retirada.",
                    ["Flutter", "Dart", "Firebase"], null, "https://example.com/repositorio/feira-digital")
            ],
            new(StatusBusca.NAO_BUSCANDO, "Aprofundar o desenvolvimento mobile enquanto conclui o curso.",
                [AreaInteresse.DesenvolvimentoMobile], 90,
                CargaHorariaSemanal.ATE_20H, 40, AceitaViajar: false, AceitaMudarDeCidade: false, [], PossuiVeiculoProprio: false)),

        new("Thiago Andrade Pires", $"thiago.pires@{EmailDomain}", RioPomba, "MG", "32900000006",
            "Estudante de análise e desenvolvimento de sistemas com foco em back-end e infraestrutura. Gosto de APIs " +
            "bem projetadas, testes automatizados e de automatizar entregas com contêineres.",
            15,
            ["C#", ".NET", AspNetCore, "Entity Framework Core", PostgreSql, DockerTool, "GitHub Actions", "CI/CD",
                "Linux", "xUnit", "REST APIs"],
            [new(Portuguese, NivelIdioma.NATIVO), new(English, NivelIdioma.INTERMEDIARIO)],
            [TipoDisponibilidade.ESTAGIO, TipoDisponibilidade.CLT, TipoDisponibilidade.PJ],
            [ModalidadeTrabalho.REMOTO, ModalidadeTrabalho.HIBRIDO],
            [
                new(TipoFormacao.TECNOLOGO, "Análise e Desenvolvimento de Sistemas", "Instituto Federal Demonstração",
                    D(2024, 2, 1), null, 2000, StatusFormacao.EM_ANDAMENTO, Principal: true),
                RpvCourse("APIs com ASP.NET Core", D(2025, 2, 10), D(2025, 5, 23), 100)
            ],
            [
                new("Startup Fio Condutor", "Estagiário de Back-end", TipoExperiencia.ESTAGIO,
                    D(2025, 9, 1), null,
                    "Criação de endpoints, testes automatizados e publicação em contêineres com integração contínua.")
            ],
            [
                new("API de Reservas", D(2025, 4, 1), null,
                    "API para reservas de salas de estudo, com autenticação, regras de conflito de horário, testes " +
                    "automatizados e documentação.",
                    ["C#", AspNetCore, PostgreSql, DockerTool], null, "https://example.com/repositorio/api-reservas"),
                new("Pipeline de Entrega", D(2025, 10, 1), D(2026, 1, 31),
                    "Esteira de integração contínua que compila, testa e publica um serviço em contêiner a cada alteração.",
                    ["GitHub Actions", DockerTool, "CI/CD"])
            ],
            new(StatusBusca.ABERTO_A_PROPOSTAS, "Atuar com back-end e infraestrutura, evoluindo em APIs, testes e entrega contínua.",
                [AreaInteresse.DesenvolvimentoBackend, AreaInteresse.DevOps, AreaInteresse.InfraestruturaNuvem], 30,
                CargaHorariaSemanal.ATE_30H, 3, AceitaViajar: false, AceitaMudarDeCidade: true, [CategoriaCnh.B], PossuiVeiculoProprio: true))
    ];
}
