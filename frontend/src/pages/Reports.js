import { useState, useEffect } from "react";
import api from "@/lib/api";
import { PageHeader, Loading } from "@/components/common";
import { StatusBadge, initials, fmtDate } from "@/lib/ui";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Award, Target, TrendingDown } from "lucide-react";

const STATUS_TONE = { Excellent: "text-emerald-600", "On Track": "text-blue-600", "Attention Required": "text-amber-600", Critical: "text-rose-600" };

export default function Reports() {
  const [tab, setTab] = useState("targets");
  const [targets, setTargets] = useState(null);
  const [board, setBoard] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [missed, setMissed] = useState(null);
  const [leads, setLeads] = useState(null);

  useEffect(() => {
    api.get("/dashboard/targets").then((r) => setTargets(r.data));
    api.get("/dashboard/leaderboard").then((r) => setBoard(r.data));
    api.get("/dashboard/funnel").then((r) => setFunnel(r.data));
    api.get("/reports/missed-followups").then((r) => setMissed(r.data));
    api.get("/leads").then((r) => setLeads(r.data));
  }, []);

  const agingBuckets = leads ? ["New", "1 day", "3 days", "7 days", "15+ days"].map((b) => ({ b, n: leads.filter((l) => l.aging === b).length })) : [];
  const maxFunnel = funnel ? Math.max(...funnel.map((f) => f.count), 1) : 1;

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Targets, leaderboard, funnel and lead aging" testid="reports-header" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="targets" data-testid="report-tab-targets"><Target className="w-4 h-4 mr-1" /> Targets</TabsTrigger>
          <TabsTrigger value="leaderboard" data-testid="report-tab-leaderboard"><Award className="w-4 h-4 mr-1" /> Leaderboard</TabsTrigger>
          <TabsTrigger value="funnel" data-testid="report-tab-funnel">Funnel</TabsTrigger>
          <TabsTrigger value="aging" data-testid="report-tab-aging">Lead Aging</TabsTrigger>
          <TabsTrigger value="missed" data-testid="report-tab-missed"><TrendingDown className="w-4 h-4 mr-1" /> Missed Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="targets">
          {!targets ? <Loading /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {targets.map((t) => (
                <Card key={t.recruiter_id} data-testid={`target-card-${t.recruiter_id}`} className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="w-9 h-9">{t.avatar && <AvatarImage src={t.avatar} />}<AvatarFallback className="bg-blue-600 text-white text-xs">{initials(t.recruiter)}</AvatarFallback></Avatar>
                    <h3 className="font-semibold font-display">{t.recruiter}</h3>
                  </div>
                  <div className="space-y-3">
                    {t.metrics.map((m) => (
                      <div key={m.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">{m.label}</span>
                          <span className={`font-semibold ${STATUS_TONE[m.status]}`}>{m.actual}/{m.target} • {m.status}</span>
                        </div>
                        <Progress value={Math.min((m.actual / m.target) * 100, 100)} className="h-2" />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard">
          {!board ? <Loading /> : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
                    {["Rank", "Recruiter", "Calls", "Connected", "Lineups", "Attended", "Selected", "Joined", "Missed", "Score"].map((h) => <th key={h} className="py-3 px-3">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {board.map((r) => (
                      <tr key={r.recruiter_id} data-testid={`lb-row-${r.recruiter_id}`} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="py-3 px-3"><span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${r.rank === 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{r.rank}</span></td>
                        <td className="py-3 px-3 font-medium">{r.recruiter}</td>
                        <td className="py-3 px-3">{r.calls}</td><td className="py-3 px-3 text-emerald-600">{r.connected}</td>
                        <td className="py-3 px-3">{r.lineups}</td><td className="py-3 px-3">{r.attendance}</td>
                        <td className="py-3 px-3 text-blue-600">{r.selected}</td><td className="py-3 px-3 text-emerald-600 font-semibold">{r.joined}</td>
                        <td className="py-3 px-3 text-rose-600">{r.missed_followups}</td>
                        <td className="py-3 px-3 font-bold font-mono text-blue-600">{r.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="funnel">
          {!funnel ? <Loading /> : (
            <Card className="p-6">
              <div className="space-y-3">
                {funnel.map((f) => (
                  <div key={f.stage} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-slate-500 text-right">{f.stage}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-7 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-end px-2 text-white text-xs font-semibold" style={{ width: `${Math.max((f.count / maxFunnel) * 100, 6)}%` }}>{f.count}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="aging">
          {!leads ? <Loading /> : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {agingBuckets.map((a) => (
                <Card key={a.b} data-testid={`aging-${a.b}`} className="p-5 text-center">
                  <p className="text-3xl font-bold font-display text-slate-800 dark:text-slate-100">{a.n}</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{a.b}</p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="missed">
          {!missed ? <Loading /> : missed.length === 0 ? <Card className="p-8 text-center text-slate-400">No missed follow-ups 🎉</Card> : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
                    {["Recruiter", "Candidate", "Phone", "Original Time", "Delay", "Priority", "Status"].map((h) => <th key={h} className="py-3 px-3">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {missed.map((m, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="py-3 px-3 font-medium">{m.recruiter}</td><td className="py-3 px-3">{m.candidate}</td>
                        <td className="py-3 px-3 font-mono text-xs">{m.phone}</td>
                        <td className="py-3 px-3 text-xs">{fmtDate(m.original_time)}</td>
                        <td className="py-3 px-3 text-rose-600 font-semibold">{m.delay}</td>
                        <td className="py-3 px-3">{m.priority}</td><td className="py-3 px-3"><StatusBadge status={m.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
