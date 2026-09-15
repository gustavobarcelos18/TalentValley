import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminAuditView } from "@/components/admin/AdminViews";
import { AppShell } from "@/components/layout/AppShell";
export default function Page() { return <ProtectedRoute allowedRoles={["ADMIN"]}><AppShell><AdminAuditView /></AppShell></ProtectedRoute>; }
