import { Stack, Typography } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";

// Permanent, discreet reminder under the profile header: the profile is never public.
export function PrivacyNotice() {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: "text.secondary" }}>
      <LockOutlined fontSize="small" aria-hidden="true" />
      <Typography variant="body2">Perfil privado: só recrutadores aprovados veem.</Typography>
    </Stack>
  );
}
