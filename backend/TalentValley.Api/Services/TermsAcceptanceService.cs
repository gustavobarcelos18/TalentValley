using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;

namespace TalentValley.Api.Services;

// LGPD: records that the signed-in student or recruiter accepted the CURRENT terms version, with the date.
// The version is always the server's own (never taken from the request). Accepting again when the version is
// already current changes nothing, so the stored date keeps marking the real moment of acceptance.
public sealed class TermsAcceptanceService(AppDbContext database)
{
    // Returns false when the person has no student/recruiter profile (for instance, the admin).
    public async Task<bool> AcceptAsync(Guid userId, string role, CancellationToken cancellationToken)
    {
        var version = SolicitacaoCadastroService.VersaoTermosAtual;
        var now = DateTimeOffset.UtcNow;
        switch (role)
        {
            case AppRoles.Student:
                return await database.Alunos.Where(x => x.UserId == userId && x.VersaoTermos != version)
                        .ExecuteUpdateAsync(x => x
                            .SetProperty(a => a.ConsentimentoEm, now)
                            .SetProperty(a => a.VersaoTermos, version), cancellationToken) > 0
                    || await database.Alunos.AnyAsync(x => x.UserId == userId, cancellationToken);
            case AppRoles.Recruiter:
                return await database.Recrutadores.Where(x => x.UserId == userId && x.VersaoTermos != version)
                        .ExecuteUpdateAsync(x => x
                            .SetProperty(r => r.ConsentimentoEm, now)
                            .SetProperty(r => r.VersaoTermos, version), cancellationToken) > 0
                    || await database.Recrutadores.AnyAsync(x => x.UserId == userId, cancellationToken);
            default:
                return false;
        }
    }
}
