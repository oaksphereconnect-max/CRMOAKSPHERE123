import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { PageHeader, Loading } from "@/components/common";
import { fmtDate } from "@/lib/ui";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle, PhoneOff, UserX, Clock, CalendarX, Briefcase, PhoneCall, Users, ChevronRight,
} from "lucide-react";

export default function ActionRequired() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/action-required").then((r) => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Loading />;

  const sections = [
    { key: "overdue_followups", title: "Overdue Follow-ups", icon: Clock, tone: "rose", items: data.overdue_followups, render: (l) => `${l.name} • ${l.phone} • due ${fmtDate(l.next_followup_date)}` },
    { key: "never_called", title: "Never-Called Leads", icon: PhoneOff, tone: "amber", items: data.never_called, render: (l) => `${l.name} • ${l.phone} • ${l.priority}` },
    { key: "unassigned", title: "Unassigned Leads", icon: Users, tone: "blue", items: data.unassigned, render: (l) => `${l.name} • ${l.phone}` },
    { key: "stale_leads", title: "Stale Leads (15+ days)", icon: AlertTriangle, tone: "slate", items: data.stale_leads, render: (l) => `${l.name} • ${l.age_days}d old` },
    { key: "selected_no_joining_date", title: "Selected — No Joining Date", icon: CalendarX, tone: "amber", items: data.selected_no_joining_date, render: (l) => `${l.name} • ${l.recruiter_name}` },
    { key: "unconfirmed_tomorrow_interviews", title: "Unconfirmed Interviews (Tomorrow)", icon: PhoneCall, tone: "blue", items: data.unconfirmed_tomorrow_interviews, render: (iv) => `${iv.lead_name} • ${iv.client_name} • ${fmtDate(iv.datetime)}` },
    { key: "unconfirmed_joinings", title: "Unconfirmed Joinings", icon: Briefcase, tone: "amber", items: data.unconfirmed_joinings, render: (j) => `${j.lead_name} • ${j.client_name} • ${j.status}` },
    { key: "recruiters_below_target", title: "Recruiters Below Call Target", icon: UserX, tone: "rose", items: data.recruiters_below_target, render: (r) => `${r.recruiter} • ${r.calls}/${r.target} calls` },
  ];
  const TONE = { rose: "text-rose-600 bg-rose-50 border-rose-200", amber: "text-amber-600 bg-amber-50 border-amber-200", blue: "text-blue-600 bg-blue-50 border-blue-200", slate: "text-slate-600 bg-slate-50 border-slate-200" };

  return (
    <div>
      <PageHeader title="Action Required" subtitle="Everything that needs attention right now" testid="action-required-header" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Card key={s.key} data-testid={`action-${s.key}`} className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-lg border ${TONE[s.tone]}`}><s.icon className="w-4 h-4" /></div>
              <h3 className="font-semibold font-display text-sm text-slate-800 dark:text-slate-100">{s.title}</h3>
              <span className={`ml-auto text-sm font-bold ${s.items.length ? "text-rose-600" : "text-emerald-600"}`}>{s.items.length}</span>
            </div>
            {s.items.length === 0 ? <p className="text-xs text-slate-400">All clear ✓</p> : (
              <ul className="space-y-1.5 max-h-52 overflow-y-auto">
                {s.items.slice(0, 8).map((it, i) => (
                  <li key={i} onClick={() => it.id && navigate(`/leads?focus=${it.id}`)} className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 hover:text-blue-600 cursor-pointer">
                    <ChevronRight className="w-3 h-3 text-slate-300" /> {s.render(it)}
                  </li>
                ))}
                {s.items.length > 8 && <li className="text-[11px] text-slate-400">+{s.items.length - 8} more…</li>}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
