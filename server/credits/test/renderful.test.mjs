import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRenderful, extractOutputUrls, isDone, isFailed } from "../src/renderful.mjs";
import { jsonResponse, silentLog, testConfig } from "./helpers.mjs";

test("extractOutputUrls understands the shapes Renderful returns", () => {
  const urls = extractOutputUrls({
    outputs: ["https://a.test/1.png"],
    output: { url: "https://b.test/2.png" },
    data: { result: { download_url: "https://c.test/3.png" } },
    urls: [{ href: "https://d.test/4.png" }]
  });
  assert.deepEqual(urls.sort(), [
    "https://a.test/1.png",
    "https://b.test/2.png",
    "https://c.test/3.png",
    "https://d.test/4.png"
  ]);
  assert.deepEqual(extractOutputUrls({ outputs: ["not-a-url"] }), []);
});

test("status helpers", () => {
  assert.equal(isDone("completed"), true);
  assert.equal(isDone("PROCESSING"), false);
  assert.equal(isFailed("failed"), true);
  assert.equal(isFailed("queued"), false);
});

test("createGeneration sends the bearer key and normalises cost", async () => {
  const { config, cleanup } = testConfig();
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return jsonResponse({
      id: "gen_1",
      type: "text-to-image",
      model: "flux-dev",
      status: "queued",
      cost: 0.05,
      cost_formatted: "$0.05",
      poll_url: "https://api.renderful.ai/api/v1/generations/gen_1"
    }, 202);
  };
  try {
    const renderful = createRenderful({ config, log: silentLog, fetchImpl });
    const result = await renderful.createGeneration({
      type: "text-to-image",
      model: "flux-dev",
      prompt: "hello",
      webhook_url: "https://should-be-removed.test"
    });
    assert.equal(result.id, "gen_1");
    assert.equal(result.cost, 0.05);
    assert.equal(captured.url, "https://api.renderful.ai/api/v1/generations");
    assert.equal(captured.init.headers.Authorization, "Bearer rf_test_key");
    const sent = JSON.parse(captured.init.body);
    assert.equal(sent.prompt, "hello");
    assert.equal(sent.webhook_url, undefined);
  } finally {
    cleanup();
  }
});

test("getGeneration normalises status, cost and outputs", async () => {
  const { config, cleanup } = testConfig();
  try {
    const renderful = createRenderful({
      config,
      log: silentLog,
      fetchImpl: async () =>
        jsonResponse({
          id: "gen_1",
          status: "completed",
          cost: 0.1,
          outputs: ["https://files.test/a.png"]
        })
    });
    const result = await renderful.getGeneration("gen_1");
    assert.equal(result.status, "completed");
    assert.equal(result.cost, 0.1);
    assert.deepEqual(result.outputs, ["https://files.test/a.png"]);
    assert.equal(result.error, null);
  } finally {
    cleanup();
  }
});

test("createGeneration surfaces upstream failures", async () => {
  const { config, cleanup } = testConfig();
  try {
    const renderful = createRenderful({
      config,
      log: silentLog,
      fetchImpl: async () => jsonResponse({ error: "bad_model", message: "unknown model" }, 400)
    });
    await assert.rejects(
      renderful.createGeneration({ type: "text-to-image", model: "nope", prompt: "x" }),
      (e) => e.status === 502 && /unknown model/.test(e.message)
    );
  } finally {
    cleanup();
  }
});

test("download streams a response to disk", async () => {
  const { config, cleanup } = testConfig();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "awd-dl-"));
  try {
    const renderful = createRenderful({
      config,
      log: silentLog,
      fetchImpl: async () =>
        new Response(Buffer.from("hello-world"), {
          status: 200,
          headers: { "content-type": "image/png", "content-length": "11" }
        })
    });
    const dest = path.join(dir, "out.png");
    const result = await renderful.download("https://files.test/a.png", dest);
    assert.equal(result.bytes, 11);
    assert.equal(result.contentType, "image/png");
    assert.equal(fs.readFileSync(dest, "utf8"), "hello-world");
  } finally {
    cleanup();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("download refuses files above the size cap", async () => {
  const { config, cleanup } = testConfig();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "awd-dl-"));
  try {
    const renderful = createRenderful({
      config,
      log: silentLog,
      fetchImpl: async () => new Response(Buffer.alloc(64, 1), { status: 200 })
    });
    await assert.rejects(
      renderful.download("https://files.test/big.bin", path.join(dir, "big.bin"), { maxBytes: 8 }),
      /larger than/
    );
    assert.equal(fs.existsSync(path.join(dir, "big.bin")), false);
  } finally {
    cleanup();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
