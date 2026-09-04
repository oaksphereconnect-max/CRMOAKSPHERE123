import { useState, useEffect } from "react";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { isFinal, REASON_STATUSES, LOST_REASONS, tomorrow10Local, toLocalInput } from "@/lib/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagChip } from "@/lib/ui";

const toIso = (local) => (local ? new Date(local).toISOString() : null);

/* ---------- Follow-up: add / reschedule ---------- */
export function FollowupDialog({ open, onOpenChange, lead, followup, onDone }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setDate(followup?.due_date ? toLocalInput(followup.due_date) : tomorrow10Local());
      setReason(followup?.reason || "");
    }
  }, [open, followup]);
  const save = async () => {
    if (!date) { toast.error("Follow-up date & time is required"); return; }
    setSaving(true);
    try {
      if (followup) await api.patch(`/followups/${followup.id}`, { due_date: toIso(date), reason });
      else await api.post("/followups", { lead_id: lead.id, due_date: toIso(date), reason });
      toast.success(followup ? "Follow-up rescheduled" : "Follow-up scheduled");
      onOpenChange(false); onDone?.();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900" data-testid="followup-dialog">
        <DialogHeader><DialogTitle className="font-display">{followup ? "Reschedule Follow-up" : "Add Follow-up"}{lead ? ` — ${lead.name}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div><Label className="text-xs">Next follow-up date & time *</Label><Input data-testid="fu-date-input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Reason / notes</Label><Input data-testid="fu-reason-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. confirm interview availability" className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="fu-save-btn" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Status change with follow-up enforcement ---------- */
export function StatusChangeDialog({ open, onOpenChange, lead, statuses = [], onDone }) {
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [joining, setJoining] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open && lead) { setStatus(lead.lead_status || ""); setDate(tomorrow10Local()); setReason(""); setLostReason(lead.lost_reason || ""); setJoining(lead.expected_joining_date ? lead.expected_joining_date.slice(0, 10) : ""); }
  }, [open, lead]);
  const hasPending = lead?.next_followup_date && new Date(lead.next_followup_date) >= new Date();
  const needFollowup = status && !isFinal(status);
  const save = async () => {
    if (!status) { toast.error("Select a status"); return; }
    const body = { lead_status: status };
    if (needFollowup) {
      if (!date && !hasPending) { toast.error("Next follow-up date is required"); return; }
      if (date) { body.next_followup_date = toIso(date); body.next_followup_reason = reason; }
    }
    if (status === "Selected") { if (!joining) { toast.error("Expected joining date is required"); return; } body.expected_joining_date = new Date(joining).toISOString(); }
    if (REASON_STATUSES.includes(status)) { if (!lostReason) { toast.error("Reason is required"); return; } body.lost_reason = lostReason; }
    setSaving(true);
    try {
      await api.patch(`/leads/${lead.id}`, body);
      toast.success(`Status changed to ${status}`);
      onOpenChange(false); onDone?.();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900" data-testid="status-dialog">
        <DialogHeader><DialogTitle className="font-display">Change Status — {lead?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div><Label className="text-xs">New status *</Label>
            <Select value={status} onValueChange={setStatus}><SelectTrigger data-testid="status-select" className="mt-1"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}{isFinal(s) ? " (final)" : ""}</SelectItem>)}</SelectContent></Select>
          </div>
          {needFollowup && (
            <div className="grid gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs font-semibold text-amber-700">{hasPending ? "Update next follow-up (optional — lead already has one pending)" : "Next follow-up required until a final status is reached"}</p>
              <Input data-testid="status-fu-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input data-testid="status-fu-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Follow-up reason" />
            </div>
          )}
          {status === "Selected" && <div><Label className="text-xs">Expected joining date *</Label><Input data-testid="status-joining-date" type="date" value={joining} onChange={(e) => setJoining(e.target.value)} className="mt-1" /></div>}
          {REASON_STATUSES.includes(status) && (
            <div><Label className="text-xs">Reason *</Label>
              <Select value={lostReason} onValueChange={setLostReason}><SelectTrigger data-testid="status-lost-reason" className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>{LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="status-save-btn" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Complete follow-up (must schedule next OR close lead) ---------- */
export function CompleteFollowupDialog({ open, onOpenChange, followup, statuses = [], onDone }) {
  const [mode, setMode] = useState("next");
  const [outcome, setOutcome] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [joining, setJoining] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setMode("next"); setOutcome(""); setDate(tomorrow10Local()); setReason(""); setStatus(""); setLostReason(""); setJoining(""); } }, [open]);
  const finals = statuses.filter(isFinal);
  const save = async () => {
    const body = { outcome };
    if (mode === "next") { if (!date) { toast.error("Next follow-up date is required"); return; } body.next_date = toIso(date); body.next_reason = reason; }
    else {
      if (!status) { toast.error("Select a final status"); return; }
      body.lead_status = status;
      if (status === "Selected") { if (!joining) { toast.error("Expected joining date required"); return; } body.expected_joining_date = new Date(joining).toISOString(); }
      if (REASON_STATUSES.includes(status)) { if (!lostReason) { toast.error("Reason required"); return; } body.lost_reason = lostReason; }
    }
    setSaving(true);
    try {
      await api.post(`/followups/${followup.id}/complete`, body);
      toast.success("Follow-up completed");
      onOpenChange(false); onDone?.();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900" data-testid="complete-followup-dialog">
        <DialogHeader><DialogTitle className="font-display">Complete Follow-up — {followup?.lead_name}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div><Label className="text-xs">Outcome / notes</Label><Textarea data-testid="cf-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2} className="mt-1" placeholder="What happened on this follow-up?" /></div>
          <div className="grid grid-cols-2 gap-2">
            <button data-testid="cf-mode-next" onClick={() => setMode("next")} className={`text-xs px-3 py-2 rounded-md border ${mode === "next" ? "bg-blue-600 text-white border-blue-600" : "border-slate-200"}`}>Schedule next follow-up</button>
            <button data-testid="cf-mode-final" onClick={() => setMode("final")} className={`text-xs px-3 py-2 rounded-md border ${mode === "final" ? "bg-blue-600 text-white border-blue-600" : "border-slate-200"}`}>Move to final status</button>
          </div>
          {mode === "next" ? (
            <div className="grid gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <Label className="text-xs">Next follow-up date & time *</Label>
              <Input data-testid="cf-next-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input data-testid="cf-next-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
            </div>
          ) : (
            <div className="grid gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <Select value={status} onValueChange={setStatus}><SelectTrigger data-testid="cf-final-status"><SelectValue placeholder="Final status" /></SelectTrigger>
                <SelectContent>{finals.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              {status === "Selected" && <Input data-testid="cf-joining-date" type="date" value={joining} onChange={(e) => setJoining(e.target.value)} />}
              {REASON_STATUSES.includes(status) && (
                <Select value={lostReason} onValueChange={setLostReason}><SelectTrigger data-testid="cf-lost-reason"><SelectValue placeholder="Reason" /></SelectTrigger>
                  <SelectContent>{LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="cf-save-btn" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? "Saving…" : "Complete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Assign single lead ---------- */
export function AssignDialog({ open, onOpenChange, lead, onDone }) {
  const [recruiters, setRecruiters] = useState([]);
  const [to, setTo] = useState("");
  useEffect(() => { if (open) { api.get("/recruiters").then((r) => setRecruiters(r.data)).catch(() => {}); setTo(lead?.assigned_recruiter_id || ""); } }, [open, lead]);
  const save = async () => {
    if (!to) { toast.error("Select a recruiter"); return; }
    try { await api.post("/leads/assign", { lead_ids: [lead.id], recruiter_id: to }); toast.success("Lead assigned"); onOpenChange(false); onDone?.(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-white dark:bg-slate-900" data-testid="assign-dialog">
        <DialogHeader><DialogTitle className="font-display">Assign Recruiter — {lead?.name}</DialogTitle></DialogHeader>
        <Select value={to} onValueChange={setTo}><SelectTrigger data-testid="assign-select"><SelectValue placeholder="Select recruiter" /></SelectTrigger>
          <SelectContent>{recruiters.filter((r) => r.active !== false).map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({r.stats?.leads || 0} leads)</SelectItem>)}</SelectContent></Select>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button data-testid="assign-save-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">Assign</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Tag picker ---------- */
export function TagPickerDialog({ open, onOpenChange, lead, onDone }) {
  const [tags, setTags] = useState([]);
  const [sel, setSel] = useState([]);
  const [q, setQ] = useState("");
  useEffect(() => { if (open) { api.get("/tags").then((r) => setTags(r.data)).catch(() => {}); setSel(lead?.tags || []); setQ(""); } }, [open, lead]);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const save = async () => {
    try { await api.post(`/leads/${lead.id}/tags`, { tag_ids: sel }); toast.success("Tags updated"); onOpenChange(false); onDone?.(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const shown = tags.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900" data-testid="tag-dialog">
        <DialogHeader><DialogTitle className="font-display">Tags — {lead?.name}</DialogTitle></DialogHeader>
        <Input data-testid="tag-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tags…" className="h-9" />
        <div className="flex flex-wrap gap-2 py-2 max-h-64 overflow-y-auto">
          {shown.map((t) => (
            <button key={t.id} data-testid={`tag-opt-${t.id}`} onClick={() => toggle(t.id)} className={`rounded-full transition-transform ${sel.includes(t.id) ? "ring-2 ring-offset-1 scale-105" : "opacity-70 hover:opacity-100"}`} style={{ "--tw-ring-color": t.color }}>
              <TagChip tag={t} />
            </button>
          ))}
          {shown.length === 0 && <p className="text-xs text-slate-400">No tags. Admin can create tags in Settings → Tags.</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button data-testid="tag-save-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">Save tags</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Note add / edit ---------- */
export function NoteDialog({ open, onOpenChange, lead, note, onDone }) {
  const [text, setText] = useState("");
  useEffect(() => { if (open) setText(note?.text || ""); }, [open, note]);
  const save = async () => {
    if (!text.trim()) { toast.error("Note cannot be empty"); return; }
    try {
      if (note) await api.patch(`/leads/${lead.id}/notes/${note.id}`, { text });
      else await api.post(`/leads/${lead.id}/notes`, { text });
      toast.success(note ? "Note updated" : "Note added"); onOpenChange(false); onDone?.();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900" data-testid="note-dialog">
        <DialogHeader><DialogTitle className="font-display">{note ? "Edit Note" : "Add Note"}</DialogTitle></DialogHeader>
        <Textarea data-testid="note-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Write a note…" />
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button data-testid="note-save-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
