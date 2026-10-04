import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProtectedFile } from "@/hooks/useProtectedFile";
import { ApiError, apiDownload } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiDownload: vi.fn(),
}));

const PHOTO = "/api/alunos/me/foto";
const LOAD_ERROR = "Não foi possível carregar o arquivo.";
const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  let counter = 0;
  createObjectURL.mockImplementation(() => `blob:${++counter}`);
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

describe("useProtectedFile", () => {
  it("stays empty without a path and never downloads", () => {
    const { result } = renderHook(() => useProtectedFile(null));

    expect(result.current).toMatchObject({ url: null, loading: false, error: null });
    expect(apiDownload).not.toHaveBeenCalled();
  });

  it("downloads the file and exposes it as an object URL", async () => {
    vi.mocked(apiDownload).mockResolvedValueOnce(new Blob(["x"]));

    const { result } = renderHook(() => useProtectedFile(PHOTO));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.url).toBe("blob:1"));
    expect(result.current).toMatchObject({ loading: false, error: null });
    expect(apiDownload).toHaveBeenCalledWith(PHOTO);
  });

  it("treats a 404 as no file yet, not as an error", async () => {
    vi.mocked(apiDownload).mockRejectedValueOnce(new ApiError(404, "Not found"));

    const { result } = renderHook(() => useProtectedFile(PHOTO));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ url: null, error: null });
  });

  it("reports a friendly error for other failures", async () => {
    vi.mocked(apiDownload).mockRejectedValueOnce(new ApiError(500, "boom"));

    const { result } = renderHook(() => useProtectedFile(PHOTO));

    await waitFor(() => expect(result.current.error).toBe(LOAD_ERROR));
    expect(result.current.url).toBeNull();
  });

  it("reports a friendly error when the failure is not an ApiError", async () => {
    vi.mocked(apiDownload).mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useProtectedFile(PHOTO));

    await waitFor(() => expect(result.current.error).toBe(LOAD_ERROR));
  });

  it("revokes the previous object URL when the path changes", async () => {
    vi.mocked(apiDownload).mockResolvedValue(new Blob(["x"]));
    const { result, rerender } = renderHook(({ path }) => useProtectedFile(path), { initialProps: { path: PHOTO as string | null } });
    await waitFor(() => expect(result.current.url).toBe("blob:1"));

    rerender({ path: "/api/alunos/me/curriculo" });

    await waitFor(() => expect(result.current.url).toBe("blob:2"));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
  });

  it("hides the file and revokes its URL once the path is removed", async () => {
    vi.mocked(apiDownload).mockResolvedValueOnce(new Blob(["x"]));
    const { result, rerender } = renderHook(({ path }) => useProtectedFile(path), { initialProps: { path: PHOTO as string | null } });
    await waitFor(() => expect(result.current.url).toBe("blob:1"));

    rerender({ path: null });

    expect(result.current).toMatchObject({ url: null, loading: false, error: null });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
  });

  it("revokes the object URL on unmount", async () => {
    vi.mocked(apiDownload).mockResolvedValueOnce(new Blob(["x"]));
    const { result, unmount } = renderHook(() => useProtectedFile(PHOTO));
    await waitFor(() => expect(result.current.url).toBe("blob:1"));

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
  });

  it("ignores a download that finishes after unmount", async () => {
    let finish: (blob: Blob) => void = () => undefined;
    vi.mocked(apiDownload).mockReturnValueOnce(new Promise<Blob>((resolve) => { finish = resolve; }));
    const { unmount } = renderHook(() => useProtectedFile(PHOTO));

    unmount();
    await act(async () => finish(new Blob(["x"])));

    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("ignores a failure of a download that was replaced by a newer path", async () => {
    let failFirst: (error: unknown) => void = () => undefined;
    vi.mocked(apiDownload)
      .mockReturnValueOnce(new Promise<Blob>((_resolve, reject) => { failFirst = reject; }))
      .mockResolvedValueOnce(new Blob(["x"]));
    const { result, rerender } = renderHook(({ path }) => useProtectedFile(path), { initialProps: { path: PHOTO } });

    rerender({ path: "/api/alunos/me/curriculo" });
    await waitFor(() => expect(result.current.url).toBe("blob:1"));
    await act(async () => failFirst(new Error("late")));

    expect(result.current).toMatchObject({ url: "blob:1", error: null });
  });

  it("downloads again on reload and when the reload key changes", async () => {
    vi.mocked(apiDownload).mockResolvedValue(new Blob(["x"]));
    const { result, rerender } = renderHook(({ key }) => useProtectedFile(PHOTO, key), { initialProps: { key: 0 } });
    await waitFor(() => expect(result.current.url).toBe("blob:1"));

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.url).toBe("blob:2"));
    rerender({ key: 1 });
    await waitFor(() => expect(result.current.url).toBe("blob:3"));

    expect(apiDownload).toHaveBeenCalledTimes(3);
  });
});
