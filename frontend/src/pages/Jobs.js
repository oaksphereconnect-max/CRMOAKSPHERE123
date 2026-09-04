import { useState, useEffect, useCallback } from "react";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { StatusBadge } from "@/lib/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Briefcase, Plus, MapPin, Users, Pencil, Trash2, Search } from "lucide-react";

const JOB_STATUSES = ["Active", "On Hold", "Closed"];

export default function Jobs() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);
  const canEdit = user.role !== "recruiter";
  const isAdmin = user.role === "admin";

  const load = useCallback(() => { api.get("/jobs").then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); api.get("/clients").then((r) => setClients(r.data)).catch(() => {}); }, [load]);

  const openForm = (j) => {
    setEditing(j || null);
    setForm(j ? { title: j.title, client_id: j.client_id, location: j.location || "", openings: j.openings || "", salary_range: j.salary_range || "", experience: j.experience || "", status: j.status || "Active", description: j.description || "" } : { status: "Active" });
    setOpen(true);
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title || !form.client_id) { toast.error("Title and client are required"); return; }
    try {
      if (editing) { await api.patch(`/jobs/${editing.id}`, form); toast.success("Job updated"); }
      else { await api.post("/jobs", form); toast.success("Job created"); }
      setOpen(false); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const remove = async () => {
    try { await api.delete(`/jobs/${del.id}`); toast.success("Job deleted"); setDel(null); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const shown = (rows || []).filter((j) => (statusF === "all" || j.status === statusF) && (!q || [j.title, j.client_name, j.location].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()))));

  return (
    <div>
      <PageHeader title="Jobs" subtitle={rows ? `${rows.length} openings` : ""} testid="jobs-header">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input data-testid="job-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs…" className="pl-9 h-9 w-44" /></div>
        <Select value={statusF} onValueChange={setStatusF}><SelectTrigger data-testid="job-status-filter" className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All status</SelectItem>{JOB_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        {canEdit && <Button size="sm" data-testid="add-job-btn" onClick={() => openForm(null)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Add Job</Button>}
      </PageHeader>
      {rows === null ? <Loading /> : shown.length === 0 ? <EmptyState icon={Briefcase} title="No jobs found" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((j) => (
            <Card key={j.id} data-testid={`job-card-${j.id}`} className="p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold font-display text-slate-800 dark:text-slate-100">{j.title}</h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <StatusBadge status={j.status} />
                  {canEdit && <button data-testid={`edit-job-${j.id}`} onClick={() => openForm(j)} className="p-1 rounded-md hover:bg-slate-100 text-slate-500" title="Edit"><Pencil className="w-4 h-4" /></button>}
                  {isAdmin && <button data-testid={`delete-job-${j.id}`} onClick={() => setDel(j)} className="p-1 rounded-md hover:bg-rose-50 text-rose-500" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-3">{j.client_name}</p>
              <div className="space-y-1.5 text-xs text-slate-500">
                <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {j.location || "—"}</p>
                <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {j.filled || 0} / {j.openings || 0} filled</p>
                <p className="font-mono text-slate-600">₹ {j.salary_range || "—"}</p>
                <p>Exp: {j.experience || "—"}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white dark:bg-slate-900" data-testid="job-dialog">
          <DialogHeader><DialogTitle className="font-display">{editing ? `Edit Job — ${editing.title}` : "Add Job"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Position title *</Label><Input data-testid="job-title-input" value={form.title || ""} onChange={(e) => set("title", e.target.value)} className="mt-1" /></div>
            <div><Label>Client *</Label>
              <Select value={form.client_id || ""} onValueChange={(v) => set("client_id", v)}>
                <SelectTrigger data-testid="job-client-select" className="mt-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Location</Label><Input data-testid="job-location-input" value={form.location || ""} onChange={(e) => set("location", e.target.value)} className="mt-1" /></div>
              <div><Label>Openings</Label><Input data-testid="job-openings-input" type="number" value={form.openings || ""} onChange={(e) => set("openings", Number(e.target.value))} className="mt-1" /></div>
              <div><Label>Salary range</Label><Input data-testid="job-salary-input" value={form.salary_range || ""} onChange={(e) => set("salary_range", e.target.value)} className="mt-1" /></div>
              <div><Label>Experience</Label><Input value={form.experience || ""} onChange={(e) => set("experience", e.target.value)} className="mt-1" /></div>
              <div><Label>Status</Label>
                <Select value={form.status || "Active"} onValueChange={(v) => set("status", v)}><SelectTrigger data-testid="job-status-select" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{JOB_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button data-testid="job-submit-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">{editing ? "Save" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete job "${del?.title}"?`} testid="delete-job-confirm"
        description="Leads and interviews linked to this job will keep their data but lose the job link. This cannot be undone." onConfirm={remove} />
    </div>
  );
}
