"use client";

import { Suspense } from "react";
import { Container, Skeleton } from "@mui/material";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { TalentComparisonView } from "@/components/recruiter/TalentComparisonView";

export default function ComparisonPage() {
  return <ProtectedRoute allowedRoles={["RECRUTADOR"]}><AppShell><Suspense fallback={<Container sx={{ py: 4 }}><Skeleton variant="rounded" height={500} /></Container>}><TalentComparisonView /></Suspense></AppShell></ProtectedRoute>;
}
