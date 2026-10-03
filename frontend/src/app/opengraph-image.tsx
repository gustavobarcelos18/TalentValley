import { ImageResponse } from "next/og";

export const alt = "Talent Valley: Talento encontra oportunidade aqui.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#0d1114",
          color: "#f4f7f6",
        }}
      >
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700, letterSpacing: -4 }}>
          <span>Talent&nbsp;</span>
          <span style={{ color: "#a0d060" }}>Valley</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 52, color: "#a8b2b0" }}>Talento encontra oportunidade aqui.</div>
        <div style={{ marginTop: 56, width: 160, height: 6, background: "#20c8c0" }} />
      </div>
    ),
    size,
  );
}
