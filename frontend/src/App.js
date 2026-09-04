import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import MyDay from "@/pages/MyDay";
import Leads from "@/pages/Leads";
import CallingList from "@/pages/CallingList";
import Followups from "@/pages/Followups";
import Interviews from "@/pages/Interviews";
import Joining from "@/pages/Joining";
import Jobs from "@/pages/Jobs";
import Clients from "@/pages/Clients";
import Recruiters from "@/pages/Recruiters";
import Reports from "@/pages/Reports";
import ImportLeads from "@/pages/ImportLeads";
import NotificationsPage from "@/pages/NotificationsPage";
import Settings from "@/pages/Settings";
import ActionRequired from "@/pages/ActionRequired";
import "@/App.css";

function Protected({ children, roles }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Layout><div className="py-20 text-center text-slate-400">You don't have access to this page.</div></Layout>;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/my-day" element={<Protected roles={["recruiter", "team_leader"]}><MyDay /></Protected>} />
        <Route path="/leads" element={<Protected><Leads key="all" /></Protected>} />
        <Route path="/my-leads" element={<Protected roles={["recruiter", "team_leader"]}><Leads key="mine" mine /></Protected>} />
        <Route path="/calling" element={<Protected><CallingList /></Protected>} />
        <Route path="/followups" element={<Protected><Followups /></Protected>} />
        <Route path="/interviews" element={<Protected><Interviews /></Protected>} />
        <Route path="/joining" element={<Protected><Joining /></Protected>} />
        <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
        <Route path="/clients" element={<Protected><Clients /></Protected>} />
        <Route path="/recruiters" element={<Protected roles={["admin", "team_leader"]}><Recruiters /></Protected>} />
        <Route path="/reports" element={<Protected><Reports /></Protected>} />
        <Route path="/action-required" element={<Protected roles={["admin", "team_leader"]}><ActionRequired /></Protected>} />
        <Route path="/import" element={<Protected roles={["admin"]}><ImportLeads /></Protected>} />
        <Route path="/notifications" element={<Protected><NotificationsPage /></Protected>} />
        <Route path="/settings" element={<Protected roles={["admin"]}><Settings /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
