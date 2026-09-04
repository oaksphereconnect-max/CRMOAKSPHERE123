import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { API } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { PriorityBadge, StatusBadge, fmtDate } from "@/lib/ui";
import LeadDrawer, { waLink } from "@/components/LeadDrawer";
import CallDispositionModal from "@/components/CallDispositionModal";
import LeadFormModal from "@/components/LeadFormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Download, PhoneCall, MessageCircle, Users2, Search, Shuffle } from "lucide-react";

const SAVED_VIEWS = [
  { key: "", label: "All" }, { key: "new_leads", label: "New Leads" }, { key: "not_called", label: "Not Called" },
  { key: "todays_followups", label: "Today's Follow-ups" }, { key: "overdue_followups", label: "Overdue" },
  { key: "hot_leads", label: "Hot Leads" }, { key: "attendance_pending", label: "Attendance Pending" },
  { key: "selected", label: "Selected" }, { key: "joining_this_week", label: "Joining This Week" },
  { key: "joined", label: "Joined" }, { key: "lost", label: "Lost" },
];

export default function Leads({ mine = false }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [leads, setLeads] = useState(null);
  const [settings, setSettings] = useState(null);
  const [recruiters, setRecruiters] = useState([]);
  const [filters, setFilters] = useState({ search: "", priority: "", source: "", lead_status: "", view: "" });
  const [selected, setSelected] = useState([]);
  const [drawerId, setDrawerId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [callLead, setCallLead] = useState(null);
  const [callOpen, setCallOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState("");

  const isAdmin = user.role === "admin" || user.role === "team_leader";

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (mine) q.set("mine", "true");
    Object.entries(filters).forEach(([k, v]) => v && q.set(k, v));
    setLeads(null);
    api.get(`/leads?${q.toString()}`).then((r) => setLeads(r.data)).catch(() => setLeads([]));
  }, [filters, mine]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
    api.get("/recruiters").then((r) => setRecruiters(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    const focus = params.get("focus");
    if (focus) { setDrawerId(focus); setDrawerOpen(true); }
  }, [params]);

  const openCall = (lead) => { setCallLead(lead); setCallOpen(true); };
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const doAssign = async () => {
    if (!assignTo) return;
    try {
      await api.post("/leads/assign", { lead_ids: selected, recruiter_id: assignTo });
      toast.success(`${selected.length} lead(s) assigned`);
      setAssignOpen(false); setSelected([]); setAssignTo(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to assign leads"); }
  };

  const autoDistribute = async () => {
    try {
      const { data } = await api.post("/leads/auto-distribute", { lead_ids: selected.length ? selected : null });
      toast.success(`Auto-distributed ${data.assigned} lead(s)`);
      setSelected([]); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Auto-distribute failed"); }
  };

  const exportCsv = () => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && k !== "view" && q.set(k, v));
    const token = localStorage.getItem("oak_token");
    fetch(`${API}/leads/export/csv?${q.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob()).then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a"); a.href = url; a.download = "leads_export.csv"; a.click();
        toast.success("Export downloaded");
      }).catch(() => toast.error("Export failed"));
  };

  return (
    <div>
      <PageHeader title={mine ? "My Leads" : "All Leads"} subtitle={leads ? `${leads.length} leads` : ""} testid="leads-header">
        <Button variant="outline" size="sm" data-testid="export-csv-btn" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> Export</Button>
        {isAdmin && <Button variant="outline" size="sm" data-testid="auto-distribute-btn" onClick={autoDistribute}><Shuffle className="w-4 h-4 mr-1" /> Auto-distribute</Button>}
        <Button size="sm" data-testid="add-lead-btn" onClick={() => setFormOpen(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Add Lead</Button>
      </PageHeader>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {SAVED_VIEWS.map((v) => (
          <button key={v.key} data-testid={`view-${v.key || "all"}`} onClick={() => setFilters((f) => ({ ...f, view: v.key }))}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filters.view === v.key ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-900 border-slate-200 hover:border-blue-400"}`}>{v.label}</button>
        ))}
      </div>

      <Card className="p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input data-testid="leads-search-input" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Search leads…" className="pl-9 h-9" />
        </div>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v === "all" ? "" : v }))}>
          <SelectTrigger className="w-32 h-9" data-testid="filter-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Priority</SelectItem>{(settings?.priorities || []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.lead_status || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, lead_status: v === "all" ? "" : v }))}>
          <SelectTrigger className="w-32 h-9" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem>{(settings?.lead_statuses || []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.source || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, source: v === "all" ? "" : v }))}>
          <SelectTrigger className="w-32 h-9" data-testid="filter-source"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Sources</SelectItem>{(settings?.sources || []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      {isAdmin && selected.length > 0 && (
        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <span className="text-sm font-medium text-blue-700">{selected.length} selected</span>
          <Button size="sm" data-testid="bulk-assign-btn" onClick={() => setAssignOpen(true)} className="bg-blue-600 hover:bg-blue-700"><Users2 className="w-4 h-4 mr-1" /> Assign</Button>
          <button className="text-xs text-slate-500 underline" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      {leads === null ? <Loading /> : leads.length === 0 ? <EmptyState icon={Users2} title="No leads found" subtitle="Try adjusting filters or add a new lead." /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                  {isAdmin && <th className="py-3 px-3 w-8"></th>}
                  <th className="py-3 px-3">Candidate</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Recruiter</th>
                  <th className="py-3 px-3">Source</th>
                  <th className="py-3 px-3">Next Follow-up</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} data-testid={`lead-row-${l.id}`} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    {isAdmin && <td className="px-3"><Checkbox data-testid={`select-${l.id}`} checked={selected.includes(l.id)} onCheckedChange={() => toggle(l.id)} /></td>}
                    <td className="py-3 px-3">
                      <button onClick={() => { setDrawerId(l.id); setDrawerOpen(true); }} className="text-left">
                        <p className="font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600">{l.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{l.lead_code} • {l.city}</p>
                      </button>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">
                      {l.phone}
                      {!l.phone_valid && <span className="ml-1 text-[10px] text-rose-600 font-bold">⚠ VERIFY</span>}
                      {l.duplicate_flag && <span className="ml-1 text-[10px] text-amber-600 font-bold">DUP</span>}
                    </td>
                    <td className="py-3 px-3"><PriorityBadge priority={l.priority} /></td>
                    <td className="py-3 px-3"><StatusBadge status={l.lead_status} /></td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{l.recruiter_name}</td>
                    <td className="py-3 px-3 text-slate-500 text-xs">{l.source}</td>
                    <td className="py-3 px-3 text-xs text-slate-500">{l.next_followup_date ? fmtDate(l.next_followup_date) : "—"}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <button data-testid={`call-${l.id}`} onClick={() => openCall(l)} title="Log call" className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600"><PhoneCall className="w-4 h-4" /></button>
                        <a href={waLink(l.phone)} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600"><MessageCircle className="w-4 h-4" /></a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <LeadDrawer leadId={drawerId} open={drawerOpen} onOpenChange={setDrawerOpen} onCall={openCall} />
      <CallDispositionModal open={callOpen} onOpenChange={setCallOpen} lead={callLead} onDone={load} />
      <LeadFormModal open={formOpen} onOpenChange={setFormOpen} onDone={load} settings={settings} />

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="bg-white dark:bg-slate-900">
          <DialogHeader><DialogTitle>Assign {selected.length} lead(s)</DialogTitle></DialogHeader>
          <div className="py-2">
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger data-testid="assign-recruiter-select"><SelectValue placeholder="Select recruiter" /></SelectTrigger>
              <SelectContent>{recruiters.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({r.stats?.leads || 0} leads)</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button data-testid="confirm-assign-btn" onClick={doAssign} className="bg-blue-600 hover:bg-blue-700">Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
