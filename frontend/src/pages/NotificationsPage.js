import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { PageHeader, Loading, EmptyState } from "@/components/common";
import { fmtDate } from "@/lib/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, CheckCheck, BellOff } from "lucide-react";

export default function NotificationsPage() {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => {
    api.get("/notifications").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const readAll = async () => {
    await api.post("/notifications/read-all");
    window.dispatchEvent(new Event("oak:notif"));
    toast.success("All notifications marked read");
    load();
  };
  const readOne = async (id) => { await api.post(`/notifications/${id}/read`); window.dispatchEvent(new Event("oak:notif")); load(); };

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Alerts & reminders" testid="notifications-header">
        <Button variant="outline" size="sm" data-testid="mark-all-read-btn" onClick={readAll}><CheckCheck className="w-4 h-4 mr-1" /> Mark all read</Button>
      </PageHeader>
      {rows === null ? <Loading /> : rows.length === 0 ? <EmptyState icon={BellOff} title="No notifications" /> : (
        <div className="space-y-2 max-w-2xl">
          {rows.map((n) => (
            <Card key={n.id} data-testid={`notification-${n.id}`} onClick={() => !n.read && readOne(n.id)}
              className={`p-4 flex items-start gap-3 cursor-pointer ${n.read ? "opacity-60" : "border-l-4 border-l-blue-500"}`}>
              <div className={`p-2 rounded-lg ${n.read ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-600"}`}><Bell className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm text-slate-800 dark:text-slate-100">{n.message}</p><p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(n.created_at)}</p></div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 mt-2" />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
