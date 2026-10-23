using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

// LGPD: each person reads and changes only their own newsletter consent, identified by the authenticated user ID.
// The date only moves when the state really changes, so it always marks the last opt-in or revocation.
// The change is a single conditional UPDATE, so two simultaneous requests cannot leave a stale answer:
// the last one to run decides, and the response always reflects what is stored.
public sealed class NewsletterService(AppDbContext database)
{
    public async Task<NewsletterResponse?> GetAlunoAsync(Guid userId, CancellationToken cancellationToken) =>
        await database.Alunos.AsNoTracking().Where(x => x.UserId == userId)
            .Select(x => new NewsletterResponse(x.NewsletterAceita, x.NewsletterAtualizadaEm))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<NewsletterResponse?> SetAlunoAsync(Guid userId, bool aceita, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await database.Alunos.Where(x => x.UserId == userId && x.NewsletterAceita != aceita)
            .ExecuteUpdateAsync(x => x
                .SetProperty(a => a.NewsletterAceita, aceita)
                .SetProperty(a => a.NewsletterAtualizadaEm, now), cancellationToken);
        return await GetAlunoAsync(userId, cancellationToken);
    }

    public async Task<NewsletterResponse?> GetRecrutadorAsync(Guid userId, CancellationToken cancellationToken) =>
        await database.Recrutadores.AsNoTracking().Where(x => x.UserId == userId)
            .Select(x => new NewsletterResponse(x.NewsletterAceita, x.NewsletterAtualizadaEm))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<NewsletterResponse?> SetRecrutadorAsync(Guid userId, bool aceita, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await database.Recrutadores.Where(x => x.UserId == userId && x.NewsletterAceita != aceita)
            .ExecuteUpdateAsync(x => x
                .SetProperty(r => r.NewsletterAceita, aceita)
                .SetProperty(r => r.NewsletterAtualizadaEm, now), cancellationToken);
        return await GetRecrutadorAsync(userId, cancellationToken);
    }
}
