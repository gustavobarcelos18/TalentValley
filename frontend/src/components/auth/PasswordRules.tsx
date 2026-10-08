"use client";

import { Box } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { PASSWORD_RULES } from "@/lib/validation";
import { CheckDraw } from "./motion/CheckDraw";
import { duration, ease } from "./motion/tokens";

// Strength = the share of the password rules the value meets, spread over these four levels.
const LEVELS = [
  { label: "Fraca", color: "error.main" },
  { label: "Razoável", color: "warning.main" },
  { label: "Boa", color: "info.main" },
  { label: "Forte", color: "success.main" },
] as const;

function StrengthMeter({ met, total }: { met: number; total: number }) {
  const reduced = useReducedMotion();
  // Segments filled out of LEVELS.length, whatever the number of rules.
  const filled = Math.round((met / total) * LEVELS.length);
  const level = filled > 0 ? LEVELS[filled - 1] : undefined;

  return (
    <Box>
      <Box aria-hidden="true" sx={{ display: "grid", gridTemplateColumns: `repeat(${LEVELS.length}, 1fr)`, gap: 0.75 }}>
        {LEVELS.map((_, i) => (
          <Box key={i} sx={{ height: 4, borderRadius: 2, overflow: "hidden", bgcolor: "divider" }}>
            <motion.span
              style={{ display: "block", height: "100%", transformOrigin: "left" }}
              initial={false}
              animate={{ transform: i < filled ? "scaleX(1)" : "scaleX(0)" }}
              transition={reduced ? { duration: 0 } : { duration: duration.base, ease: ease.outExpo }}
            >
              <Box sx={{ height: "100%", bgcolor: level?.color, transition: "background-color 300ms" }} />
            </motion.span>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 0.75, fontSize: "0.8125rem", color: "text.secondary" }}>
        Força da senha{level ? `: ${level.label}` : ""}
      </Box>
    </Box>
  );
}

// Strength meter and checklist of the new-password rules, updated as the user types.
export function PasswordRules({ value }: { value: string }) {
  const results = PASSWORD_RULES.map((rule) => ({ rule, met: rule.test(value) }));
  const metCount = results.filter((result) => result.met).length;

  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      <StrengthMeter met={metCount} total={results.length} />
      <Box
        component="ul"
        aria-label="Requisitos da senha"
        sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gap: 0.5 }}
      >
        {results.map(({ rule, met }) => (
          <Box
            component="li"
            key={rule.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              fontSize: "0.8125rem",
              color: met ? "success.main" : "text.secondary",
              transition: "color 200ms",
            }}
          >
            <CheckDraw size={16} drawn={met} />
            <span>{rule.label}</span>
            <span className="sr-only">{met ? " (atendido)" : " (pendente)"}</span>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
