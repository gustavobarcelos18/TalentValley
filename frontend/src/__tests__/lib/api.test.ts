import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CSRF_PATH = "/api/auth/csrf";
const ITEMS_PATH = "/api/items";
const CSRF_HEADER = "X-XSRF-TOKEN";
const ANTIFORGERY_TITLE = "Invalid antiforgery token.";
const SERVER_ERROR = "Erro na requisição (500)";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function problemResponse(status: number, title: string, headers: Record<string, string> = {}) {
  return jsonResponse({ title, status }, status, headers);
}

function noContent() {
  return new Response(null, { status: 204 });
}

async function loadApi() {
  vi.resetModules();
  return import("@/lib/api");
}

function initOf(callIndex: number) {
  return fetchMock.mock.calls[callIndex]![1] as RequestInit & { headers: Record<string, string> };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("csrf token", () => {
  it("stores the token returned by the server", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "abc" }));

    expect(api.getCsrfToken()).toBeNull();
    await expect(api.fetchCsrfToken()).resolves.toBe("abc");

    expect(api.getCsrfToken()).toBe("abc");
    expect(fetchMock).toHaveBeenCalledWith(CSRF_PATH, { credentials: "include" });
  });

  it("fails with the status when the server refuses", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(api.fetchCsrfToken()).rejects.toThrow("Falha ao obter token de segurança (503)");
  });

  it("ensureCsrfToken only fetches when there is no token yet", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "abc" }));

    await api.ensureCsrfToken();
    await api.ensureCsrfToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshCsrfToken replaces the token and swallows failures", async () => {
    const api = await loadApi();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: "first" }))
      .mockResolvedValueOnce(jsonResponse({ token: "second" }))
      .mockRejectedValueOnce(new Error("offline"));

    await api.refreshCsrfToken();
    expect(api.getCsrfToken()).toBe("first");
    await api.refreshCsrfToken();
    expect(api.getCsrfToken()).toBe("second");
    await expect(api.refreshCsrfToken()).resolves.toBeUndefined();
    expect(api.getCsrfToken()).toBe("second");
  });
});

describe("apiGet", () => {
  it("sends credentials and returns the parsed body", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }));

    await expect(api.apiGet(ITEMS_PATH)).resolves.toEqual({ id: 1 });

    expect(fetchMock).toHaveBeenCalledWith(ITEMS_PATH, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  });

  it("returns undefined for 204", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(noContent());

    await expect(api.apiGet(ITEMS_PATH)).resolves.toBeUndefined();
  });

  it("prefixes the path with NEXT_PUBLIC_API_BASE_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.com");
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await api.apiGet(ITEMS_PATH);

    expect(fetchMock.mock.calls[0]![0]).toBe(`https://api.example.com${ITEMS_PATH}`);
  });
});

