import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiDownload } from "@/lib/api";
import { clearProtectedFiles, downloadProtectedFile, forgetProtectedFile } from "@/lib/protectedFileCache";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiDownload: vi.fn(),
}));

const PHOTO = "/api/alunos/me/foto";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(apiDownload).mockImplementation(async () => new Blob(["x"]));
  clearProtectedFiles();
});

describe("protectedFileCache", () => {
  it("shares one download between callers of the same file", async () => {
    await Promise.all([downloadProtectedFile(PHOTO), downloadProtectedFile(PHOTO)]);

    expect(apiDownload).toHaveBeenCalledTimes(1);
  });

  it("keeps a separate copy per reload key", async () => {
    await downloadProtectedFile(PHOTO, 0);
    await downloadProtectedFile(PHOTO, 1);

    expect(apiDownload).toHaveBeenCalledTimes(2);
  });

  it("downloads again after the file is forgotten", async () => {
    await downloadProtectedFile(PHOTO, 0);
    await downloadProtectedFile(PHOTO, 1);

    forgetProtectedFile(PHOTO);
    await downloadProtectedFile(PHOTO, 0);
    await downloadProtectedFile(PHOTO, 1);

    expect(apiDownload).toHaveBeenCalledTimes(4);
  });

  it("forgets only the file that changed", async () => {
    await downloadProtectedFile("/api/talentos/ana/foto");

    forgetProtectedFile(PHOTO);
    await downloadProtectedFile("/api/talentos/ana/foto");

    expect(apiDownload).toHaveBeenCalledTimes(1);
  });

  it("downloads again after the cache is cleared (login, logout)", async () => {
    await downloadProtectedFile(PHOTO);

    clearProtectedFiles();
    await downloadProtectedFile(PHOTO);

    expect(apiDownload).toHaveBeenCalledTimes(2);
  });

  it("keeps only the most recent files", async () => {
    for (let index = 0; index < 31; index += 1) await downloadProtectedFile(`/api/talentos/t${index}/foto`);
    expect(apiDownload).toHaveBeenCalledTimes(31);

    await downloadProtectedFile("/api/talentos/t30/foto");
    expect(apiDownload).toHaveBeenCalledTimes(31);

    await downloadProtectedFile("/api/talentos/t0/foto");
    expect(apiDownload).toHaveBeenCalledTimes(32);
  });
});
