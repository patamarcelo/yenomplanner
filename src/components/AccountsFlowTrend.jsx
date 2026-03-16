import React, { useMemo } from "react";
import {
    Box,
    Card,
    CardContent,
    Divider,
    Stack,
    Typography,
    useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";

import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
} from "recharts";

import { formatBRL } from "../utils/money";

const MONTHS_SHORT = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
];

function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function ymKey(year, monthIndex0) {
    return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;
}

function ymLabel(year, monthIndex0) {
    return `${MONTHS_SHORT[monthIndex0]}/${String(year).slice(-2)}`;
}

function buildTicks(min, max, step) {
    const out = [];
    for (let x = min; x <= max; x += step) out.push(x);
    return out;
}

function CustomTooltip({ active, payload, label, hideValues }) {
    if (!active || !payload || !payload.length) return null;

    const receita = safeNum(payload.find((p) => p.dataKey === "receitas")?.value);
    const despesa = safeNum(payload.find((p) => p.dataKey === "despesas")?.value);
    const resultado = receita - despesa;

    const mask = (v) => (hideValues ? "••••" : formatBRL(v));

    return (
        <Box
            sx={(theme) => ({
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                background: alpha(theme.palette.background.paper, 0.98),
                borderRadius: 1,
                px: 1.2,
                py: 1,
                boxShadow: theme.shadows[6],
                minWidth: 190,
            })}
        >
            <Typography variant="caption" sx={{ fontWeight: 900, display: "block", mb: 0.6 }}>
                {label}
            </Typography>

            <Stack spacing={0.35}>
                <Typography variant="body2" sx={{ color: "success.main", fontWeight: 700 }}>
                    Receitas: {mask(receita)}
                </Typography>

                <Typography variant="body2" sx={{ color: "error.main", fontWeight: 700 }}>
                    Despesas: {mask(despesa)}
                </Typography>

                <Divider sx={{ my: 0.35 }} />

                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 900,
                        color: resultado >= 0 ? "success.main" : "error.main",
                    }}
                >
                    Resultado: {hideValues ? "••••" : resultado < 0 ? `- ${formatBRL(Math.abs(resultado))}` : formatBRL(resultado)}
                </Typography>
            </Stack>
        </Box>
    );
}

