import type { ReactElement } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import LiveLogs from "./pages/LiveLogs";
import Dashboard from "./pages/Dashboard";
import RemediationRules from "./pages/RemediationRules";
import RunDetail from "./pages/RunDetail";
import RunsList from "./pages/RunsList";

export default function App(): ReactElement {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">PipelineOS</h1>
            <p className="text-sm text-slate-400">Phase 2 — intelligence (flakiness, diagnosis, trends)</p>
          </div>
          <nav className="flex gap-3 text-sm">
            <Link className="text-slate-300 hover:text-white" to="/runs">
              Runs
            </Link>
            <Link className="text-slate-300 hover:text-white" to="/dashboard">
              Dashboard
            </Link>
            <Link className="text-slate-300 hover:text-white" to="/rules">
              Rules
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/runs" replace />} />
          <Route path="/runs" element={<RunsList />} />
          <Route path="/runs/:id" element={<RunDetail />} />
          <Route path="/runs/:id/logs" element={<LiveLogs />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/rules" element={<RemediationRules />} />
        </Routes>
      </main>
    </div>
  );
}
