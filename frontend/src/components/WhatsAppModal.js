import { useState, useEffect, useMemo } from "react";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { waLink, fmtDate } from "@/lib/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle } from "lucide-react";

export function fillTemplate(body, vars) {
  return (body || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, key) => {
    const v = vars[key.trim()];
    return v ? String(v) : m;
  });
}

export default function WhatsAppModal({ open, onOpenChange, lead, onDone }) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [tplId, setTplId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      api.get("/wa-templates").then((r) => setTemplates(r.data)).catch(() => {});
      api.get("/jobs").then((r) => setJobs(r.data)).catch(() => {});
      setTplId(""); setMessage("");
    }
  }, [open]);

  const vars = useMemo(() => {
    if (!lead) return {};
    const job = jobs.find((j) => j.id === lead.job_id);
    const iv = lead.interview_date ? new Date(lead.interview_date) : null;
    return {
      "Candidate Name": lead.name,
      "Recruiter Name": user?.name,
      "Job Role": lead.job_title || job?.title,
      "Company Name": lead.client_name,
      "Location": job?.location || lead.city,
      "Salary": job?.salary_range ? `₹${job.salary_range}` : lead.expected_salary,
      "Interview Date": iv && !isNaN(iv) ? iv.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
      "Interview Time": iv && !isNaN(iv) ? iv.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
      "Joining Date": lead.expected_joining_date ? fmtDate(lead.expected_joining_date, false) : "",
    };
  }, [lead, jobs, user]);

  const pickTemplate = (id) => {
    setTplId(id);
    const t = templates.find((x) => x.id === id);
    setMessage(t ? fillTemplate(t.body, vars) : "");
  };

  const unfilled = (message.match(/\{\{[^}]+\}\}/g) || []);

  const send = async () => {
    if (!message.trim()) { toast.error("Message is empty"); return; }
    setSending(true);
    try {
      const t = templates.find((x) => x.id === tplId);
      window.open(waLink(lead.phone, message), "_blank", "noopener");
      await api.post(`/leads/${lead.id}/whatsapp`, { template_name: t?.name || "Custom message", message });
      toast.success("WhatsApp opened & logged in timeline");
      onOpenChange(false);
      onDone?.();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
    finally { setSending(false); }
  };

  if (!lead) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white dark:bg-slate-900" data-testid="whatsapp-modal">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-600" /> Send WhatsApp — {lead.name}</DialogTitle>
          <p className="text-sm text-slate-400 font-mono">{lead.phone}</p>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs">Template</Label>
            <Select value={tplId} onValueChange={pickTemplate}>
              <SelectTrigger data-testid="wa-template-select" className="mt-1"><SelectValue placeholder="Choose a template…" /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Message preview (editable)</Label>
            <Textarea data-testid="wa-message-input" value={message} onChange={(e) => setMessage(e.target.value)} rows={8} className="mt-1 text-sm" placeholder="Pick a template or type a message…" />
            {unfilled.length > 0 && <p className="text-[11px] text-amber-600 mt-1" data-testid="wa-unfilled-warning">Fill in before sending: {[...new Set(unfilled)].join(", ")}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="wa-send-btn" onClick={send} disabled={sending} className="bg-emerald-600 hover:bg-emerald-700"><MessageCircle className="w-4 h-4 mr-1" /> Open WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
