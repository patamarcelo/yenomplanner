import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { Box, Card, CardContent, Divider, Grid, Stack, Typography } from "@mui/material";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

import KpiCard from "../components/KpiCard";
import { formatBRL } from "../utils/money";
import { cards } from "../data/mockCards";
import { formatDateBR, formatMonthBR } from "../utils/dateBR";

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDaysISO(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function Dashboard() {
  const month = useSelector((s) => s.finance.month);
  const txns = useSelector((s) => s.finance.txns);

  const monthTx = useMemo(
    () => (txns || []).filter((t) => t?.invoiceMonth === month),
    [txns, month]
  );

  const totalMonth = useMemo(() => sum(monthTx.map((t) => Number(t.amount || 0))), [monthTx]);
  const confirmedMonth = useMemo(
    () => sum(monthTx.filter((t) => t.status === "confirmado").map((t) => Number(t.amount || 0))),
    [monthTx]
  );
  const predictedMonth = useMemo(
    () => sum(monthTx.filter((t) => t.status !== "confirmado").map((t) => Number(t.amount || 0))),
    [monthTx]
  );

  const installmentsInMonth = useMemo(
    () => monthTx.filter((t) => t.kind === "installment").length,
    [monthTx]
  );

  // Últimos 15 dias (por data de compra)
  const chartData = useMemo(() => {
    const end = todayISO();
    const start = addDaysISO(end, -14);

    // soma por dia
    const byDay = new Map();
    for (let i = 0; i < 15; i++) {
      const day = addDaysISO(start, i);
      byDay.set(day, 0);
    }

    for (const t of txns || []) {
      const day = t?.purchaseDate; // pode trocar pra chargeDate se preferir
      if (!day || !byDay.has(day)) continue;
      byDay.set(day, byDay.get(day) + Number(t.amount || 0));
    }

    return Array.from(byDay.entries()).map(([day, value]) => ({
      day, // ISO
      label: formatDateBR(day), // dd-mm-yyyy
      value: Number(value.toFixed(2)),
    }));
  }, [txns]);

  // Totais por cartão no mês
  const totalsByCard = useMemo(() => {
    const map = new Map(cards.map((c) => [c.id, 0]));
    for (const t of monthTx) {
      map.set(t.cardId, (map.get(t.cardId) || 0) + Number(t.amount || 0));
    }
    return cards.map((c) => ({ ...c, total: map.get(c.id) || 0 }));
  }, [monthTx]);

  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Mês selecionado: <b>{formatMonthBR(month)}</b>
      </Typography>

      {/* Linha principal: 30% cards / 70% gráfico */}
      <Grid container spacing={2} alignItems="stretch">
        {/* Coluna esquerda (cards) */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={12} lg={6}>
              <KpiCard title="Total do mês" value={formatBRL(totalMonth)} subtitle="Por fatura" />
            </Grid>
            <Grid item xs={12} sm={6} md={12} lg={6}>
              <KpiCard title="Confirmado" value={formatBRL(confirmedMonth)} subtitle="No mês" />
            </Grid>
            <Grid item xs={12} sm={6} md={12} lg={6}>
              <KpiCard title="Previsto" value={formatBRL(predictedMonth)} subtitle="No mês" />
            </Grid>
            <Grid item xs={12} sm={6} md={12} lg={6}>
              <KpiCard title="Parcelas" value={`${installmentsInMonth}`} subtitle="Itens no mês" />
            </Grid>
          </Grid>
        </Grid>

        {/* Coluna direita (gráfico) */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%" }}>
              <Stack spacing={1} sx={{ height: "100%" }}>
                <Typography sx={{ fontWeight: 900 }}>Gastos últimos 15 dias</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Baseado na data de compra (dd-mm-aaaa). Ajustamos depois para cobrança se preferir.
                </Typography>

                <Box sx={{ flex: 1, minHeight: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={2} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => formatBRL(v)} labelFormatter={(l) => l} />
                      <Line type="monotone" dataKey="value" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 1 }} />

      {/* Cards dos cartões embaixo do divider */}
      <Grid container spacing={2}>
        {totalsByCard.map((c) => (
          <Grid key={c.id} item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontWeight: 900 }}>{c.name}</Typography>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: 999,
                        background: c.tint,
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    />
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -0.3 }}>
                    {formatBRL(c.total)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Total no mês (fatura)
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
