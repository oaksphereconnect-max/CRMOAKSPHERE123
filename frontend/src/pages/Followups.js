import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { PriorityBadge, fmtDate } from "@/lib/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarClock, CheckCircle2, MessageCircle } from "lucide-react";
import { waLink } from "@/components/LeadDrawer";

const VIEWS = [["today", "Today's"], ["overdue", "Overdue"], ["upcoming", "Upcoming"], ["completed", "Completed"]];

export default function Followups() {
  const [view, setView] = useState("today");
  const [rows, setRows] = useState(null);

  const load = useCallback(() => {
    setRows(null);
    api.get(`/followups?view=${view}`).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [view]);
  useEffect(() => { load(); }, [load]);

  const complete = async (id) => {
    await api.post(`/followups/${id}/complete`);
    toast.success("Follow-up marked complete");
    load();
  };

  return (
    <div>
      <PageHeader title="Follow-up Engine" subtitle="Never miss a callback." testid="followups-header" />
      <Tabs value={view} onValueChange={setView} className="mb-4">
        <TabsList data-testid="followup-tabs">
          {VIEWS.map(([k, l]) => <TabsTrigger key={k} value={k} data-testid={`followup-tab-${k}`}>{l}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {rows === null ? <Loading /> : rows.length === 0 ? <EmptyState icon={CalendarClock} title={`No ${view} follow-ups`} /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Candidate</th><th className="py-3 px-3">Phone</th><th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Due</th><th className="py-3 px-3">Reason</th><th className="py-3 px-3">Recruiter</th><th className="py-3 px-3 text-right">Action</th>
              </tr></thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id} data-testid={`followup-row-${f.id}`} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="py-3 px-3 font-medium">{f.lead_name}</td>
                    <td className="py-3 px-3 font-mono text-xs">{f.phone}</td>
                    <td className="py-3 px-3"><PriorityBadge priority={f.priority} /></td>
                    <td className="py-3 px-3 text-xs">
                      {fmtDate(f.due_date)}
                      {f.overdue_by && <span className="ml-2 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">OVERDUE BY {f.overdue_by}</span>}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-xs max-w-[200px] truncate">{f.reason}</td>
                    <td className="py-3 px-3 text-slate-600 text-xs">{f.recruiter_name}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a href={waLink(f.phone)} target="_blank" rel="noreferrer" className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"><MessageCircle className="w-4 h-4" /></a>
                        {f.status !== "completed" && <Button size="sm" variant="outline" data-testid={`complete-followup-${f.id}`} onClick={() => complete(f.id)}><CheckCircle2 className="w-4 h-4 mr-1" /> Done</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
