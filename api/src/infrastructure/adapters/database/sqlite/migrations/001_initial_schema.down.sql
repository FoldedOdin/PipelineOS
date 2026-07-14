-- 001_initial_schema.down.sql
-- Drop all initial schema tables

DROP TABLE IF EXISTS artifacts;
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS stage_flakiness_records;
DROP TABLE IF EXISTS runner_registrations;
DROP TABLE IF EXISTS remediation_rules;
DROP TABLE IF EXISTS stages;
DROP TABLE IF EXISTS runs;
DROP TABLE IF EXISTS pipelines;
DROP TABLE IF EXISTS schema_migrations;
