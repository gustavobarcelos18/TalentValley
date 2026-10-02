"use client";

// Replaces the root layout when it fails, so the MUI theme is not available:
// plain markup with system colors that follow the OS color scheme.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pt-BR" style={{ colorScheme: "light dark" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "Canvas",
          color: "CanvasText",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main role="alert" style={{ maxWidth: 440 }}>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 8px" }}>Algo deu errado</h1>
          <p style={{ margin: "0 0 24px" }}>
            Não foi possível carregar a plataforma. Tente novamente em instantes.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ font: "inherit", padding: "10px 20px", cursor: "pointer" }}
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
