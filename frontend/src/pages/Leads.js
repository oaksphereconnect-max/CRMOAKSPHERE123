import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api, { formatError } from "@/lib/api";
import { API } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { PriorityBadge, StatusBadge, fmtDate, TagChip, isFinal } from "@/lib/ui";
import LeadDrawer from "@/components/LeadDrawer";
import CallDispositionModal from "@/components/CallDispositionModal";
import LeadFormModal from "@/components/LeadFormModal";
import WhatsAppModal from "@/components/WhatsAppModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Download, PhoneCall, MessageCircle, Users2, Search, Shuffle, Pencil, Trash2, X } from "lucide-react";

const SAVED_VIEWS = [
  { key: "", label: "All" }, { key: "new_leads", label: "Fresh Leads" }, { key: "not_called", label: "Not Called" },
  { key: "todays_followups", label: "Today's Follow-ups" }, { key: "overdue_followups", label: "Overdue" },
  { key: "no_answer", label: "No Answer" }, { key: "interested", label: "Interested" }, { key: "hot_leads", label: "Hot Leads" },
  { key: "interviews", label: "Interviews" }, { key: "attendance_pending", label: "Attendance Pending" },
  { key: "selected", label: "Selected" }, { key: "joining_this_week", label: "Joining This Week" },
  { key: "joined", label: "Joined" }, { key: "rejected", label: "Rejected / Lost" },
];
const FILTER_KEYS = ["search", "priority", "source", "lead_status", "view", "recruiter_id", "tag"];

