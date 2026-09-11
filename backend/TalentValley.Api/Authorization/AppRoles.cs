namespace TalentValley.Api.Authorization;

public static class AppRoles
{
    public const string Student = "ALUNO";
    public const string Recruiter = "RECRUTADOR";
    public const string Admin = "ADMIN";
    public static IReadOnlyList<string> All { get; } = Array.AsReadOnly([Student, Recruiter, Admin]);
}
