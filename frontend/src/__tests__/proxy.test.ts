import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
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

  it("declares a matcher for the protected areas", () => {
    expect(config.matcher).toEqual(expect.arrayContaining(["/meu-perfil/:path*", "/recrutador/:path*", "/admin/:path*"]));
  });
});
