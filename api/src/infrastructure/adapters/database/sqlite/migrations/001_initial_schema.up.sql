-- 001_initial_schema.up.sql
-- PipelineOS SQLite Relational Schema
-- Every DTO field used for filtering, joins, or sorting is a first-class column.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pipelines (
  pipeline_id TEXT PRIMARY KEY,
  ref_sha TEXT NOT NULL,
  raw_yaml TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  event TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER,
  last_heartbeat_at TEXT,
  claimed_by TEXT,
  claim_expires_at TEXT,
  remediation_history_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_pipeline_id ON runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_claimed_by ON runs(claimed_by);
CREATE INDEX IF NOT EXISTS idx_runs_claim_expires_at ON runs(claim_expires_at);

CREATE TABLE IF NOT EXISTS stages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  image TEXT NOT NULL DEFAULT '',
  command TEXT NOT NULL DEFAULT '',
  exit_code INTEGER,
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER,
  logs TEXT NOT NULL DEFAULT '',
  metrics_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(run_id, name)
);

CREATE INDEX IF NOT EXISTS idx_stages_run_id ON stages(run_id);
CREATE INDEX IF NOT EXISTS idx_stages_status ON stages(status);

CREATE TABLE IF NOT EXISTS remediation_rules (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  pipeline_id TEXT,
  stage_name TEXT,
  match_json TEXT NOT NULL DEFAULT '{}',
  action_json TEXT NOT NULL DEFAULT '{}',
  auto_json TEXT NOT NULL DEFAULT '{}',
  stats_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remediation_rules_enabled ON remediation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_remediation_rules_pipeline_id ON remediation_rules(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_remediation_rules_stage_name ON remediation_rules(stage_name);

CREATE TABLE IF NOT EXISTS runner_registrations (
  id TEXT PRIMARY KEY,
  runner_id TEXT NOT NULL UNIQUE,
  last_heartbeat_at TEXT NOT NULL,
  status TEXT NOT NULL,
  version TEXT,
  hostname TEXT,
  platform TEXT,
  active_runs INTEGER NOT NULL DEFAULT 0,
  max_concurrent_runs INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runner_registrations_runner_id ON runner_registrations(runner_id);
CREATE INDEX IF NOT EXISTS idx_runner_registrations_status ON runner_registrations(status);
CREATE INDEX IF NOT EXISTS idx_runner_registrations_last_heartbeat ON runner_registrations(last_heartbeat_at);

CREATE TABLE IF NOT EXISTS stage_flakiness_records (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  outcomes_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(pipeline_id, stage_name)
);

CREATE INDEX IF NOT EXISTS idx_stage_flakiness_pipeline_id ON stage_flakiness_records(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_stage_flakiness_updated_at ON stage_flakiness_records(updated_at);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL UNIQUE,
  event TEXT NOT NULL,
  pipeline_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivery_id ON webhook_deliveries(delivery_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pipeline_id ON webhook_deliveries(pipeline_id);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(run_id, stage_name, name)
);

CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_stage_name ON artifacts(stage_name);
