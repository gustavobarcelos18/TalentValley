using System.Net;

namespace TalentValley.Api.Email;

/// <summary>
/// Builds the two approved Talent Valley transactional emails (HTML + plain text).
/// Kept as plain C# (no template engine) with email-compatible table markup and
/// inline CSS, so the templates stay small, reviewable and free of extra dependencies.
/// </summary>
public static class TalentValleyEmailTemplates
{
    public sealed record Content(string Subject, string TextContent, string HtmlContent);

    public static Content BuildActivation(string logoUrl, string link) => new(
        "Ative sua conta no Talent Valley",
        ActivationText(link),
        BuildHtml(
            title: "Ative sua conta no Talent Valley",
            preheader: "Crie sua senha e comece sua jornada no Talent Valley.",
            eyebrow: "SEU ACESSO ESTÁ PRONTO",
            headline: "Sua jornada começa aqui.",
            paragraphs:
            [
                "Você já pode criar sua senha e ativar seu acesso ao Talent Valley.",
                "Clique no botão abaixo para definir sua senha e acessar a plataforma com segurança."
            ],
            ctaLabel: "Criar minha senha",
            note: "Se você não esperava esta mensagem, pode simplesmente ignorá-la.",
            link,
            logoUrl));

    public static Content BuildPasswordReset(string logoUrl, string link) => new(
        "Redefina sua senha no Talent Valley",
        PasswordResetText(link),
        BuildHtml(
            title: "Redefina sua senha no Talent Valley",
            preheader: "Receba acesso seguro à redefinição de sua senha.",
            eyebrow: "REDEFINIÇÃO DE SENHA",
            headline: "Vamos recuperar seu acesso.",
            paragraphs:
            [
                "Recebemos uma solicitação para redefinir a senha da sua conta Talent Valley.",
                "Clique no botão abaixo para escolher uma nova senha."
            ],
            ctaLabel: "Redefinir minha senha",
            note: "Se você não solicitou a redefinição, pode simplesmente ignorar esta mensagem.",
            link,
            logoUrl));

    private static string ActivationText(string link) => $"""
        Talent Valley — ativação de conta

        SEU ACESSO ESTÁ PRONTO

        Sua jornada começa aqui.

        Você já pode criar sua senha e ativar seu acesso ao Talent Valley. Para definir sua senha e acessar a plataforma com segurança, acesse:

        {link}

        Se o endereço acima não abrir, copie e cole o link completo no navegador.

        Se você não esperava esta mensagem, pode simplesmente ignorá-la.

        TALENTOS · CONEXÕES · OPORTUNIDADES

        Talent Valley
        Uma iniciativa Rio Pomba Valley
        """;

    private static string PasswordResetText(string link) => $"""
        Talent Valley — redefinição de senha

        REDEFINIÇÃO DE SENHA

        Vamos recuperar seu acesso.

        Recebemos uma solicitação para redefinir a senha da sua conta Talent Valley. Para escolher uma nova senha, acesse:

        {link}

        Se o endereço acima não abrir, copie e cole o link completo no navegador.

        Se você não solicitou a redefinição, pode simplesmente ignorar esta mensagem.

        TALENTOS · CONEXÕES · OPORTUNIDADES

        Talent Valley
        Uma iniciativa Rio Pomba Valley
        """;

    private static string BuildHtml(string title, string preheader, string eyebrow, string headline,
        IReadOnlyList<string> paragraphs, string ctaLabel, string note, string link, string logoUrl)
    {
        var href = WebUtility.HtmlEncode(link);
        var encodedLogo = WebUtility.HtmlEncode(logoUrl);
        var encodedPreheader = WebUtility.HtmlEncode(preheader);
        var paragraphsHtml = string.Concat(paragraphs.Select(Paragraph));

        var style = """
            @media only screen and (max-width: 620px) {
              .tv-wrap { width: 100% !important; }
              .tv-mark { width: 120px !important; height: auto !important; }
              .tv-pad { padding-left: 22px !important; padding-right: 22px !important; }
              .tv-h1 { font-size: 26px !important; }
              .tv-btn a { display: block !important; }
            }
            """;

        var head = $"""
            <!DOCTYPE html>
            <html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="color-scheme" content="dark">
            <meta name="supported-color-schemes" content="dark">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>{title}</title>
            <style type="text/css">{style}</style>
            </head>
            <body style="margin:0;padding:0;background-color:#0D1114;">
            <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{encodedPreheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0D1114;">
            <tr>
            <td align="center" style="padding:28px 12px;">
            <table role="presentation" class="tv-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#12171B;">
            <tr>
            <td class="tv-pad" align="center" style="padding:40px 40px 0;">
            <img class="tv-mark" src="{encodedLogo}" width="153" height="75" alt="Marca da montanha Talent Valley" style="display:inline-block;width:153px;height:75px;border:0;outline:none;text-decoration:none;">
            <p style="margin:16px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;font-weight:600;color:#F4F7F6;">Talent <span style="color:#20C8C0;">Valley</span></p>
            <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A8B2B0;">by Rio Pomba Valley</p>
            </td>
            </tr>
            <tr>
            <td class="tv-pad" style="padding:28px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="height:1px;font-size:1px;line-height:1px;background-color:#273238;">&nbsp;</td></tr></table>
            </td>
            </tr>
            <tr>
            <td class="tv-pad" style="padding:30px 40px 0;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#20C8C0;">{eyebrow}</p>
            <h1 class="tv-h1" style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.25;font-weight:600;color:#F4F7F6;">{headline}</h1>
            {paragraphsHtml}
            </td>
            </tr>
            <tr>
            <td class="tv-pad" style="padding:10px 40px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" bgcolor="#A0D060" style="border-radius:6px;background-color:#A0D060;">
            <a class="tv-btn" href="{href}" style="display:inline-block;padding:15px 36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:1.2;color:#15201D;text-decoration:none;border-radius:6px;">{ctaLabel}</a>
            </td>
            </tr></table>
            </td>
            </tr>
            """;

        var tail = $"""
            <tr>
            <td class="tv-pad" style="padding:28px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="height:1px;font-size:1px;line-height:1px;background-color:#273238;">&nbsp;</td></tr></table>
            <p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#A8B2B0;">Se o botão não funcionar, copie e cole o endereço abaixo no navegador:</p>
            <p style="margin:10px 0 0;font-family:Consolas,'Courier New',monospace;font-size:12px;line-height:1.6;color:#F4F7F6;word-break:break-all;overflow-wrap:anywhere;">{href}</p>
            <p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#A8B2B0;">{note}</p>
            </td>
            </tr>
            <tr>
            <td class="tv-pad" style="padding:28px 40px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="height:1px;font-size:1px;line-height:1px;background-color:#273238;">&nbsp;</td></tr></table>
            <p style="margin:26px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:2px;text-align:center;color:#20C8C0;">TALENTOS · CONEXÕES · OPORTUNIDADES</p>
            <p style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:600;text-align:center;color:#F4F7F6;">Talent Valley</p>
            <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;text-align:center;color:#A8B2B0;">Uma iniciativa Rio Pomba Valley</p>
            </td>
            </tr>
            </table>
            </td>
            </tr>
            </table>
            </body>
            </html>
            """;
        return head + tail;
    }

    private static string Paragraph(string text) =>
        $"""<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#A8B2B0;">{text}</p>""";
}
