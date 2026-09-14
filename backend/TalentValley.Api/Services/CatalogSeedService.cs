using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Services;

public sealed class CatalogSeedService(AppDbContext database)
{
    public static readonly string[] CompetenciaNames =
    [
        // Languages
        "C", "C++", "C#", "Java", "Kotlin", "Python", "PHP", "Ruby", "Go", "Rust",
        "JavaScript", "TypeScript", "Dart", "Swift", "SQL", "Bash", "PowerShell",

        // Backend and APIs
        ".NET", "ASP.NET Core", "Entity Framework Core", "Node.js", "Express.js", "NestJS",
        "Spring Boot", "Spring Framework", "Django", "Flask", "FastAPI", "Laravel", "Ruby on Rails",
        "REST APIs", "GraphQL", "WebSockets", "gRPC", "Swagger/OpenAPI", "JWT", "OAuth 2.0",
        "OpenID Connect", "Webhooks", "Middleware", "Background Services", "Dependency Injection",
        "API Design", "API Integration", "SignalR", "MediatR", "Hangfire", "Dapper", "RabbitMQ", "Apache Kafka",

        // Frontend
        "HTML", "CSS", "Sass", "React", "Next.js", "Vue.js", "Nuxt.js", "Angular", "Svelte",
        "Tailwind CSS", "Bootstrap", "Material UI", "Styled Components", "Redux", "Zustand",
        "React Hook Form", "Zod", "Responsive Web Design", "Web Accessibility", "Axios", "Vite",
        "ESLint", "Prettier",

        // Databases and persistence
        "MySQL", "PostgreSQL", "SQL Server", "Oracle Database", "SQLite", "MongoDB", "Redis", "Firebase",
        "Supabase", "DynamoDB", "Elasticsearch", "Prisma", "Knex.js", "Database Modeling",
        "Relational Databases", "NoSQL", "Database Migrations", "Query Optimization", "Indexes", "Transactions",
        "Data Integrity",

        // Cloud and DevOps
        "Docker", "Docker Compose", "Kubernetes", "GitHub Actions", "Azure DevOps", "AWS", "Microsoft Azure",
        "Google Cloud", "CI/CD", "Linux", "Nginx", "Terraform", "Ansible", "Jenkins", "Vercel", "Netlify",
        "Infrastructure as Code", "Reverse Proxy", "Environment Configuration", "GitLab CI/CD", "Azure Functions",
        "AWS Lambda", "Serverless", "Cloudflare", "Prometheus", "Grafana", "OpenTelemetry",

        // Testing and quality
        "xUnit", "NUnit", "Jest", "Vitest", "React Testing Library", "Cypress", "Playwright", "Selenium",
        "Postman", "REST Client", "Unit Testing", "Integration Testing", "End-to-End Testing", "TDD",
        "Test Automation", "API Testing",

        // Data and AI
        "Pandas", "NumPy", "Jupyter", "Power BI", "Excel", "Machine Learning", "Artificial Intelligence",
        "Scikit-learn", "TensorFlow", "PyTorch", "OpenAI API", "Gemini API", "LangChain", "Data Analysis",
        "Data Visualization", "Prompt Engineering",

        // Mobile
        "Android", "iOS", "React Native", "Flutter", ".NET MAUI",

        // Architecture and software engineering
        "Clean Architecture", "SOLID", "Clean Code", "Design Patterns", "Domain-Driven Design", "MVC",
        "Microservices", "Layered Architecture", "CQRS", "Event-Driven Architecture", "Repository Pattern",
        "Software Architecture", "Refactoring", "Code Review",

        // Security
        "OWASP", "Authentication", "Authorization", "RBAC", "API Security", "Cryptography", "HTTPS/TLS",
        "Secure Coding", "CORS", "CSRF", "Input Validation", "Secrets Management",

        // Tools and collaboration
        "Git", "GitHub", "GitLab", "Visual Studio", "Visual Studio Code", "Jira", "Trello", "Figma",
        "npm", "pnpm", "Yarn",

        // General development
        "Debugging", "Logging", "Observability", "Performance Optimization", "Version Control", "System Integration",
        "Error Handling", "Validation", "Pagination", "Filtering", "Search", "Sorting", "File Upload", "JSON",
        "HTTP", "REST", "Agile", "Scrum"
    ];

    public static readonly string[] IdiomaNames =
    [
        "Português", "Inglês", "Espanhol", "Francês", "Alemão"
    ];

    public async Task InitializeAsync()
    {
        await SeedCompetenciasAsync();
        await SeedIdiomasAsync();
    }

    private async Task SeedCompetenciasAsync()
    {
        var existing = await database.Competencias.Select(x => x.NomeBusca).ToHashSetAsync();
        foreach (var nome in CompetenciaNames)
        {
            var busca = NameNormalizer.Normalize(nome);
            if (!existing.Contains(busca))
                database.Competencias.Add(new() { Nome = nome, NomeBusca = busca });
        }
        await database.SaveChangesAsync();
    }

    private async Task SeedIdiomasAsync()
    {
        var existing = await database.Idiomas.Select(x => x.NomeBusca).ToHashSetAsync();
        foreach (var nome in IdiomaNames)
        {
            var busca = NameNormalizer.Normalize(nome);
            if (!existing.Contains(busca))
                database.Idiomas.Add(new() { Nome = nome, NomeBusca = busca });
        }
        await database.SaveChangesAsync();
    }
}
