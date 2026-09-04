import React from "react";
import { Card } from "@/components/ui/card";

export function PageHeader({ title, subtitle, children, testid }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6" data-testid={testid}>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return <div className="py-16 text-center text-slate-400 text-sm" data-testid="loading-state">{label}</div>;
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="py-16 text-center" data-testid="empty-state">
      {Icon && <Icon className="w-10 h-10 mx-auto text-slate-300 mb-3" />}
      <p className="text-slate-600 dark:text-slate-300 font-medium">{title}</p>
      {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export function KpiCard({ label, value, sub, tone = "slate", icon: Icon, testid }) {
  const tones = {
    slate: "text-slate-900 dark:text-slate-50",
    blue: "text-blue-600", green: "text-emerald-600", red: "text-rose-600",
    yellow: "text-amber-600",
  };
  return (
    <Card className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className={`text-2xl font-bold mt-1 font-display ${tones[tone]}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {Icon && <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><Icon className="w-4 h-4 text-slate-400" /></div>}
      </div>
    </Card>
  );
}
