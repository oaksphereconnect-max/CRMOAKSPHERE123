import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading } from "@/components/common";
import { PriorityBadge, fmtDate } from "@/lib/ui";
import CallDispositionModal from "@/components/CallDispositionModal";
import { waLink } from "@/components/LeadDrawer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, PhoneCall, MessageCircle, Sun } from "lucide-react";

export default function MyDay() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [active, setActive] = useState(0);
  const [callLead, setCallLead] = useState(null);
  const [callOpen, setCallOpen] = useState(false);

  const load = useCallback(() => {
    api.get("/dashboard/my-day").then((r) => setData(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Loading />;
  const step = data.steps[active];

  const openCall = (item) => { setCallLead(item); setCallOpen(true); };

  return (
    <div>
      <PageHeader title="My Day" subtitle={`${data.completed_steps}/${data.total_steps} steps complete`} testid="my-day-header">
        <div className="flex items-center gap-2 min-w-[160px]">
          <Progress value={data.progress} className="h-2 w-32" />
          <span className="text-sm font-bold text-blue-600">{data.progress}%</span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4 p-3">
          <div className="flex items-center gap-2 mb-3 px-2 pt-1"><Sun className="w-4 h-4 text-amber-500" /><span className="text-sm font-semibold">Daily checklist</span></div>
          <div className="space-y-1">
            {data.steps.map((s, i) => (
              <button key={s.key} data-testid={`myday-step-${s.key}`} onClick={() => setActive(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${active === i ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                {s.done ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                <span className="flex-1">{s.title}</span>
                <span className={`text-xs font-bold ${s.items.length ? "text-slate-500" : "text-emerald-500"}`}>{s.items.length}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-8 p-5">
          <h3 className="font-semibold font-display text-slate-800 dark:text-slate-100 mb-4">{step.title}</h3>
          {step.items.length === 0 ? (
            <div className="py-12 text-center text-slate-400"><CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" /><p>Nothing here — you're all caught up!</p></div>
          ) : (
            <div className="space-y-2">
              {step.items.map((it) => {
                const isLead = !!it.name;
                return (
                  <div key={it.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{isLead ? it.name : it.lead_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{it.phone} {it.next_followup_date && `• ${fmtDate(it.next_followup_date)}`} {it.datetime && `• ${fmtDate(it.datetime)}`}</p>
                    </div>
                    {it.priority && <PriorityBadge priority={it.priority} />}
                    {isLead && (
                      <div className="flex gap-1">
                        <Button size="sm" data-testid={`myday-call-${it.id}`} onClick={() => openCall(it)} className="bg-blue-600 hover:bg-blue-700 h-8"><PhoneCall className="w-4 h-4" /></Button>
                        <a href={waLink(it.phone)} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 h-8"><MessageCircle className="w-4 h-4" /></Button></a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      <CallDispositionModal open={callOpen} onOpenChange={setCallOpen} lead={callLead} onDone={load} />
    </div>
  );
}
