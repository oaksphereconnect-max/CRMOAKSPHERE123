import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PriorityBadge, StatusBadge, fmtDate } from "@/lib/ui";
import { Phone, MessageCircle, PhoneCall, AlertTriangle } from "lucide-react";

export function waLink(phone) {
  const digits = (phone || "").replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

export default function LeadDrawer({ leadId, open, onOpenChange, onCall }) {
  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState({ activities: [], calls: [] });

  useEffect(() => {
    if (open && leadId) {
      api.get(`/leads/${leadId}`).then((r) => setLead(r.data)).catch(() => {});
      api.get(`/leads/${leadId}/activities`).then((r) => setTimeline(r.data)).catch(() => {});
    }
  }, [open, leadId]);

  if (!lead) return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent /></Sheet>;

  const Field = ({ label, value, mono }) => (
    <div><p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p><p className={`text-sm text-slate-800 dark:text-slate-100 ${mono ? "font-mono" : ""}`}>{value || "—"}</p></div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-white dark:bg-slate-900" data-testid="lead-drawer">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            {lead.name}
            <span className="text-xs font-mono text-slate-400">{lead.lead_code}</span>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={lead.priority} />
          <StatusBadge status={lead.lead_status} />
          {!lead.phone_valid && <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> INVALID / VERIFY</span>}
          {lead.duplicate_flag && <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">DUPLICATE</span>}
        </div>

        <div className="mt-4 flex gap-2">
          <Button size="sm" data-testid="drawer-call-btn" onClick={() => onCall?.(lead)} className="bg-blue-600 hover:bg-blue-700"><PhoneCall className="w-4 h-4 mr-1" /> Log Call</Button>
          <a href={waLink(lead.phone)} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200"><MessageCircle className="w-4 h-4 mr-1" /> WhatsApp</Button></a>
          <a href={`tel:${lead.phone}`}><Button size="sm" variant="outline"><Phone className="w-4 h-4 mr-1" /> Dial</Button></a>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Field label="Phone" value={lead.phone} mono />
          <Field label="Alt Phone" value={lead.alt_phone} mono />
          <Field label="Email" value={lead.email} />
          <Field label="City" value={lead.city} />
          <Field label="Age / Gender" value={`${lead.age || "—"} / ${lead.gender || "—"}`} />
          <Field label="Qualification" value={lead.qualification} />
          <Field label="Experience" value={lead.experience} />
          <Field label="Notice Period" value={lead.notice_period} />
          <Field label="Current Salary" value={lead.current_salary} mono />
          <Field label="Expected Salary" value={lead.expected_salary} mono />
          <Field label="Source" value={lead.source} />
          <Field label="Recruiter" value={lead.recruiter_name} />
          <Field label="Client" value={lead.client_name} />
          <Field label="Job" value={lead.job_title} />
          <Field label="Call Attempts" value={lead.call_attempts} />
          <Field label="Last Call" value={lead.last_call_status ? `${lead.last_call_status} • ${fmtDate(lead.last_call_date)}` : "—"} />
          <Field label="Next Follow-up" value={lead.next_followup_date ? fmtDate(lead.next_followup_date) : "—"} />
          <Field label="Lead age" value={`${lead.age_days} days (${lead.aging})`} />
        </div>

        {lead.notes && <div className="mt-4"><p className="text-[11px] uppercase tracking-wider text-slate-400">Notes</p><p className="text-sm text-slate-700 dark:text-slate-300">{lead.notes}</p></div>}

        <div className="mt-6">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Activity Timeline</p>
          <div className="space-y-2">
            {[...timeline.calls.map((c) => ({ ...c, kind: "call" })), ...timeline.activities.map((a) => ({ ...a, kind: "act" }))]
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map((e) => (
                <div key={e.id} className="flex gap-2 text-sm border-l-2 border-slate-200 dark:border-slate-700 pl-3 py-1">
                  <div className="flex-1">
                    <p className="text-slate-700 dark:text-slate-200">
                      {e.kind === "call" ? <span className="font-medium">{e.disposition}</span> : e.description}
                    </p>
                    <p className="text-[11px] text-slate-400">{fmtDate(e.created_at)} • {e.recruiter_name || e.actor_name}</p>
                  </div>
                </div>
              ))}
            {timeline.calls.length === 0 && timeline.activities.length === 0 && <p className="text-xs text-slate-400">No activity yet.</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
