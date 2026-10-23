using System.ComponentModel.DataAnnotations;

namespace TalentValley.Api.DTOs;

// LGPD newsletter consent for the signed-in person (GET/PUT /api/alunos/me/newsletter and /api/recrutador/me/newsletter).
// AtualizadaEm is the date of the last real change (opt-in or revocation); null when the person never opted in.
public sealed record NewsletterResponse(bool Aceita, DateTimeOffset? AtualizadaEm);

// Aceita is nullable + [Required] so a missing or null value is rejected (400) instead of silently meaning "revoked".
public sealed record UpdateNewsletterRequest([Required] bool? Aceita);
