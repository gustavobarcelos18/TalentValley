"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Button,
  Divider,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import ExpandMore from "@mui/icons-material/ExpandMore";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import { motion } from "framer-motion";
import { BrandLink } from "@/components/brand/BrandLink";
import { spring } from "@/components/auth/motion/tokens";
import { UserAvatar } from "@/components/common/UserAvatar";
import type { UsuarioAutenticado } from "@/types/auth";
import { isNavItemActive, type NavItem } from "./navigation";

interface SidebarNavItemProps {
  item: NavItem;
  pathname: string;
  compact: boolean;
  /** Keeps the animated active marker of this menu apart from the other copy of the menu. */
  idPrefix: string;
  onNavigate?: () => void;
}

function SidebarNavItem({ item, pathname, compact, idPrefix, onNavigate }: SidebarNavItemProps) {
  const active = isNavItemActive(item, pathname);

  const button = (
    <ListItemButton
      component={Link}
      href={item.href}
      selected={active}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      sx={(theme) => ({
        position: "relative",
        flexGrow: 0,
        minHeight: 44,
        px: 1.5,
        gap: compact ? 0 : 1.5,
        justifyContent: compact ? "center" : "flex-start",
        overflow: "hidden",
        color: "text.secondary",
        "&.Mui-selected, &.Mui-selected:hover": { color: (theme.vars ?? theme).palette.text.primary },
      })}
    >
      {active && (
        <motion.span
          layoutId={`${idPrefix}-active-marker`}
          transition={spring.snappy}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 10,
            bottom: 10,
            width: 3,
            borderRadius: 3,
            background: "var(--mui-palette-vivid-main)",
          }}
        />
      )}
      <ListItemIcon sx={{ minWidth: 0, color: "inherit" }}>{item.icon}</ListItemIcon>
      <ListItemText
        primary={item.label}
        sx={{ m: 0, ...(compact && { flex: "0 0 0", width: 0, opacity: 0 }) }}
        slotProps={{ primary: { noWrap: true, sx: { fontWeight: 600, fontSize: 14 } } }}
      />
    </ListItemButton>
  );

  // Only the icon-only menu needs a tooltip; its links keep their text as accessible name.
  return compact ? (
    <Tooltip title={item.label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

interface AccountButtonProps {
  id: string;
  user: UsuarioAutenticado;
  roleLabel: string;
  photoPath: string | null;
  reloadKey: number;
  compact: boolean;
  menuOpen: boolean;
  onOpen: (anchor: HTMLElement) => void;
}

function AccountButton({ id, user, roleLabel, photoPath, reloadKey, compact, menuOpen, onOpen }: AccountButtonProps) {
  const button = (
    <Button
      id={id}
      color="inherit"
      aria-label={`Menu da conta de ${user.nome}`}
      aria-haspopup="menu"
      aria-controls={menuOpen ? "account-menu" : undefined}
      aria-expanded={menuOpen ? "true" : undefined}
      onClick={(event) => onOpen(event.currentTarget)}
      sx={{
        textTransform: "none",
        borderRadius: 2,
        minWidth: 0,
        justifyContent: compact ? "center" : "flex-start",
        gap: 1.25,
        px: compact ? 0 : 1,
        py: 1,
        textAlign: "left",
      }}
    >
      <UserAvatar
        key={`${user.id}-${reloadKey}`}
        name={user.nome}
        photoPath={photoPath}
        reloadKey={reloadKey}
        size={36}
      />
      {!compact && (
        <>
          <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {user.nome}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {roleLabel}
            </Typography>
          </Stack>
          <ExpandMore fontSize="small" />
        </>
      )}
    </Button>
  );

  // The tooltip stays mounted when the menu expands, so the avatar is not remounted (which would download the photo again).
  // An empty title shows nothing, and the button keeps its own aria-label.
  return (
    <Tooltip title={compact ? user.nome : ""} placement="right">
      {button}
    </Tooltip>
  );
}

export interface SidebarPanelProps {
  idPrefix: string;
  collapsed: boolean;
  /** Present only on the desktop menu, which the user can collapse. */
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  /** Control placed next to the brand (the drawer's close button). */
  headerAction?: ReactNode;
  user: UsuarioAutenticado | null;
  navItems: NavItem[];
  pathname: string;
  roleLabel: string;
  photoPath: string | null;
  reloadKey: number;
  dark: boolean;
  onToggleMode: () => void;
  accountMenuOpen: boolean;
  onOpenAccountMenu: (anchor: HTMLElement) => void;
}

/** Content of the app menu: brand, navigation, theme and collapse controls, and the account button. */
export function SidebarPanel({
  idPrefix,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  headerAction,
  user,
  navItems,
  pathname,
  roleLabel,
  photoPath,
  reloadKey,
  dark,
  onToggleMode,
  accountMenuOpen,
  onOpenAccountMenu,
}: SidebarPanelProps) {
  return (
    <Stack sx={{ height: "100%", minHeight: 0, py: 2, px: collapsed ? 1 : 1.5 }}>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          px: collapsed ? 0 : 0.5,
          minHeight: 48,
        }}
      >
        <BrandLink compact={collapsed} onNavigate={onNavigate} />
        {headerAction}
      </Stack>

      <Stack
        component="nav"
        aria-label="Menu principal"
        spacing={0.5}
        sx={{ mt: 3, flexGrow: 1, overflowY: "auto" }}
      >
        {navItems.map((item) => (
          <SidebarNavItem
            key={item.href}
            item={item}
            pathname={pathname}
            compact={collapsed}
            idPrefix={idPrefix}
            onNavigate={onNavigate}
          />
        ))}
      </Stack>

      <Divider sx={{ my: 1.5 }} />
      <Stack
        direction={collapsed ? "column" : "row"}
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 0.5, mb: 1 }}
      >
        <Tooltip title={dark ? "Modo claro" : "Modo escuro"} placement="right">
          <IconButton aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"} onClick={onToggleMode}>
            {dark ? <LightModeOutlined /> : <DarkModeOutlined />}
          </IconButton>
        </Tooltip>
        {onToggleCollapsed && (
          <Tooltip title={collapsed ? "Expandir menu" : "Recolher menu"} placement="right">
            <IconButton
              aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
              aria-expanded={!collapsed}
              onClick={onToggleCollapsed}
            >
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {user && (
        <AccountButton
          id={`${idPrefix}-account-button`}
          user={user}
          roleLabel={roleLabel}
          photoPath={photoPath}
          reloadKey={reloadKey}
          compact={collapsed}
          menuOpen={accountMenuOpen}
          onOpen={onOpenAccountMenu}
        />
      )}
    </Stack>
  );
}
