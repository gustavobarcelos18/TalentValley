import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminStudentDetailView } from "@/components/admin/AdminViews";
import { AppShell } from "@/components/layout/AppShell";
export default async function Page({ params }: PageProps<"/admin/alunos/[id]">) { const { id } = await params; return <ProtectedRoute allowedRoles={["ADMIN"]}><AppShell><AdminStudentDetailView id={id} /></AppShell></ProtectedRoute>; }
