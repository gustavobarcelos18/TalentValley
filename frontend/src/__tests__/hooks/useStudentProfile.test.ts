import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { ApiError } from "@/lib/api";
import { fetchMyProfile } from "@/lib/student";
import type { MeResponse } from "@/types/student";

vi.mock("@/lib/student");

const LOAD_ERROR = "Não foi possível carregar seu perfil. Tente novamente.";
const REFRESH_ERROR = "Não foi possível atualizar o perfil. Tente novamente.";
const profile = (slug: string) => ({ slug }) as MeResponse;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useStudentProfile", () => {
  it("starts loading and exposes the profile once it arrives", async () => {
    vi.mocked(fetchMyProfile).mockResolvedValueOnce(profile("ana"));

    const { result } = renderHook(() => useStudentProfile());

    expect(result.current).toMatchObject({ profile: null, loading: true, error: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ profile: { slug: "ana" }, error: null });
  });

  it("reports the API error title when the first load fails", async () => {
    vi.mocked(fetchMyProfile).mockRejectedValueOnce(new ApiError(500, "msg", { title: "Falhou" }));

    const { result } = renderHook(() => useStudentProfile());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ profile: null, error: "Falhou" });
  });

  it("uses the load fallback for errors without text", async () => {
    vi.mocked(fetchMyProfile).mockRejectedValueOnce("offline");

    const { result } = renderHook(() => useStudentProfile());

    await waitFor(() => expect(result.current.error).toBe(LOAD_ERROR));
  });

  it("refresh replaces the profile and clears a previous error", async () => {
    vi.mocked(fetchMyProfile)
      .mockResolvedValueOnce(profile("ana"))
      .mockRejectedValueOnce("offline")
      .mockResolvedValueOnce(profile("ana-2"));
    const { result } = renderHook(() => useStudentProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.refresh());
    expect(result.current.error).toBe(REFRESH_ERROR);

    await act(() => result.current.refresh());

    expect(result.current).toMatchObject({ profile: { slug: "ana-2" }, loading: false, error: null });
  });

  it("refresh keeps the last known profile when it fails", async () => {
    vi.mocked(fetchMyProfile)
      .mockResolvedValueOnce(profile("ana"))
      .mockRejectedValueOnce("offline");
    const { result } = renderHook(() => useStudentProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.refresh());

    expect(result.current).toMatchObject({ profile: { slug: "ana" }, error: REFRESH_ERROR });
  });
});
