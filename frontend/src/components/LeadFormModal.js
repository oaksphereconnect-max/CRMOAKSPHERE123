import { useState, useEffect } from "react";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { tomorrow10Local } from "@/lib/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

const EDIT_KEYS = ["name", "phone", "alt_phone", "email", "city", "age", "gender", "qualification", "experience", "current_salary", "expected_salary", "notice_period", "source", "priority", "assigned_recruiter_id", "client_id", "job_id", "notes"];

export default function LeadFormModal({ open, onOpenChange, onDone, settings, lead }) {
  const { user } = useAuth();
  const [form, setForm] = useState({});
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [dup, setDup] = useState(null);
  const [saving, setSaving] = useState(false);
  const [followup, setFollowup] = useState("");
  const isEdit = !!lead;

  useEffect(() => {
    if (open) {
      if (lead) {
        const f = {};
        EDIT_KEYS.forEach((k) => { if (lead[k] != null) f[k] = lead[k]; });
        setForm(f);
      } else {
        setForm({ priority: "Medium", source: "Manual" });
        setFollowup(tomorrow10Local());
      }
      setDup(null);
      api.get("/clients").then((r) => setClients(r.data)).catch(() => {});
      api.get("/jobs").then((r) => setJobs(r.data)).catch(() => {});
      api.get("/recruiters").then((r) => setRecruiters(r.data)).catch(() => {});
    }
  }, [open, lead]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const checkDup = async (phone) => {
    if (!phone || phone.length < 5) { setDup(null); return; }
    const { data } = await api.get(`/leads/check-duplicate?phone=${encodeURIComponent(phone)}`);
    const matches = (data.matches || []).filter((m) => m.id !== lead?.id);
    setDup(matches.length ? matches : null);
  };

  const save = async () => {
    if (!form.name || !form.phone) { toast.error("Name and phone are required"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/leads/${lead.id}`, form);
        toast.success("Lead updated");
      } else {
        await api.post("/leads", { ...form, next_followup_date: followup ? new Date(followup).toISOString() : null, next_followup_reason: "First call" });
        toast.success("Lead created");
      }
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900" data-testid="lead-form-modal">
        <DialogHeader><DialogTitle className="font-display">{isEdit ? `Edit Lead — ${lead.lead_code}` : "Add New Lead"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="sm:col-span-2"><Label>Full name *</Label><Input data-testid="lead-name-input" value={form.name || ""} onChange={(e) => set("name", e.target.value)} className="mt-1" /></div>
          <div>
            <Label>Phone *</Label>
            <Input data-testid="lead-phone-input" value={form.phone || ""} onChange={(e) => { set("phone", e.target.value); }} onBlur={(e) => checkDup(e.target.value)} className="mt-1 font-mono" />
          </div>
          <div><Label>Alternate phone</Label><Input value={form.alt_phone || ""} onChange={(e) => set("alt_phone", e.target.value)} className="mt-1 font-mono" /></div>
          {dup && (
            <div className="sm:col-span-2 flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2" data-testid="duplicate-warning">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Possible duplicate: {dup.map((d) => `${d.name} (${d.recruiter_name})`).join(", ")}. Not auto-merged — review manually.</span>
            </div>
          )}
          <div><Label>Email</Label><Input value={form.email || ""} onChange={(e) => set("email", e.target.value)} className="mt-1" /></div>
          <div><Label>City</Label><Input value={form.city || ""} onChange={(e) => set("city", e.target.value)} className="mt-1" /></div>
          <div><Label>Age</Label><Input type="number" value={form.age || ""} onChange={(e) => set("age", e.target.value)} className="mt-1" /></div>
          <div>
            <Label>Gender</Label>
            <Select value={form.gender || ""} onValueChange={(v) => set("gender", v)}><SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{["Male", "Female", "Other"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Qualification</Label><Input value={form.qualification || ""} onChange={(e) => set("qualification", e.target.value)} className="mt-1" /></div>
          <div><Label>Experience</Label><Input value={form.experience || ""} onChange={(e) => set("experience", e.target.value)} className="mt-1" /></div>
          <div><Label>Current salary</Label><Input value={form.current_salary || ""} onChange={(e) => set("current_salary", e.target.value)} className="mt-1" /></div>
          <div><Label>Expected salary</Label><Input value={form.expected_salary || ""} onChange={(e) => set("expected_salary", e.target.value)} className="mt-1" /></div>
          <div><Label>Notice period</Label><Input value={form.notice_period || ""} onChange={(e) => set("notice_period", e.target.value)} className="mt-1" /></div>
          <div>
            <Label>Source</Label>
            <Select value={form.source || ""} onValueChange={(v) => set("source", v)}><SelectTrigger data-testid="lead-source-select" className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{(settings?.sources || []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority || ""} onValueChange={(v) => set("priority", v)}><SelectTrigger data-testid="lead-priority-select" className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{(settings?.priorities || []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
          </div>
          {user.role !== "recruiter" && (
            <div>
              <Label>Assign recruiter</Label>
              <Select value={form.assigned_recruiter_id || ""} onValueChange={(v) => set("assigned_recruiter_id", v)}><SelectTrigger data-testid="lead-recruiter-select" className="mt-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>{recruiters.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
          <div>
            <Label>Client</Label>
            <Select value={form.client_id || ""} onValueChange={(v) => set("client_id", v)}><SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div>
            <Label>Job</Label>
            <Select value={form.job_id || ""} onValueChange={(v) => set("job_id", v)}><SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent></Select>
          </div>
          {!isEdit && (
            <div><Label>First follow-up (call by) *</Label><Input data-testid="lead-followup-input" type="datetime-local" value={followup} onChange={(e) => setFollowup(e.target.value)} className="mt-1" /></div>
          )}
          <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} className="mt-1" rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="lead-form-submit" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? "Saving…" : isEdit ? "Save changes" : "Create lead"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
