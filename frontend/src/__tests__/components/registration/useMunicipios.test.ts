import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { municipioCache, type Municipio } from "@/components/registration/location";
import { useMunicipios } from "@/components/registration/useMunicipios";
import { createFetchControl } from "./locationFetchControl";

const IBGE = "servicodados.ibge.gov.br";
const TIMEOUT_MS = 10_000;
const RIO_POMBA: Municipio = { id: 1, nome: "Rio Pomba" };
const CAMPINAS: Municipio = { id: 2, nome: "Campinas" };

let control: ReturnType<typeof createFetchControl>;

const flush = () => act(() => Promise.resolve());

beforeEach(() => {
  control = createFetchControl();
  vi.stubGlobal("fetch", control.fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  municipioCache.clear();
});

describe("useMunicipios", () => {
  it("stays idle without a UF", () => {
    const { result } = renderHook(() => useMunicipios(""));

    expect(result.current).toMatchObject({ municipios: [], loading: false, error: false });
    expect(control.fetchMock).not.toHaveBeenCalled();
  });

  it("returns cached municipalities without fetching", () => {
    municipioCache.set("MG", [RIO_POMBA]);

    const { result } = renderHook(() => useMunicipios("MG"));

    expect(result.current).toMatchObject({ municipios: [RIO_POMBA], loading: false, error: false });
    expect(control.fetchMock).not.toHaveBeenCalled();
  });

  it("loads the municipalities of the UF and caches them", async () => {
    const { result } = renderHook(() => useMunicipios("MG"));
    expect(result.current.loading).toBe(true);

    control.callTo(IBGE)[0].respond([{ id: 1, nome: "Rio Pomba" }]);
    await flush();

    expect(result.current).toMatchObject({ municipios: [RIO_POMBA], loading: false, error: false });
    expect(municipioCache.get("MG")).toEqual([RIO_POMBA]);
  });

  it("reports an error when the request fails", async () => {
    const { result } = renderHook(() => useMunicipios("MG"));

    control.callTo(IBGE)[0].respond([], false);
    await flush();

    expect(result.current).toMatchObject({ municipios: [], loading: false, error: true });
    expect(municipioCache.has("MG")).toBe(false);
  });

  it("reports an error when the request times out", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMunicipios("MG"));

    await act(() => vi.advanceTimersByTimeAsync(TIMEOUT_MS));

    expect(control.callTo(IBGE)[0].signal.aborted).toBe(true);
    expect(result.current.error).toBe(true);
  });

  it("does not time out once the response arrived", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMunicipios("MG"));
    control.callTo(IBGE)[0].respond([{ id: 1, nome: "Rio Pomba" }]);
    await act(() => vi.advanceTimersByTimeAsync(0));

    await act(() => vi.advanceTimersByTimeAsync(TIMEOUT_MS));

    expect(result.current).toMatchObject({ municipios: [RIO_POMBA], error: false });
  });

  it("aborts the previous request and ignores its failure when the UF changes", async () => {
    const { result, rerender } = renderHook(({ uf }) => useMunicipios(uf), { initialProps: { uf: "MG" } });

    rerender({ uf: "SP" });
    await flush();

    const [first, second] = control.callTo(IBGE);
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(result.current).toMatchObject({ loading: true, error: false });

    second.respond([{ id: 2, nome: "Campinas" }]);
    await flush();
    expect(result.current.municipios).toEqual([CAMPINAS]);
  });

  it("caches a late response of an obsolete UF without changing the displayed state", async () => {
    const lateControl = createFetchControl({ rejectOnAbort: false });
    vi.stubGlobal("fetch", lateControl.fetchMock);
    const { result, rerender } = renderHook(({ uf }) => useMunicipios(uf), { initialProps: { uf: "MG" } });
    rerender({ uf: "SP" });
    await flush();

    lateControl.callTo(IBGE)[0].respond([{ id: 1, nome: "Rio Pomba" }]);
    await flush();

    expect(municipioCache.get("MG")).toEqual([RIO_POMBA]);
    expect(result.current).toMatchObject({ municipios: [], loading: true });
  });

  it("switches to cached municipalities and to idle when the UF changes", async () => {
    municipioCache.set("SP", [CAMPINAS]);
    const { result, rerender } = renderHook(({ uf }) => useMunicipios(uf), { initialProps: { uf: "MG" } });

    rerender({ uf: "SP" });
    expect(result.current).toMatchObject({ municipios: [CAMPINAS], loading: false });

    rerender({ uf: "" });
    expect(result.current).toMatchObject({ municipios: [], loading: false, error: false });
    expect(control.callTo(IBGE)).toHaveLength(1);
  });

  it("retries after an error by dropping the cache entry and requesting again", async () => {
    const { result } = renderHook(() => useMunicipios("MG"));
    control.callTo(IBGE)[0].respond([], false);
    await flush();
    expect(result.current.error).toBe(true);

    act(() => result.current.retry());
    await flush();
    expect(result.current).toMatchObject({ loading: true, error: false });

    control.callTo(IBGE)[1].respond([{ id: 1, nome: "Rio Pomba" }]);
    await flush();
    expect(result.current).toMatchObject({ municipios: [RIO_POMBA], error: false });
  });

  it("aborts the pending request on unmount without reporting an error or caching anything", async () => {
    const { result, unmount } = renderHook(() => useMunicipios("MG"));
    const [call] = control.callTo(IBGE);

    unmount();
    await flush();

    expect(call.signal.aborted).toBe(true);
    expect(result.current).toMatchObject({ municipios: [], loading: true, error: false });
    expect(municipioCache.has("MG")).toBe(false);
  });
});
