using System.ComponentModel.DataAnnotations;
using TalentValley.Api.Authorization;

namespace TalentValley.Api.DTOs;

public sealed record DemoStateResponse(bool Habilitado, bool Preparado);

public sealed record DemoChangeResponse(int AlunosCriados, int RecrutadoresCriados);

public sealed record EnterDemoRequest([Required, AllowedValues(AppRoles.Student, AppRoles.Recruiter)] string Papel);
