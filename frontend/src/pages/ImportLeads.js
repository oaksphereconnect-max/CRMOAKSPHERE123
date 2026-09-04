import { PageHeader } from "@/components/common";
import { Card } from "@/components/ui/card";
import { Upload, FileSpreadsheet, GitCompareArrows, Eye } from "lucide-react";

export default function ImportLeads() {
  return (
    <div>
      <PageHeader title="Import Leads" subtitle="CSV / XLSX bulk import" testid="import-header" />
      <Card className="p-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600"><Upload className="w-6 h-6" /></div>
          <div>
            <h3 className="font-semibold font-display text-lg text-slate-800 dark:text-slate-100">Bulk Import — Coming next round</h3>
            <p className="text-sm text-slate-500">The full import pipeline is the next planned module.</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">When ready, importing will include:</p>
        <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-blue-500" /> Upload CSV / XLSX with column mapping to lead fields</li>
          <li className="flex items-center gap-2"><GitCompareArrows className="w-4 h-4 text-amber-500" /> Duplicate phone & invalid-number detection (never silent-delete)</li>
          <li className="flex items-center gap-2"><Eye className="w-4 h-4 text-emerald-500" /> Preview before commit, then batch import with assignment</li>
        </ul>
        <p className="mt-6 text-xs text-slate-400">For now, add leads individually from the All Leads page, or use the seeded demo data.</p>
      </Card>
    </div>
  );
}
