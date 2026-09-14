"use client";

import { Suspense } from "react";
import { Container, Skeleton } from "@mui/material";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { FavoritesView } from "@/components/recruiter/FavoritesView";

export default function FavoritesPage() {
  return <ProtectedRoute allowedRoles={["RECRUTADOR"]}><AppShell><Suspense fallback={<Container sx={{ py: 4 }}><Skeleton variant="rounded" height={300} /></Container>}><FavoritesView /></Suspense></AppShell></ProtectedRoute>;
}
