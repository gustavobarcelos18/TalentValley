"use client";

import { Suspense } from "react";
import { Container, Skeleton } from "@mui/material";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CONTENT_MAX_WIDTH } from "@/components/layout/contentWidth";
import { TalentComparisonTableView } from "@/components/recruiter/TalentComparisonTableView";

export default function ComparisonTablePage() {
  return <ProtectedRoute allowedRoles={["RECRUTADOR"]}><Suspense fallback={<Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: 4 }}><Skeleton variant="rounded" height={500} /></Container>}><TalentComparisonTableView /></Suspense></ProtectedRoute>;
}
