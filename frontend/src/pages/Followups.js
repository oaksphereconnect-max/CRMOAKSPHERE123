import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { PriorityBadge, StatusBadge, fmtDate } from "@/lib/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import WhatsAppModal from "@/components/WhatsAppModal";
import { FollowupDialog, CompleteFollowupDialog } from "@/components/LeadDialogs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarClock, CheckCircle2, MessageCircle, Search, Pencil, Trash2, X } from "lucide-react";

const VIEWS = [["today", "Due Today"], ["overdue", "Overdue"], ["tomorrow", "Tomorrow"], ["upcoming", "Upcoming"], ["missed", "Missed"], ["completed", "Completed"]];
const TONE = { overdue: "text-rose-600", missed: "text-rose-600", today: "text-amber-600", tomorrow: "text-blue-600", upcoming: "text-slate-600", completed: "text-emerald-600" };

export default function Followups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [view, setView] = useState(params.get("view") || "today");
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState({});
  const [q, setQ] = useState("");
  const [settings, setSettings] = useState(null);
  const [wa, setWa] = useState(null);
  const [complete, setComplete] = useState(null);
  const [resched, setResched] = useState(null);
  const [del, setDel] = useState(null);
  const recruiterId = params.get("recruiter_id") || "";
  const canDelete = user.role !== "recruiter";

  const load = useCallback(() => {
    setRows(null);
    const p = new URLSearchParams({ view });
    if (q) p.set("search", q);
    if (recruiterId) p.set("recruiter_id", recruiterId);
    api.get(`/followups?${p}`).then((r) => setRows(r.data)).catch(() => setRows([]));
    api.get("/followups/counts").then((r) => setCounts(r.data)).catch(() => {});
  }, [view, q, recruiterId]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => { api.get("/settings").then((r) => setSettings(r.data)).catch(() => {}); }, []);

  const remove = async () => {
    try { await api.delete(`/followups/${del.id}`); toast.success("Follow-up deleted"); setDel(null); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  return (
    <div>
      <PageHeader title="Follow-up Engine" subtitle="Every active lead stays in follow-up until it reaches a final status." testid="followups-header">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input data-testid="followup-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search candidate, phone…" className="pl-9 h-9 w-56" /></div>
        {recruiterId && <Button variant="ghost" size="sm" data-testid="clear-recruiter-filter" onClick={() => navigate("/followups")} className="h-9 text-xs"><X className="w-3.5 h-3.5 mr-1" /> Clear recruiter filter</Button>}
      </PageHeader>

      <div className="flex gap-1.5 flex-wrap mb-4" data-testid="followup-tabs">
        {VIEWS.map(([k, l]) => (
          <button key={k} data-testid={`followup-tab-${k}`} onClick={() => setView(k)}
            className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-colors ${view === k ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-900 border-slate-200 hover:border-blue-400"}`}>
            {l}<span className={`font-bold ${view === k ? "text-white" : TONE[k]}`} data-testid={`followup-count-${k}`}>{counts[k] ?? "…"}</span>
          </button>
        ))}
      </div>

      {rows === null ? <Loading /> : rows.length === 0 ? <EmptyState icon={CalendarClock} title={`No ${VIEWS.find((v) => v[0] === view)?.[1].toLowerCase()} follow-ups`} /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Candidate</th><th className="py-3 px-3">Priority / Status</th>
                <th className="py-3 px-3">Due</th><th className="py-3 px-3">Reason</th><th className="py-3 px-3">Recruiter</th><th className="py-3 px-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id} data-testid={`followup-row-${f.id}`} className={`border-b border-slate-100 dark:border-slate-800/60 ${f.is_overdue ? "bg-rose-50/40 dark:bg-rose-950/10" : ""}`}>
                    <td className="py-3 px-3">
                      <button data-testid={`fu-open-lead-${f.id}`} onClick={() => navigate(`/leads?focus=${f.lead_id}`)} className="text-left"><p className="font-medium hover:text-blue-600">{f.lead_name}</p><p className="text-[11px] text-slate-400 font-mono">{f.phone}</p></button>
                    </td>
                    <td className="py-3 px-3"><div className="flex flex-col gap-1 items-start"><PriorityBadge priority={f.priority} /><StatusBadge status={f.lead_status} /></div></td>
                    <td className="py-3 px-3 text-xs">
                      <span className={f.is_overdue ? "text-rose-600 font-semibold" : ""}>{fmtDate(f.due_date)}</span>
                      {f.overdue_by && <span className="ml-2 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">OVERDUE BY {f.overdue_by}</span>}
                      {f.status === "completed" && f.completed_at && <p className="text-[10px] text-emerald-600 mt-0.5">done {fmtDate(f.completed_at)}</p>}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-xs max-w-[220px]"><p className="truncate">{f.reason || "—"}</p>{f.outcome && <p className="text-emerald-700 truncate">→ {f.outcome}</p>}</td>
                    <td className="py-3 px-3 text-slate-600 text-xs">{f.recruiter_name}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button data-testid={`fu-wa-${f.id}`} onClick={() => setWa({ id: f.lead_id, name: f.lead_name, phone: f.phone })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="WhatsApp"><MessageCircle className="w-4 h-4" /></button>
                        {f.status !== "completed" && <>
                          <button data-testid={`fu-resched-${f.id}`} onClick={() => setResched(f)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Reschedule"><Pencil className="w-4 h-4" /></button>
                          <Button size="sm" variant="outline" className="h-8 text-xs ml-1" data-testid={`complete-followup-${f.id}`} onClick={() => setComplete(f)}><CheckCircle2 className="w-4 h-4 mr-1" /> Done</Button>
                        </>}
                        {canDelete && <button data-testid={`fu-delete-${f.id}`} onClick={() => setDel(f)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <WhatsAppModal open={!!wa} onOpenChange={(o) => !o && setWa(null)} lead={wa} onDone={load} />
      <CompleteFollowupDialog open={!!complete} onOpenChange={(o) => !o && setComplete(null)} followup={complete} statuses={settings?.lead_statuses || []} onDone={load} />
      <FollowupDialog open={!!resched} onOpenChange={(o) => !o && setResched(null)} lead={resched ? { id: resched.lead_id, name: resched.lead_name } : null} followup={resched} onDone={load} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this follow-up?" testid="delete-followup-confirm" description={`Follow-up for ${del?.lead_name} on ${del ? fmtDate(del.due_date) : ""} will be removed.`} onConfirm={remove} />
    </div>
  );
}
