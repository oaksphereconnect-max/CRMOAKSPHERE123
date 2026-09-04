import { useState, useEffect, useCallback } from "react";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PriorityBadge, StatusBadge, fmtDate, TagChip, waLink, isFinal } from "@/lib/ui";
import { Phone, MessageCircle, PhoneCall, AlertTriangle, Pencil, Trash2, StickyNote, CalendarPlus, RefreshCw, UserPlus, Tag, CheckCircle2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import WhatsAppModal from "@/components/WhatsAppModal";
import LeadFormModal from "@/components/LeadFormModal";
import { FollowupDialog, StatusChangeDialog, AssignDialog, TagPickerDialog, NoteDialog } from "@/components/LeadDialogs";

export { waLink };

const ACT_ICON = { call: "📞", whatsapp: "💬", note: "📝", followup: "📅", followup_done: "✅", status_change: "🔁", assigned: "👤", transfer: "➡️", interview: "🎯", joining: "🏁", tag: "🏷️", created: "✨", edited: "✏️" };

function Field({ label, value, mono }) {
  return <div><p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p><p className={`text-sm text-slate-800 dark:text-slate-100 break-words ${mono ? "font-mono" : ""}`}>{value || "—"}</p></div>;
}

function ActionBtn({ icon: Icon, label, onClick, testid, tone = "" }) {
  return <Button size="sm" variant="outline" data-testid={testid} onClick={onClick} className={`h-8 text-xs ${tone}`}><Icon className="w-3.5 h-3.5 mr-1" /> {label}</Button>;
}

export default function LeadDrawer({ leadId, open, onOpenChange, onCall, onChanged }) {
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState({ activities: [], calls: [], notes: [], followups: [] });
  const [settings, setSettings] = useState(null);
  const [dlg, setDlg] = useState(null); // edit | delete | note | followup | status | assign | tags | whatsapp
  const [editNote, setEditNote] = useState(null);
  const [delNote, setDelNote] = useState(null);
  const isAdmin = user.role === "admin";
  const canAssign = user.role !== "recruiter";

  const reload = useCallback(() => {
    if (!leadId) return;
    api.get(`/leads/${leadId}`).then((r) => setLead(r.data)).catch(() => {});
    api.get(`/leads/${leadId}/activities`).then((r) => setTimeline(r.data)).catch(() => {});
  }, [leadId]);

  useEffect(() => { if (open && leadId) { setLead(null); reload(); } }, [open, leadId, reload]);
  useEffect(() => { if (open && !settings) api.get("/settings").then((r) => setSettings(r.data)).catch(() => {}); }, [open, settings]);

  const changed = () => { reload(); onChanged?.(); };

  const deleteLead = async () => {
    try { await api.delete(`/leads/${lead.id}`); toast.success("Lead deleted"); onOpenChange(false); onChanged?.(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const deleteNote = async () => {
    try { await api.delete(`/leads/${lead.id}/notes/${delNote.id}`); toast.success("Note deleted"); setDelNote(null); changed(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  if (!lead) return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="bg-white dark:bg-slate-900"><p className="text-sm text-slate-400 mt-8">Loading…</p></SheetContent></Sheet>;

  const pendingFu = lead.next_followup_date && new Date(lead.next_followup_date) >= new Date();
  const overdueFu = lead.next_followup_date && new Date(lead.next_followup_date) < new Date() && !isFinal(lead.lead_status);
  const events = [
    ...timeline.calls.map((c) => ({ ...c, kind: "call", text: `Call: ${c.disposition}${c.notes ? ` — ${c.notes}` : ""}`, who: c.recruiter_name })),
    ...timeline.activities.map((a) => ({ ...a, kind: a.type, text: a.description, who: a.actor_name })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-slate-900" data-testid="lead-drawer">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">{lead.name}<span className="text-xs font-mono text-slate-400">{lead.lead_code}</span></SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={lead.priority} />
          <StatusBadge status={lead.lead_status} />
          {lead.is_final && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">FINAL</span>}
          {!lead.phone_valid && <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> INVALID / VERIFY</span>}
          {lead.duplicate_flag && <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">DUPLICATE</span>}
        </div>

        <div className="mt-2 flex items-center gap-1.5 flex-wrap" data-testid="lead-tags">
          {lead.tag_details?.map((t) => <TagChip key={t.id} tag={t} testid={`lead-tag-${t.id}`} />)}
          <button data-testid="drawer-tags-btn" onClick={() => setDlg("tags")} className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"><Tag className="w-3 h-3" /> {lead.tag_details?.length ? "Edit tags" : "Add tag"}</button>
        </div>

        {/* Follow-up banner */}
        <div className={`mt-3 p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${overdueFu ? "bg-rose-50 border-rose-200 text-rose-700" : pendingFu ? "bg-amber-50 border-amber-200 text-amber-800" : lead.is_final ? "bg-slate-50 border-slate-200 text-slate-500" : "bg-rose-50 border-rose-200 text-rose-700"}`} data-testid="followup-banner">
          <div>
            <p className="font-semibold">{overdueFu ? "OVERDUE follow-up" : pendingFu ? "Next follow-up" : lead.is_final ? "Lead closed — no follow-up needed" : "No follow-up scheduled — required for active leads"}</p>
            {lead.next_followup_date && <p>{fmtDate(lead.next_followup_date)}{lead.next_followup_reason ? ` • ${lead.next_followup_reason}` : ""}</p>}
            {lead.last_contact_date && <p className="text-slate-500 mt-0.5">Last contact: {fmtDate(lead.last_contact_date)}</p>}
          </div>
          {!lead.is_final && <Button size="sm" variant="outline" className="h-7 text-xs bg-white" data-testid="drawer-followup-btn" onClick={() => setDlg("followup")}><CalendarPlus className="w-3.5 h-3.5 mr-1" /> {lead.next_followup_date ? "Reschedule" : "Add Follow-up"}</Button>}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-1.5 flex-wrap" data-testid="drawer-actions">
          <Button size="sm" data-testid="drawer-call-btn" onClick={() => onCall?.(lead)} className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"><PhoneCall className="w-3.5 h-3.5 mr-1" /> Log Call</Button>
          <ActionBtn icon={MessageCircle} label="WhatsApp" testid="drawer-whatsapp-btn" onClick={() => setDlg("whatsapp")} tone="text-emerald-600 border-emerald-200" />
          <a href={`tel:${lead.phone}`}><Button size="sm" variant="outline" className="h-8 text-xs" data-testid="drawer-dial-btn"><Phone className="w-3.5 h-3.5 mr-1" /> Dial</Button></a>
          <ActionBtn icon={Pencil} label="Edit" testid="drawer-edit-btn" onClick={() => setDlg("edit")} />
          <ActionBtn icon={RefreshCw} label="Change Status" testid="drawer-status-btn" onClick={() => setDlg("status")} />
          <ActionBtn icon={StickyNote} label="Add Note" testid="drawer-note-btn" onClick={() => { setEditNote(null); setDlg("note"); }} />
          {canAssign && <ActionBtn icon={UserPlus} label="Assign" testid="drawer-assign-btn" onClick={() => setDlg("assign")} />}
          {isAdmin && <ActionBtn icon={Trash2} label="Delete" testid="drawer-delete-btn" onClick={() => setDlg("delete")} tone="text-rose-600 border-rose-200 hover:bg-rose-50" />}
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
          <Field label="Interview" value={lead.interview_status !== "Pending" ? `${lead.interview_status}${lead.interview_date ? ` • ${fmtDate(lead.interview_date)}` : ""}` : "—"} />
          <Field label="Expected Joining" value={lead.expected_joining_date ? fmtDate(lead.expected_joining_date, false) : "—"} />
          {lead.lost_reason && <Field label="Closure reason" value={lead.lost_reason} />}
          <Field label="Lead age" value={`${lead.age_days} days (${lead.aging})`} />
        </div>
        {lead.notes && <div className="mt-4"><p className="text-[11px] uppercase tracking-wider text-slate-400">Lead notes</p><p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{lead.notes}</p></div>}

        {/* Notes */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notes ({timeline.notes?.length || 0})</p>
            <button data-testid="notes-add-btn" onClick={() => { setEditNote(null); setDlg("note"); }} className="text-xs text-blue-600 hover:underline">+ Add note</button>
          </div>
          <div className="space-y-2">
            {(timeline.notes || []).map((n) => (
              <div key={n.id} data-testid={`note-${n.id}`} className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-slate-800 border border-amber-100 dark:border-slate-700 text-sm">
                <p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{n.text}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[11px] text-slate-400">{fmtDate(n.created_at)} • {n.author_name}{n.updated_at ? " (edited)" : ""}</p>
                  {(isAdmin || n.author_id === user.id) && (
                    <div className="flex gap-2">
                      <button data-testid={`note-edit-${n.id}`} onClick={() => { setEditNote(n); setDlg("note"); }} className="text-[11px] text-blue-600 hover:underline">Edit</button>
                      <button data-testid={`note-delete-${n.id}`} onClick={() => setDelNote(n)} className="text-[11px] text-rose-600 hover:underline">Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(timeline.notes || []).length === 0 && <p className="text-xs text-slate-400">No notes yet.</p>}
          </div>
        </div>

        {/* Follow-up history */}
        <div className="mt-6">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Follow-up History</p>
          <div className="space-y-1.5">
            {(timeline.followups || []).map((f) => (
              <div key={f.id} data-testid={`fu-hist-${f.id}`} className="flex items-center justify-between text-xs p-2 rounded-md border border-slate-100 dark:border-slate-800">
                <div><p className="font-medium text-slate-700 dark:text-slate-200">{fmtDate(f.due_date)}</p><p className="text-slate-400">{f.reason || "—"}{f.outcome ? ` → ${f.outcome}` : ""}</p></div>
                <span className={`px-2 py-0.5 rounded-full font-semibold ${f.status === "completed" ? "bg-emerald-50 text-emerald-700" : f.status === "superseded" ? "bg-slate-100 text-slate-500" : new Date(f.due_date) < new Date() ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                  {f.status === "pending" && new Date(f.due_date) < new Date() ? "overdue" : f.status}
                </span>
              </div>
            ))}
            {(timeline.followups || []).length === 0 && <p className="text-xs text-slate-400">No follow-ups yet.</p>}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6 mb-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Activity Timeline</p>
          <div className="space-y-2" data-testid="activity-timeline">
            {events.map((e) => (
              <div key={e.id} className="flex gap-2 text-sm border-l-2 border-slate-200 dark:border-slate-700 pl-3 py-1">
                <span className="text-sm leading-5">{ACT_ICON[e.kind] || "•"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 dark:text-slate-200 break-words">{e.text}</p>
                  <p className="text-[11px] text-slate-400">{fmtDate(e.created_at)} • {e.who}</p>
                </div>
              </div>
            ))}
            {events.length === 0 && <p className="text-xs text-slate-400">No activity yet.</p>}
          </div>
        </div>

        <LeadFormModal open={dlg === "edit"} onOpenChange={(o) => !o && setDlg(null)} lead={lead} settings={settings} onDone={changed} />
        <WhatsAppModal open={dlg === "whatsapp"} onOpenChange={(o) => !o && setDlg(null)} lead={lead} onDone={changed} />
        <FollowupDialog open={dlg === "followup"} onOpenChange={(o) => !o && setDlg(null)} lead={lead} onDone={changed} />
        <StatusChangeDialog open={dlg === "status"} onOpenChange={(o) => !o && setDlg(null)} lead={lead} statuses={settings?.lead_statuses || []} onDone={changed} />
        <AssignDialog open={dlg === "assign"} onOpenChange={(o) => !o && setDlg(null)} lead={lead} onDone={changed} />
        <TagPickerDialog open={dlg === "tags"} onOpenChange={(o) => !o && setDlg(null)} lead={lead} onDone={changed} />
        <NoteDialog open={dlg === "note"} onOpenChange={(o) => !o && setDlg(null)} lead={lead} note={editNote} onDone={changed} />
        <ConfirmDialog open={dlg === "delete"} onOpenChange={(o) => !o && setDlg(null)} title="Delete this lead?" testid="delete-lead-confirm"
          description={`"${lead.name}" (${lead.phone}) and its call logs, notes, follow-ups and interview records will be permanently deleted. This cannot be undone.`} onConfirm={deleteLead} />
        <ConfirmDialog open={!!delNote} onOpenChange={(o) => !o && setDelNote(null)} title="Delete this note?" testid="delete-note-confirm" description="This note will be removed from the lead." onConfirm={deleteNote} />
      </SheetContent>
    </Sheet>
  );
}
