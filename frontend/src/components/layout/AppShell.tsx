"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppBar,
  Avatar,
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
} from "@mui/material";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/labels";
import { initialsOf } from "@/lib/format";
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
  ],
  ADMIN: [],
};

interface AppShellProps {
  children: ReactNode;
}

// Reusable authenticated shell for the internal application (student, recruiter
// and admin). Theme-compatible surfaces, responsive navigation and logout.
export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = user ? NAV_BY_ROLE[user.role] : [];
  const roleLabel = user ? ROLE_LABELS[user.role] : "";

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.replace("/login");
  }

  function renderBrand() {
    return (
      <Stack direction="row" spacing={1.5}>
        <Box
          aria-hidden
          sx={{ alignItems: "center",
            width: 32,
            height: 32,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          TV
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>
          Talent{" "}
          <Box component="span" sx={{ color: "primary.main" }}>
            Valley
          </Box>
        </Typography>
      </Stack>
    );
  }

  function isActive(item: NavItem): boolean {
    if (item.href === "/recrutador") return pathname === item.href;
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
              spacing={{ xs: 1, md: 4 }}
              sx={{ alignItems: "center", minWidth: 0 }}
            >
              {renderBrand()}
              <Stack
                direction="row"
                spacing={1}
                sx={{alignItems: "center",  display: { xs: "none", md: "flex" } }}
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

            {user && (
              <>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ display: { xs: "none", md: "flex" } }}
                >
                  <Chip
                    label={roleLabel}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{alignItems: "center",  fontWeight: 600 }}
                  />
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
                  sx={{ display: { xs: "inline-flex", md: "none" } }}
                >
                  <MenuIcon />
                </IconButton>
              </>
            )}
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
          {renderBrand()}
          <Divider />
          {user && (
            <Stack direction="row" spacing={1.5}>
              <Avatar sx={{ bgcolor: "primary.main", fontWeight: 600 }}>
                {initialsOf(user.nome)}
              </Avatar>
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
