export interface ILogStorageAdapter {
  append(runId: string, stageName: string, chunk: string): Promise<void>;
  read(runId: string, stageName: string): Promise<string>;
  delete(runId: string): Promise<boolean>;
}
