"use client";

import Link from "next/link";
import { Button } from "@mui/material";
import { ArrowForward, NorthEast } from "@mui/icons-material";
import { useAuth } from "@/hooks/useAuth";
import { getRoleDestination } from "@/lib/paths";
import { ActionMotion } from "./motion/ActionMotion";
import { entrance } from "./entrance";

/** Public CTA set is the default first-paint state; a confirmed session only upgrades it. */
export function JoinActions({ audience }: { audience?: "talent" | "company" }) {
  const { user } = useAuth();
  if (user) return <div className="join-actions"><ActionMotion><Button component={Link} href={getRoleDestination(user.role)} variant="contained" endIcon={<ArrowForward />}>Acessar minha área</Button></ActionMotion></div>;
  return <div className="join-actions">
    {audience !== "company" && <ActionMotion><Button component={Link} href="/cadastro/aluno" variant="contained" endIcon={<ArrowForward />}>Sou Talento</Button></ActionMotion>}
    {audience !== "talent" && <ActionMotion><Button component={Link} href="/cadastro/recrutador" variant={audience ? "contained" : "outlined"} endIcon={<ArrowForward />}>Sou Recrutador</Button></ActionMotion>}
  </div>;
}

export function HeroActions() {
  const { user } = useAuth();
  const actions = user
    ? [{ href: getRoleDestination(user.role), label: "Acessar minha área", contained: true }]
    : [{ href: "/cadastro/aluno", label: "Sou Talento", contained: true }, { href: "/cadastro/recrutador", label: "Sou Recrutador", contained: false }];
  // Keyed by position: when the session arrives the wrapper survives, so the CSS entrance never replays.
  return <div className="join-actions">{actions.map((action, index) =>
    <div key={index} className="entrance" style={entrance(0.8 + index * 0.1)}>
      <ActionMotion>
        <Button component={Link} href={action.href} variant={action.contained ? "contained" : "outlined"} endIcon={<ArrowForward />}>{action.label}</Button>
      </ActionMotion>
    </div>
  )}</div>;
}

/** Footer access link; its label depends on the session. */
export function FooterAccessLink() {
  const { user } = useAuth();
  return <Link href={user ? getRoleDestination(user.role) : "/login"}>{user ? "Minha área" : "Entrar"}<NorthEast fontSize="small"/></Link>;
}
