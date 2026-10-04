import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedTalentPhoto } from "@/components/recruiter/ProtectedTalentPhoto";

interface ProtectedFileResult {
  url: string | null;
  loading: boolean;
}

let protectedFile: ProtectedFileResult = { url: null, loading: false };
const requestedPaths: Array<string | null> = [];

vi.mock("@/hooks/useProtectedFile", () => ({
  useProtectedFile: (path: string | null): ProtectedFileResult => {
    requestedPaths.push(path);
    return protectedFile;
  },
}));

const NAME = "Maria Souza";
const INITIALS = "MS";
const PHOTO_PATH = "/api/recrutador/talentos/maria/foto";
const PHOTO_URL = "blob:talent-valley/foto";
const DEFAULT_SIZE = 72;
const CUSTOM_SIZE = 40;

function avatarWidth(): string {
  const avatar = screen.getByText(INITIALS).closest(".MuiAvatar-root");
  return window.getComputedStyle(avatar as Element).width;
}

describe("ProtectedTalentPhoto", () => {
  beforeEach(() => {
    requestedPaths.length = 0;
  });

  it("requests the protected photo path", () => {
    protectedFile = { url: null, loading: false };
    render(<ProtectedTalentPhoto path={PHOTO_PATH} name={NAME} />);

    expect(requestedPaths).toEqual([PHOTO_PATH]);
  });

  it("shows initials and no spinner when there is no photo", () => {
    protectedFile = { url: null, loading: false };
    render(<ProtectedTalentPhoto path={null} name={NAME} />);

    expect(screen.getByText(INITIALS)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("renders the photo with an accessible description when loaded", () => {
    protectedFile = { url: PHOTO_URL, loading: false };
    render(<ProtectedTalentPhoto path={PHOTO_PATH} name={NAME} />);

    expect(screen.getByAltText(`Foto de ${NAME}`).getAttribute("src")).toBe(PHOTO_URL);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows a progress indicator over the initials while the photo is loading", () => {
    protectedFile = { url: null, loading: true };
    render(<ProtectedTalentPhoto path={PHOTO_PATH} name={NAME} />);

    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.getByText(INITIALS)).toBeTruthy();
  });

  it("applies the default and custom sizes to the avatar", () => {
    protectedFile = { url: null, loading: false };
    const { rerender } = render(<ProtectedTalentPhoto path={null} name={NAME} />);
    expect(avatarWidth()).toBe(`${DEFAULT_SIZE}px`);

    rerender(<ProtectedTalentPhoto path={null} name={NAME} size={CUSTOM_SIZE} />);
    expect(avatarWidth()).toBe(`${CUSTOM_SIZE}px`);
  });
});
