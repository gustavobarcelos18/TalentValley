"use client";

import type { ReactNode } from "react";
import { Chip } from "@mui/material";
import BusinessCenterOutlined from "@mui/icons-material/BusinessCenterOutlined";
import HowToRegOutlined from "@mui/icons-material/HowToRegOutlined";
import PendingActionsOutlined from "@mui/icons-material/PendingActionsOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import UpdateOutlined from "@mui/icons-material/UpdateOutlined";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import PsychologyOutlined from "@mui/icons-material/PsychologyOutlined";
import { AdminDemoCard } from "@/components/demo/AdminDemoCard";
import { EmptyState } from "@/components/common/EmptyState";
import { StatCard } from "@/components/common/StatCard";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { adminApi } from "@/lib/admin";
import { useLoad } from "@/components/admin/useLoad";
import { Page, LoadState } from "@/components/admin/adminShared";

interface Indicator {
  label: string;
  value: number;
  href: string;
  icon: ReactNode;
  attention: boolean;
}

export function AdminDashboardView() {
  const state = useLoad(() => adminApi.dashboard(), []);
  if (state.loading || state.error || !state.data)
    return (
      <Page title="Visão geral">
        <LoadState {...state} skeleton="stats" count={6} />
      </Page>
    );
  const d = state.data;
  const indicators: Indicator[] = [
    {
      label: "Solicitações de cadastro pendentes",
      value: d.solicitacoesCadastroPendentes,
      href: "/admin/solicitacoes",
      icon: <HowToRegOutlined />,
      attention: d.solicitacoesCadastroPendentes > 0,
    },
    {
      label: "Alunos ativos",
      value: d.alunosAtivos,
      href: "/admin/alunos",
      icon: <SchoolOutlined />,
      attention: false,
    },
    {
      label: "Recrutadores ativos",
      value: d.recrutadoresAtivos,
      href: "/admin/recrutadores",
      icon: <BusinessCenterOutlined />,
      attention: false,
    },
    {
      label: "Validações RPV pendentes",
      value: d.validacoesRpvPendentes,
      href: "/admin/validacoes-rpv",
      icon: <PendingActionsOutlined />,
      attention: d.validacoesRpvPendentes > 0,
    },
    {
      label: "Perfis atualizados nos últimos 7 dias",
      value: d.perfisAtualizadosUltimos7Dias,
      href: "/admin/alunos",
      icon: <UpdateOutlined />,
      attention: false,
    },
    {
      label: "Formações RPV verificadas",
      value: d.formacoesRpvVerificadas,
      href: "/admin/validacoes-rpv",
      icon: <VerifiedOutlined />,
      attention: false,
    },
  ];
  return (
    <Page title="Visão geral" description="Acompanhe o que precisa da sua atenção. Clique em um indicador para abrir a área correspondente.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {indicators.map(({ label, value, href, icon, attention }, index) => (
          <StatCard key={label} label={label} value={value} href={href} icon={icon} attention={attention} index={index} />
        ))}
      </div>
      <SurfaceCard title="Competências mais utilizadas" index={indicators.length}>
        {d.competenciasMaisUtilizadas.length ? (
          <div className="flex flex-wrap gap-2">
            {d.competenciasMaisUtilizadas.map((c) => (
              <Chip key={c.id} variant="outlined" label={`${c.nome} · ${c.quantidadeAlunos}`} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<PsychologyOutlined />}
            title="Ainda não há competências cadastradas em perfis ativos."
            description="Quando os alunos adicionarem competências, as mais usadas aparecem aqui."
          />
        )}
      </SurfaceCard>
      <AdminDemoCard index={indicators.length + 1} />
    </Page>
  );
}
