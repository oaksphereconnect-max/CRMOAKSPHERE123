import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PhoneCall, Loader2 } from "lucide-react";

const DEMO = [
  { label: "Admin / Owner", email: "oaksphereconnect@gmail.com", password: "OakAdmin@2026" },
  { label: "Team Leader", email: "teamlead@oaksphere.com", password: "teamlead123" },
  { label: "Recruiter (Harshika)", email: "harshika@oaksphere.com", password: "recruiter123" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const quick = (d) => { setEmail(d.email); setPassword(d.password); };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[#0B132B] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 20% 20%, #2563EB 0, transparent 40%), radial-gradient(circle at 80% 80%, #6366F1 0, transparent 40%)" }} />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-lg font-display">O</div>
          <span className="font-display font-bold text-xl">OAKsphere Connect</span>
        </div>
        <div className="relative space-y-4 max-w-md">
          <h1 className="text-4xl font-extrabold font-display leading-tight">No lead lost. Ever.</h1>
          <p className="text-slate-300 leading-relaxed">The recruitment command center that keeps your team calling, following up and closing — from first touch to joining.</p>
          <div className="flex gap-6 pt-4 text-sm">
            <div><p className="text-2xl font-bold font-display">Lead → Joining</p><p className="text-slate-400">Full funnel tracking</p></div>
          </div>
        </div>
        <p className="relative text-xs text-slate-500">© 2026 OAKsphere Connect</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">O</div>
            <span className="font-display font-bold text-lg">OAKsphere Connect</span>
          </div>
          <h2 className="text-2xl font-bold font-display text-slate-900">Welcome back</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">Sign in to your recruitment workspace.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input data-testid="login-email-input" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@oaksphere.com" className="mt-1" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input data-testid="login-password-input" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" required />
            </div>
            {error && <p data-testid="login-error" className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
            <Button data-testid="login-submit-btn" type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 h-11">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick demo login</p>
            <div className="grid gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  data-testid={`demo-login-${d.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                  onClick={() => quick(d)}
                  type="button"
                  className="flex items-center gap-2 text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <PhoneCall className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">{d.label}</span>
                  <span className="ml-auto text-[11px] text-slate-400">tap to fill</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
