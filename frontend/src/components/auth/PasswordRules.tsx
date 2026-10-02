"use client";

import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import RadioButtonUnchecked from "@mui/icons-material/RadioButtonUnchecked";
import { Box } from "@mui/material";
import { PASSWORD_RULES } from "@/lib/validation";

// Static checklist of the new-password rules, updated as the user types.
export function PasswordRules({ value }: { value: string }) {
  return (
    <Box
      component="ul"
      aria-label="Requisitos da senha"
      sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gap: 0.5 }}
    >
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        const Icon = met ? CheckCircleOutlined : RadioButtonUnchecked;
        return (
          <Box
            component="li"
            key={rule.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              fontSize: "0.8125rem",
              color: met ? "success.main" : "text.secondary",
            }}
          >
            <Icon aria-hidden="true" sx={{ fontSize: "1rem" }} />
            <span>{rule.label}</span>
            <span className="sr-only">{met ? " (atendido)" : " (pendente)"}</span>
          </Box>
        );
      })}
    </Box>
  );
}
