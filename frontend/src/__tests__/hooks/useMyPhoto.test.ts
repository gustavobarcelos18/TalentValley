import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMyPhoto } from "@/hooks/useMyPhoto";
import { notifyPhotoChange } from "@/lib/photoSync";
import { fetchMyProfile } from "@/lib/student";
import type { MeResponse } from "@/types/student";
import type { UserRole } from "@/types/auth";

const auth = vi.hoisted(() => ({ user: null as { id: string; role: UserRole } | null }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/lib/student");

const PHOTO = "/api/alunos/me/foto";
const withPhoto = (fotoUrl: string | null) => ({ dadosBasicos: { fotoUrl } }) as MeResponse;

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.user = { id: "1", role: "ALUNO" };
});

describe("useMyPhoto", () => {
  it.each<UserRole>(["RECRUTADOR", "ADMIN"])("does not request a profile for a %s", (role) => {
    auth.user = { id: "2", role };

    const { result } = renderHook(() => useMyPhoto());

    expect(result.current).toEqual({ photoPath: null, reloadKey: 0 });
    expect(fetchMyProfile).not.toHaveBeenCalled();
  });

  it("does not request a profile for an anonymous visitor", () => {
    auth.user = null;

    const { result } = renderHook(() => useMyPhoto());

    expect(result.current.photoPath).toBeNull();
    expect(fetchMyProfile).not.toHaveBeenCalled();
  });

  it("returns the student photo path once the profile loads", async () => {
    vi.mocked(fetchMyProfile).mockResolvedValueOnce(withPhoto(PHOTO));

    const { result } = renderHook(() => useMyPhoto());

    await waitFor(() => expect(result.current.photoPath).toBe(PHOTO));
    expect(result.current.reloadKey).toBe(0);
  });

  it("falls back to no photo when a profile reload fails", async () => {
    vi.mocked(fetchMyProfile)
      .mockResolvedValueOnce(withPhoto(PHOTO))
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useMyPhoto());
    await waitFor(() => expect(result.current.photoPath).toBe(PHOTO));

    act(() => notifyPhotoChange());

    await waitFor(() => expect(result.current.photoPath).toBeNull());
  });

  it("reloads the profile and bumps the reload key when the photo changes", async () => {
    vi.mocked(fetchMyProfile)
      .mockResolvedValueOnce(withPhoto(null))
      .mockResolvedValueOnce(withPhoto(PHOTO));
    const { result } = renderHook(() => useMyPhoto());
    await waitFor(() => expect(fetchMyProfile).toHaveBeenCalledTimes(1));

    act(() => notifyPhotoChange());

    await waitFor(() => expect(result.current.photoPath).toBe(PHOTO));
    expect(result.current.reloadKey).toBe(1);
  });

  it("ignores a response that was overtaken by a newer request", async () => {
    const first = deferred<MeResponse>();
    vi.mocked(fetchMyProfile)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(withPhoto("/new"));
    const { result } = renderHook(() => useMyPhoto());

    act(() => notifyPhotoChange());
    await waitFor(() => expect(result.current.photoPath).toBe("/new"));
    await act(async () => first.resolve(withPhoto("/old")));

    expect(result.current.photoPath).toBe("/new");
  });

  it("stops listening for photo changes after unmount", async () => {
    const pending = deferred<MeResponse>();
    vi.mocked(fetchMyProfile).mockReturnValueOnce(pending.promise);
    const { unmount } = renderHook(() => useMyPhoto());

    unmount();
    await act(async () => pending.resolve(withPhoto(PHOTO)));
    act(() => notifyPhotoChange());

    expect(fetchMyProfile).toHaveBeenCalledTimes(1);
  });

  it("hides the previous user's photo while the next profile is loading", async () => {
    vi.mocked(fetchMyProfile).mockResolvedValueOnce(withPhoto(PHOTO));
    const { result, rerender } = renderHook(() => useMyPhoto());
    await waitFor(() => expect(result.current.photoPath).toBe(PHOTO));
    const next = deferred<MeResponse>();
    vi.mocked(fetchMyProfile).mockReturnValueOnce(next.promise);

    auth.user = { id: "9", role: "ALUNO" };
    rerender();

    expect(result.current.photoPath).toBeNull();
    await act(async () => next.resolve(withPhoto("/other")));
    expect(result.current.photoPath).toBe("/other");
  });
});
