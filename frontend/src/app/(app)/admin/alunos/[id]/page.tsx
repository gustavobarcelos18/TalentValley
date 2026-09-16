import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminStudentDetailView } from "@/components/admin/AdminViews";
import { AppShell } from "@/components/layout/AppShell";
import { AdminStudentDeleteButton } from "@/components/admin/AdminStudentDeleteButton";
export default async function Page({ params }: PageProps<"/admin/alunos/[id]">) { const { id } = await params; return <ProtectedRoute allowedRoles={["ADMIN"]}><AppShell><AdminStudentDetailView id={id} /><div className="mx-auto w-full max-w-6xl px-6 pb-8"><AdminStudentDeleteButton id={id} /></div></AppShell></ProtectedRoute>; }
