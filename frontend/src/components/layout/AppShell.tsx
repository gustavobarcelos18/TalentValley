"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  useColorScheme,
  useMediaQuery,
  type Theme,
} from "@mui/material";
import Close from "@mui/icons-material/Close";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import { useAuth } from "@/hooks/useAuth";
import { useMyPhoto } from "@/hooks/useMyPhoto";
import { BrandLink } from "@/components/brand/BrandLink";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { AuthMotionConfig } from "@/components/auth/motion/AuthMotionConfig";
import { ROLE_LABELS } from "@/lib/labels";
import { CHANGE_PASSWORD_HREF, NAV_BY_ROLE, PRIVACY_HREF } from "./navigation";
import { SidebarPanel } from "./SidebarPanel";
import { useSidebarCollapsed } from "./useSidebarCollapsed";

const EXPANDED_WIDTH = 272;
const COLLAPSED_WIDTH = 80;
const DRAWER_WIDTH = 300;

interface AppShellProps {
  children: ReactNode;
}

// Reusable authenticated shell for the internal application (student, recruiter
// and admin): collapsible side menu on desktop, sliding menu on phones.
export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const { photoPath, reloadKey } = useMyPhoto();
  const pathname = usePathname();
  const router = useRouter();
  const { mode, systemMode, setMode } = useColorScheme();
  const desktop = useMediaQuery((theme: Theme) => theme.breakpoints.up("lg"));
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const [shownPathname, setShownPathname] = useState(pathname);

  const navItems = user ? NAV_BY_ROLE[user.role] : [];
  const roleLabel = user ? ROLE_LABELS[user.role] : "";
  const dark = (mode === "system" ? systemMode : mode) !== "light";

  // The shell stays mounted between pages, so both menus must close by themselves when the
  // address changes (for instance with the phone's back gesture) or the screen becomes wide.
  if (shownPathname !== pathname) {
    setShownPathname(pathname);
    setMenuOpen(false);
    setAccountAnchor(null);
  }
  if (desktop && menuOpen) {
    setMenuOpen(false);
    setAccountAnchor(null);
  }

  async function handleLogout() {
    setMenuOpen(false);
    setAccountAnchor(null);
    await logout();
    router.replace("/login");
  }

  function closeAccountMenu() {
    setAccountAnchor(null);
    setMenuOpen(false);
  }

  const panelProps = {
    user,
    navItems,
    pathname,
    roleLabel,
    photoPath,
    reloadKey,
    dark,
    onToggleMode: () => setMode(dark ? "light" : "dark"),
    accountMenuOpen: Boolean(accountAnchor),
    onOpenAccountMenu: setAccountAnchor,
  };

  return (
    <AuthMotionConfig>
      <Box sx={{ minHeight: "100dvh", display: "flex", bgcolor: "background.default" }}>
        <Box
          sx={(theme) => ({
            display: { xs: "none", lg: "block" },
            flexShrink: 0,
            position: "sticky",
            top: 0,
            alignSelf: "flex-start",
            height: "100dvh",
            width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
            overflow: "hidden",
            bgcolor: "background.paper",
            borderRight: 1,
            borderColor: "divider",
            transition: theme.transitions.create("width", { duration: theme.transitions.duration.shorter }),
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          })}
        >
          <SidebarPanel
            {...panelProps}
            idPrefix="desktop"
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed(!collapsed)}
          />
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {/* The demonstration notice and the phone's top bar stick together, so neither covers the other. */}
          <Box sx={{ position: "sticky", top: 0, zIndex: (theme) => theme.zIndex.appBar }}>
            <DemoBanner />
            <AppBar
              position="static"
              elevation={0}
              sx={{
                display: { xs: "block", lg: "none" },
                bgcolor: "background.paper",
                color: "text.primary",
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Toolbar disableGutters sx={{ px: { xs: 2, sm: 3 }, minHeight: 64, gap: 1.5 }}>
                {user && (
                  <IconButton aria-label="Abrir menu" edge="start" onClick={() => setMenuOpen(true)}>
                    <MenuIcon />
                  </IconButton>
                )}
                <BrandLink />
              </Toolbar>
            </AppBar>
          </Box>

          <Box component="main" sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {children}
          </Box>
        </Box>
      </Box>

      <Drawer
        anchor="left"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        slotProps={{ paper: { sx: { width: DRAWER_WIDTH, maxWidth: "85vw" } } }}
      >
        <SidebarPanel
          {...panelProps}
          idPrefix="drawer"
          collapsed={false}
          onNavigate={() => setMenuOpen(false)}
          headerAction={
            <IconButton aria-label="Fechar menu" onClick={() => setMenuOpen(false)}>
              <Close />
            </IconButton>
          }
        />
      </Drawer>

      {user && (
        <Menu
          id="account-menu"
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={() => setAccountAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "left" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={{ list: { "aria-labelledby": accountAnchor?.id } }}
        >
          {!user.modoDemonstracao && (
            <MenuItem
              component={Link}
              href={CHANGE_PASSWORD_HREF}
              selected={pathname === CHANGE_PASSWORD_HREF}
              onClick={closeAccountMenu}
            >
              <ListItemIcon>
                <LockOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText>Alterar senha</ListItemText>
            </MenuItem>
          )}
          {user.role === "RECRUTADOR" && (
            <MenuItem
              component={Link}
              href={PRIVACY_HREF}
              selected={pathname === PRIVACY_HREF}
              onClick={closeAccountMenu}
            >
              <ListItemIcon>
                <ShieldOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText>Privacidade</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
            <ListItemIcon sx={{ color: "inherit" }}>
              <LogoutOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Sair</ListItemText>
          </MenuItem>
        </Menu>
      )}
    </AuthMotionConfig>
  );
}
