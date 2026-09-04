import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, KpiCard, Loading } from "@/components/common";
import { Card } from "@/components/ui/card";
import {
  Users2, PhoneCall, PhoneOff, CalendarClock, AlertTriangle, Phone,
  UserCheck, TrendingUp, Award, CheckCircle2,
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [funnel, setFunnel] = useState([]);
  const [board, setBoard] = useState([]);

  useEffect(() => {
    api.get("/dashboard/main").then((r) => setData(r.data)).catch(() => {});
    api.get("/dashboard/funnel").then((r) => setFunnel(r.data)).catch(() => {});
    api.get("/dashboard/leaderboard").then((r) => setBoard(r.data)).catch(() => {});
  }, []);

  if (!data) return <Loading />;
  const t = data.today;
  const maxFunnel = Math.max(...funnel.map((f) => f.count), 1);

  return (
    <div>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="Today's performance at a glance" testid="dashboard-header" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard testid="kpi-leads-added" label="Leads Added" value={t.leads_added} icon={Users2} tone="blue" />
        <KpiCard testid="kpi-calls-made" label="Calls Made" value={t.calls_made} icon={PhoneCall} />
        <KpiCard testid="kpi-connected" label="Connected" value={t.connected} sub={`${t.not_connected} not connected`} icon={UserCheck} tone="green" />
        <KpiCard testid="kpi-interested" label="Interested" value={t.interested} icon={TrendingUp} tone="blue" />
        <KpiCard testid="kpi-followups-due" label="Follow-ups Due" value={t.followups_due} icon={CalendarClock} tone="yellow" />
        <KpiCard testid="kpi-followups-overdue" label="Overdue" value={t.followups_overdue} icon={AlertTriangle} tone="red" />
        <KpiCard testid="kpi-interviews" label="Interviews" value={t.interviews_scheduled} sub={`${t.interviews_attended} attended`} icon={Phone} tone="blue" />
        <KpiCard testid="kpi-joined" label="Joined" value={t.joined} sub={`${t.selected} selected`} icon={CheckCircle2} tone="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-5">
          <h3 className="font-semibold font-display text-slate-800 dark:text-slate-100 mb-4">Recruitment Funnel</h3>
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.stage} data-testid={`funnel-${f.stage}`} className="flex items-center gap-3">
                <span className="w-24 text-xs text-slate-500 text-right">{f.stage}</span>
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-6 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-end px-2 text-white text-[11px] font-semibold transition-all" style={{ width: `${Math.max((f.count / maxFunnel) * 100, 6)}%` }}>{f.count}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> Leaderboard</h3>
            <button className="text-xs text-blue-600 hover:underline" onClick={() => navigate("/reports")}>View all</button>
          </div>
          <div className="space-y-2">
            {board.slice(0, 5).map((r) => (
              <div key={r.recruiter_id} data-testid={`leaderboard-${r.recruiter_id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${r.rank === 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{r.rank}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{r.recruiter}</p>
                  <p className="text-[11px] text-slate-400">{r.joined} joined • {r.selected} selected • {r.connected} connected</p>
                </div>
                <span className="text-sm font-bold font-mono text-blue-600">{r.score}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h3 className="font-semibold font-display text-slate-800 dark:text-slate-100 mb-4">Recruiter Comparison (Today)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                {["Recruiter", "Leads", "Calls", "Connected", "Follow-ups", "Lineups", "Attendance", "Selected", "Joined"].map((h) => <th key={h} className="py-2 px-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.comparison.map((c) => (
                <tr key={c.recruiter_id} data-testid={`comparison-${c.recruiter_id}`} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-2 px-3 font-medium">{c.recruiter}</td>
                  <td className="py-2 px-3">{c.leads}</td><td className="py-2 px-3">{c.calls}</td>
                  <td className="py-2 px-3 text-emerald-600 font-medium">{c.connected}</td>
                  <td className="py-2 px-3">{c.followups}</td><td className="py-2 px-3">{c.lineups}</td>
                  <td className="py-2 px-3">{c.attendance}</td>
                  <td className="py-2 px-3 text-blue-600">{c.selected}</td>
                  <td className="py-2 px-3 text-emerald-600 font-semibold">{c.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
