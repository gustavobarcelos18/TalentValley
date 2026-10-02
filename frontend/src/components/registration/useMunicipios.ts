import { useEffect, useState } from "react";
import { fetchMunicipios, municipioCache, type Municipio } from "./location";

type MunicipiosState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; municipios: Municipio[] }
  | { type: "error" };

export function useMunicipios(uf: string): {
  municipios: Municipio[];
  loading: boolean;
  error: boolean;
  retry: () => void;
} {
  // Start from the cache: the hook is mounted again when the wizard returns to
  // the personal data step, and the effect below skips an already cached UF.
  const [state, setState] = useState<MunicipiosState>(() => {
    if (!uf) return { type: "idle" };
    const cached = municipioCache.get(uf);
    return cached ? { type: "success", municipios: cached } : { type: "loading" };
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const [loadKey, setLoadKey] = useState({ uf, nonce: 0 });

  // Adjust the displayed state during render when the UF (or a retry) changes,
  // instead of calling setState synchronously inside the effect body.
  if (loadKey.uf !== uf || loadKey.nonce !== retryNonce) {
    setLoadKey({ uf, nonce: retryNonce });
    if (!uf) {
      setState({ type: "idle" });
    } else {
      const cached = municipioCache.get(uf);
      setState(cached ? { type: "success", municipios: cached } : { type: "loading" });
    }
  }

  useEffect(() => {
    if (!uf) return;
    if (municipioCache.has(uf)) return;

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10000);

    fetchMunicipios(uf, controller.signal)
      .then((municipios) => {
        municipioCache.set(uf, municipios);
        if (!controller.signal.aborted) {
          setState({ type: "success", municipios });
        }
      })
      .catch(() => {
        // A real timeout must reach the error state; an abort caused by a UF
        // change or unmount must stay silent.
        if (timedOut || !controller.signal.aborted) {
          setState({ type: "error" });
        }
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [uf, retryNonce]);

  return {
    municipios: state.type === "success" ? state.municipios : [],
    loading: state.type === "loading",
    error: state.type === "error",
    retry: () => {
      municipioCache.delete(uf);
      setRetryNonce((n) => n + 1);
    },
  };
}
