import test from "node:test";
import assert from "node:assert/strict";
import { creditsFromUsd, createPricing, kindToTypes, normalizeCost } from "../src/pricing.mjs";
import { fluxDev, wan26, wan26i2v, catalogFetch, silentLog, testConfig } from "./helpers.mjs";

test("creditsFromUsd rounds up and never returns 0 for paid work", () => {
  assert.equal(creditsFromUsd(0, 0.05), 0);
  assert.equal(creditsFromUsd(0.025, 0.05), 1);
  assert.equal(creditsFromUsd(0.05, 0.05), 1);
  assert.equal(creditsFromUsd(0.1, 0.05), 2);
  assert.equal(creditsFromUsd(0.375, 0.05), 8);
  assert.equal(creditsFromUsd(2.82, 0.05), 57);
  assert.equal(creditsFromUsd(5.64, 0.05), 113);
});

test("normalizeCost accepts cost and dollar_cost and orders the range", () => {
  assert.deepEqual(normalizeCost({ cost: { min: 1, max: 0.5 } }), { min: 0.5, max: 1 });
  assert.deepEqual(normalizeCost({ dollar_cost: { min: 0.2 } }), { min: 0.2, max: 0.2 });
  assert.equal(normalizeCost({}), null);
});

test("quote returns a min-max range and reserves the max", async () => {
  const { config, cleanup } = testConfig();
  try {
    const pricing = createPricing({ config, log: silentLog, fetchImpl: catalogFetch([fluxDev, wan26]) });
    const q = await pricing.quote({ type: "text-to-image", model: "flux-dev" });
    assert.equal(q.known, true);
    assert.equal(q.creditUsd, 0.05);
    assert.deepEqual(q.usd, { min: 0.025, max: 0.1 });
    assert.deepEqual(q.credits, { min: 1, max: 2, reserved: 2 });

    const video = await pricing.quote({ type: "text-to-video", model: "wan-2.6", num_outputs: 2 });
    assert.deepEqual(video.usd, { min: 1, max: 2 });
    assert.deepEqual(video.credits, { min: 20, max: 40, reserved: 40 });
  } finally {
    cleanup();
  }
});

test("quote rejects unknown models and type mismatches", async () => {
  const { config, cleanup } = testConfig();
  try {
    const pricing = createPricing({ config, log: silentLog, fetchImpl: catalogFetch([wan26, wan26i2v]) });
    await assert.rejects(
      pricing.quote({ type: "text-to-image", model: "not-a-real-model" }),
      /Unknown model/
    );
    await assert.rejects(
      pricing.quote({ type: "text-to-image", model: "wan-2.6" }),
      /does not support type/
    );
  } finally {
    cleanup();
  }
});

test("the bundled fallback catalog prices models when Renderful is unreachable", async () => {
  const { config, cleanup } = testConfig();
  try {
    const pricing = createPricing({
      config,
      log: silentLog,
      fetchImpl: async () => {
        throw new Error("offline");
      }
    });
    const q = await pricing.quote({ type: "text-to-image", model: "flux-dev" });
    assert.equal(q.known, true);
    assert.deepEqual(q.credits, { min: 1, max: 2, reserved: 2 });
    assert.equal(q.source, "bundled-fallback");
  } finally {
    cleanup();
  }
});

test("the live catalog overrides the bundled prices", async () => {
  const { config, cleanup } = testConfig();
  try {
    const live = { ...fluxDev, cost: { min: 1, max: 2 } };
    const pricing = createPricing({ config, log: silentLog, fetchImpl: catalogFetch([live]) });
    const q = await pricing.quote({ type: "text-to-image", model: "flux-dev" });
    assert.deepEqual(q.credits, { min: 20, max: 40, reserved: 40 });
  } finally {
    cleanup();
  }
});

test("listModels filters by kind and includes credit prices", async () => {
  const { config, cleanup } = testConfig();
  try {
    const pricing = createPricing({ config, log: silentLog, fetchImpl: catalogFetch([fluxDev, wan26, wan26i2v]) });
    const videos = await pricing.listModels({ kind: "video" });
    assert.deepEqual(videos.map((m) => m.id).sort(), ["wan-2.6", "wan-2.6-i2v"]);
    assert.deepEqual(videos.find((m) => m.id === "wan-2.6").credits, { min: 10, max: 20 });
    const images = await pricing.listModels({ kind: "image", q: "flux" });
    assert.equal(images.length, 1);
    assert.equal(images[0].id, "flux-dev");
  } finally {
    cleanup();
  }
});

test("kindToTypes covers the Asset Builder kinds", () => {
  assert.ok(kindToTypes("image").includes("text-to-image"));
  assert.ok(kindToTypes("audio").includes("text-to-music"));
  assert.ok(kindToTypes("3d").includes("image-to-3d"));
  assert.equal(kindToTypes("nope"), undefined);
});
