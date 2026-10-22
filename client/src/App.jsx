
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import api from "./services/api";
import Login from "./pages/Login";

import Dashboard from "./pages/Dashboard";
import NewEntry from "./pages/NewEntry";
import AllOrders from "./pages/AllOrders";
import Deadlines from "./pages/Deadlines";
import ArtistWorkload from "./pages/ArtistWorkload";
import Notifications from "./pages/Notifications";
import Reports from "./pages/Reports";
import ActivityLog from "./pages/ActivityLog";

function Navigation({ user, onLogout }) {
  const links = [
    { to: "/", label: "Dashboard" },
    { to: "/orders", label: "All Orders" },
    { to: "/deadlines", label: "Deadline Alerts" },
    { to: "/new-entry", label: "New Entry" },
    { to: "/artist-workload", label: "Artist Workload" },
    { to: "/notifications", label: "Notifications" },
    { to: "/reports", label: "Reports & Export" },
    { to: "/activity-log", label: "Activity Log" },
  ];

  return (
    <nav className="flex flex-wrap items-center justify-around gap-1 border-t border-gray-800 bg-[#18191e] p-3 text-sm md:justify-start md:gap-3 md:px-8">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="rounded-lg px-3 py-2 text-gray-300 transition hover:bg-blue-700 hover:text-white"
        >
          {link.label}
        </Link>
      ))}

      <div className="ml-auto flex items-center gap-3 px-2 py-2">
        <span className="text-gray-300">
          {user.full_name}
          <span className="ml-2 rounded bg-gray-700 px-2 py-1 text-xs">
            {user.role}
          </span>
        </span>

        <button
          onClick={onLogout}
          className="rounded-lg bg-red-700 px-3 py-2 text-white hover:bg-red-600"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}

function AppContent() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [logoutError, setLogoutError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    api
      .get("/auth/me")
      .then((response) => {
        if (active) setUser(response.data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    setLogoutError("");

    try {
      await api.post("/auth/logout");
      setUser(null);
      navigate("/login", { replace: true });
    } catch {
      setLogoutError(
        "Unable to log out because the server could not confirm the request. Please try again."
      );
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111216] text-white">
        Checking your session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111216]">
      {user ? (
        <>
          <header className="border-b border-gray-800 px-5 py-4 text-xl font-bold text-white">
            🐾 Furesque
          </header>

          <Navigation user={user} onLogout={handleLogout} />

          <main>
            {logoutError && (
              <p
                role="alert"
                className="mx-5 mt-4 rounded-lg bg-red-950 p-3 text-red-300"
              >
                {logoutError}
              </p>
            )}

            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<AllOrders />} />
              <Route path="/deadlines" element={<Deadlines />} />
              <Route path="/new-entry" element={<NewEntry />} />
              <Route
                path="/artist-workload"
                element={<ArtistWorkload />}
              />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/activity-log" element={<ActivityLog />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </>
      ) : (
        <Routes>
          <Route
            path="/login"
            element={<Login onLogin={setUser} />}
          />
          <Route
            path="*"
            element={<Navigate to="/login" replace />}
          />
        </Routes>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
