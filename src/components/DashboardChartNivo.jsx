// src/components/DashboardChartNivo.jsx
import React, { useMemo, useCallback } from "react";
import { ResponsiveBarCanvas } from "@nivo/bar";
import { alpha } from "@mui/material/styles";

export default React.memo(function DashboardChartNivo({
  data,
  catKeys,
  catMeta,
  maxChartValue,
  hideValues,
  money,
  theme,
  formatBRL,
  pickFallbackColor,
}) {
  const isDark =
    theme?.palette?.mode === "dark" ||
    (typeof theme?.palette?.background?.default === "string" &&
      theme.palette.background.default.toLowerCase().includes("rgb(0"));

  const mutedText = isDark ? alpha("#ffffff", 0.78) : theme.palette.text.secondary;
  const gridColor = isDark ? alpha("#ffffff", 0.14) : alpha(theme.palette.divider, 0.6);

  const safeData = Array.isArray(data) ? data : [];

  // ✅ garante que "total" NÃO entra no stack
  const keys = useMemo(() => {
    return (Array.isArray(catKeys) ? catKeys : [])
      .map(String)
      .filter((k) => k && k !== "total");
  }, [catKeys]);

  const yMax = useMemo(() => Math.max(10, Number(maxChartValue || 0) * 1.15), [maxChartValue]);

  const colors = useCallback(
    (bar) => {
      const k = String(bar?.id ?? "");
      const meta = catMeta?.get?.(k);
      return meta?.color || pickFallbackColor?.(theme, k) || (isDark ? "#60a5fa" : "#3b82f6");
    },
    [catMeta, pickFallbackColor, theme, isDark]
  );

  const tooltip = useCallback(
    ({ indexValue, data: row }) => {
      const entries = (keys || [])
        .map((k) => ({ k, v: Number(row?.[k] || 0) }))
        .filter((x) => x.v > 0)
        .sort((a, b) => b.v - a.v);

      const total = Number(row?.total || 0);

      return (
        <div
          style={{
            padding: 10,
            borderRadius: 12,
            background: isDark ? "rgba(2,6,23,0.92)" : "rgba(255,255,255,0.96)",
            color: isDark ? "whitesmoke" : "#0f172a",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.10)"}`,
            boxShadow: "0 14px 40px rgba(0,0,0,0.22)",
            minWidth: 220,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 12, color: mutedText }}>Dia {String(indexValue)}</div>
            <div style={{ fontWeight: 950, fontSize: 12 }}>{hideValues ? "••••" : money(total)}</div>
          </div>

          <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.08)", marginBottom: 8 }} />

          <div style={{ display: "grid", gap: 6 }}>
            {entries.length ? (
              entries.slice(0, 10).map((it) => {
                const meta = catMeta?.get?.(it.k);
                const c = meta?.color || pickFallbackColor?.(theme, it.k) || "#94a3b8";
                const label = meta?.label || meta?.name || it.k;

                return (
                  <div key={it.k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: c,
                          boxShadow: isDark ? `0 0 0 2px rgba(255,255,255,0.06)` : `0 0 0 2px rgba(2,6,23,0.04)`,
                          flex: "0 0 auto",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: mutedText,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 150,
                        }}
                        title={label}
                      >
                        {label}
                      </span>
                    </div>

                    <span style={{ fontSize: 12, fontWeight: 950 }}>{hideValues ? "••••" : money(it.v)}</span>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: 12, fontWeight: 800, color: mutedText }}>Sem categorias no dia.</div>
            )}
          </div>
        </div>
      );
    },
    [keys, catMeta, hideValues, isDark, money, mutedText, pickFallbackColor, theme]
  );

  // ✅ LAYER CANVAS CORRETO: (ctx, props) => void
  const TotalLabelsLayer = useCallback(
    (ctx, props) => {
      const bars = props?.bars || [];
      if (!bars.length) return;

      // topo por coluna
      const minYByCol = new Map();
      for (const b of bars) {
        const colKey = `${Math.round(b.x)}:${Math.round(b.width)}`;
        const prev = minYByCol.get(colKey);
        if (prev == null || b.y < prev) minYByCol.set(colKey, b.y);
      }

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = "950 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";

      for (const b of bars) {
        const colKey = `${Math.round(b.x)}:${Math.round(b.width)}`;
        if (minYByCol.get(colKey) !== b.y) continue;

        const row = b?.data?.data || {};
        const total = Number(row?.total || 0);
        if (!total) continue;

        const label = hideValues ? "••••" : money(total);
        const cx = b.x + b.width / 2;
        const cy = b.y - 7;

        // sombra/stroke fake
        ctx.fillStyle = "rgba(0,0,0,0.60)";
        ctx.fillText(label, cx - 0.8, cy + 0.8);
        ctx.fillText(label, cx + 0.8, cy + 0.8);
        ctx.fillText(label, cx, cy + 1.2);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, cx, cy);
      }

      ctx.restore();
    },
    [hideValues, money]
  );

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ResponsiveBarCanvas
        data={safeData}
        keys={keys}
        indexBy="label"
        margin={{ top: 40, right: 18, bottom: 28, left: 68 }}
        padding={0.28}
        innerPadding={2}
        groupMode="stacked"
        valueScale={{ type: "linear", min: 0, max: yMax }}
        indexScale={{ type: "band", round: true }}
        colors={colors}
        borderWidth={0}
        enableGridX={false}
        enableGridY
        gridYValues={6}
        gridYLineColor={gridColor}
        axisTop={null}
        axisRight={null}
        axisBottom={{ tickSize: 0, tickPadding: 10 }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 10,
          format: (v) => (hideValues ? "••••" : formatBRL ? formatBRL(v) : money(Number(v || 0))),
        }}
        theme={{
          text: { fill: mutedText, fontSize: 12, fontWeight: 800 },
          axis: { ticks: { text: { fill: mutedText, fontSize: 12, fontWeight: 800 } } },
          grid: { line: { stroke: gridColor, strokeWidth: 1 } },
          tooltip: { container: { background: "transparent" } },
        }}
        tooltip={tooltip}
        layers={["grid", "axes", "bars", TotalLabelsLayer, "markers", "legends"]}
        animate={true}
        motionConfig="wobbly"   // perceptível
        isInteractive={true}
        pixelRatio={1}
      />
    </div>
  );
});