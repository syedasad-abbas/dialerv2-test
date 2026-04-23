import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireRole from "./components/RequireRole";
import PortalLayout from "./components/PortalLayout";
import LoginPage from "./pages/LoginPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import NewUserPage from "./pages/NewUserPage";
import DialerPage from "./pages/DialerPage";
import { useAuthStore } from "./store/authStore";

function HomeRedirect() {
  const { token } = useAuthStore();
  return <Navigate to={token ? "/portal" : "/login"} replace />;
}

function PortalIndexRedirect() {
  const { user } = useAuthStore();
  return <Navigate to={user?.role === "admin" ? "/portal/dashboard" : "/portal/dialer"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute roles={["admin", "agent", "user"]} />}>
        <Route path="/portal" element={<PortalLayout />}>
          <Route index element={<PortalIndexRedirect />} />
          <Route path="dialer" element={<DialerPage />} />

          <Route element={<RequireRole roles={["admin"]} />}>
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="users/new" element={<NewUserPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
