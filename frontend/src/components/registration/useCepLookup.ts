import { useEffect, useRef, useState } from "react";
import {
  CEP_LOOKUP_ERROR,
  fetchMunicipios,
  findMunicipio,
  municipioCache,
  readViaCep,
} from "./location";

export type CepStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; message?: string }
  | { type: "error"; message: string };

export function useCepLookup({
  cep,
  cidade,
  uf,
  onChange,
  disabled,
}: {
  cep: string;
  cidade: string;
  uf: string;
  onChange: (key: "cidade" | "uf", value: string) => void;
  disabled: boolean;
}): CepStatus {
  const [lookup, setLookup] = useState<{ cep: string; status: CepStatus }>({
    cep: "",
    status: { type: "idle" },
  });
  const latestRef = useRef({ cidade, uf, onChange });

  // Keep the latest values available to the async lookup callback without
  // re-running the lookup effect (which would fire duplicate requests).
  useEffect(() => {
    latestRef.current = { cidade, uf, onChange };
  });

  const digits = cep.replace(/\D/g, "");

  useEffect(() => {
    if (digits.length !== 8 || disabled) return;

    const controller = new AbortController();
    // Snapshot of the city/UF at request time. A late response must never
    // overwrite a field the user edited manually while it was pending.
    const snapshot = {
      cidade: latestRef.current.cidade,
      uf: latestRef.current.uf,
    };

    const debounce = setTimeout(() => {
      setLookup({ cep: digits, status: { type: "loading" } });
      void (async () => {
        let timedOut = false;
        const timeout = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, 8000);
        try {
          const response = await fetch(
            `https://viacep.com.br/ws/${digits}/json/`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("ViaCEP HTTP failure");
          const result = readViaCep(await response.json());
          if (!result) throw new Error("ViaCEP invalid response");
          if (controller.signal.aborted) return;

          // Resolve the official municipality name for the returned UF before
          // touching the form, so the selected city is never from another state.
          let matched: string | null = null;
          let municipiosUnavailable = false;
          try {
            const cached = municipioCache.get(result.uf);
            const municipios =
              cached ?? (await fetchMunicipios(result.uf, controller.signal));
            if (!cached) municipioCache.set(result.uf, municipios);
            if (controller.signal.aborted) return;
            matched = findMunicipio(municipios, result.cidade)?.nome ?? null;
          } catch (reason) {
            // A timeout during the municipality lookup must surface the lookup
            // error below; an obsolete abort (changed CEP/UF) stays silent.
            // Other failures still fill the UF and leave Cidade unselected.
            if (timedOut) throw reason;
            if (controller.signal.aborted) return;
            municipiosUnavailable = true;
          }

          const latest = latestRef.current;
          const ufUnchanged = latest.uf === snapshot.uf;
          const cidadeUnchanged = latest.cidade === snapshot.cidade;
          const applied = ufUnchanged && cidadeUnchanged;

          // Apply UF and Cidade together so a CEP autofill never leaves a
          // Cidade/Estado mismatch, and never overrides a newer user edit.
          if (applied) {
            latest.onChange("uf", result.uf);
            latest.onChange("cidade", matched ?? "");
          }

          setLookup({
            cep: digits,
            // Only advertise an autofill when it was actually applied; a stale
            // response (the user edited Cidade/UF while it was pending) must
            // not claim both fields were populated.
            status: applied
              ? matched
                ? { type: "success" }
                : {
                    type: "success",
                    message: municipiosUnavailable
                      ? "UF preenchida pelo CEP. Digite a cidade manualmente."
                      : "UF preenchida pelo CEP. Selecione a cidade na lista.",
                  }
              : { type: "idle" },
          });
        } catch {
          if (timedOut || !controller.signal.aborted) {
            setLookup({
              cep: digits,
              status: { type: "error", message: CEP_LOOKUP_ERROR },
            });
          }
        } finally {
          clearTimeout(timeout);
        }
      })();
    }, 400);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [digits, disabled]);

  if (digits.length !== 8 || disabled || lookup.cep !== digits) {
    return { type: "idle" };
  }
  return lookup.status;
}
