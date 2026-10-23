using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Services;

// Single definition of the demonstration boundary.
// Recruiters: they may discover, favorite, compare or download only from students whose profile is active,
// whose account is activated (email confirmed through the activation flow) and who are on the same side of
// the demonstration as the recruiter: real recruiters only see real students and the demonstration
// recruiter only sees demonstration students.
// Administrators: ExcludingDemo keeps demonstration accounts out of their numbers and lists.
public static class TalentVisibility
{
    public static IQueryable<Aluno> VisibleToRecruiters(this IQueryable<Aluno> query, bool recruiterIsDemo) =>
        query.Where(x => x.Ativo && x.User.EmailConfirmed && x.User.EhDemo == recruiterIsDemo);

    // Raw-SQL form of the same predicate; requires "Alunos" aliased as a and "AspNetUsers" joined as u.
    // The caller binds the recruiter's demonstration flag to the given parameter name.
    public static string Sql(string recruiterIsDemoParameter) =>
        $"a.\"Ativo\" AND u.\"EmailConfirmed\" AND u.\"EhDemo\" = {recruiterIsDemoParameter}";

    // Whether the signed-in recruiter is a demonstration account; always read from the database.
    public static Task<bool> IsDemoRecruiterAsync(
        AppDbContext database, Guid recruiterId, CancellationToken cancellationToken) =>
        database.Users.AsNoTracking().Where(x => x.Id == recruiterId)
            .Select(x => x.EhDemo).SingleOrDefaultAsync(cancellationToken);

    // Administrative views and numbers describe the real platform: demonstration accounts never count.
    public static IQueryable<Aluno> ExcludingDemo(this IQueryable<Aluno> query) =>
        query.Where(x => !x.User.EhDemo);

    public static IQueryable<Recrutador> ExcludingDemo(this IQueryable<Recrutador> query) =>
        query.Where(x => !x.User.EhDemo);

    public static IQueryable<Formacao> ExcludingDemo(this IQueryable<Formacao> query) =>
        query.Where(x => !x.Aluno.User.EhDemo);

    public static IQueryable<AlunoCompetencia> ExcludingDemo(this IQueryable<AlunoCompetencia> query) =>
        query.Where(x => !x.Aluno.User.EhDemo);
}