export default function Leads({ mine = false }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [leads, setLeads] = useState(null);
  const [settings, setSettings] = useState(null);
  const [recruiters, setRecruiters] = useState([]);
  const [tags, setTags] = useState([]);
  const [filters, setFilters] = useState(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ""])));
  const [selected, setSelected] = useState([]);
  const [drawerId, setDrawerId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [callLead, setCallLead] = useState(null);
  const [callOpen, setCallOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [waLead, setWaLead] = useState(null);
  const [delLead, setDelLead] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState("");

  const isAdmin = user.role === "admin" || user.role === "team_leader";
  const isOwner = user.role === "admin";

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
    api.get("/tags").then((r) => setTags(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    const focus = params.get("focus");
    if (focus) { setDrawerId(focus); setDrawerOpen(true); }
  }, [params]);
  useEffect(() => {
    const next = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ""]));
    setFilters((f) => (FILTER_KEYS.some((k) => (f[k] || "") !== next[k]) ? next : f));
  }, [params]);

  const setF = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };
  const clearFilters = () => { setFilters(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""]))); setParams({}, { replace: true }); };
  const activeFilters = FILTER_KEYS.filter((k) => filters[k]).length;

  const openCall = (lead) => { setCallLead(lead); setCallOpen(true); };
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const doAssign = async () => {
    if (!assignTo) return;
    try {
      await api.post("/leads/assign", { lead_ids: selected, recruiter_id: assignTo });
      toast.success(`${selected.length} lead(s) assigned`);
      setAssignOpen(false); setSelected([]); setAssignTo(""); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const autoDistribute = async () => {
    try {
      const { data } = await api.post("/leads/auto-distribute", { lead_ids: selected.length ? selected : null });
      toast.success(`Auto-distributed ${data.assigned} lead(s)`);
      setSelected([]); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const deleteLead = async () => {
    try { await api.delete(`/leads/${delLead.id}`); toast.success("Lead deleted"); setDelLead(null); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
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

  const recruiterName = filters.recruiter_id && recruiters.find((r) => r.id === filters.recruiter_id)?.name;

  return (
    <div>
      <PageHeader title={mine ? "My Leads" : recruiterName ? `Leads — ${recruiterName}` : "All Leads"} subtitle={leads ? `${leads.length} leads` : ""} testid="leads-header">
        <Button variant="outline" size="sm" data-testid="export-csv-btn" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> Export</Button>
        {isAdmin && <Button variant="outline" size="sm" data-testid="auto-distribute-btn" onClick={autoDistribute}><Shuffle className="w-4 h-4 mr-1" /> Auto-distribute</Button>}
        <Button size="sm" data-testid="add-lead-btn" onClick={() => { setEditLead(null); setFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Add Lead</Button>
      </PageHeader>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {SAVED_VIEWS.map((v) => (
          <button key={v.key} data-testid={`view-${v.key || "all"}`} onClick={() => setF("view", v.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filters.view === v.key ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-900 border-slate-200 hover:border-blue-400"}`}>{v.label}</button>
        ))}
      </div>

      <Card className="p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input data-testid="leads-search-input" value={filters.search} onChange={(e) => setF("search", e.target.value)} placeholder="Search name, phone, email, city…" className="pl-9 h-9" />
        </div>
        <Select value={filters.priority || "all"} onValueChange={(v) => setF("priority", v === "all" ? "" : v)}>
          <SelectTrigger className="w-32 h-9" data-testid="filter-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Priority</SelectItem>{(settings?.priorities || []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.lead_status || "all"} onValueChange={(v) => setF("lead_status", v === "all" ? "" : v)}>
          <SelectTrigger className="w-36 h-9" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem>{(settings?.lead_statuses || []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.source || "all"} onValueChange={(v) => setF("source", v === "all" ? "" : v)}>
          <SelectTrigger className="w-32 h-9" data-testid="filter-source"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Sources</SelectItem>{(settings?.sources || []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.tag || "all"} onValueChange={(v) => setF("tag", v === "all" ? "" : v)}>
          <SelectTrigger className="w-36 h-9" data-testid="filter-tag"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Tags</SelectItem>{tags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        {isAdmin && !mine && (
          <Select value={filters.recruiter_id || "all"} onValueChange={(v) => setF("recruiter_id", v === "all" ? "" : v)}>
            <SelectTrigger className="w-40 h-9" data-testid="filter-recruiter"><SelectValue placeholder="Recruiter" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Recruiters</SelectItem>{recruiters.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {activeFilters > 0 && <Button variant="ghost" size="sm" data-testid="clear-filters-btn" onClick={clearFilters} className="h-9 text-xs text-slate-500"><X className="w-3.5 h-3.5 mr-1" /> Clear ({activeFilters})</Button>}
      </Card>

      {isAdmin && selected.length > 0 && (
        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <span className="text-sm font-medium text-blue-700">{selected.length} selected</span>
          <Button size="sm" data-testid="bulk-assign-btn" onClick={() => setAssignOpen(true)} className="bg-blue-600 hover:bg-blue-700"><Users2 className="w-4 h-4 mr-1" /> Assign / Transfer</Button>
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
                  <th className="py-3 px-3">Tags</th>
                  <th className="py-3 px-3">Recruiter</th>
                  <th className="py-3 px-3">Next Follow-up</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const fu = l.next_followup_date ? new Date(l.next_followup_date) : null;
                  const overdue = fu && fu < new Date() && !isFinal(l.lead_status);
                  return (
                    <tr key={l.id} data-testid={`lead-row-${l.id}`} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      {isAdmin && <td className="px-3"><Checkbox data-testid={`select-${l.id}`} checked={selected.includes(l.id)} onCheckedChange={() => toggle(l.id)} /></td>}
                      <td className="py-3 px-3">
                        <button data-testid={`open-lead-${l.id}`} onClick={() => { setDrawerId(l.id); setDrawerOpen(true); }} className="text-left">
                          <p className="font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600">{l.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{l.lead_code} • {l.city || l.source}</p>
                        </button>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs">
                        {l.phone}
                        {!l.phone_valid && <span className="ml-1 text-[10px] text-rose-600 font-bold">⚠ VERIFY</span>}
                        {l.duplicate_flag && <span className="ml-1 text-[10px] text-amber-600 font-bold">DUP</span>}
                      </td>
                      <td className="py-3 px-3"><PriorityBadge priority={l.priority} /></td>
                      <td className="py-3 px-3"><StatusBadge status={l.lead_status} /></td>
                      <td className="py-3 px-3"><div className="flex flex-wrap gap-1 max-w-[180px]">{(l.tag_details || []).slice(0, 3).map((t) => <TagChip key={t.id} tag={t} />)}{(l.tag_details || []).length > 3 && <span className="text-[10px] text-slate-400">+{l.tag_details.length - 3}</span>}</div></td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 text-xs">{l.recruiter_name}</td>
                      <td className="py-3 px-3 text-xs">
                        {fu ? <span className={overdue ? "text-rose-600 font-semibold" : "text-slate-500"}>{fmtDate(l.next_followup_date)}{overdue && <span className="ml-1 text-[10px] bg-rose-50 border border-rose-200 px-1 rounded">OVERDUE</span>}</span>
                          : isFinal(l.lead_status) ? <span className="text-slate-400">closed</span> : <span className="text-amber-600 font-medium" title="Active lead without follow-up">⚠ none</span>}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button data-testid={`call-${l.id}`} onClick={() => openCall(l)} title="Log call" className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600"><PhoneCall className="w-4 h-4" /></button>
                          <button data-testid={`wa-${l.id}`} onClick={() => setWaLead(l)} title="WhatsApp" className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600"><MessageCircle className="w-4 h-4" /></button>
                          <button data-testid={`edit-${l.id}`} onClick={() => { setEditLead(l); setFormOpen(true); }} title="Edit" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
                          {isOwner && <button data-testid={`delete-${l.id}`} onClick={() => setDelLead(l)} title="Delete" className="p-1.5 rounded-md hover:bg-rose-50 text-rose-500"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <LeadDrawer leadId={drawerId} open={drawerOpen} onOpenChange={setDrawerOpen} onCall={openCall} onChanged={load} />
      <CallDispositionModal open={callOpen} onOpenChange={setCallOpen} lead={callLead} onDone={load} />
      <LeadFormModal open={formOpen} onOpenChange={setFormOpen} onDone={load} settings={settings} lead={editLead} />
      <WhatsAppModal open={!!waLead} onOpenChange={(o) => !o && setWaLead(null)} lead={waLead} onDone={load} />
      <ConfirmDialog open={!!delLead} onOpenChange={(o) => !o && setDelLead(null)} title="Delete this lead?" testid="delete-lead-confirm"
        description={delLead ? `"${delLead.name}" (${delLead.phone}) and all its history will be permanently deleted.` : ""} onConfirm={deleteLead} />

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="bg-white dark:bg-slate-900">
          <DialogHeader><DialogTitle>Assign {selected.length} lead(s)</DialogTitle></DialogHeader>
          <div className="py-2">
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger data-testid="assign-recruiter-select"><SelectValue placeholder="Select recruiter" /></SelectTrigger>
              <SelectContent>{recruiters.filter((r) => r.active !== false).map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({r.stats?.leads || 0} leads)</SelectItem>)}</SelectContent>
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
