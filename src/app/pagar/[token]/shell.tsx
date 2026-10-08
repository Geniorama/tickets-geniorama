/** El marco de las páginas públicas de pago: una tarjeta centrada, sin menú. */
export function PayShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "2.5rem 1rem", backgroundColor: "var(--app-content-bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "34rem" }}>
        <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--app-body-text)", margin: "0 0 1rem", textAlign: "center" }}>
          Geniorama
        </p>
        <div
          style={{
            backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
            borderRadius: "0.75rem", padding: "1.5rem",
          }}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
