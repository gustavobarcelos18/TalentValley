"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { TalentProfileView } from "@/components/recruiter/TalentProfileView";

export default function TalentProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  return <ProtectedRoute allowedRoles={["RECRUTADOR"]}><AppShell><TalentProfileView slug={slug} /></AppShell></ProtectedRoute>;
}
