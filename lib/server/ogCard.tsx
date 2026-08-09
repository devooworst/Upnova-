/* ------------------------------------------------------------------ */
/*  Social preview card — one clean generator for every shareable      */
/*  type. Rendered server-side (next/og) when a link is unfurled by    */
/*  X/WhatsApp/iMessage/etc. Dark UpNova frame, type overline, title,  */
/*  creator, location/price where relevant, and the UpNova CTA.        */
/* ------------------------------------------------------------------ */

import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard(input: {
  overline: string; // "SERVICE · BOOK", "OPPORTUNITY · APPLY"
  title: string;
  creator: string;
  meta?: string; // "Baltimore, MD · From $60"
  cta: string; // "Book on UpNova"
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0A0F",
          color: "#fafafa",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 9999, background: "#a3e635", display: "flex" }} />
          <div style={{ fontSize: 28, letterSpacing: 6, color: "#a1a1aa", textTransform: "uppercase", display: "flex" }}>
            {input.overline}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, display: "flex" }}>
            {input.title.length > 60 ? input.title.slice(0, 57) + "…" : input.title}
          </div>
          <div style={{ fontSize: 34, color: "#a1a1aa", display: "flex" }}>
            {input.creator}
            {input.meta ? ` · ${input.meta}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 2, display: "flex" }}>UpNova</div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#0A0A0F",
              background: "#a3e635",
              padding: "16px 36px",
              borderRadius: 9999,
              display: "flex",
            }}
          >
            {input.cta}
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
