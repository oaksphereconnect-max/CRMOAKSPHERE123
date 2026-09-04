import React from "react";

export const PRIORITY_CLASSES = {
  Hot: "bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold shadow-sm",
  High: "bg-orange-500 text-white font-semibold",
  Medium: "bg-amber-400 text-slate-900 font-semibold",
  Low: "bg-sky-100 text-sky-800 font-medium",
  Cold: "bg-slate-100 text-slate-600 font-normal",
};

const STATUS_MAP = {
  green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border border-amber-200",
  red: "bg-rose-50 text-rose-700 border border-rose-200",
  blue: "bg-blue-50 text-blue-700 border border-blue-200",
  grey: "bg-slate-100 text-slate-600 border border-slate-200",
};

export function statusColor(status) {
  const s = (status || "").toLowerCase();
  if (["joined", "connected", "selected", "attended", "connected–interested", "confirmed", "excellent", "target achieved"].some((x) => s.includes(x)))
    return "green";
  if (["overdue", "critical", "lost", "dropped", "rejected", "no show", "not attended", "invalid"].some((x) => s.includes(x)))
    return "red";
  if (["pending", "follow-up", "callback", "documents", "delayed", "attention", "contacted", "on hold"].some((x) => s.includes(x)))
    return "yellow";
  if (["new", "scheduled", "interview", "tomorrow", "today", "offer released", "on track", "interested"].some((x) => s.includes(x)))
    return "blue";
  return "grey";
}

export function PriorityBadge({ priority }) {
  return (
    <span data-testid={`priority-badge-${priority}`} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] tracking-wide ${PRIORITY_CLASSES[priority] || PRIORITY_CLASSES.Medium}`}>
      {priority}
    </span>
  );
}

export function StatusBadge({ status }) {
  if (!status) return <span className="text-slate-400 text-xs">—</span>;
  const c = STATUS_MAP[statusColor(status)];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${c}`}>
      {status}
    </span>
  );
}

export function fmtDate(d, withTime = true) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  const opts = withTime
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" };
  return dt.toLocaleString("en-IN", opts);
}

export function initials(name) {
  return (name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}
