"use client";

import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import CompareArrowsOutlined from "@mui/icons-material/CompareArrowsOutlined";
import { useRouter } from "next/navigation";
import type { TalentListItem } from "@/types/recruiter";

export function ComparisonBar({ selected, message }: { selected: TalentListItem[]; message: string | null }) {
  const router = useRouter();
  if (!selected.length && !message) return null;
  return <Stack spacing={1} aria-live="polite">
    {message && <Alert severity="info">{message}</Alert>}
    {selected.length > 0 && <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: "divider" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
        <Typography variant="body2">{selected.length === 1 ? "1 talento selecionado. Selecione mais 1 para comparar." : "2 talentos selecionados para comparação."}</Typography>
        <Button variant="contained" startIcon={<CompareArrowsOutlined />} disabled={selected.length !== 2}
          aria-describedby="comparison-selection-status"
          onClick={() => router.push(`/recrutador/comparar?slugs=${encodeURIComponent(selected[0].slug)}&slugs=${encodeURIComponent(selected[1].slug)}`)}>
          Comparar talentos
        </Button>
      </Stack>
      <Typography id="comparison-selection-status" className="sr-only">{selected.length} de 2 talentos selecionados.</Typography>
    </Paper>}
  </Stack>;
}
