import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LiveLogs from "./pages/LiveLogs";
import RunDetail from "./pages/RunDetail";
import RunsList from "./pages/RunsList";

export default function App(): ReactElement {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <h1 className="text-lg font-semibold tracking-tight text-white">PipelineOS</h1>
        <p className="text-sm text-slate-400">Phase 1 — self-hosted pipeline runner</p>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/runs" replace />} />
          <Route path="/runs" element={<RunsList />} />
          <Route path="/runs/:id" element={<RunDetail />} />
          <Route path="/runs/:id/logs" element={<LiveLogs />} />
        </Routes>
      </main>
    </div>
  );
}
