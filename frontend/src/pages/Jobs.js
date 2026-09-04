import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { StatusBadge } from "@/lib/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Briefcase, Plus, MapPin, Users } from "lucide-react";

export default function Jobs() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const canEdit = user.role !== "recruiter";

  const load = useCallback(() => {
    setRows(null);
    api.get("/jobs").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); api.get("/clients").then((r) => setClients(r.data)); }, [load]);

  const save = async () => {
    if (!form.title || !form.client_id) { toast.error("Title and client required"); return; }
    await api.post("/jobs", form);
    toast.success("Job created"); setOpen(false); setForm({}); load();
  };

  return (
    <div>
      <PageHeader title="Jobs" subtitle={rows ? `${rows.length} openings` : ""} testid="jobs-header">
        {canEdit && <Button size="sm" data-testid="add-job-btn" onClick={() => { setForm({ status: "Active" }); setOpen(true); }} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Add Job</Button>}
      </PageHeader>
      {rows === null ? <Loading /> : rows.length === 0 ? <EmptyState icon={Briefcase} title="No jobs yet" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((j) => (
            <Card key={j.id} data-testid={`job-card-${j.id}`} className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold font-display text-slate-800 dark:text-slate-100">{j.title}</h3>
                <StatusBadge status={j.status} />
              </div>
              <p className="text-sm text-slate-500 mb-3">{j.client_name}</p>
              <div className="space-y-1.5 text-xs text-slate-500">
                <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {j.location}</p>
                <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {j.filled || 0} / {j.openings} filled</p>
                <p className="font-mono text-slate-600">₹ {j.salary_range}</p>
                <p>Exp: {j.experience}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white dark:bg-slate-900">
          <DialogHeader><DialogTitle>Add Job</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Position title *</Label><Input data-testid="job-title-input" value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="mt-1" /></div>
            <div><Label>Client *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
                <SelectTrigger data-testid="job-client-select" className="mt-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Location</Label><Input value={form.location || ""} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="mt-1" /></div>
              <div><Label>Openings</Label><Input type="number" value={form.openings || ""} onChange={(e) => setForm((f) => ({ ...f, openings: Number(e.target.value) }))} className="mt-1" /></div>
              <div><Label>Salary range</Label><Input value={form.salary_range || ""} onChange={(e) => setForm((f) => ({ ...f, salary_range: e.target.value }))} className="mt-1" /></div>
              <div><Label>Experience</Label><Input value={form.experience || ""} onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button data-testid="job-submit-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
