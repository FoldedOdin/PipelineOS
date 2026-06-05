import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App shell", () => {
  it("renders the primary dashboard navigation", () => {
    const html = renderToString(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain("PipelineOS");
    expect(html).toContain("Runs");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Rules");
    expect(html).toContain("Intelligence dashboard");
  });
});
