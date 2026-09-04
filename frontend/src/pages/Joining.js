import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { fmtDate } from "@/lib/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import WhatsAppModal from "@/components/WhatsAppModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ListChecks, Pencil, Trash2, Search, MessageCircle } from "lucide-react";

const STATUSES = ["Selected", "Documents Pending", "Offer Pending", "Offer Released", "Joining Confirmed", "Joined", "Delayed", "No Show", "Dropped", "Client Rejected"];
const CONFIRMATIONS = ["Pending", "Confirmed", "Not Confirmed"];

export default function Joining() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [wa, setWa] = useState(null);
  const canDelete = user.role !== "recruiter";

  const load = useCallback(() => { api.get("/joinings").then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);

  const update = async (id, body) => {
    try { await api.patch(`/joinings/${id}`, body); toast.success("Joining updated"); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const saveEdit = async () => {
    await update(edit.id, { joining_date: edit.joining_date ? new Date(edit.joining_date).toISOString() : null, salary: edit.salary, remarks: edit.remarks,
      actual_joining_date: edit.actual_joining_date ? new Date(edit.actual_joining_date).toISOString() : null });
    setEdit(null);
  };
  const remove = async () => {
    try { await api.delete(`/joinings/${del.id}`); toast.success("Joining record deleted"); setDel(null); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const shown = (rows || []).filter((j) => (statusF === "all" || j.status === statusF) && (!q || [j.lead_name, j.phone, j.client_name].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()))));

  return (
    <div>
      <PageHeader title="Joining Management" subtitle="From selection to confirmed joining." testid="joining-header">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input data-testid="joining-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 h-9 w-44" /></div>
        <Select value={statusF} onValueChange={setStatusF}><SelectTrigger data-testid="joining-status-filter" className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </PageHeader>
      {rows === null ? <Loading /> : shown.length === 0 ? <EmptyState icon={ListChecks} title="No joining records" /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Candidate</th><th className="py-3 px-3">Client</th><th className="py-3 px-3">Salary</th>
                <th className="py-3 px-3">Joining Date</th><th className="py-3 px-3">Recruiter</th><th className="py-3 px-3">Status</th><th className="py-3 px-3">Confirmation</th><th className="py-3 px-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {shown.map((j) => (
                  <tr key={j.id} data-testid={`joining-row-${j.id}`} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="py-3 px-3"><button onClick={() => navigate(`/leads?focus=${j.lead_id}`)} className="text-left"><p className="font-medium hover:text-blue-600">{j.lead_name}</p><p className="text-[11px] text-slate-400 font-mono">{j.phone}</p></button></td>
                    <td className="py-3 px-3 text-xs">{j.client_name}</td>
                    <td className="py-3 px-3 font-mono text-xs">{j.salary || "—"}</td>
                    <td className="py-3 px-3 text-xs">{fmtDate(j.joining_date, false)}{j.actual_joining_date && <p className="text-emerald-600">joined {fmtDate(j.actual_joining_date, false)}</p>}</td>
                    <td className="py-3 px-3 text-xs">{j.recruiter_name}</td>
                    <td className="py-3 px-3">
                      <Select value={j.status} onValueChange={(v) => update(j.id, { status: v })}>
                        <SelectTrigger className="h-8 w-40 text-xs" data-testid={`joining-status-${j.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-3">
                      <Select value={j.confirmation} onValueChange={(v) => update(j.id, { confirmation: v })}>
                        <SelectTrigger className="h-8 w-32 text-xs" data-testid={`joining-confirm-${j.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{CONFIRMATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button data-testid={`jn-wa-${j.id}`} onClick={() => setWa({ id: j.lead_id, name: j.lead_name, phone: j.phone, client_name: j.client_name, expected_joining_date: j.joining_date })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="WhatsApp"><MessageCircle className="w-4 h-4" /></button>
                        <button data-testid={`jn-edit-${j.id}`} onClick={() => setEdit({ ...j, joining_date: j.joining_date ? j.joining_date.slice(0, 10) : "", actual_joining_date: j.actual_joining_date ? j.actual_joining_date.slice(0, 10) : "" })} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Edit"><Pencil className="w-4 h-4" /></button>
                        {canDelete && <button data-testid={`jn-delete-${j.id}`} onClick={() => setDel(j)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>}
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
        <DialogContent className="max-w-md bg-white dark:bg-slate-900" data-testid="joining-edit-dialog">
          <DialogHeader><DialogTitle className="font-display">Edit Joining — {edit?.lead_name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Expected joining date</Label><Input data-testid="jn-edit-date" type="date" value={edit?.joining_date || ""} onChange={(e) => setEdit((x) => ({ ...x, joining_date: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Actual joining date</Label><Input type="date" value={edit?.actual_joining_date || ""} onChange={(e) => setEdit((x) => ({ ...x, actual_joining_date: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Salary</Label><Input data-testid="jn-edit-salary" value={edit?.salary || ""} onChange={(e) => setEdit((x) => ({ ...x, salary: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Remarks</Label><Input value={edit?.remarks || ""} onChange={(e) => setEdit((x) => ({ ...x, remarks: e.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button data-testid="jn-edit-save" onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <WhatsAppModal open={!!wa} onOpenChange={(o) => !o && setWa(null)} lead={wa} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this joining record?" testid="delete-joining-confirm" description={`Joining record for ${del?.lead_name} will be removed. The lead itself is not deleted.`} onConfirm={remove} />
    </div>
  );
}
