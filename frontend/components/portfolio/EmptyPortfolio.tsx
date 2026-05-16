"use client";

import { Plus, Upload } from "lucide-react";

interface Props {
  onAddTrade: () => void;
}

export default function EmptyPortfolio({ onAddTrade }: Props) {
  return (
    <div className="vela-card flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-vela-teal/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-vela-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 13.5l4.5-4.5 3 3 4.5-4.5 4.5 4.5" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Set sail</h2>
        <p className="text-zinc-500 text-sm mt-1 max-w-sm">
          Add your first trade manually or import your transaction history from any broker.
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onAddTrade} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add a trade
        </button>
        <button className="border border-vela-border text-sm text-zinc-300 hover:text-zinc-100 px-4 py-2 rounded-md transition-colors flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Import trades
        </button>
      </div>
    </div>
  );
}
