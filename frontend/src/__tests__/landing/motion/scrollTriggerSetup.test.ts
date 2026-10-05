import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registerPlugin: vi.fn(),
  config: vi.fn(),
  plugin: { name: "ScrollTrigger" },
}));

vi.mock("gsap", () => ({ gsap: { registerPlugin: mocks.registerPlugin } }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: Object.assign(mocks.plugin, { config: mocks.config }) }));

async function evaluateModule() {
  vi.resetModules();
  await import("@/components/landing/motion/scrollTriggerSetup");
}

describe("scrollTriggerSetup", () => {
  beforeEach(() => {
    mocks.registerPlugin.mockClear();
    mocks.config.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers ScrollTrigger and refreshes only when the tab becomes visible again", async () => {
    await evaluateModule();

    expect(mocks.registerPlugin).toHaveBeenCalledTimes(1);
    expect(mocks.registerPlugin).toHaveBeenCalledWith(mocks.plugin);
    expect(mocks.config).toHaveBeenCalledTimes(1);
    expect(mocks.config).toHaveBeenCalledWith({ autoRefreshEvents: "visibilitychange" });
  });

  it("does not touch GSAP when evaluated without a browser window", async () => {
    vi.stubGlobal("window", undefined);

    await evaluateModule();

    expect(mocks.registerPlugin).not.toHaveBeenCalled();
    expect(mocks.config).not.toHaveBeenCalled();
  });
});
