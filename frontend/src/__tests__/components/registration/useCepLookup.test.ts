import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CEP_LOOKUP_ERROR, municipioCache } from "@/components/registration/location";
import { useCepLookup } from "@/components/registration/useCepLookup";
import { createFetchControl } from "./locationFetchControl";

const VIACEP = "viacep.com.br";
const IBGE = "servicodados.ibge.gov.br";
const DEBOUNCE_MS = 400;
const TIMEOUT_MS = 8000;
const CEP = "36180-000";
const OTHER_CEP = "36700-120";
const VIACEP_BODY = { localidade: "Rio Pomba", uf: "MG" };
const MUNICIPIOS_BODY = [{ id: 1, nome: "Rio Pomba" }];
const FILL_FROM_LIST = "UF preenchida pelo CEP. Selecione a cidade na lista.";
const FILL_MANUALLY = "UF preenchida pelo CEP. Digite a cidade manualmente.";

type Props = { cep: string; cidade: string; uf: string; disabled: boolean };

const baseProps: Props = { cep: CEP, cidade: "", uf: "", disabled: false };
const onChange = vi.fn();

let control: ReturnType<typeof createFetchControl>;

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

function setup(overrides: Partial<Props> = {}) {
  return renderHook((props: Props) => useCepLookup({ ...props, onChange }), {
    initialProps: { ...baseProps, ...overrides },
  });
}

async function startLookup() {
  await advance(DEBOUNCE_MS);
  const call = control.callTo(VIACEP).at(-1);
  if (!call) throw new Error("The ViaCEP request was not made");
  return call;
}

