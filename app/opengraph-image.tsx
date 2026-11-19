import { ImageResponse } from "next/og";

export const alt =
  "Silo — the only cache that understands WooCommerce inventory. Surgical invalidation, always-accurate stock.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#08090b",
          padding: "56px 64px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -140,
            width: 700,
            height: 700,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(61,107,255,0.35) 0%, rgba(61,107,255,0) 68%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              width: 34,
              height: 34,
              gap: 3,
              marginRight: 14,
            }}
          >
            {["#f6f5f1", "#3d6bff", "#f6f5f1", "#f6f5f1"].map((color, index) => (
              <div
                key={index}
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: 3,
                  background: color,
                  opacity: index > 1 ? 0.35 : 1,
                  display: "flex",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#f6f5f1", letterSpacing: -1 }}>
            silo
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: 16,
              paddingLeft: 16,
              borderLeft: "1px solid rgba(255,255,255,0.18)",
              fontSize: 13,
              letterSpacing: 2.5,
              color: "rgba(246,245,241,0.45)",
            }}
          >
            CACHE FOR WOOCOMMERCE
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: "auto",
              alignItems: "center",
              gap: 8,
              border: "1px solid rgba(30,214,161,0.25)",
              background: "rgba(30,214,161,0.08)",
              color: "#1ed6a1",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 13,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "#1ed6a1",
                display: "flex",
              }}
            />
            Inventory-aware
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          <div
            style={{
              display: "flex",
              fontSize: 70,
              lineHeight: 1.02,
              letterSpacing: -3.2,
              color: "#f6f5f1",
              maxWidth: 970,
            }}
          >
            The only cache that understands
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 70,
              lineHeight: 1.02,
              letterSpacing: -3.2,
              color: "#6389ff",
              maxWidth: 970,
            }}
          >
            WooCommerce inventory.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: 23,
              color: "rgba(246,245,241,0.5)",
              letterSpacing: -0.3,
            }}
          >
            Surgical invalidation. Always-accurate stock. No full purges.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 22,
            gap: 44,
            position: "relative",
          }}
        >
          {[
            ["0.4ms", "cache lookup"],
            ["99.4%", "hit rate"],
            ["5 URLs", "per stock change"],
            ["0", "carts cached"],
          ].map(([value, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ display: "flex", fontSize: 22, color: "#f6f5f1", letterSpacing: -0.5 }}>
                {value}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 12,
                  letterSpacing: 1.6,
                  color: "rgba(246,245,241,0.35)",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </div>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              marginLeft: "auto",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "7px 10px",
              fontSize: 11,
              letterSpacing: 1.6,
              color: "rgba(246,245,241,0.4)",
            }}
          >
            GETSILO.COM
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
