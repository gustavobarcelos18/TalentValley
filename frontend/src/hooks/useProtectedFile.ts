"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { ApiError, apiDownload } from "@/lib/api";

interface ProtectedFileState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

type ProtectedFileAction =
  | { type: "start" }
  | { type: "loaded"; url: string }
  | { type: "notFound" }
  | { type: "error"; error: string }
  | { type: "reset" };

function protectedFileReducer(state: ProtectedFileState, action: ProtectedFileAction): ProtectedFileState {
  switch (action.type) {
    case "start":
      return { ...state, loading: true, error: null };
    case "loaded":
      return { url: action.url, loading: false, error: null };
    case "notFound":
      return { url: null, loading: false, error: null };
    case "error":
      return { url: null, loading: false, error: action.error };
    case "reset":
      return { url: null, loading: false, error: null };
    default:
      return state;
  }
}

// Fetches a protected file (photo/curriculum) with credentials and exposes it as
// an object URL, because a plain <img src> pointing at the cross-origin API may
// not deliver the auth cookie correctly. A 404 means "no file yet" and is not an
// error. Object URLs are revoked when the path changes or the component unmounts.
export function useProtectedFile(path: string | null, reloadKey = 0) {
  const [state, dispatch] = useReducer(protectedFileReducer, {
    url: null,
    loading: false,
    error: null,
  });
  const [version, setVersion] = useState(0);

      useEffect(() => {
    if (!path) {
      // No file to load — reset to empty state without a synchronous inline dispatch.
      return;
    }

    dispatch({ type: "reset" });

    let active = true;
    let objectUrl: string | null = null;

    dispatch({ type: "start" });

    apiDownload(path)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        dispatch({ type: "loaded", url: objectUrl });
      })
      .catch((error) => {
        if (!active) return;
        // Missing file is a normal state (nothing uploaded yet).
        const notFound = error instanceof ApiError && error.status === 404;
        dispatch(
          notFound
            ? { type: "notFound" }
            : { type: "error", error: "Não foi possível carregar o arquivo." }
        );
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, version, reloadKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // Without a path there is no file to represent: the effect above exits early
  // and cleanup has already revoked any previous object URL. Derive an empty
  // public state from `path` so stale/revoked reducer state is never exposed.
  if (!path) {
    return { url: null, loading: false, error: null, reload };
  }

  return { ...state, reload };
}
