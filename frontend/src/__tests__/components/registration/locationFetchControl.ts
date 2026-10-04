import { vi } from "vitest";

type FetchCall = {
  url: string;
  signal: AbortSignal;
  respond: (body: unknown, ok?: boolean) => void;
};

export function createFetchControl({ rejectOnAbort = true } = {}) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn((url: string, init: { signal: AbortSignal }) =>
    new Promise<Response>((resolve, reject) => {
      if (rejectOnAbort) {
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }
      calls.push({
        url,
        signal: init.signal,
        respond: (body, ok = true) => resolve({ ok, json: () => Promise.resolve(body) } as Response),
      });
    }),
  );

  const callTo = (host: string) => calls.filter((call) => call.url.includes(host));

  return { fetchMock, callTo };
}
