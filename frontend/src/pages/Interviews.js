import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { StatusBadge, fmtDate } from "@/lib/ui";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, CalendarCheck } from "lucide-react";

const STAGES = ["Pending", "Scheduled", "Tomorrow", "Today", "Attended", "Not Attended", "Rescheduled", "Selected", "Rejected", "Dropped"];
const CONFIRMATIONS = ["Pending", "Confirmed", "Not Confirmed", "Reschedule Requested"];

export default function Interviews() {
  const [view, setView] = useState("all");
  const [rows, setRows] = useState(null);

  const load = useCallback(() => {
    setRows(null);
    const url = view === "tomorrow" ? "/interviews?view=tomorrow" : "/interviews";
    api.get(url).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [view]);
  useEffect(() => { load(); }, [load]);

  const update = async (id, field, value) => {
    await api.patch(`/interviews/${id}`, { [field]: value });
    toast.success("Interview updated");
    load();
  };

  return (
    <div>
      <PageHeader title="Interview Management" subtitle="Track every lineup from schedule to selection." testid="interviews-header" />
      <Tabs value={view} onValueChange={setView} className="mb-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="interview-tab-all">All</TabsTrigger>
          <TabsTrigger value="tomorrow" data-testid="interview-tab-tomorrow">Tomorrow's Interviews</TabsTrigger>
        </TabsList>
      </Tabs>

      {rows === null ? <Loading /> : rows.length === 0 ? <EmptyState icon={Phone} title="No interviews" /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">Candidate</th><th className="py-3 px-3">Client / Job</th><th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Type</th><th className="py-3 px-3">Recruiter</th><th className="py-3 px-3">Stage</th><th className="py-3 px-3">Confirmation</th>
              </tr></thead>
              <tbody>
                {rows.map((iv) => (
                  <tr key={iv.id} data-testid={`interview-row-${iv.id}`} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="py-3 px-3"><p className="font-medium">{iv.lead_name}</p><p className="text-[11px] text-slate-400 font-mono">{iv.phone}</p></td>
                    <td className="py-3 px-3 text-xs"><p>{iv.client_name}</p><p className="text-slate-400">{iv.job_title}</p></td>
                    <td className="py-3 px-3 text-xs">{fmtDate(iv.datetime)}</td>
                    <td className="py-3 px-3"><StatusBadge status={iv.type} /></td>
                    <td className="py-3 px-3 text-xs">{iv.recruiter_name}</td>
                    <td className="py-3 px-3">
                      <Select value={iv.stage} onValueChange={(v) => update(iv.id, "stage", v)}>
                        <SelectTrigger className="h-8 w-36 text-xs" data-testid={`interview-stage-${iv.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-3">
                      <Select value={iv.confirmation} onValueChange={(v) => update(iv.id, "confirmation", v)}>
                        <SelectTrigger className="h-8 w-40 text-xs" data-testid={`interview-confirm-${iv.id}`}><SelectValue /></SelectTrigger>
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
