export type PipelineTrigger = "push" | "pull_request";

export interface PipelineStage {
  name: string;
  image: string;
  run: string;
  depends_on: string[];
  env: Record<string, string>;
  timeout_minutes: number | null;
  artifacts?: string[];
  cache?: { key: string; paths: string[] };
}

export interface PipelineDefinition {
  name: string;
  repository?: string;
  on: PipelineTrigger[];
  stages: PipelineStage[];
}

