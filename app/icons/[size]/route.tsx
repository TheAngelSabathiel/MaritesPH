/** App icons for the manifest (PNG, generated at build time): navy "M" stamp. "maskable" keeps a safe zone. */
import { ImageResponse } from "next/og";

const SIZES = { "192": 192, "512": 512, maskable: 512 } as const;
export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const px = SIZES[size as keyof typeof SIZES];
  if (!px) return new Response("Not found", { status: 404 });
  const maskable = size === "maskable";
  const inner = maskable ? px * 0.6 : px * 0.8;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1d3a72", borderRadius: maskable ? 0 : px * 0.18 }}>
        <div style={{ width: inner, height: inner, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: inner / 2, border: `${Math.round(px * 0.03)}px solid #e0b357`, color: "#f7f3ea", fontSize: inner * 0.58, fontWeight: 800 }}>M</div>
      </div>
    ),
    { width: px, height: px },
  );
}
