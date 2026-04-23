import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useState } from "react";

export default function PortalLayout() {
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* SIDEBAR */}
      <aside
        style={{
          width: open ? 260 : 70,
          transition: "0.2s ease",
          borderRight: "1px solid #ddd",
          padding: 12,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* TOP BAR */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {open && <h3 style={{ margin: 0 }}>Portal</h3>}

          <button
            onClick={() => setOpen(!open)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>

        {/* ADMIN SECTION */}
        {isAdmin && (
          <div style={{ marginTop: 20 }}>
            {open && <div style={sectionTitle}>ADMIN</div>}

            <NavLink to="/portal/dashboard" style={navItem}>
              {open ? "Dashboard" : "Db"}
            </NavLink>

            <NavLink to="/portal/users/new" style={navItem}>
              {open ? "Users" : "Us"}
            </NavLink>
          </div>
        )}

        {/* WORKSPACE SECTION */}
        <div style={{ marginTop: 20 }}>
          {open && <div style={sectionTitle}>WORKSPACE</div>}

          <NavLink to="/portal/dialer" style={navItem}>
            {open ? "Dialer" : "Dl"}
          </NavLink>
        </div>

        {/* LOGOUT */}
        <button
          onClick={logout}
          style={{
            marginTop: "auto",
            padding: 10,
            border: "1px solid #ddd",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          {open ? "Logout" : "⏻"}
        </button>
      </aside>

      {/* MAIN AREA */}
      <main style={{ flex: 1, padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}

/* ---------------- STYLES ---------------- */

const sectionTitle = {
  fontSize: 11,
  fontWeight: 700,
  color: "#888",
  marginBottom: 6,
  letterSpacing: 1,
};

const navItem = ({ isActive }: { isActive: boolean }) => ({
  display: "flex",
  alignItems: "center",
  padding: "10px 12px",
  marginBottom: 6,
  borderRadius: 8,
  textDecoration: "none",
  fontSize: 14,
  color: isActive ? "#fff" : "#222",
  background: isActive ? "#111" : "transparent",
  border: isActive ? "1px solid #111" : "1px solid #ddd",
});