describe("error parsing", () => {
  it("uses the ProblemDetails title as the message", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(problemResponse(404, "Not found"));

    const error = await api.apiGet(ITEMS_PATH).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(api.ApiError);
    expect(error).toMatchObject({ name: "ApiError", status: 404, message: "Not found", problem: { title: "Not found" } });
  });

  it("falls back to a generic message when the problem has no title", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "x" }, 500));

    await expect(api.apiGet(ITEMS_PATH)).rejects.toMatchObject({ status: 500, message: SERVER_ERROR });
  });

  it("falls back to a generic message when the JSON body is invalid", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(new Response("{", { status: 500, headers: { "content-type": "application/json" } }));

    await expect(api.apiGet(ITEMS_PATH)).rejects.toMatchObject({ message: SERVER_ERROR, problem: undefined });
  });

  it("falls back to a generic message for non-JSON responses", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500, headers: { "content-type": "text/plain" } }));

    await expect(api.apiGet(ITEMS_PATH)).rejects.toMatchObject({ message: SERVER_ERROR });
  });

  it("reads Retry-After only when it is a number of seconds", async () => {
    const api = await loadApi();
    fetchMock
      .mockResolvedValueOnce(problemResponse(429, "Too many", { "retry-after": " 30 " }))
      .mockResolvedValueOnce(problemResponse(429, "Too many", { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }))
      .mockResolvedValueOnce(problemResponse(429, "Too many"))
      .mockResolvedValueOnce(new Response("busy", { status: 503, headers: { "retry-after": "5" } }));

    await expect(api.apiGet(ITEMS_PATH)).rejects.toMatchObject({ retryAfterSeconds: 30 });
    await expect(api.apiGet(ITEMS_PATH)).rejects.toMatchObject({ retryAfterSeconds: undefined });
    await expect(api.apiGet(ITEMS_PATH)).rejects.toMatchObject({ retryAfterSeconds: undefined });
    await expect(api.apiGet(ITEMS_PATH)).rejects.toMatchObject({ retryAfterSeconds: 5 });
  });

  it("notifies the unauthorized handler on every 401 until it is cleared", async () => {
    const api = await loadApi();
    const handler = vi.fn();
    api.setUnauthorizedHandler(handler);
    fetchMock
      .mockResolvedValueOnce(problemResponse(401, "Unauthorized"))
      .mockResolvedValueOnce(problemResponse(403, "Forbidden"))
      .mockResolvedValueOnce(problemResponse(401, "Unauthorized"));

    await expect(api.apiGet(ITEMS_PATH)).rejects.toMatchObject({ status: 401 });
    await expect(api.apiGet(ITEMS_PATH)).rejects.toMatchObject({ status: 403 });
    expect(handler).toHaveBeenCalledTimes(1);

    api.setUnauthorizedHandler(null);
    await expect(api.apiGet(ITEMS_PATH)).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("apiMutation", () => {
  it("sends a JSON body with the method and credentials", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(api.apiMutation("PUT", ITEMS_PATH, { a: 1 })).resolves.toEqual({ ok: true });

    expect(fetchMock.mock.calls[0]![0]).toBe(ITEMS_PATH);
    expect(initOf(0)).toMatchObject({
      method: "PUT",
      credentials: "include",
      body: JSON.stringify({ a: 1 }),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
    });
  });

  it("sends neither body nor Content-Type when there is no body", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(noContent());

    await expect(api.apiMutation("DELETE", ITEMS_PATH)).resolves.toBeUndefined();

    expect(initOf(0).body).toBeUndefined();
    expect(initOf(0).headers).not.toHaveProperty("Content-Type");
  });

  it("attaches the CSRF header once a token is known", async () => {
    const api = await loadApi();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(noContent());

    await api.fetchCsrfToken();
    await api.apiMutation("POST", ITEMS_PATH, {});

    expect(initOf(1).headers[CSRF_HEADER]).toBe("tok");
  });

  it("returns undefined for an empty or blank success body", async () => {
    const api = await loadApi();
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("  \n", { status: 200 }));

    await expect(api.apiMutation("POST", ITEMS_PATH)).resolves.toBeUndefined();
    await expect(api.apiMutation("POST", ITEMS_PATH)).resolves.toBeUndefined();
  });

  it("retries once with a fresh token after an antiforgery failure", async () => {
    const api = await loadApi();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: "stale" }))
      .mockResolvedValueOnce(problemResponse(400, ANTIFORGERY_TITLE))
      .mockResolvedValueOnce(jsonResponse({ token: "fresh" }))
      .mockResolvedValueOnce(jsonResponse({ saved: true }));

    await api.fetchCsrfToken();
    await expect(api.apiMutation("POST", ITEMS_PATH, { a: 1 })).resolves.toEqual({ saved: true });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(initOf(1).headers[CSRF_HEADER]).toBe("stale");
    expect(fetchMock.mock.calls[2]![0]).toBe(CSRF_PATH);
    expect(initOf(3).headers[CSRF_HEADER]).toBe("fresh");
    expect(initOf(3).body).toBe(JSON.stringify({ a: 1 }));
  });

  it("does not retry twice when the antiforgery failure persists", async () => {
    const api = await loadApi();
    fetchMock
      .mockResolvedValueOnce(problemResponse(400, ANTIFORGERY_TITLE))
      .mockResolvedValueOnce(jsonResponse({ token: "fresh" }))
      .mockResolvedValueOnce(problemResponse(400, ANTIFORGERY_TITLE));

    await expect(api.apiMutation("POST", ITEMS_PATH)).rejects.toMatchObject({ status: 400, message: ANTIFORGERY_TITLE });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry when retry is disabled or the error is something else", async () => {
    const api = await loadApi();
    fetchMock
      .mockResolvedValueOnce(problemResponse(400, ANTIFORGERY_TITLE))
      .mockResolvedValueOnce(problemResponse(400, "Other"))
      .mockResolvedValueOnce(problemResponse(409, ANTIFORGERY_TITLE));

    await expect(api.apiMutation("POST", ITEMS_PATH, undefined, false)).rejects.toMatchObject({ status: 400 });
    await expect(api.apiMutation("POST", ITEMS_PATH)).rejects.toMatchObject({ message: "Other" });
    await expect(api.apiMutation("POST", ITEMS_PATH)).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("apiUpload", () => {
  it("posts the form data without forcing a Content-Type", async () => {
    const api = await loadApi();
    const formData = new FormData();
    formData.append("file", new Blob(["x"]), "a.txt");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(noContent());

    await api.fetchCsrfToken();
    await expect(api.apiUpload(ITEMS_PATH, formData)).resolves.toBeUndefined();

    expect(initOf(1)).toMatchObject({ method: "POST", credentials: "include", body: formData });
    expect(initOf(1).headers).toEqual({ Accept: "application/json", [CSRF_HEADER]: "tok" });
  });

  it("throws the parsed error when the upload is rejected", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(problemResponse(413, "Too large"));

    await expect(api.apiUpload(ITEMS_PATH, new FormData(), false)).rejects.toMatchObject({ status: 413, message: "Too large" });
  });
});

describe("apiDownload", () => {
  it("returns the response bytes", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(new Response("pdf-bytes", { status: 200 }));

    const blob = await api.apiDownload("/api/file");

    expect(await blob.text()).toBe("pdf-bytes");
    expect(initOf(0).headers.Accept).toBe("application/octet-stream, application/pdf, image/*");
    expect(initOf(0).credentials).toBe("include");
  });

  it("throws an ApiError when the download fails", async () => {
    const api = await loadApi();
    fetchMock.mockResolvedValueOnce(problemResponse(404, "Not found"));

    await expect(api.apiDownload("/api/file")).rejects.toMatchObject({ status: 404 });
  });
});

describe("getApiErrorMessage", () => {
  const FALLBACK = "fallback";

  it("prefers the problem title, then the ApiError message", async () => {
    const { ApiError, getApiErrorMessage } = await loadApi();

    expect(getApiErrorMessage(new ApiError(400, "msg", { title: "title" }), FALLBACK)).toBe("title");
    expect(getApiErrorMessage(new ApiError(400, "msg"), FALLBACK)).toBe("msg");
  });

  it("uses the message of a plain Error and the fallback otherwise", async () => {
    const { getApiErrorMessage } = await loadApi();

    expect(getApiErrorMessage(new Error("boom"), FALLBACK)).toBe("boom");
    expect(getApiErrorMessage(new Error(""), FALLBACK)).toBe(FALLBACK);
    expect(getApiErrorMessage("nope", FALLBACK)).toBe(FALLBACK);
  });
});
