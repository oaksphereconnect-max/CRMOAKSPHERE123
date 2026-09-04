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

export const FINAL_STATUSES = ["Selected", "Joined", "Rejected", "Not Interested", "Invalid Lead", "Closed", "Lost", "Duplicate", "Wrong Number"];
export const isFinal = (s) => FINAL_STATUSES.includes(s);
export const REASON_STATUSES = ["Lost", "Rejected", "Not Interested"];
export const LOST_REASONS = ["Not Interested", "Salary", "Location", "Already Joined", "Job Mismatch", "Invalid Number", "No Response", "Client Rejection", "Other"];

export function toLocalInput(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export function tomorrow10Local() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInput(d);
}

export function waLink(phone, text) {
  let digits = (phone || "").replace(/[^\d]/g, "");
  if (digits.length === 10) digits = "91" + digits;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function TagChip({ tag, onRemove, testid }) {
  return (
    <span data-testid={testid} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border"
      style={{ borderColor: tag.color || "#94a3b8", color: tag.color || "#475569", backgroundColor: `${tag.color || "#94a3b8"}14` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color || "#94a3b8" }} />
      {tag.name}
      {onRemove && <button onClick={onRemove} className="ml-0.5 hover:opacity-70" aria-label={`Remove ${tag.name}`}>×</button>}
    </span>
  );
}
