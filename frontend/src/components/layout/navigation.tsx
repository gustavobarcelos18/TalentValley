import type { ReactElement } from "react";
import BusinessCenterOutlined from "@mui/icons-material/BusinessCenterOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import FavoriteBorderOutlined from "@mui/icons-material/FavoriteBorderOutlined";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import InboxOutlined from "@mui/icons-material/InboxOutlined";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import PersonOutlineOutlined from "@mui/icons-material/PersonOutlineOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import type { UserRole } from "@/types/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: ReactElement;
}

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  ALUNO: [
    { label: "Início", href: "/inicio", icon: <HomeOutlined /> },
    { label: "Meu perfil", href: "/meu-perfil", icon: <PersonOutlineOutlined /> },
    { label: "Minha conta", href: "/conta", icon: <ManageAccountsOutlined /> },
  ],
  RECRUTADOR: [
    { label: "Visão geral", href: "/recrutador", icon: <DashboardOutlined /> },
    { label: "Explorar talentos", href: "/recrutador/talentos", icon: <PeopleAltOutlined /> },
    { label: "Favoritos", href: "/recrutador/favoritos", icon: <FavoriteBorderOutlined /> },
  ],
  ADMIN: [
    { label: "Visão geral", href: "/admin", icon: <DashboardOutlined /> },
    { label: "Solicitações", href: "/admin/solicitacoes", icon: <InboxOutlined /> },
    { label: "Alunos", href: "/admin/alunos", icon: <SchoolOutlined /> },
    { label: "Recrutadores", href: "/admin/recrutadores", icon: <BusinessCenterOutlined /> },
    { label: "Validações RPV", href: "/admin/validacoes-rpv", icon: <VerifiedOutlined /> },
    { label: "Auditoria", href: "/admin/auditoria", icon: <FactCheckOutlined /> },
  ],
};

export const CHANGE_PASSWORD_HREF = "/conta/senha";
// Recruiters only: students have the same section inside "Minha conta" (/conta).
export const PRIVACY_HREF = "/conta/privacidade";

/** The overview routes match only themselves; every other item also owns its nested routes. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/recrutador" || item.href === "/admin") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
