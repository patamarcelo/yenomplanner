import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { Stack, Typography, Card, CardContent, Chip, Divider, Box } from "@mui/material";
import { formatBRL } from "../utils/money";
import { cards } from "../data/mockCards";

export default function Installments() {
  const txns = useSelector((s) => s.finance.txns);

  const groups = useMemo(() => {
    const list = Array.isArray(txns) ? txns : [];

    const map = new Map();
    for (const t of list) {
      if (t?.kind !== "installment") continue;
      const gid = t?.installment?.groupId;
      if (!gid) continue;

      if (!map.has(gid)) map.set(gid, []);
      map.get(gid).push(t);
    }

    return Array.from(map.entries()).map(([groupId, arr]) => {
      const sorted = arr
        .slice()
        .sort((a, b) => (a?.invoiceMonth > b?.invoiceMonth ? 1 : -1));

      const total = sorted.reduce((acc, x) => acc + Number(x?.amount || 0), 0);

      // próxima parcela: primeira que não está confirmada, senão a primeira
      const next = sorted.find((x) => x?.status !== "confirmado") || sorted[0];
      const first = sorted[0];

      const card = cards.find((c) => c.id === first?.cardId);

      return {
        groupId,
        merchant: first?.merchant || "Parcelamento",
        cardId: first?.cardId || "—",
        cardName: card?.name || first?.cardId || "—",
        cardTint: card?.tint || "rgba(0,0,0,0.06)",
        total,
        next,
        totalParts: first?.installment?.total || sorted.length,
      };
    });
  }, [txns]);

  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 900 }}>
        Parcelamentos
      </Typography>

      {groups.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Nenhum parcelamento encontrado. Crie um parcelado no “Novo lançamento”.
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      {groups.map((g) => (
        <Card key={g.groupId}>
          <CardContent>
            <Stack spacing={1.1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack spacing={0.2}>
                  <Typography sx={{ fontWeight: 900 }}>{g.merchant}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Grupo: {g.groupId}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: g.cardTint,
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  />
                  <Chip label={g.cardName} variant="outlined" />
                </Stack>
              </Stack>

              <Divider />

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Total do grupo
                </Typography>
                <Typography sx={{ fontWeight: 900 }}>{formatBRL(g.total)}</Typography>
              </Stack>

              {g.next ? (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Próxima parcela
                  </Typography>
                  <Typography sx={{ fontWeight: 800 }}>
                    {g.next.invoiceMonth} — {formatBRL(g.next.amount)}{" "}
                    <span style={{ opacity: 0.65 }}>
                      ({g.next.installment?.current}/{g.totalParts})
                    </span>
                  </Typography>
                </Stack>
              ) : null}

              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                MVP: em seguida vamos adicionar “cancelar futuras”, “editar grupo” e “reclassificar”.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
