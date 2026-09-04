import { useState, useEffect, useCallback } from "react";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Loading } from "@/components/common";
import { TagChip } from "@/lib/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { X, Plus, Pencil, Trash2, Eye } from "lucide-react";

const PLACEHOLDERS = ["Candidate Name", "Recruiter Name", "Job Role", "Company Name", "Location", "Salary", "Interview Date", "Interview Time", "Joining Date"];
const COLORS = ["#dc2626", "#f97316", "#d97706", "#16a34a", "#059669", "#2563eb", "#4f46e5", "#7c3aed", "#9f1239", "#64748b"];

function ListEditor({ label, items, onChange, testid, locked = [] }) {
  const [val, setVal] = useState("");
  const [editIdx, setEditIdx] = useState(-1);
  const [editVal, setEditVal] = useState("");
  const add = () => { const v = val.trim(); if (!v) return; if (items.includes(v)) { toast.error("Already exists"); return; } onChange([...(items || []), v]); setVal(""); };
  const commitEdit = () => { const v = editVal.trim(); if (v && v !== items[editIdx]) onChange(items.map((x, i) => (i === editIdx ? v : x))); setEditIdx(-1); };
  return (
    <div>
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
        {(items || []).map((it, i) => editIdx === i ? (
          <Input key={i} autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()} className="h-7 w-36 text-xs" data-testid={`${testid}-edit-input`} />
        ) : (
          <span key={i} className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full" data-testid={`${testid}-item-${i}`}>
            <button onClick={() => { setEditIdx(i); setEditVal(it); }} className="hover:text-blue-600" title="Edit">{it}</button>
            {!locked.includes(it) && <button data-testid={`${testid}-remove-${i}`} onClick={() => onChange(items.filter((_, x) => x !== i))} className="text-slate-400 hover:text-rose-500"><X className="w-3 h-3" /></button>}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input data-testid={`${testid}-input`} value={val} onChange={(e) => setVal(e.target.value)} placeholder={`Add ${label.toLowerCase()}…`} className="h-8" onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button size="sm" variant="outline" data-testid={`${testid}-add`} onClick={add}><Plus className="w-4 h-4" /></Button>
      </div>
      <p className="text-[11px] text-slate-400 mt-1">Click a value to rename it. Core statuses used by workflows are locked.</p>
    </div>
  );
}

function TagsManager() {
  const [tags, setTags] = useState(null);
  const [form, setForm] = useState(null); // {id?, name, color}
  const [del, setDel] = useState(null);
  const load = useCallback(() => api.get("/tags").then((r) => setTags(r.data)).catch(() => setTags([])), []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    if (!form.name?.trim()) { toast.error("Tag name is required"); return; }
    try {
      if (form.id) await api.patch(`/tags/${form.id}`, { name: form.name, color: form.color });
      else await api.post("/tags", { name: form.name, color: form.color });
      toast.success(form.id ? "Tag updated" : "Tag created"); setForm(null); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const remove = async () => {
    try { await api.delete(`/tags/${del.id}`); toast.success("Tag deleted"); setDel(null); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  if (!tags) return <Loading />;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div><h3 className="font-semibold font-display">Lead Tags</h3><p className="text-xs text-slate-400">Tags are searchable and filterable on the Leads page. Deleting a tag removes it from all leads.</p></div>
        <Button size="sm" data-testid="add-tag-btn" onClick={() => setForm({ name: "", color: COLORS[5] })} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Add Tag</Button>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {tags.map((t) => (
          <div key={t.id} data-testid={`tag-row-${t.id}`} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3"><TagChip tag={t} /><span className="text-xs text-slate-400">{t.lead_count} lead(s)</span></div>
            <div className="flex gap-1">
              <button data-testid={`edit-tag-${t.id}`} onClick={() => setForm({ id: t.id, name: t.name, color: t.color })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
              <button data-testid={`delete-tag-${t.id}`} onClick={() => setDel(t)} className="p-1.5 rounded hover:bg-rose-50 text-rose-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {tags.length === 0 && <p className="text-sm text-slate-400 py-4">No tags yet.</p>}
      </div>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-sm bg-white dark:bg-slate-900" data-testid="tag-form-dialog">
          <DialogHeader><DialogTitle className="font-display">{form?.id ? "Edit Tag" : "New Tag"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input data-testid="tag-name-input" value={form?.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            <div><Label>Color</Label>
              <div className="flex gap-2 mt-2 flex-wrap">{COLORS.map((c) => <button key={c} data-testid={`tag-color-${c.slice(1)}`} onClick={() => setForm((f) => ({ ...f, color: c }))} className={`w-7 h-7 rounded-full border-2 ${form?.color === c ? "border-slate-900 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />)}</div>
            </div>
            {form?.name && <div><Label className="text-xs">Preview</Label><div className="mt-1"><TagChip tag={form} /></div></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button data-testid="tag-form-save" onClick={save} className="bg-blue-600 hover:bg-blue-700">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete tag "${del?.name}"?`} testid="delete-tag-confirm" description={`This tag will be removed from ${del?.lead_count || 0} lead(s).`} onConfirm={remove} />
    </Card>
  );
}

function TemplatesManager() {
  const [tpls, setTpls] = useState(null);
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(null);
  const [del, setDel] = useState(null);
  const load = useCallback(() => api.get("/wa-templates").then((r) => setTpls(r.data)).catch(() => setTpls([])), []);
  useEffect(() => { load(); }, [load]);
  const insert = (ph) => setForm((f) => ({ ...f, body: `${f.body || ""}{{${ph}}}` }));
  const save = async () => {
    if (!form.name?.trim() || !form.body?.trim()) { toast.error("Name and message are required"); return; }
    try {
      if (form.id) await api.patch(`/wa-templates/${form.id}`, { name: form.name, category: form.category, body: form.body });
      else await api.post("/wa-templates", { name: form.name, category: form.category, body: form.body });
      toast.success(form.id ? "Template updated" : "Template created"); setForm(null); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const remove = async () => {
    try { await api.delete(`/wa-templates/${del.id}`); toast.success("Template deleted"); setDel(null); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const sample = { "Candidate Name": "Priya Sharma", "Recruiter Name": "Harshika", "Job Role": "Customer Support", "Company Name": "Teleperformance", "Location": "Mumbai", "Salary": "₹25,000", "Interview Date": "12 Sep 2026", "Interview Time": "11:00 AM", "Joining Date": "20 Sep 2026" };
  const filled = (b) => (b || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, k) => sample[k.trim()] || m);
  if (!tpls) return <Loading />;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div><h3 className="font-semibold font-display">WhatsApp Templates</h3><p className="text-xs text-slate-400">Recruiters pick a template when sending WhatsApp; placeholders are auto-filled from the lead.</p></div>
        <Button size="sm" data-testid="add-template-btn" onClick={() => setForm({ name: "", category: "General", body: "" })} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Add Template</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tpls.map((t) => (
          <div key={t.id} data-testid={`template-card-${t.id}`} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div><p className="font-medium text-sm">{t.name}</p><p className="text-[11px] text-slate-400">{t.category}</p></div>
              <div className="flex gap-0.5">
                <button data-testid={`preview-template-${t.id}`} onClick={() => setPreview(t)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Preview"><Eye className="w-4 h-4" /></button>
                <button data-testid={`edit-template-${t.id}`} onClick={() => setForm({ ...t })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                <button data-testid={`delete-template-${t.id}`} onClick={() => setDel(t)} className="p-1.5 rounded hover:bg-rose-50 text-rose-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="text-xs text-slate-500 whitespace-pre-wrap line-clamp-4">{t.body}</p>
          </div>
        ))}
        {tpls.length === 0 && <p className="text-sm text-slate-400 py-4">No templates yet.</p>}
      </div>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-900" data-testid="template-form-dialog">
          <DialogHeader><DialogTitle className="font-display">{form?.id ? "Edit Template" : "New Template"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Name *</Label><Input data-testid="template-name-input" value={form?.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
              <div><Label>Category</Label><Input data-testid="template-category-input" value={form?.category || ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>Message *</Label><Textarea data-testid="template-body-input" value={form?.body || ""} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={7} className="mt-1 text-sm" /></div>
            <div><Label className="text-xs">Insert dynamic field</Label><div className="flex flex-wrap gap-1 mt-1">{PLACEHOLDERS.map((p) => <button key={p} data-testid={`ph-${p.replace(/\s/g, "-")}`} onClick={() => insert(p)} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200">{`{{${p}}}`}</button>)}</div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button data-testid="template-form-save" onClick={save} className="bg-blue-600 hover:bg-blue-700">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900" data-testid="template-preview-dialog">
          <DialogHeader><DialogTitle className="font-display">Preview — {preview?.name}</DialogTitle></DialogHeader>
          <div className="p-3 rounded-xl bg-[#e7ffdb] text-slate-800 text-sm whitespace-pre-wrap shadow-inner">{filled(preview?.body)}</div>
          <p className="text-[11px] text-slate-400">Shown with sample candidate data.</p>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete template "${del?.name}"?`} testid="delete-template-confirm" description="Recruiters will no longer see this template." onConfirm={remove} />
    </Card>
  );
}

export default function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);
  if (!s) return <Loading />;
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const save = async () => {
    try { await api.patch("/settings", s); toast.success("Settings saved"); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure your agency workspace" testid="settings-header" />
      <Tabs defaultValue="general">
        <TabsList className="mb-4" data-testid="settings-tabs">
          <TabsTrigger value="general" data-testid="settings-tab-general">General & Statuses</TabsTrigger>
          <TabsTrigger value="tags" data-testid="settings-tab-tags">Lead Tags</TabsTrigger>
          <TabsTrigger value="templates" data-testid="settings-tab-templates">WhatsApp Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <div className="flex justify-end mb-3"><Button data-testid="save-settings-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">Save changes</Button></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
            <Card className="p-5">
              <h3 className="font-semibold font-display mb-4">Agency Profile</h3>
              <Label>Agency name</Label>
              <Input data-testid="agency-name-input" value={s.agency_name} onChange={(e) => set("agency_name", e.target.value)} className="mt-1" />
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold font-display mb-4">Recruiter Targets</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Calls / day</Label><Input data-testid="target-calls-input" type="number" value={s.target_calls} onChange={(e) => set("target_calls", Number(e.target.value))} className="mt-1" /></div>
                <div><Label className="text-xs">Connected / day</Label><Input data-testid="target-connected-input" type="number" value={s.target_connected} onChange={(e) => set("target_connected", Number(e.target.value))} className="mt-1" /></div>
                <div><Label className="text-xs">Lineups / day</Label><Input type="number" value={s.target_lineups} onChange={(e) => set("target_lineups", Number(e.target.value))} className="mt-1" /></div>
                <div><Label className="text-xs">Joinings / month</Label><Input type="number" value={s.target_joinings_month} onChange={(e) => set("target_joinings_month", Number(e.target.value))} className="mt-1" /></div>
                <div className="col-span-2"><Label className="text-xs">Follow-up escalation delay (hours)</Label><Input data-testid="escalation-input" type="number" value={s.escalation_hours} onChange={(e) => set("escalation_hours", Number(e.target.value))} className="mt-1" /></div>
              </div>
            </Card>
            <Card className="p-5"><ListEditor label="Lead Sources" items={s.sources} onChange={(v) => set("sources", v)} testid="sources" /></Card>
            <Card className="p-5"><ListEditor label="Priority Levels" items={s.priorities} onChange={(v) => set("priorities", v)} testid="priorities" locked={["Hot", "High", "Medium", "Low", "Cold"]} /></Card>
            <Card className="p-5"><ListEditor label="Lead Statuses" items={s.lead_statuses} onChange={(v) => set("lead_statuses", v)} testid="lead-statuses" locked={["New", "Interested", "Follow-up", "Interview", "Selected", "Joined", "Lost", "Not Interested", "Rejected", "Invalid Lead", "Closed"]} /></Card>
            <Card className="p-5"><ListEditor label="Interview Statuses" items={s.interview_statuses} onChange={(v) => set("interview_statuses", v)} testid="interview-statuses" /></Card>
            <Card className="p-5 lg:col-span-2"><ListEditor label="Joining Statuses" items={s.joining_statuses} onChange={(v) => set("joining_statuses", v)} testid="joining-statuses" /></Card>
          </div>
        </TabsContent>
        <TabsContent value="tags"><TagsManager /></TabsContent>
        <TabsContent value="templates"><TemplatesManager /></TabsContent>
      </Tabs>
    </div>
  );
}
