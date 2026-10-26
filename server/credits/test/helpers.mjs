import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.mjs";

export const silentLog = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {}
};

export const fluxDev = {
  id: "flux-dev",
  name: "Flux Dev",
  provider: "Black Forest Labs",
  type: "text-to-image",
  cost: { min: 0.025, max: 0.1 },
  dollar_cost: { min: 0.025, max: 0.1 },
  capabilities: { resolutions: ["1024*1024"] }
};

export const wan26 = {
  id: "wan-2.6",
  name: "WAN 2.6",
  provider: "Alibaba",
  type: "text-to-video",
  cost: { min: 0.5, max: 1 },
  dollar_cost: { min: 0.5, max: 1 },
  capabilities: { durations: [5, 10, 15] }
};

export const wan26i2v = {
  id: "wan-2.6-i2v",
  name: "WAN 2.6 I2V",
  provider: "Alibaba",
  type: "image-to-video",
  cost: { min: 0.5, max: 1 },
  dollar_cost: { min: 0.5, max: 1 },
  capabilities: {}
};

export function testConfig(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "awd-credits-"));
  const config = loadConfig({
    NODE_ENV: "test",
    DATA_DIR: dir,
    PUBLIC_BASE_URL: "https://proxy.test",
    FILE_SIGNING_SECRET: "5f".repeat(32),
    RENDERFUL_API_KEY: "rf_test_key",
    LICENSE_VALIDATE_URL: "",
    ALLOW_UNVERIFIED_LICENSES: "true",
    ADMIN_SECRET: "admin-secret",
    RATE_LIMIT_PER_MIN: "1000",
    ...overrides
  });
  return {
    config,
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export function catalogFetch(models) {
  return async (url) => {
    const target = String(url);
    if (target.endsWith("/models")) {
      return jsonResponse({ models, total: models.length });
    }
    throw new Error(`unexpected fetch: ${target}`);
  };
}
