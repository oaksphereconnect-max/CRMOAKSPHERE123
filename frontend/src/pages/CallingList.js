import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { PriorityBadge, fmtDate } from "@/lib/ui";
import CallDispositionModal from "@/components/CallDispositionModal";
import LeadDrawer, { waLink } from "@/components/LeadDrawer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhoneCall, MessageCircle, ListChecks } from "lucide-react";

const REASON_COLORS = {
  "Overdue Follow-up": "bg-rose-50 text-rose-700 border-rose-200",
  "Hot Candidate": "bg-red-50 text-red-700 border-red-200",
  "Interview Tomorrow": "bg-blue-50 text-blue-700 border-blue-200",
  "Today's Follow-up": "bg-amber-50 text-amber-700 border-amber-200",
  "New High-Priority": "bg-orange-50 text-orange-700 border-orange-200",
  "New Lead": "bg-slate-50 text-slate-600 border-slate-200",
  "Reattempt": "bg-slate-50 text-slate-600 border-slate-200",
  "Old Lead": "bg-slate-50 text-slate-500 border-slate-200",
};

export default function CallingList() {
  const [leads, setLeads] = useState(null);
  const [callLead, setCallLead] = useState(null);
  const [callOpen, setCallOpen] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(() => {
    setLeads(null);
    api.get("/calling-list").then((r) => setLeads(r.data)).catch(() => setLeads([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCall = (l) => { setCallLead(l); setCallOpen(true); };

  return (
    <div>
      <PageHeader title="My Calling List" subtitle={leads ? `${leads.length} candidates in your prioritized queue` : ""} testid="calling-header" />
      {leads === null ? <Loading /> : leads.length === 0 ? <EmptyState icon={ListChecks} title="Your queue is clear!" subtitle="No pending candidates to call right now." /> : (
        <div className="space-y-2">
          {leads.map((l, i) => (
            <Card key={l.id} data-testid={`calling-row-${l.id}`} className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
              <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <button onClick={() => { setDrawerId(l.id); setDrawerOpen(true); }} className="text-left">
                  <p className="font-medium text-slate-800 dark:text-slate-100 truncate hover:text-blue-600">{l.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{l.phone} • {l.city}</p>
                </button>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium hidden sm:inline ${REASON_COLORS[l.queue_reason] || "bg-slate-50 border-slate-200"}`}>{l.queue_reason}</span>
              <PriorityBadge priority={l.priority} />
              {l.next_followup_date && <span className="text-[11px] text-slate-400 hidden md:inline">{fmtDate(l.next_followup_date)}</span>}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="sm" data-testid={`calling-call-${l.id}`} onClick={() => openCall(l)} className="bg-blue-600 hover:bg-blue-700 h-8"><PhoneCall className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Call</span></Button>
                <a href={waLink(l.phone)} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 h-8"><MessageCircle className="w-4 h-4" /></Button></a>
              </div>
            </Card>
          ))}
        </div>
      )}
      <CallDispositionModal open={callOpen} onOpenChange={setCallOpen} lead={callLead} onDone={load} />
      <LeadDrawer leadId={drawerId} open={drawerOpen} onOpenChange={setDrawerOpen} onCall={openCall} />
    </div>
  );
}
