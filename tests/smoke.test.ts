import { describe, it, expect } from "vitest";

describe("project scaffold", () => {
  it("boots clarinet vitest environment", () => {
    expect((globalThis as any).simnet).toBeTruthy();
  });
});

