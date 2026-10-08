using TalentValley.Api.Email;

namespace TalentValley.Api.Tests;

public sealed class AccountEmailTemplatesTests
{
    private const string Link = "https://talent.example/redefinir-senha?email=maria%40example.test&token=reset-secret";
    private const string EncodedLink = "https://talent.example/redefinir-senha?email=maria%40example.test&amp;token=reset-secret";
    private const string NotWhoDidItNotice = "Não foi você?";

    [Fact]
    public void Password_reset_has_button_text_link_and_ignore_notice()
    {
        var content = AccountEmailTemplates.PasswordReset(Link);

        Assert.Contains($"<a href=\"{EncodedLink}\"", content.Html);
        Assert.Contains("Redefinir senha</a>", content.Html);
        Assert.Contains($">{EncodedLink}</a>", content.Html);
        Assert.Contains(NotWhoDidItNotice, content.Html);
        Assert.Contains(Link, content.Text);
        Assert.Contains(NotWhoDidItNotice, content.Text);
    }

    [Fact]
    public void Activation_has_button_and_text_link_without_ignore_notice()
    {
        var link = "https://talent.example/ativar-conta?email=maria%40example.test&token=activation-secret";
        var encoded = "https://talent.example/ativar-conta?email=maria%40example.test&amp;token=activation-secret";

        var content = AccountEmailTemplates.Activation(link);

        Assert.Contains($"<a href=\"{encoded}\"", content.Html);
        Assert.Contains("Ativar conta</a>", content.Html);
        Assert.Contains($">{encoded}</a>", content.Html);
        Assert.Contains(link, content.Text);
        Assert.DoesNotContain(NotWhoDidItNotice, content.Html);
        Assert.DoesNotContain(NotWhoDidItNotice, content.Text);
    }

    [Fact]
    public void Link_is_html_encoded_so_it_cannot_break_out_of_the_attribute()
    {
        var content = AccountEmailTemplates.PasswordReset("https://talent.example/x?a=1&b=\"><script>alert(1)</script>");

        Assert.DoesNotContain("<script>", content.Html);
        Assert.DoesNotContain("&b=\"", content.Html);
        Assert.Contains("&amp;b=&quot;&gt;&lt;script&gt;", content.Html);
    }
}
