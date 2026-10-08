import type { ComponentProps, ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/components/auth/AuthProvider";
import { useAuth } from "@/hooks/useAuth";

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>["value"]>;

describe("useAuth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the value provided by the AuthProvider context", () => {
    const value: AuthValue = {
      user: { id: "1", nome: "Ana", email: "ana@example.com", role: "ALUNO" },
      loading: false,
      error: null,
      loginCompleted: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      clearError: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toBe(value);
  });

  it("throws outside an AuthProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used within an AuthProvider");
  });
});
