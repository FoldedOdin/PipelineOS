import type { ReactElement } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import LiveLogs from "./pages/LiveLogs";
import Dashboard from "./pages/Dashboard";
import RemediationRules from "./pages/RemediationRules";
import RunDetail from "./pages/RunDetail";
import RunsList from "./pages/RunsList";
import RunnersList from "./pages/RunnersList";
import Login from "./pages/Login";

export default function App(): ReactElement {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-900/90 px-6 py-3.5 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20">
              <span className="font-mono text-sm font-bold text-white">⚡</span>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                PipelineOS
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              </h1>
            </div>
          </div>
          <nav className="flex items-center gap-1.5 text-sm font-medium">
            <Link
              className="rounded-lg px-3 py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              to="/runs"
            >
              Runs
            </Link>
            <Link
              className="rounded-lg px-3 py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              to="/runners"
            >
              Runners
            </Link>
            <Link
              className="rounded-lg px-3 py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              to="/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className="rounded-lg px-3 py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              to="/rules"
            >
              Rules
            </Link>
            <button
              onClick={() => {
                void (async () => {
                  const { logout } = await import("./api/auth");
                  await logout().catch(() => undefined);
                  window.location.href = "/login";
                })();
              }}
              className="ml-3 rounded-lg border border-slate-700/80 bg-slate-800/50 px-3.5 py-1.5 text-xs text-slate-300 transition-all hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/runs" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/runs" element={<RunsList />} />
          <Route path="/runs/:id" element={<RunDetail />} />
          <Route path="/runs/:id/logs" element={<LiveLogs />} />
          <Route path="/runners" element={<RunnersList />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/rules" element={<RemediationRules />} />
        </Routes>
      </main>
    </div>
  );
}
