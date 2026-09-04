import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Loading } from "@/components/common";
import { initials } from "@/lib/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, KeyRound } from "lucide-react";

export default function Recruiters() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ role: "recruiter" });
  const isAdmin = user.role === "admin";

  const load = useCallback(() => {
    setRows(null);
    api.get("/recruiters").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name || !form.email || !form.password) { toast.error("Name, email, password required"); return; }
    try {
      await api.post("/users", form);
      toast.success("User created"); setOpen(false); setForm({ role: "recruiter" }); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.id}`, { active: !u.active });
      toast.success(u.active ? "Deactivated" : "Activated"); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to update user"); }
  };

  const resetPw = async (u) => {
    const pw = window.prompt(`Set a new password for ${u.name}:`, "");
    if (!pw) return;
    try {
      await api.post(`/users/${u.id}/reset-password`, { password: pw });
      toast.success(`Password updated for ${u.name}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to reset password"); }
  };

  return (
    <div>
      <PageHeader title="Recruiters" subtitle="Team roster & performance" testid="recruiters-header">
        {isAdmin && <Button size="sm" data-testid="add-user-btn" onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700"><UserPlus className="w-4 h-4 mr-1" /> Add User</Button>}
      </PageHeader>
      {rows === null ? <Loading /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <Card key={r.id} data-testid={`recruiter-card-${r.id}`} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-11 h-11">{r.avatar && <AvatarImage src={r.avatar} />}<AvatarFallback className="bg-blue-600 text-white">{initials(r.name)}</AvatarFallback></Avatar>
                <div className="flex-1"><h3 className="font-semibold font-display text-slate-800 dark:text-slate-100">{r.name}</h3><p className="text-xs text-slate-400">{r.role === "team_leader" ? "Team Leader" : "Recruiter"}</p></div>
                {isAdmin && <Switch data-testid={`active-toggle-${r.id}`} checked={r.active} onCheckedChange={() => toggleActive(r)} />}
              </div>
              <p className="text-xs text-slate-400 mb-3">{r.email}</p>
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                <div><p className="text-base font-bold font-display text-slate-700">{r.stats.leads}</p><p className="text-[10px] text-slate-400 uppercase">Leads</p></div>
                <div><p className="text-base font-bold font-display text-blue-600">{r.stats.calls_today}</p><p className="text-[10px] text-slate-400 uppercase">Calls</p></div>
                <div><p className="text-base font-bold font-display text-emerald-600">{r.stats.connected_today}</p><p className="text-[10px] text-slate-400 uppercase">Conn</p></div>
                <div><p className="text-base font-bold font-display text-amber-600">{r.stats.joined_month}</p><p className="text-[10px] text-slate-400 uppercase">Joined</p></div>
              </div>
              {isAdmin && <Button size="sm" variant="outline" className="w-full mt-3" data-testid={`reset-pw-${r.id}`} onClick={() => resetPw(r)}><KeyRound className="w-3.5 h-3.5 mr-1" /> Reset Password</Button>}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white dark:bg-slate-900">
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Full name *</Label><Input data-testid="user-name-input" value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            <div><Label>Email *</Label><Input data-testid="user-email-input" type="email" value={form.email || ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1" /></div>
            <div><Label>Password *</Label><Input data-testid="user-password-input" value={form.password || ""} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="mt-1" /></div>
            <div><Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="user-role-select" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="recruiter">Recruiter</SelectItem><SelectItem value="team_leader">Team Leader</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button data-testid="user-submit-btn" onClick={create} className="bg-blue-600 hover:bg-blue-700">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
