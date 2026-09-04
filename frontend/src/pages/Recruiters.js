import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading } from "@/components/common";
import { initials } from "@/lib/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, KeyRound, Pencil, Trash2, ArrowRightLeft, Users2, Search, CalendarClock } from "lucide-react";

function UserDialog({ open, onOpenChange, user, teamLeaders, onDone }) {
  const [form, setForm] = useState({ role: "recruiter" });
  useEffect(() => { if (open) setForm(user ? { name: user.name, email: user.email, phone: user.phone || "", role: user.role, team_leader_id: user.team_leader_id || "" } : { role: "recruiter" }); }, [open, user]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.name || !form.email || (!user && !form.password)) { toast.error("Name, email and password are required"); return; }
    try {
      if (user) {
        const body = { ...form };
        if (!body.phone) delete body.phone;
        if (!body.team_leader_id) delete body.team_leader_id;
        await api.patch(`/users/${user.id}`, body);
        toast.success("User updated");
      } else {
        await api.post("/users", { ...form, team_leader_id: form.team_leader_id || null });
        toast.success("User created");
      }
      onOpenChange(false); onDone();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-slate-900" data-testid="user-dialog">
        <DialogHeader><DialogTitle className="font-display">{user ? `Edit — ${user.name}` : "Add User"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div><Label>Full name *</Label><Input data-testid="user-name-input" value={form.name || ""} onChange={(e) => set("name", e.target.value)} className="mt-1" /></div>
          <div><Label>Email *</Label><Input data-testid="user-email-input" type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} className="mt-1" /></div>
          <div><Label>Phone</Label><Input data-testid="user-phone-input" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} className="mt-1" /></div>
          {!user && <div><Label>Password *</Label><Input data-testid="user-password-input" value={form.password || ""} onChange={(e) => set("password", e.target.value)} className="mt-1" /></div>}
          <div><Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger data-testid="user-role-select" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="recruiter">Recruiter</SelectItem><SelectItem value="team_leader">Team Leader</SelectItem></SelectContent>
            </Select>
          </div>
          {form.role === "recruiter" && teamLeaders.length > 0 && (
            <div><Label>Team leader</Label>
              <Select value={form.team_leader_id || "none"} onValueChange={(v) => set("team_leader_id", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="user-tl-select" className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{teamLeaders.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button data-testid="user-submit-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">{user ? "Save" : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({ open, onOpenChange, from, others, mode, onDone }) {
  const [to, setTo] = useState("");
  useEffect(() => { if (open) setTo(""); }, [open]);
  const leads = from?.stats?.leads || 0;
  const run = async () => {
    try {
      if (mode === "delete") {
        if (leads > 0 && !to) { toast.error("Choose who should receive these leads first"); return; }
        const { data } = await api.delete(`/users/${from.id}${to ? `?transfer_to=${to}` : ""}`);
        toast.success(`${from.name} deleted${data.transferred ? ` • ${data.transferred} lead(s) transferred` : ""}`);
      } else if (mode === "deactivate") {
        if (to) { const { data } = await api.post(`/users/${from.id}/transfer-leads`, { to_recruiter_id: to }); toast.success(`${data.transferred} lead(s) transferred`); }
        await api.patch(`/users/${from.id}`, { active: false });
        toast.success(`${from.name} deactivated`);
      } else {
        if (!to) { toast.error("Select a recruiter"); return; }
        const { data } = await api.post(`/users/${from.id}/transfer-leads`, { to_recruiter_id: to });
        toast.success(`${data.transferred} lead(s) transferred`);
      }
      onOpenChange(false); onDone();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const titles = { delete: `Delete ${from?.name}?`, deactivate: `Deactivate ${from?.name}?`, transfer: `Transfer leads from ${from?.name}` };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900" data-testid="transfer-dialog">
        <DialogHeader><DialogTitle className="font-display">{titles[mode]}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1 text-sm">
          {leads > 0 ? (
            <p className={`p-3 rounded-lg border ${mode === "delete" ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-amber-50 border-amber-200 text-amber-800"}`} data-testid="transfer-warning">
              {from?.name} has <b>{leads}</b> assigned lead(s). {mode === "delete" ? "Who should these leads be transferred to? Leads are never deleted." : "Who should these leads be transferred to?"}{mode === "deactivate" ? " (optional)" : ""}
            </p>
          ) : <p className="text-slate-500">{mode === "delete" ? "This user has no assigned leads. The account will be permanently removed." : "No assigned leads."}</p>}
          {(leads > 0 || mode === "transfer") && (
            <Select value={to} onValueChange={setTo}><SelectTrigger data-testid="transfer-to-select"><SelectValue placeholder="Select recruiter to receive leads" /></SelectTrigger>
              <SelectContent>{others.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({r.stats?.leads || 0} leads)</SelectItem>)}</SelectContent></Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="transfer-confirm-btn" onClick={run} className={mode === "delete" ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"}>{mode === "delete" ? "Transfer & Delete" : mode === "deactivate" ? "Deactivate" : "Transfer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Recruiters() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [dlg, setDlg] = useState(null); // {type, user}
  const isAdmin = user.role === "admin";

  const load = useCallback(() => { api.get("/recruiters").then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = (u) => {
    if (u.active) { setDlg({ type: "deactivate", user: u }); return; }
    api.patch(`/users/${u.id}`, { active: true }).then(() => { toast.success("Activated"); load(); }).catch((e) => toast.error(formatError(e.response?.data?.detail)));
  };
  const resetPw = async (u) => {
    const pw = window.prompt(`Set a new password for ${u.name}:`, "");
    if (!pw) return;
    try { await api.post(`/users/${u.id}/reset-password`, { password: pw }); toast.success(`Password updated for ${u.name}`); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const shown = (rows || []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.email.toLowerCase().includes(q.toLowerCase()));
  const teamLeaders = (rows || []).filter((r) => r.role === "team_leader");
  const others = (rows || []).filter((r) => r.id !== dlg?.user?.id && r.active !== false);

  return (
    <div>
      <PageHeader title="Recruiters" subtitle="Team roster & performance" testid="recruiters-header">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input data-testid="recruiter-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 h-9 w-48" /></div>
        {isAdmin && <Button size="sm" data-testid="add-user-btn" onClick={() => setDlg({ type: "form", user: null })} className="bg-blue-600 hover:bg-blue-700"><UserPlus className="w-4 h-4 mr-1" /> Add User</Button>}
      </PageHeader>
      {rows === null ? <Loading /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((r) => (
            <Card key={r.id} data-testid={`recruiter-card-${r.id}`} className={`p-5 ${r.active === false ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-11 h-11">{r.avatar && <AvatarImage src={r.avatar} />}<AvatarFallback className="bg-blue-600 text-white">{initials(r.name)}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0"><h3 className="font-semibold font-display text-slate-800 dark:text-slate-100 truncate">{r.name}</h3><p className="text-xs text-slate-400">{r.role === "team_leader" ? "Team Leader" : "Recruiter"}{r.active === false ? " • Inactive" : ""}</p></div>
                {isAdmin && <Switch data-testid={`active-toggle-${r.id}`} checked={r.active !== false} onCheckedChange={() => toggleActive(r)} />}
              </div>
              <p className="text-xs text-slate-400 mb-3 truncate">{r.email}{r.phone ? ` • ${r.phone}` : ""}</p>
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                <div><p className="text-base font-bold font-display text-slate-700">{r.stats.leads}</p><p className="text-[10px] text-slate-400 uppercase">Leads</p></div>
                <div><p className="text-base font-bold font-display text-blue-600">{r.stats.calls_today}</p><p className="text-[10px] text-slate-400 uppercase">Calls</p></div>
                <div><p className="text-base font-bold font-display text-emerald-600">{r.stats.connected_today}</p><p className="text-[10px] text-slate-400 uppercase">Conn</p></div>
                <div><p className="text-base font-bold font-display text-amber-600">{r.stats.joined_month}</p><p className="text-[10px] text-slate-400 uppercase">Joined</p></div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-3">
                <Button size="sm" variant="outline" className="h-8 text-xs" data-testid={`view-leads-${r.id}`} onClick={() => navigate(`/leads?recruiter_id=${r.id}`)}><Users2 className="w-3.5 h-3.5 mr-1" /> Leads</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" data-testid={`view-followups-${r.id}`} onClick={() => navigate(`/followups?recruiter_id=${r.id}`)}><CalendarClock className="w-3.5 h-3.5 mr-1" /> Follow-ups</Button>
                {isAdmin && <>
                  <Button size="sm" variant="outline" className="h-8 text-xs" data-testid={`edit-user-${r.id}`} onClick={() => setDlg({ type: "form", user: r })}><Pencil className="w-3.5 h-3.5 mr-1" /> Edit</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" data-testid={`transfer-${r.id}`} onClick={() => setDlg({ type: "transfer", user: r })}><ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Transfer</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" data-testid={`reset-pw-${r.id}`} onClick={() => resetPw(r)}><KeyRound className="w-3.5 h-3.5 mr-1" /> Password</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50" data-testid={`delete-user-${r.id}`} onClick={() => setDlg({ type: "delete", user: r })}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
                </>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <UserDialog open={dlg?.type === "form"} onOpenChange={(o) => !o && setDlg(null)} user={dlg?.user} teamLeaders={teamLeaders} onDone={load} />
      <TransferDialog open={["delete", "deactivate", "transfer"].includes(dlg?.type)} onOpenChange={(o) => !o && setDlg(null)} from={dlg?.user} others={others} mode={dlg?.type} onDone={load} />
    </div>
  );
}
