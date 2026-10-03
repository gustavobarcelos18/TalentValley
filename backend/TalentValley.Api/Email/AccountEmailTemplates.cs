using System.Net;

namespace TalentValley.Api.Email;

public sealed record EmailContent(string Html, string Text);

/// <summary>
/// Builds the HTML and plain-text bodies of account emails. Email clients ignore external CSS, web fonts and SVG,
/// so the layout uses tables, inline styles and system fonts only.
/// </summary>
public static class AccountEmailTemplates
{
    public static EmailContent Activation(string link) => Build(link,
        heading: "Ative sua conta",
        intro: "Sua conta no Talent Valley foi criada. Para começar a usar a plataforma, defina sua senha e ative o acesso.",
        buttonLabel: "Ativar conta",
        textAction: "Para ativar sua conta, acesse",
        notice: null);

    public static EmailContent PasswordReset(string link) => Build(link,
        heading: "Redefina sua senha",
        intro: "Recebemos um pedido para redefinir a senha da sua conta no Talent Valley. Use o botão abaixo para escolher uma nova senha.",
        buttonLabel: "Redefinir senha",
        textAction: "Para redefinir sua senha, acesse",
        notice: "Não foi você? Ignore este e-mail. Sua senha atual continua a mesma e nenhuma alteração será feita.");

    private const string Font = "'Segoe UI',Helvetica,Arial,sans-serif";
    private const string Brand = "#007D32";
    private const string Muted = "#53605C";

    private static EmailContent Build(string link, string heading, string intro, string buttonLabel,
        string textAction, string? notice)
    {
        // Heading, intro, button label and notice are fixed constants above; only the link is dynamic and needs encoding.
        var href = WebUtility.HtmlEncode(link);
        var noticeHtml = notice is null ? "" :
            $$"""<tr><td style="padding:24px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#F6F7F2;border-left:4px solid #A0D060;border-radius:6px;padding:14px 16px;font-family:{{Font}};font-size:14px;line-height:21px;color:{{Muted}};">{{notice}}</td></tr></table></td></tr>""";

        // Outlook desktop ignores max-width (hence the mso ghost table) and padding on <a> (hence mso-padding-alt on the button cell).
        var html = $$"""
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="color-scheme" content="light">
            <title>{{heading}}</title>
            </head>
            <body style="margin:0;padding:0;background-color:#F6F7F2;">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">{{intro}}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F6F7F2;">
              <tr><td align="center" style="padding:32px 16px;">
                <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
                  <tr><td style="padding:0 0 20px 0;font-family:{{Font}};font-size:24px;line-height:28px;font-weight:700;color:#15201D;">
                    Talent <span style="color:{{Brand}};">Valley</span><br>
                    <span style="font-size:12px;line-height:16px;font-weight:400;color:{{Muted}};">by Rio Pomba Valley</span>
                  </td></tr>
                  <tr><td style="background-color:#FFFFFF;border:1px solid #D5DDD4;border-radius:12px;overflow:hidden;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td height="6" style="height:6px;line-height:6px;font-size:0;background-color:{{Brand}};background-image:linear-gradient(90deg,{{Brand}},#A0D060,#20C8C0);">&nbsp;</td></tr>
                      <tr><td style="padding:32px 28px;font-family:{{Font}};color:#15201D;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr><td style="font-family:{{Font}};font-size:22px;line-height:28px;font-weight:700;color:#15201D;">{{heading}}</td></tr>
                          <tr><td style="padding:12px 0 0 0;font-family:{{Font}};font-size:16px;line-height:24px;color:{{Muted}};">{{intro}}</td></tr>
                          <tr><td style="padding:28px 0 0 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                              <td align="center" bgcolor="{{Brand}}" style="background-color:{{Brand}};border-radius:8px;mso-padding-alt:14px 28px;">
                                <a href="{{href}}" style="display:inline-block;padding:14px 28px;font-family:{{Font}};font-size:16px;line-height:20px;font-weight:600;color:#FFFFFF;text-decoration:none;">{{buttonLabel}}</a>
                              </td>
                            </tr></table>
                          </td></tr>
                          <tr><td style="padding:24px 0 0 0;font-family:{{Font}};font-size:13px;line-height:20px;color:{{Muted}};">Se o botão não funcionar, copie e cole este endereço no navegador:<br>
                            <a href="{{href}}" style="color:{{Brand}};word-break:break-all;">{{href}}</a></td></tr>
                          {{noticeHtml}}
                        </table>
                      </td></tr>
                    </table>
                  </td></tr>
                  <tr><td align="center" style="padding:20px 0 0 0;font-family:{{Font}};font-size:12px;line-height:18px;color:{{Muted}};">
                    Mensagem automática do Talent Valley, a plataforma de carreira do Rio Pomba Valley.
                  </td></tr>
                </table>
                <!--[if mso]></td></tr></table><![endif]-->
              </td></tr>
            </table>
            </body>
            </html>
            """;

        var text = $"{heading}\n\n{intro}\n\n{textAction}: {link}" + (notice is null ? "" : $"\n\n{notice}");
        return new EmailContent(html, text);
    }
}
