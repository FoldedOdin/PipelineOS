import { container } from "../bootstrap/index.js";
import type { StageCostAggregateDTO } from "../domain/dto/index.js";

export type { StageCostAggregateDTO as StageCostAggregate };

export const costService = {
  async topStageCosts(input: {
    pipelineId: string;
    limit: number;
    days: number;
  }): Promise<StageCostAggregateDTO[]> {
    const limit = Math.min(50, Math.max(1, Math.floor(input.limit)));
    const days = Math.min(90, Math.max(1, Math.floor(input.days)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await container.persistence.runRepository.topStageCosts(input.pipelineId, limit, since);
  },
} as const;
