import { useState, useEffect, useCallback } from "react";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, MapPin, Pencil, Trash2, Search } from "lucide-react";

const FIELDS = [["company", "Company"], ["location", "Location"], ["contact_person", "Contact person"], ["contact_phone", "Contact phone"], ["contact_email", "Contact email"], ["payment_terms", "Payment terms"], ["replacement_terms", "Replacement terms"]];

export default function Clients() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);
  const canEdit = user.role !== "recruiter";
  const isAdmin = user.role === "admin";

  const load = useCallback(() => { api.get("/clients").then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);

  const openForm = (c) => { setEditing(c || null); setForm(c ? Object.fromEntries(["name", ...FIELDS.map((f) => f[0])].map((k) => [k, c[k] || ""])) : {}); setOpen(true); };

  const save = async () => {
    if (!form.name) { toast.error("Client name is required"); return; }
    try {
      if (editing) { await api.patch(`/clients/${editing.id}`, form); toast.success("Client updated"); }
      else { await api.post("/clients", form); toast.success("Client added"); }
      setOpen(false); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const remove = async () => {
    try { await api.delete(`/clients/${del.id}`); toast.success("Client deleted"); setDel(null); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const Stat = ({ label, value, tone }) => (
    <div className="text-center"><p className={`text-lg font-bold font-display ${tone}`}>{value}</p><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p></div>
  );
  const shown = (rows || []).filter((c) => !q || [c.name, c.company, c.location, c.contact_person].some((v) => (v || "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="Clients" subtitle={rows ? `${rows.length} client companies` : ""} testid="clients-header">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input data-testid="client-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className="pl-9 h-9 w-48" /></div>
        {canEdit && <Button size="sm" data-testid="add-client-btn" onClick={() => openForm(null)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Add Client</Button>}
      </PageHeader>
      {rows === null ? <Loading /> : shown.length === 0 ? <EmptyState icon={Building2} title="No clients found" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((c) => (
            <Card key={c.id} data-testid={`client-card-${c.id}`} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold font-display">{c.name[0]}</div>
                <div className="flex-1 min-w-0"><h3 className="font-semibold font-display text-slate-800 dark:text-slate-100 truncate">{c.name}</h3><p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location || "—"}</p></div>
                {canEdit && (
                  <div className="flex gap-0.5">
                    <button data-testid={`edit-client-${c.id}`} onClick={() => openForm(c)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                    {isAdmin && <button data-testid={`delete-client-${c.id}`} onClick={() => setDel(c)} className="p-1.5 rounded-md hover:bg-rose-50 text-rose-500" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-1">Contact: {c.contact_person || "—"}{c.contact_phone ? ` • ${c.contact_phone}` : ""}</p>
              <p className="text-xs text-slate-400 mb-3">{c.payment_terms || "—"} • {c.replacement_terms || "—"}</p>
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Stat label="Submit" value={c.stats.submitted} tone="text-slate-700" />
                <Stat label="Interview" value={c.stats.interviewed} tone="text-blue-600" />
                <Stat label="Selected" value={c.stats.selected} tone="text-amber-600" />
                <Stat label="Joined" value={c.stats.joined} tone="text-emerald-600" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white dark:bg-slate-900" data-testid="client-dialog">
          <DialogHeader><DialogTitle className="font-display">{editing ? `Edit Client — ${editing.name}` : "Add Client"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Client name *</Label><Input data-testid="client-name-input" value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map(([k, label]) => <div key={k}><Label>{label}</Label><Input data-testid={`client-${k}-input`} value={form[k] || ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="mt-1" /></div>)}
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button data-testid="client-submit-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">{editing ? "Save" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete client "${del?.name}"?`} testid="delete-client-confirm"
        description={`${del?.stats?.active_jobs || 0} active job(s) reference this client. Leads linked to it will keep their data but lose the client link. This cannot be undone.`} onConfirm={remove} />
    </div>
  );
}
