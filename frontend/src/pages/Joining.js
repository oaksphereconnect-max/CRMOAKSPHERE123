import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { StatusBadge, fmtDate } from "@/lib/ui";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks } from "lucide-react";

const STATUSES = ["Selected", "Documents Pending", "Offer Pending", "Offer Released", "Joining Confirmed", "Joined", "Delayed", "No Show", "Dropped", "Client Rejected"];
const CONFIRMATIONS = ["Pending", "Confirmed", "Not Confirmed"];

export default function Joining() {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => {
    setRows(null);
    api.get("/joinings").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = async (id, field, value) => {
    await api.patch(`/joinings/${id}`, { [field]: value });
    toast.success("Joining updated");
    load();
  };

  return (
    <div>
      <PageHeader title="Joining Management" subtitle="From selection to confirmed joining." testid="joining-header" />
      {rows === null ? <Loading /> : rows.length === 0 ? <EmptyState icon={ListChecks} title="No joining records yet" /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Candidate</th><th className="py-3 px-3">Client</th><th className="py-3 px-3">Salary</th>
                <th className="py-3 px-3">Joining Date</th><th className="py-3 px-3">Recruiter</th><th className="py-3 px-3">Status</th><th className="py-3 px-3">Confirmation</th>
              </tr></thead>
              <tbody>
                {rows.map((j) => (
                  <tr key={j.id} data-testid={`joining-row-${j.id}`} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="py-3 px-3"><p className="font-medium">{j.lead_name}</p><p className="text-[11px] text-slate-400 font-mono">{j.phone}</p></td>
                    <td className="py-3 px-3 text-xs">{j.client_name}</td>
                    <td className="py-3 px-3 font-mono text-xs">{j.salary || "—"}</td>
                    <td className="py-3 px-3 text-xs">{fmtDate(j.joining_date, false)}</td>
                    <td className="py-3 px-3 text-xs">{j.recruiter_name}</td>
                    <td className="py-3 px-3">
                      <Select value={j.status} onValueChange={(v) => update(j.id, "status", v)}>
                        <SelectTrigger className="h-8 w-40 text-xs" data-testid={`joining-status-${j.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-3">
                      <Select value={j.confirmation} onValueChange={(v) => update(j.id, "confirmation", v)}>
                        <SelectTrigger className="h-8 w-32 text-xs" data-testid={`joining-confirm-${j.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{CONFIRMATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
