import { useState, useEffect } from "react";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { isFinal, REASON_STATUSES, LOST_REASONS, tomorrow10Local } from "@/lib/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CONNECTED = ["Connected–Interested", "Not Interested", "Callback Requested", "Interview Scheduled", "Already Working", "Salary Issue", "Location Issue", "Job Mismatch"];
const NOT_CONNECTED = ["No Answer", "Busy", "Switched Off", "Unreachable", "Invalid Number", "WhatsApp Only", "Call Back Later"];
const REQUIRES_FOLLOWUP = ["Callback Requested", "Call Back Later"];
const AUTO_FINAL = { "Not Interested": "Not Interested", "Invalid Number": "Invalid Lead" };
const DEFAULT_STATUSES = ["Contacted", "Interested", "Follow-up", "Selected", "Not Interested", "Rejected", "Closed", "Lost"];

export default function CallDispositionModal({ open, onOpenChange, lead, onDone }) {
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [followupReason, setFollowupReason] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewType, setInterviewType] = useState("Telephonic");
  const [clientId, setClientId] = useState("");
  const [jobId, setJobId] = useState("");
  const [expectedJoining, setExpectedJoining] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [leadStatus, setLeadStatus] = useState("");
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDisposition(""); setNotes(""); setFollowupDate(tomorrow10Local()); setFollowupReason("");
      setInterviewDate(""); setClientId(lead?.client_id || ""); setJobId(lead?.job_id || "");
      setExpectedJoining(""); setLostReason(""); setLeadStatus("");
      api.get("/clients").then((r) => setClients(r.data)).catch(() => {});
      api.get("/jobs").then((r) => setJobs(r.data)).catch(() => {});
      api.get("/settings").then((r) => r.data?.lead_statuses?.length && setStatuses(r.data.lead_statuses.filter((s) => s !== "New"))).catch(() => {});
    }
  }, [open, lead]);

  const needInterview = disposition === "Interview Scheduled";
  const predicted = leadStatus || AUTO_FINAL[disposition] || (needInterview ? "Interview" : lead?.lead_status);
  const finalOutcome = isFinal(predicted);
  const mustFollowup = REQUIRES_FOLLOWUP.includes(disposition);
  const showFollowup = disposition && !finalOutcome && !needInterview;
  const isSelected = leadStatus === "Selected";
  const needReason = REASON_STATUSES.includes(leadStatus);

  const save = async () => {
    if (!disposition) { toast.error("Select a call outcome"); return; }
    if (showFollowup && !followupDate) { toast.error("Next follow-up date is required until the lead reaches a final status"); return; }
    if (mustFollowup && !followupReason) { toast.error("Follow-up reason is required for callbacks"); return; }
    setSaving(true);
    try {
      await api.post(`/leads/${lead.id}/call`, {
        disposition, notes,
        followup_date: showFollowup && followupDate ? new Date(followupDate).toISOString() : null,
        followup_reason: followupReason || (showFollowup ? `After: ${disposition}` : ""),
        interview_date: interviewDate ? new Date(interviewDate).toISOString() : null,
        interview_type: interviewType,
        client_id: clientId || null, job_id: jobId || null,
        expected_joining_date: expectedJoining ? new Date(expectedJoining).toISOString() : null,
        lost_reason: lostReason || null,
        lead_status: leadStatus || null,
      });
      toast.success("Call logged");
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900" data-testid="disposition-modal">
        <DialogHeader>
          <DialogTitle className="font-display">Log Call — {lead.name}</DialogTitle>
          <p className="text-sm text-slate-400 font-mono">{lead.phone}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Call outcome *</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <p className="col-span-2 text-[11px] font-semibold text-emerald-600 uppercase">Connected</p>
              {CONNECTED.map((d) => (
                <button key={d} data-testid={`disposition-opt-${d}`} onClick={() => setDisposition(d)}
                  className={`text-xs px-2 py-1.5 rounded-md border text-left ${disposition === d ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:border-blue-400"}`}>{d}</button>
              ))}
              <p className="col-span-2 text-[11px] font-semibold text-rose-600 uppercase mt-1">Not Connected</p>
              {NOT_CONNECTED.map((d) => (
                <button key={d} data-testid={`disposition-opt-${d}`} onClick={() => setDisposition(d)}
                  className={`text-xs px-2 py-1.5 rounded-md border text-left ${disposition === d ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:border-blue-400"}`}>{d}</button>
              ))}
            </div>
          </div>

          {needInterview && (
            <div className="grid gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs font-semibold text-blue-700">Interview details required</p>
              <div>
                <Label className="text-xs">Interview date & time *</Label>
                <Input data-testid="interview-date-input" type="datetime-local" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Client *</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger data-testid="interview-client-select" className="mt-1"><SelectValue placeholder="Client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Job *</Label>
                  <Select value={jobId} onValueChange={setJobId}>
                    <SelectTrigger data-testid="interview-job-select" className="mt-1"><SelectValue placeholder="Job" /></SelectTrigger>
                    <SelectContent>{jobs.filter((j) => !clientId || j.client_id === clientId).map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={interviewType} onValueChange={setInterviewType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Walk-in", "Telephonic", "Virtual", "F2F"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Update lead status (optional)</Label>
            <Select value={leadStatus} onValueChange={setLeadStatus}>
              <SelectTrigger data-testid="lead-status-select" className="mt-1"><SelectValue placeholder="Keep current / auto" /></SelectTrigger>
              <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}{isFinal(s) ? " (final)" : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {showFollowup && (
            <div className="grid gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200" data-testid="followup-section">
              <p className="text-xs font-semibold text-amber-700">{mustFollowup ? "Callback follow-up required" : "Next follow-up required (lead is still active)"}</p>
              <div>
                <Label className="text-xs">Next follow-up date & time *</Label>
                <Input data-testid="followup-date-input" type="datetime-local" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Reason {mustFollowup ? "*" : ""}</Label>
                <Input data-testid="followup-reason-input" value={followupReason} onChange={(e) => setFollowupReason(e.target.value)} placeholder="e.g. candidate will confirm availability" className="mt-1" />
              </div>
            </div>
          )}
          {disposition && finalOutcome && <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2" data-testid="final-status-note">Lead will be closed as <b>{predicted}</b> — no further follow-up needed.</p>}

          {isSelected && (
            <div>
              <Label className="text-xs">Expected joining date *</Label>
              <Input data-testid="expected-joining-input" type="date" value={expectedJoining} onChange={(e) => setExpectedJoining(e.target.value)} className="mt-1" />
            </div>
          )}

          {needReason && (
            <div>
              <Label className="text-xs">Reason *</Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger data-testid="lost-reason-select" className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>{LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea data-testid="call-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add call notes…" className="mt-1" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="disposition-submit-button" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? "Saving…" : "Save call"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
