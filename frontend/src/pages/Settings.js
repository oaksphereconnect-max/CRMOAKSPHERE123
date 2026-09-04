import { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { PageHeader, Loading } from "@/components/common";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";

function ListEditor({ label, items, onChange, testid }) {
  const [val, setVal] = useState("");
  return (
    <div>
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
        {(items || []).map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
            {it}
            <button onClick={() => onChange(items.filter((_, x) => x !== i))} className="text-slate-400 hover:text-rose-500"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input data-testid={`${testid}-input`} value={val} onChange={(e) => setVal(e.target.value)} placeholder={`Add ${label.toLowerCase()}…`} className="h-8" onKeyDown={(e) => { if (e.key === "Enter" && val) { onChange([...(items || []), val]); setVal(""); } }} />
        <Button size="sm" variant="outline" data-testid={`${testid}-add`} onClick={() => { if (val) { onChange([...(items || []), val]); setVal(""); } }}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);
  if (!s) return <Loading />;
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));

  const save = async () => {
    try {
      await api.patch("/settings", s);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save settings");
    }
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure your agency workspace" testid="settings-header">
        <Button data-testid="save-settings-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">Save changes</Button>
      </PageHeader>
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
        <Card className="p-5"><ListEditor label="Priority Levels" items={s.priorities} onChange={(v) => set("priorities", v)} testid="priorities" /></Card>
        <Card className="p-5"><ListEditor label="Lead Statuses" items={s.lead_statuses} onChange={(v) => set("lead_statuses", v)} testid="lead-statuses" /></Card>
        <Card className="p-5"><ListEditor label="Interview Statuses" items={s.interview_statuses} onChange={(v) => set("interview_statuses", v)} testid="interview-statuses" /></Card>
        <Card className="p-5 lg:col-span-2"><ListEditor label="Joining Statuses" items={s.joining_statuses} onChange={(v) => set("joining_statuses", v)} testid="joining-statuses" /></Card>
      </div>
    </div>
  );
}
