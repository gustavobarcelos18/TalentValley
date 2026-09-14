namespace TalentValley.Api.Authorization;

public static class AppPolicies
{
    public const string RequireAdmin = nameof(RequireAdmin);
    public const string RequireActiveStudent = nameof(RequireActiveStudent);
    public const string RequireActiveRecruiter = nameof(RequireActiveRecruiter);
    public const string RequireActiveStudentOrRecruiter = nameof(RequireActiveStudentOrRecruiter);
}
