import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { StatusBadge, fmtDate, toLocalInput } from "@/lib/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import WhatsAppModal from "@/components/WhatsAppModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Phone, Pencil, Trash2, Search, MessageCircle } from "lucide-react";

const STAGES = ["Pending", "Scheduled", "Tomorrow", "Today", "Attended", "Not Attended", "Rescheduled", "Selected", "Rejected", "Dropped"];
const CONFIRMATIONS = ["Pending", "Confirmed", "Not Confirmed", "Reschedule Requested"];

export default function Interviews() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState("all");
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [wa, setWa] = useState(null);
  const canDelete = user.role !== "recruiter";

  const load = useCallback(() => {
    setRows(null);
    api.get(view === "tomorrow" ? "/interviews?view=tomorrow" : "/interviews").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [view]);
  useEffect(() => { load(); }, [load]);

  const update = async (id, body) => {
    try { await api.patch(`/interviews/${id}`, body); toast.success("Interview updated"); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const saveEdit = async () => {
    if (!edit.datetime) { toast.error("Date & time required"); return; }
    await update(edit.id, { datetime: new Date(edit.datetime).toISOString(), location: edit.location, type: edit.type, contact_person: edit.contact_person, notes: edit.notes });
    setEdit(null);
  };
  const remove = async () => {
    try { await api.delete(`/interviews/${del.id}`); toast.success("Interview deleted"); setDel(null); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const shown = (rows || []).filter((iv) => !q || [iv.lead_name, iv.phone, iv.client_name, iv.job_title].some((v) => (v || "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="Interview Management" subtitle="Track every lineup from schedule to selection." testid="interviews-header">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input data-testid="interview-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 h-9 w-48" /></div>
      </PageHeader>
      <Tabs value={view} onValueChange={setView} className="mb-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="interview-tab-all">All</TabsTrigger>
          <TabsTrigger value="tomorrow" data-testid="interview-tab-tomorrow">Tomorrow's Interviews</TabsTrigger>
        </TabsList>
      </Tabs>

      {rows === null ? <Loading /> : shown.length === 0 ? <EmptyState icon={Phone} title="No interviews" subtitle="Interviews are created from the call log (Interview Scheduled)." /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Candidate</th><th className="py-3 px-3">Client / Job</th><th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Type</th><th className="py-3 px-3">Recruiter</th><th className="py-3 px-3">Stage</th><th className="py-3 px-3">Confirmation</th><th className="py-3 px-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {shown.map((iv) => (
                  <tr key={iv.id} data-testid={`interview-row-${iv.id}`} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="py-3 px-3"><button onClick={() => navigate(`/leads?focus=${iv.lead_id}`)} className="text-left"><p className="font-medium hover:text-blue-600">{iv.lead_name}</p><p className="text-[11px] text-slate-400 font-mono">{iv.phone}</p></button></td>
                    <td className="py-3 px-3 text-xs"><p>{iv.client_name}</p><p className="text-slate-400">{iv.job_title}</p></td>
                    <td className="py-3 px-3 text-xs">{fmtDate(iv.datetime)}{iv.location && <p className="text-slate-400">{iv.location}</p>}</td>
                    <td className="py-3 px-3"><StatusBadge status={iv.type} /></td>
                    <td className="py-3 px-3 text-xs">{iv.recruiter_name}</td>
                    <td className="py-3 px-3">
                      <Select value={iv.stage} onValueChange={(v) => update(iv.id, { stage: v })}>
                        <SelectTrigger className="h-8 w-36 text-xs" data-testid={`interview-stage-${iv.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-3">
                      <Select value={iv.confirmation} onValueChange={(v) => update(iv.id, { confirmation: v })}>
                        <SelectTrigger className="h-8 w-40 text-xs" data-testid={`interview-confirm-${iv.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{CONFIRMATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button data-testid={`iv-wa-${iv.id}`} onClick={() => setWa({ id: iv.lead_id, name: iv.lead_name, phone: iv.phone, client_name: iv.client_name, job_title: iv.job_title, interview_date: iv.datetime, city: iv.location })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="WhatsApp reminder"><MessageCircle className="w-4 h-4" /></button>
                        <button data-testid={`iv-edit-${iv.id}`} onClick={() => setEdit({ ...iv, datetime: toLocalInput(iv.datetime) })} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Edit / Reschedule"><Pencil className="w-4 h-4" /></button>
                        {canDelete && <button data-testid={`iv-delete-${iv.id}`} onClick={() => setDel(iv)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900" data-testid="interview-edit-dialog">
          <DialogHeader><DialogTitle className="font-display">Edit Interview — {edit?.lead_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Date & time *</Label><Input data-testid="iv-edit-datetime" type="datetime-local" value={edit?.datetime || ""} onChange={(e) => setEdit((x) => ({ ...x, datetime: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Type</Label>
                <Select value={edit?.type || "Telephonic"} onValueChange={(v) => setEdit((x) => ({ ...x, type: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Walk-in", "Telephonic", "Virtual", "F2F"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Location</Label><Input value={edit?.location || ""} onChange={(e) => setEdit((x) => ({ ...x, location: e.target.value }))} className="mt-1" /></div>
              <div><Label className="text-xs">Contact person</Label><Input value={edit?.contact_person || ""} onChange={(e) => setEdit((x) => ({ ...x, contact_person: e.target.value }))} className="mt-1" /></div>
              <div><Label className="text-xs">Notes</Label><Input value={edit?.notes || ""} onChange={(e) => setEdit((x) => ({ ...x, notes: e.target.value }))} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button data-testid="iv-edit-save" onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <WhatsAppModal open={!!wa} onOpenChange={(o) => !o && setWa(null)} lead={wa} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this interview?" testid="delete-interview-confirm" description={`Interview for ${del?.lead_name} at ${del?.client_name} will be removed. The lead itself is not deleted.`} onConfirm={remove} />
    </div>
  );
}
