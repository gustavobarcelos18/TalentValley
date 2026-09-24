"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppBar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useColorScheme,
} from "@mui/material";
import Close from "@mui/icons-material/Close";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import { useAuth } from "@/hooks/useAuth";
import { useMyPhoto } from "@/hooks/useMyPhoto";
import { UserAvatar } from "@/components/common/UserAvatar";
import { TalentValleyMark } from "@/components/brand/TalentValleyMark";
import { ROLE_LABELS } from "@/lib/labels";
import type { UserRole } from "@/types/auth";

interface NavItem {
  label: string;
  href: string;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  ALUNO: [{ label: "Meu perfil", href: "/meu-perfil" }],
  RECRUTADOR: [
    { label: "Visão geral", href: "/recrutador" },
    { label: "Explorar talentos", href: "/recrutador/talentos" },
    { label: "Favoritos", href: "/recrutador/favoritos" },
  ],
  ADMIN: [
    { label: "Visão geral", href: "/admin" },
    { label: "Solicitações", href: "/admin/solicitacoes" },
    { label: "Alunos", href: "/admin/alunos" },
    { label: "Recrutadores", href: "/admin/recrutadores" },
    { label: "Validações RPV", href: "/admin/validacoes-rpv" },
    { label: "Auditoria", href: "/admin/auditoria" },
  ],
};

// The brand always leads to the authenticated user's own home. This is a
// semantic rule of its own, so it stays explicit and independent from the
// NAV_BY_ROLE order, array indexes or the current pathname.
const HOME_BY_ROLE: Record<UserRole, string> = {
  ALUNO: "/meu-perfil",
  RECRUTADOR: "/recrutador",
  ADMIN: "/admin",
};

interface AppShellProps {
  children: ReactNode;
}

// Reusable authenticated shell for the internal application (student, recruiter
// and admin). Theme-compatible surfaces, responsive navigation and logout.
export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const { photoPath, reloadKey } = useMyPhoto();
  const pathname = usePathname();
  const router = useRouter();
  const { mode, systemMode, setMode } = useColorScheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = user ? NAV_BY_ROLE[user.role] : [];
  const roleLabel = user ? ROLE_LABELS[user.role] : "";
  const dark = (mode === "system" ? systemMode : mode) !== "light";

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.replace("/login");
  }

  function renderBrand(onNavigate?: () => void) {
    const homeHref = user ? HOME_BY_ROLE[user.role] : null;

    const brandContent = (
      <>
        <TalentValleyMark width={46} />
        <Typography
          sx={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 600,
            fontSize: 17,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            color: "text.primary",
            whiteSpace: "nowrap",
          }}
        >
          Talent{" "}
          <Box component="span" sx={{ color: "secondary.main" }}>
            Valley
          </Box>
        </Typography>
      </>
    );

    // While the authenticated user is unavailable there is no role home to
    // link to, so the brand stays as plain, non-interactive identity.
    if (!homeHref) {
      return (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          {brandContent}
        </Stack>
      );
    }

    return (
      <Stack
        component={Link}
        href={homeHref}
        onClick={onNavigate}
        direction="row"
        spacing={1.25}
        sx={{
          alignItems: "center",
          color: "inherit",
          textDecoration: "none",
          borderRadius: 1,
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: (theme) => theme.palette.primary.main,
            outlineOffset: 2,
          },
        }}
      >
        {brandContent}
      </Stack>
    );
  }

  function isActive(item: NavItem): boolean {
    if (item.href === "/recrutador" || item.href === "/admin") return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "background.paper",
          color: "text.primary",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar disableGutters sx={{ px: { xs: 2, sm: 3 }, minHeight: 64 }}>
          <Stack
            direction="row"
            sx={{ width: "100%", alignItems: "center", justifyContent: "space-between" }}
          >
            <Stack
              direction="row"
              spacing={{ xs: 1, lg: 4 }}
              sx={{ alignItems: "center", minWidth: 0 }}
            >
              {renderBrand()}
              <Stack
                direction="row"
                spacing={1}
                sx={{alignItems: "center",  display: { xs: "none", lg: "flex" } }}
              >
                {navItems.map((item) => (
                  <ListItemButton
                    key={item.href}
                    component={Link}
                    href={item.href}
                    selected={isActive(item)}
                    sx={{ borderRadius: 2, px: 2 }}
                  >
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: { sx: { fontWeight: 600, fontSize: 14 } },
                      }}
                    />
                  </ListItemButton>
                ))}
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <IconButton
                aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
                onClick={() => setMode(dark ? "light" : "dark")}
              >
                {dark ? <LightModeOutlined /> : <DarkModeOutlined />}
              </IconButton>
              {user && (
                <>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center", display: { xs: "none", lg: "flex" } }}
                  >
                    <Chip
                      label={roleLabel}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{alignItems: "center",  fontWeight: 600 }}
                    />
                    <UserAvatar name={user.nome} photoPath={photoPath} reloadKey={reloadKey} size={32} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {user.nome}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label="Sair da conta"
                      onClick={handleLogout}
                    >
                      <LogoutOutlined fontSize="small" />
                    </IconButton>
                  </Stack>
                  <IconButton
                    aria-label="Abrir menu"
                    onClick={() => setMenuOpen(true)}
                    sx={{ display: { xs: "inline-flex", lg: "none" } }}
                  >
                    <MenuIcon />
                  </IconButton>
                </>
              )}
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        slotProps={{ paper: { sx: { width: 300, p: 2.5 } } }}
      >
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            {renderBrand(() => setMenuOpen(false))}
            <IconButton aria-label="Fechar menu" onClick={() => setMenuOpen(false)}>
              <Close />
            </IconButton>
          </Stack>
          <Divider />
          {user && (
            <Stack direction="row" spacing={1.5}>
              <UserAvatar name={user.nome} photoPath={photoPath} reloadKey={reloadKey} size={40} />
              <Stack sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{alignItems: "center",  fontWeight: 600 }} noWrap>
                  {user.nome}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {roleLabel}
                </Typography>
              </Stack>
            </Stack>
          )}
          <Divider />
          <Stack component="nav" spacing={0.5}>
            {navItems.map((item) => (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={isActive(item)}
                onClick={() => setMenuOpen(false)}
                sx={{ borderRadius: 2 }}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </Stack>
          <Divider />
          <ListItemButton
            onClick={handleLogout}
            sx={{ borderRadius: 2, color: "error.main" }}
          >
            <ListItemText
              primary="Sair"
              slotProps={{ primary: { sx: { fontWeight: 600 } } }}
            />
            <LogoutOutlined fontSize="small" />
          </ListItemButton>
        </Stack>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}
      >
        {children}
      </Box>
    </Box>
  );
}
