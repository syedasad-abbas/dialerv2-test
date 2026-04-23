import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore, type UserRole } from "../store/authStore";

export default function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) return <Navigate to="/portal/dialer" replace />;
  return <Outlet />;
}
