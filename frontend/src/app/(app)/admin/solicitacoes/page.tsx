import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RegistrationRequestsView } from "@/components/admin/RegistrationRequestsView";
import { AppShell } from "@/components/layout/AppShell";
export default function Page() { return <ProtectedRoute allowedRoles={["ADMIN"]}><AppShell><RegistrationRequestsView /></AppShell></ProtectedRoute>; }
