// src/components/DashboardChart.jsx
import React from "react";
import { alpha } from "@mui/material/styles";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  LabelList,
} from "recharts";

/* =========================
   Helpers
========================= */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function calcTickInterval(maxValue, step = 100, maxTicks = 7) {
  const m = Math.max(0, Number(maxValue || 0));
  const raw = Math.ceil(m / step) * step || step;

  const ticksNeeded = Math.floor(raw / step) + 1;
  if (ticksNeeded <= maxTicks) return step;

  const mul = Math.ceil(ticksNeeded / maxTicks);
  return step * mul;
}

function ceilToStep(n, step) {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || v <= 0) return step;
  return Math.ceil(v / step) * step;
}

// month: "YYYY-MM", dayLabel: "1".."31"
function fmtDayLabelDDMM(month, dayLabel) {
  const m = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(dayLabel || "");

  const y = Number(m[1]);
  const mo = Number(m[2]); // 1..12
  const d = Number(dayLabel);

  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return String(dayLabel || "");

  // clamp day pro mês (evita 31 em fevereiro)
  const lastDay = new Date(y, mo, 0).getDate();
  const dd = clamp(d, 1, lastDay);

  const dd2 = String(dd).padStart(2, "0");
  const mm2 = String(mo).padStart(2, "0");
  return `${dd2}/${mm2}`;
}

const TotalLabel = React.memo(function TotalLabel({ hideValues, money, fill }) {
  return (
    <LabelList
      dataKey="total"
      position="top"
      content={({ x, y, width, value }) => {
        const n = Number(value || 0);
        if (!n || n <= 0) return null;

        const cx = Number(x || 0) + Number(width || 0) / 2;
        const cy = Number(y || 0) - 6;

        return (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            fontSize={10}
            fontWeight={900}
            fill={fill}
            style={{ pointerEvents: "none" }}
          >
            {hideValues ? "••••" : money(n)}
          </text>
        );
      }}
    />
  );
});

export default React.memo(function DashboardChart({
  data,
  catKeys,
  catMeta,
  maxChartValue,
  hideValues,
  money,
  theme,
  vizRef,
  month, // ✅ NOVO: "YYYY-MM" pra formatar 01/03
  formatBRL,
  pickFallbackColor,
  StackedDayTooltip,
}) {
  const isDark =
    theme?.palette?.mode === "dark" ||
    (typeof theme?.palette?.background?.default === "string" &&
      theme.palette.background.default.toLowerCase().includes("rgb(0"));

  const textColor = isDark ? "whitesmoke" : theme.palette.text.primary;
  const mutedText = isDark ? alpha("#ffffff", 0.78) : theme.palette.text.secondary;

  const gridStroke = isDark ? alpha("#ffffff", 0.18) : alpha(theme.palette.divider, 0.75);

  // ✅ Y em 100/100 (ou 200/300 se precisar pra não poluir)
  const yMax = React.useMemo(() => {
    const base = Math.max(100, Number(maxChartValue || 0) * 1.15);
    const step = calcTickInterval(base, 100, 7);
    return ceilToStep(base, step);
  }, [maxChartValue]);

  const yStep = React.useMemo(() => calcTickInterval(yMax, 100, 7), [yMax]);

  const yTicks = React.useMemo(() => {
    const out = [];
    for (let v = 0; v <= yMax; v += yStep) out.push(v);
    return out;
  }, [yMax, yStep]);

  // ✅ precompute fills (bar specs)
  const barsSpec = React.useMemo(() => {
    const keys = Array.isArray(catKeys) ? catKeys : [];
    return keys.map((k) => {
      const kk = String(k);
      const meta = catMeta?.get?.(kk);
      const fill = meta?.color || pickFallbackColor(theme, kk);
      return { key: kk, fill };
    });
  }, [catKeys, catMeta, pickFallbackColor, theme]);

  const renderTooltip = React.useCallback(
    (props) => (
      <StackedDayTooltip
        {...props}
        catMeta={catMeta}
        theme={theme}
        money={money}
        vizRef={vizRef}
      />
    ),
    [catMeta, theme, money, vizRef, StackedDayTooltip]
  );

  // ✅ animação “viva” mas barata
  const animate = !hideValues;

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={140}>
      <BarChart
        data={Array.isArray(data) ? data : []}
        margin={{ top: 28, right: 18, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          vertical={false}
          stroke={gridStroke}
          strokeWidth={1.1}
          strokeDasharray="2 4"
          opacity={0.55}
        />

        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          tick={{ fontSize: 12, fill: mutedText, fontWeight: 800 }}
          tickFormatter={(v) => fmtDayLabelDDMM(month, v)}
        />

        <YAxis
          axisLine={false}
          tickLine={false}
          width={64}
          domain={[0, yMax]}
          ticks={yTicks}
          tick={{ fontSize: 12, fill: mutedText, fontWeight: 800 }}
          tickFormatter={(v) => (hideValues ? "••••" : formatBRL(v))}
        />

        <RechartsTooltip
          content={renderTooltip}
          isAnimationActive={false}
          cursor={{ fill: alpha(isDark ? "#ffffff" : "#0f172a", 0.06) }}
        />

        {barsSpec.map(({ key, fill }, idx) => {
          // ✅ stagger leve pra parecer “vivo” sem ficar esquisito
          const begin = animate ? Math.min(160, idx * 8) : 0;

          return (
            <Bar
              key={key}
              dataKey={key}
              stackId="day"
              fill={fill}
              radius={[0, 0, 0, 0]}
              barSize={24} // ✅ volta ao tamanho antigo
              isAnimationActive={animate}
              animationBegin={begin}
              animationDuration={520}
              animationEasing="ease-out"
            />
          );
        })}

        <Bar dataKey="total" fill="transparent" stackId="__total__" isAnimationActive={false}>
          <TotalLabel hideValues={hideValues} money={money} fill={textColor} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});