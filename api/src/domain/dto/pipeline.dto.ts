export interface PipelineDTO {
  pipelineId: string; // {owner}/{repo}
  refSha: string;
  rawYaml: string;
  updatedAt: Date;
}

export interface CreatePipelineInput {
  pipelineId: string;
  refSha: string;
  rawYaml: string;
}

export interface UpdatePipelineInput {
  refSha?: string;
  rawYaml?: string;
  updatedAt?: Date;
}
