import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

function run(path: string, cookie?: string) {
  const request = new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);
  return proxy(request);
}

describe("proxy", () => {
  it.each(["/meu-perfil", "/recrutador/talentos", "/admin/alunos", "/conta/senha"])(
    "sends an anonymous visitor of %s to the login with the return url",
    (path) => {
      const response = run(path);

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("returnUrl")).toBe(path);
    },
  );

  it("lets a visitor with the access cookie through", () => {
    const response = run("/admin", "tv_access=token");

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not treat other cookies as a session", () => {
    expect(run("/admin", "other=token").status).toBe(307);
  });

  it.each(["/", "/login", "/cadastro/aluno"])("lets an anonymous visitor reach the public path %s", (path) => {
    const response = run(path);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  describe("api requests", () => {
    const secret = "0123456789abcdef0123456789abcdef";

    function runApi(headers: Record<string, string>) {
      return proxy(new NextRequest("http://localhost:3000/api/auth/login", { headers }));
    }

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("forwards the visitor ip and the shared secret to the backend", () => {
      vi.stubEnv("CLIENT_IP_PROXY_SECRET", secret);

      const response = runApi({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" });

      expect(response.headers.get("x-middleware-request-x-client-ip")).toBe("198.51.100.7");
      expect(response.headers.get("x-middleware-request-x-proxy-secret")).toBe(secret);
    });

    it("falls back to x-real-ip when x-forwarded-for is missing", () => {
      vi.stubEnv("CLIENT_IP_PROXY_SECRET", secret);

      const response = runApi({ "x-real-ip": "198.51.100.8" });

      expect(response.headers.get("x-middleware-request-x-client-ip")).toBe("198.51.100.8");
    });

    it("overwrites an ip and secret sent by the browser", () => {
      vi.stubEnv("CLIENT_IP_PROXY_SECRET", secret);

      const response = runApi({
        "x-forwarded-for": "198.51.100.7",
        "x-client-ip": "203.0.113.99",
        "x-proxy-secret": "guessed",
      });

      expect(response.headers.get("x-middleware-request-x-client-ip")).toBe("198.51.100.7");
      expect(response.headers.get("x-middleware-request-x-proxy-secret")).toBe(secret);
    });

    it("drops browser-sent ip and secret when no secret is configured", () => {
      vi.stubEnv("CLIENT_IP_PROXY_SECRET", "");

      const response = runApi({
        "x-forwarded-for": "198.51.100.7",
        "x-client-ip": "203.0.113.99",
        "x-proxy-secret": "guessed",
      });

      const overridden = response.headers.get("x-middleware-override-headers") ?? "";
      expect(overridden).not.toContain("x-client-ip");
      expect(overridden).not.toContain("x-proxy-secret");
      expect(response.headers.get("x-middleware-request-x-client-ip")).toBeNull();
    });

    it("does not hand the secret to page requests", () => {
      vi.stubEnv("CLIENT_IP_PROXY_SECRET", secret);

      const response = proxy(new NextRequest("http://localhost:3000/", { headers: { "x-forwarded-for": "198.51.100.7" } }));

      expect(response.headers.get("x-middleware-request-x-proxy-secret")).toBeNull();
      expect(response.headers.get("x-middleware-request-x-client-ip")).toBeNull();
    });

    it("sends no ip headers when the visitor ip is unknown", () => {
      vi.stubEnv("CLIENT_IP_PROXY_SECRET", secret);

      const response = runApi({});

      expect(response.headers.get("x-middleware-request-x-client-ip")).toBeNull();
      expect(response.headers.get("x-middleware-request-x-proxy-secret")).toBeNull();
    });
  });

  it("declares a matcher for the protected areas", () => {
    expect(config.matcher).toEqual(expect.arrayContaining(["/meu-perfil/:path*", "/recrutador/:path*", "/admin/:path*"]));
  });
});
