"use client";

// Último recurso: erro no layout raiz (o error.tsx não cobre esse caso). Usa
// estilos inline porque o CSS do app pode não ter carregado.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "Arial, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, background: "#f8fafc", color: "#1e2559" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>O Genus Contabilidade encontrou um erro</h1>
          <p style={{ fontSize: 14, color: "#64748b" }}>
            Tente de novo. Se continuar, feche e abra o programa.
            {error.digest ? ` (código ${error.digest})` : ""}
          </p>
          <button type="button" onClick={reset} style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", cursor: "pointer" }}>
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
