import { describe, expect, it } from "vitest";
import { parsePipelineYaml } from "./yamlParser.js";

describe("parsePipelineYaml", () => {
  it("parses stages with dependencies, env, and timeout", () => {
    const pipeline = parsePipelineYaml(`
name: Node CI
on:
  - push
stages:
  - name: install
    image: node:20-alpine
    run: npm ci
    env:
      NODE_ENV: test
    timeout_minutes: 5
  - name: test
    image: node:20-alpine
    run: npm test
    depends_on:
      - install
`);

    expect(pipeline.name).toBe("Node CI");
    expect(pipeline.stages[0]).toMatchObject({
      name: "install",
      env: { NODE_ENV: "test" },
      timeout_minutes: 5,
    });
    expect(pipeline.stages[1]?.depends_on).toEqual(["install"]);
  });

  it("rejects duplicate stage names", () => {
    expect(() =>
      parsePipelineYaml(`
name: duplicate
on:
  - push
stages:
  - name: test
    image: alpine:3.20
    run: echo one
  - name: test
    image: alpine:3.20
    run: echo two
`),
    ).toThrow('duplicate stage name "test"');
  });

  it("rejects dependencies that reference missing stages", () => {
    expect(() =>
      parsePipelineYaml(`
name: missing dependency
on:
  - pull_request
stages:
  - name: build
    image: alpine:3.20
    run: echo build
    depends_on:
      - install
`),
    ).toThrow('depends_on missing stage "install"');
  });
});
