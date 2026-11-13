/**
 * Shared Open Graph card (1200x630) with Marites PH branding: a manila-folder
 * band, the title, and a stamp-style "Verified ni Marites" mark. Rendered by
 * next/og (no image files to maintain). Uses the default bundled font.
 */
export const OG_SIZE = { width: 1200, height: 630 };

export function OgCard({ title, subtitle, tagline }: { title: string; subtitle: string; tagline: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f5f7fa", color: "#16213b" }}>
      <div style={{ height: 28, background: "#e0b357", display: "flex" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 800 }}>
          <div style={{ width: 56, height: 44, background: "#e0b357", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 30, height: 20, background: "#1d3a72", borderRadius: 4, display: "flex" }} />
          </div>
          Marites PH
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: title.length > 40 ? 64 : 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, display: "flex" }}>{title}</div>
          <div style={{ fontSize: 30, color: "#556079", display: "flex" }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 28, color: "#556079", display: "flex" }}>{tagline}</div>
          {/* Double-ruled stamp drawn as two nested solid borders (the image renderer has no "double" style). */}
          <div style={{ display: "flex", border: "3px solid #1b7247", borderRadius: 12, padding: 4, transform: "rotate(-3deg)" }}>
            <div style={{ display: "flex", border: "2px solid #1b7247", borderRadius: 8, padding: "10px 22px", color: "#1b7247", fontSize: 30, fontWeight: 800 }}>
              Verified ni Marites
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
