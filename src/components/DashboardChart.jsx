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

export default React.memo(function DashboardChart({
  data,
  catKeys,
  catMeta,
  maxChartValue,
  hideValues,
  money,
  theme,
  vizRef,
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

  const gridStroke = isDark
    ? alpha("#ffffff", 0.18)
    : alpha(theme.palette.divider, 0.75);

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

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 28, right: 18, left: 0, bottom: 0 }}>
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
          tick={{ fontSize: 12, fill: mutedText, fontWeight: 800 }}
        />

        <YAxis
          axisLine={false}
          tickLine={false}
          width={64}
          domain={[0, Math.max(10, maxChartValue * 1.15)]}
          tick={{ fontSize: 12, fill: mutedText, fontWeight: 800 }}
          tickFormatter={(v) => (hideValues ? "••••" : formatBRL(v))}
        />

        <RechartsTooltip content={renderTooltip} />

        {catKeys.map((k) => {
          const meta = catMeta.get(String(k));
          const fill = meta?.color || pickFallbackColor(theme, k);
          return (
            <Bar
              key={k}
              dataKey={k}
              stackId="day"
              fill={fill}
              radius={[0, 0, 0, 0]}
              barSize={24}
              isAnimationActive={false}
            />
          );
        })}

        {/* ✅ Label do TOTAL em cima (leve e legível) */}
        <Bar dataKey="total" fill="transparent" stackId="__total__" isAnimationActive={false}>
          <LabelList
            dataKey="total"
            position="top"
            content={({ x, y, width, value }) => {
              const n = Number(value || 0);
              if (!n || n <= 0) return null;

              return (
                <text
                  x={x + width * 1.5 }
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={900}
                  fill={textColor}
                >
                  {hideValues ? "••••" : money(n)}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});