beforeEach(() => {
  vi.useFakeTimers();
  onChange.mockReset();
  control = createFetchControl();
  vi.stubGlobal("fetch", control.fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  municipioCache.clear();
});

describe("useCepLookup", () => {
  it("stays idle and does not fetch while the CEP is incomplete", async () => {
    const { result } = setup({ cep: "36180-0" });

    await advance(DEBOUNCE_MS);

    expect(result.current).toEqual({ type: "idle" });
    expect(control.fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch while disabled", async () => {
    const { result } = setup({ disabled: true });

    await advance(DEBOUNCE_MS);

    expect(result.current).toEqual({ type: "idle" });
    expect(control.fetchMock).not.toHaveBeenCalled();
  });

  it("waits for the debounce, then reports loading and requests ViaCEP", async () => {
    const { result } = setup();

    await advance(DEBOUNCE_MS - 1);
    expect(control.fetchMock).not.toHaveBeenCalled();

    await advance(1);
    expect(control.callTo(VIACEP)[0].url).toBe("https://viacep.com.br/ws/36180000/json/");
    expect(result.current).toEqual({ type: "loading" });
  });

  it("fills UF and the official city name and reports success", async () => {
    const { result } = setup();
    (await startLookup()).respond({ localidade: "rio pomba", uf: "mg" });
    await advance(0);
    control.callTo(IBGE)[0].respond(MUNICIPIOS_BODY);
    await advance(0);

    expect(onChange).toHaveBeenCalledWith("uf", "MG");
    expect(onChange).toHaveBeenCalledWith("cidade", "Rio Pomba");
    expect(result.current).toEqual({ type: "success" });
    expect(municipioCache.get("MG")).toEqual([{ id: 1, nome: "Rio Pomba" }]);
  });

  it("uses the cached municipalities instead of requesting them again", async () => {
    municipioCache.set("MG", [{ id: 1, nome: "Rio Pomba" }]);
    const { result } = setup();

    (await startLookup()).respond(VIACEP_BODY);
    await advance(0);

    expect(control.callTo(IBGE)).toHaveLength(0);
    expect(onChange).toHaveBeenCalledWith("cidade", "Rio Pomba");
    expect(result.current).toEqual({ type: "success" });
  });

  it("fills only the UF when the city is not in the official list", async () => {
    municipioCache.set("MG", [{ id: 2, nome: "Mercês" }]);
    const { result } = setup();

    (await startLookup()).respond(VIACEP_BODY);
    await advance(0);

    expect(onChange).toHaveBeenCalledWith("uf", "MG");
    expect(onChange).toHaveBeenCalledWith("cidade", "");
    expect(result.current).toEqual({ type: "success", message: FILL_FROM_LIST });
  });

  it("fills only the UF when the municipality list is unavailable", async () => {
    const { result } = setup();

    (await startLookup()).respond(VIACEP_BODY);
    await advance(0);
    control.callTo(IBGE)[0].respond([], false);
    await advance(0);

    expect(onChange).toHaveBeenCalledWith("uf", "MG");
    expect(onChange).toHaveBeenCalledWith("cidade", "");
    expect(result.current).toEqual({ type: "success", message: FILL_MANUALLY });
    expect(municipioCache.has("MG")).toBe(false);
  });

  it("reports the lookup error when ViaCEP fails", async () => {
    const { result } = setup();

    (await startLookup()).respond({}, false);
    await advance(0);

    expect(result.current).toEqual({ type: "error", message: CEP_LOOKUP_ERROR });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports the lookup error when ViaCEP does not know the CEP", async () => {
    const { result } = setup();

    (await startLookup()).respond({ erro: true });
    await advance(0);

    expect(result.current).toEqual({ type: "error", message: CEP_LOOKUP_ERROR });
  });

  it("reports the lookup error when the ViaCEP request times out", async () => {
    const { result } = setup();
    await startLookup();

    await advance(TIMEOUT_MS);

    expect(result.current).toEqual({ type: "error", message: CEP_LOOKUP_ERROR });
  });

  it("reports the lookup error when the municipality request times out", async () => {
    const { result } = setup();
    (await startLookup()).respond(VIACEP_BODY);
    await advance(0);

    await advance(TIMEOUT_MS);

    expect(result.current).toEqual({ type: "error", message: CEP_LOOKUP_ERROR });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not overwrite Cidade or UF edited while the lookup was pending", async () => {
    const { result, rerender } = setup();
    const call = await startLookup();

    rerender({ ...baseProps, cidade: "Ubá" });
    call.respond(VIACEP_BODY);
    await advance(0);
    control.callTo(IBGE)[0].respond(MUNICIPIOS_BODY);
    await advance(0);

    expect(onChange).not.toHaveBeenCalled();
    expect(result.current).toEqual({ type: "idle" });
    expect(control.callTo(VIACEP)).toHaveLength(1);
  });

  it("does not overwrite UF edited while the lookup was pending", async () => {
    municipioCache.set("MG", [{ id: 1, nome: "Rio Pomba" }]);
    const { result, rerender } = setup();
    const call = await startLookup();

    rerender({ ...baseProps, uf: "SP" });
    call.respond(VIACEP_BODY);
    await advance(0);

    expect(onChange).not.toHaveBeenCalled();
    expect(result.current).toEqual({ type: "idle" });
  });

  it("silently drops the pending lookup when the CEP changes", async () => {
    const { result, rerender } = setup();
    const first = await startLookup();

    rerender({ ...baseProps, cep: OTHER_CEP });
    await advance(0);

    expect(first.signal.aborted).toBe(true);
    expect(result.current).toEqual({ type: "idle" });
    expect(onChange).not.toHaveBeenCalled();

    await advance(DEBOUNCE_MS);
    expect(control.callTo(VIACEP).at(-1)?.url).toContain("36700120");
    expect(result.current).toEqual({ type: "loading" });
  });

  it("cancels the debounce when the CEP changes before it fires", async () => {
    const { rerender } = setup();

    await advance(DEBOUNCE_MS - 1);
    rerender({ ...baseProps, cep: OTHER_CEP });
    await advance(DEBOUNCE_MS - 1);

    expect(control.fetchMock).not.toHaveBeenCalled();
  });

  it("ignores a ViaCEP response that arrives after the lookup was aborted", async () => {
    const lateControl = createFetchControl({ rejectOnAbort: false });
    vi.stubGlobal("fetch", lateControl.fetchMock);
    const { unmount } = setup();
    await advance(DEBOUNCE_MS);
    const [call] = lateControl.callTo(VIACEP);

    unmount();
    call.respond(VIACEP_BODY);
    await advance(0);

    expect(lateControl.callTo(IBGE)).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores a municipality response that arrives after the lookup was aborted", async () => {
    const lateControl = createFetchControl({ rejectOnAbort: false });
    vi.stubGlobal("fetch", lateControl.fetchMock);
    const { unmount } = setup();
    await advance(DEBOUNCE_MS);
    lateControl.callTo(VIACEP)[0].respond(VIACEP_BODY);
    await advance(0);

    unmount();
    lateControl.callTo(IBGE)[0].respond(MUNICIPIOS_BODY);
    await advance(0);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("stays silent when the municipality request is aborted by a CEP change", async () => {
    const { result, rerender } = setup();
    (await startLookup()).respond(VIACEP_BODY);
    await advance(0);

    rerender({ ...baseProps, cep: OTHER_CEP });
    await advance(0);

    expect(control.callTo(IBGE)[0].signal.aborted).toBe(true);
    expect(result.current).toEqual({ type: "idle" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("returns idle when the hook becomes disabled after a lookup", async () => {
    municipioCache.set("MG", [{ id: 1, nome: "Rio Pomba" }]);
    const { result, rerender } = setup();
    (await startLookup()).respond(VIACEP_BODY);
    await advance(0);
    expect(result.current).toEqual({ type: "success" });

    rerender({ ...baseProps, disabled: true });

    expect(result.current).toEqual({ type: "idle" });
  });

  it("does not repeat the lookup when only city or UF change", async () => {
    municipioCache.set("MG", [{ id: 1, nome: "Rio Pomba" }]);
    const { rerender } = setup();
    (await startLookup()).respond(VIACEP_BODY);
    await advance(0);

    rerender({ ...baseProps, cidade: "Rio Pomba", uf: "MG" });
    await advance(DEBOUNCE_MS);

    expect(control.callTo(VIACEP)).toHaveLength(1);
  });
});
