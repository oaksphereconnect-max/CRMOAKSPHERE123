import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, MapPin } from "lucide-react";

export default function Clients() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const canEdit = user.role !== "recruiter";

  const load = useCallback(() => {
    setRows(null);
    api.get("/clients").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name) { toast.error("Name required"); return; }
    await api.post("/clients", form);
    toast.success("Client added"); setOpen(false); setForm({}); load();
  };

  const Stat = ({ label, value, tone }) => (
    <div className="text-center"><p className={`text-lg font-bold font-display ${tone}`}>{value}</p><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p></div>
  );

  return (
    <div>
      <PageHeader title="Clients" subtitle={rows ? `${rows.length} client companies` : ""} testid="clients-header">
        {canEdit && <Button size="sm" data-testid="add-client-btn" onClick={() => { setForm({}); setOpen(true); }} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" /> Add Client</Button>}
      </PageHeader>
      {rows === null ? <Loading /> : rows.length === 0 ? <EmptyState icon={Building2} title="No clients yet" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((c) => (
            <Card key={c.id} data-testid={`client-card-${c.id}`} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold font-display">{c.name[0]}</div>
                <div><h3 className="font-semibold font-display text-slate-800 dark:text-slate-100">{c.name}</h3><p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</p></div>
              </div>
              <p className="text-xs text-slate-500 mb-1">Contact: {c.contact_person || "—"}</p>
              <p className="text-xs text-slate-400 mb-3">{c.payment_terms} • {c.replacement_terms}</p>
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
        <DialogContent className="bg-white dark:bg-slate-900">
          <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Client name *</Label><Input data-testid="client-name-input" value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Company</Label><Input value={form.company || ""} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className="mt-1" /></div>
              <div><Label>Location</Label><Input value={form.location || ""} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="mt-1" /></div>
              <div><Label>Contact person</Label><Input value={form.contact_person || ""} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} className="mt-1" /></div>
              <div><Label>Contact phone</Label><Input value={form.contact_phone || ""} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} className="mt-1" /></div>
              <div><Label>Payment terms</Label><Input value={form.payment_terms || ""} onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))} className="mt-1" /></div>
              <div><Label>Replacement terms</Label><Input value={form.replacement_terms || ""} onChange={(e) => setForm((f) => ({ ...f, replacement_terms: e.target.value }))} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button data-testid="client-submit-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
