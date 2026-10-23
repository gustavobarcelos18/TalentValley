namespace TalentValley.Api.Authorization;

// Marks an endpoint that stays usable while the account has not yet accepted the current terms:
// reading who is signed in, accepting the terms, changing the password, and the LGPD rights
// (export, newsletter consent, deletion). Every other student/recruiter endpoint is blocked until the acceptance.
[AttributeUsage(AttributeTargets.Method)]
public sealed class AllowPendingTermsAttribute : Attribute;
