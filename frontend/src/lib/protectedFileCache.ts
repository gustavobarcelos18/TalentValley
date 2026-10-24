import { apiDownload } from "./api";

// Photos can be several MB, so only the latest ones are kept.
const MAX_ENTRIES = 30;

// The API answers protected files with `no-store`, so the browser never reuses them. This cache only lives in the
// memory of the open tab: the same download is shared by every avatar of the page and by later visits to a screen.
// It is emptied on every login, logout or demo switch so one user's file is never shown to another.
const downloads = new Map<string, Promise<Blob>>();

const keyOf = (path: string, reloadKey: number) => `${reloadKey}:${path}`;

export function downloadProtectedFile(path: string, reloadKey = 0): Promise<Blob> {
  const key = keyOf(path, reloadKey);
  const cached = downloads.get(key);
  if (cached) {
    // Re-insert so the most recently used entry is the last one to be evicted.
    downloads.delete(key);
    downloads.set(key, cached);
    return cached;
  }

  const download = apiDownload(path);
  downloads.set(key, download);
  // A failed download (including "no file yet") is never kept, so the next visit tries again.
  download.catch(() => {
    if (downloads.get(key) === download) downloads.delete(key);
  });
  if (downloads.size > MAX_ENTRIES) {
    const oldest = downloads.keys().next().value;
    if (oldest !== undefined) downloads.delete(oldest);
  }
  return download;
}

/** Drops every kept copy of a file, for when its content changed (a new or removed photo). */
export function forgetProtectedFile(path: string): void {
  for (const key of Array.from(downloads.keys())) {
    if (key.endsWith(`:${path}`)) downloads.delete(key);
  }
}

export function clearProtectedFiles(): void {
  downloads.clear();
}