export default function AccountsFlowTrend({
    months = [],
    incomeTotals = {},
    expenseTotals = {},
    hideValues = false,
    matrixScrollLeft = 0,
    monthColWidth = 112,
    yearTotalWidth = 130,
    allTotalWidth = 140,
    labelColWidth = 120,
}) {
    const theme = useTheme();

    const years = useMemo(() => {
        const set = new Set((months || []).map((m) => m.year));
        return Array.from(set).sort((a, b) => a - b);
    }, [months]);

    const newWidth = 116
    const layoutMeta = useMemo(() => {
        let xCursor = 0;
        const monthStartByYM = {};
        const monthCenterByYM = {};
        const yearGapStarts = [];
        const yearBoundaries = [];
        const xTicks = [];
        const labelTicks = [];

        for (let yi = 0; yi < years.length; yi++) {
            const year = years[yi];

            for (let mi = 0; mi < 12; mi++) {
                const ym = ymKey(year, mi);
                monthStartByYM[ym] = xCursor;
                monthCenterByYM[ym] = xCursor + newWidth / 2;

                xTicks.push(xCursor + newWidth / 2);
                labelTicks.push({
                    value: xCursor + newWidth / 2,
                    label: ymLabel(year, mi),
                    ym,
                });

                xCursor += newWidth;
            }

            yearGapStarts.push({
                year,
                start: xCursor,
                end: xCursor + yearTotalWidth,
            });

            yearBoundaries.push(xCursor);
            xCursor += yearTotalWidth;
        }

        const allTotalStart = xCursor;
        const chartWidth = xCursor + allTotalWidth;

        return {
            monthStartByYM,
            monthCenterByYM,
            yearGapStarts,
            yearBoundaries,
            xTicks,
            labelTicks,
            chartWidth,
            allTotalStart,
        };
    }, [months, years, newWidth, yearTotalWidth, allTotalWidth]);

    const chartData = useMemo(() => {
        return (months || []).map((m) => {
            const ym = ymKey(m.year, m.monthIndex0);
            const receitas = safeNum(incomeTotals[ym]);
            const despesas = safeNum(expenseTotals[ym]);
            const x = layoutMeta.monthCenterByYM[ym] ?? 0;

            return {
                x,
                ym,
                label: ymLabel(m.year, m.monthIndex0),
                receitas,
                despesas,
                resultado: receitas - despesas,
            };
        });
    }, [months, incomeTotals, expenseTotals, layoutMeta.monthCenterByYM]);

    const totalReceitas = useMemo(
        () => chartData.reduce((acc, item) => acc + safeNum(item.receitas), 0),
        [chartData]
    );

    const totalDespesas = useMemo(
        () => chartData.reduce((acc, item) => acc + safeNum(item.despesas), 0),
        [chartData]
    );

    const totalResultado = totalReceitas - totalDespesas;

    const maskMoney = (value) => (hideValues ? "••••" : formatBRL(value));

    const visibleChartWidth = Math.max(720, layoutMeta.chartWidth);

    const xDomain = [0, layoutMeta.chartWidth];
    const xTickMap = new Map(layoutMeta.labelTicks.map((t) => [t.value, t.label]));

    const yearGapOverlays = layoutMeta.yearGapStarts || [];
    const yearSeparatorLines = layoutMeta.yearBoundaries || [];

    const yMax = useMemo(() => {
        let max = 0;
        for (const item of chartData) {
            max = Math.max(max, safeNum(item.receitas), safeNum(item.despesas));
        }
        return max;
    }, [chartData]);

    const yTicks = useMemo(() => {
        if (!Number.isFinite(yMax) || yMax <= 0) return [0];
        const approxStep = yMax / 4;
        const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(approxStep, 1))));
        const normalized = approxStep / magnitude;

        let step = magnitude;
        if (normalized > 5) step = 10 * magnitude;
        else if (normalized > 2) step = 5 * magnitude;
        else if (normalized > 1) step = 2 * magnitude;

        const top = Math.ceil(yMax / step) * step;
        return buildTicks(0, top, step);
    }, [yMax]);

    return (
        <Card variant="outlined" sx={{ overflow: "hidden", mt: 1.25, borderRadius: 1 }}>
            <CardContent sx={{ pb: 2 }}>
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    alignItems={{ xs: "flex-start", md: "center" }}
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                >
                    <Stack spacing={0.2}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <QueryStatsRoundedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                                Fluxo mensal
                            </Typography>
                        </Stack>

                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                            receitas x despesas consolidadas
                        </Typography>
                    </Stack>

                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={0.8}
                        alignItems={{ xs: "stretch", sm: "center" }}
                    >
                        <Box
                            sx={{
                                px: 1.1,
                                py: 0.55,
                                borderRadius: 1,
                                background: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.18 : 0.1),
                            }}
                        >
                            <Stack direction="row" spacing={0.7} alignItems="center">
                                <TrendingUpRoundedIcon sx={{ fontSize: 16, color: "success.main" }} />
                                <Typography variant="caption" sx={{ fontWeight: 900, color: "success.main" }}>
                                    Receitas: {maskMoney(totalReceitas)}
                                </Typography>
                            </Stack>
                        </Box>

                        <Box
                            sx={{
                                px: 1.1,
                                py: 0.55,
                                borderRadius: 1,
                                background: alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.18 : 0.1),
                            }}
                        >
                            <Stack direction="row" spacing={0.7} alignItems="center">
                                <TrendingDownRoundedIcon sx={{ fontSize: 16, color: "error.main" }} />
                                <Typography variant="caption" sx={{ fontWeight: 900, color: "error.main" }}>
                                    Despesas: {maskMoney(totalDespesas)}
                                </Typography>
                            </Stack>
                        </Box>

                        <Box
                            sx={{
                                px: 1.1,
                                py: 0.55,
                                borderRadius: 1,
                                background:
                                    totalResultado >= 0
                                        ? alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.16 : 0.08)
                                        : alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.16 : 0.08),
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    fontWeight: 900,
                                    color: totalResultado >= 0 ? "success.main" : "error.main",
                                }}
                            >
                                Resultado: {hideValues ? "••••" : totalResultado < 0 ? `- ${formatBRL(Math.abs(totalResultado))}` : formatBRL(totalResultado)}
                            </Typography>
                        </Box>
                    </Stack>
                </Stack>

                <Divider sx={{ mb: 1.2 }} />

                <Box
                    sx={{
                        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                        borderRadius: 1,
                        overflow: "hidden",
                        background: alpha(theme.palette.background.paper, 0.5),
                        paddingTop: 3
                    }}
                >
                    <Box
                        sx={{
                            overflowX: "hidden",
                            overflowY: "hidden",
                        }}
                    >
                        <Box
                            sx={{
                                minWidth: labelColWidth + visibleChartWidth,
                                width: "max-content",
                            }}
                        >
                            <Box
                                sx={{
                                    // pl: `${labelColWidth}px`,
                                    pl: 6,
                                    transform: `translateX(-${matrixScrollLeft}px)`,
                                    width: visibleChartWidth,
                                    transition: "transform 80ms linear",
                                }}
                            >
                                <Box
                                    sx={{
                                        position: "relative",
                                        width: visibleChartWidth,
                                        height: 340,
                                        overflow: "hidden",
                                    }}
                                >
                                    {yearGapOverlays.map((gap) => (
                                        <Box
                                            key={`gap_${gap.year}`}
                                            sx={{
                                                position: "absolute",
                                                top: 0,
                                                bottom: 0,
                                                left: gap.start,
                                                width: yearTotalWidth,
                                                background: "transparent",
                                                borderLeft: "none",
                                                borderRight: "none",
                                                pointerEvents: "none",
                                                zIndex: 1,
                                            }}
                                        />
                                    ))}

                                    {yearSeparatorLines.map((x) => (
                                        <Box
                                            key={`sep_${x}`}
                                            sx={{
                                                position: "absolute",
                                                top: 0,
                                                bottom: 0,
                                                left: x,
                                                width: 2,
                                                background: alpha(theme.palette.primary.main, 0.18),
                                                pointerEvents: "none",
                                                zIndex: 2,
                                            }}
                                        />
                                    ))}

                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart
                                            data={chartData}
                                            margin={{ top: 14, right: 18, left: 8, bottom: 8 }}
                                        >
                                            <defs>
                                                <linearGradient id="incomeFillAccountsTrend" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.5} />
                                                    <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0.08} />
                                                </linearGradient>

                                                <linearGradient id="expenseFillAccountsTrend" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={theme.palette.error.main} stopOpacity={0.46} />
                                                    <stop offset="95%" stopColor={theme.palette.error.main} stopOpacity={0.08} />
                                                </linearGradient>
                                            </defs>

                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke={alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.34 : 0.75)}
                                                vertical={true}
                                                horizontal={true}
                                            />

                                            <XAxis
                                                type="number"
                                                dataKey="x"
                                                domain={xDomain}
                                                ticks={layoutMeta.xTicks}
                                                tickFormatter={(value) => xTickMap.get(value) || ""}
                                                allowDuplicatedCategory={false}
                                                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                                                axisLine={{ stroke: alpha(theme.palette.divider, 0.8) }}
                                                tickLine={{ stroke: alpha(theme.palette.divider, 0.8) }}
                                                interval={0}
                                            />

                                            <YAxis
                                                ticks={yTicks}
                                                tickFormatter={(v) => (hideValues ? "••••" : formatBRL(v))}
                                                width={95}
                                                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                                                axisLine={{ stroke: alpha(theme.palette.divider, 0.8) }}
                                                tickLine={{ stroke: alpha(theme.palette.divider, 0.8) }}
                                            />

                                            <Tooltip
                                                content={<CustomTooltip hideValues={hideValues} />}
                                                labelFormatter={(value, payload) => {
                                                    const first = payload?.[0]?.payload;
                                                    return first?.label || "";
                                                }}
                                            />

                                            <Legend />

                                            <ReferenceLine
                                                y={0}
                                                stroke={alpha(theme.palette.text.secondary, 0.5)}
                                                strokeDasharray="4 4"
                                            />

                                            <Area
                                                type="monotone"
                                                dataKey="receitas"
                                                name="Receitas"
                                                stroke={theme.palette.success.main}
                                                strokeWidth={3}
                                                fill="url(#incomeFillAccountsTrend)"
                                                dot={{ r: 2.6 }}
                                                activeDot={{ r: 5.2 }}
                                                isAnimationActive={false}
                                            />

                                            <Area
                                                type="monotone"
                                                dataKey="despesas"
                                                name="Despesas"
                                                stroke={theme.palette.error.main}
                                                strokeWidth={3}
                                                fill="url(#expenseFillAccountsTrend)"
                                                dot={{ r: 2.6 }}
                                                activeDot={{ r: 5.2 }}
                                                isAnimationActive={false}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}