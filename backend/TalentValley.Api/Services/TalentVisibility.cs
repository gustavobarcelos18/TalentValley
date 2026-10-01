using System.Linq.Expressions;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Services;

// Single definition of which students recruiters may discover, favorite, compare or download from:
// the profile must be active and the account activated (email confirmed through the activation flow).
public static class TalentVisibility
{
    public static readonly Expression<Func<Aluno, bool>> IsVisibleToRecruiter =
        x => x.Ativo && x.User.EmailConfirmed;

    public static IQueryable<Aluno> VisibleToRecruiters(this IQueryable<Aluno> query) =>
        query.Where(IsVisibleToRecruiter);

    // Raw-SQL form of the same predicate; requires "Alunos" aliased as a and "AspNetUsers" joined as u.
    public const string Sql = "a.\"Ativo\" = 1 AND u.\"EmailConfirmed\" = 1";
}
