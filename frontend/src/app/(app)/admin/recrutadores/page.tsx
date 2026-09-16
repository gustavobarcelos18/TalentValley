import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRecruitersDeletionView } from "@/components/admin/AdminRecruitersDeletionView";
import { AppShell } from "@/components/layout/AppShell";
export default function Page() { return <ProtectedRoute allowedRoles={["ADMIN"]}><AppShell><AdminRecruitersDeletionView /></AppShell></ProtectedRoute>; }
