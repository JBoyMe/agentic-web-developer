#!/usr/bin/env node
/**
 * Headless smoke test for the local Blender engine (0-credit video / 3D path).
 *
 * Finds Blender, runs scripts/blender-smoke.py, then re-parses the exported GLB
 * in Node to confirm the container is a valid glTF 2 binary with a Draco mesh
 * extension. No proxy call, no Renderful spend — the local engine must stay
 * offline, and this harness proves that path still works after an upgrade.
 *
 * Usage:
 *   node scripts/qa-blender.mjs
 *   BLENDER_BIN="C:\\Program Files\\blender.exe" node scripts/qa-blender.mjs
 *   node scripts/qa-blender.mjs --keep     (keep the render/GLB output)
 *
 * Exit 0 when the rig, the frames, the GLB and its Draco extension all check out.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADDON = path.join(ROOT, "skill/assets/cineblock_ai_blender_addon.py");
const SCRIPT = path.join(ROOT, "scripts/blender-smoke.py");
const KEEP = process.argv.includes("--keep");

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail ?? "" });
    console.log(`  \u2714 ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    console.log(`  \u2716 ${name} — ${e.message}`);
  }
}
const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

/* --------------------------------------------------------- binary discovery */
function candidates() {
  const list = [];
  if (process.env.BLENDER_BIN) list.push(process.env.BLENDER_BIN);
  list.push(process.platform === "win32" ? "blender.exe" : "blender");
  if (process.platform === "win32") {
    for (const root of [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs"),
      "E:\\Program Files",
      "D:\\Program Files"
    ]) {
      if (!root) continue;
      // Flat install: <root>\blender.exe
      list.push(path.join(root, "blender.exe"));
      // Versioned install: <root>\Blender Foundation\Blender 5.0\blender.exe
      const foundation = path.join(root, "Blender Foundation");
      if (fs.existsSync(foundation)) {
        for (const dir of fs.readdirSync(foundation)) {
          list.push(path.join(foundation, dir, "blender.exe"));
        }
      }
    }
  } else if (process.platform === "darwin") {
    list.push("/Applications/Blender.app/Contents/MacOS/Blender");
  } else {
    list.push("/usr/bin/blender", "/usr/local/bin/blender", "/snap/bin/blender", "/var/lib/flatpak/exports/bin/org.blender.Blender");
  }
  return [...new Set(list.filter(Boolean))];
}

function findBlender() {
  for (const candidate of candidates()) {
    if (!candidate.includes(path.sep) && !candidate.includes("/")) continue; // bare name: resolved by spawn/PATH
    if (fs.existsSync(candidate)) return candidate;
  }
  return process.platform === "win32" ? "blender.exe" : "blender";
}

/* ------------------------------------------------------------- GLB parsing */
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 20) throw new Error(`GLB is only ${buf.length} bytes`);
  const magic = buf.toString("ascii", 0, 4);
  if (magic !== "glTF") throw new Error(`bad magic ${JSON.stringify(magic)}`);
  const version = buf.readUInt32LE(4);
  const totalLength = buf.readUInt32LE(8);
  if (version !== 2) throw new Error(`glTF version ${version}, expected 2`);
  if (totalLength !== buf.length) throw new Error(`declared length ${totalLength} != actual ${buf.length}`);
  const chunkLength = buf.readUInt32LE(12);
  const chunkType = buf.toString("ascii", 16, 20);
  if (chunkType !== "JSON") throw new Error(`first chunk is ${chunkType}, expected JSON`);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + chunkLength));
  return { version, totalLength, json, chunks: buf.length };
}

function runBlender(bin, args) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.once("error", (e) => resolve({ code: -1, out, err: `${err}\nspawn failed: ${e.message}` }));
    child.once("close", (code) => resolve({ code, out, err }));
  });
}

/* ------------------------------------------------------------------- runner */
async function main() {
  const blender = findBlender();
  const tmpDir = KEEP
    ? path.join(ROOT, ".blender-smoke")
    : fs.mkdtempSync(path.join(os.tmpdir(), "awd-blender-"));
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(`\nBlender smoke test\n  blender ${blender}\n  add-on  ${path.relative(ROOT, ADDON)}\n  output  ${tmpDir}\n`);

  const run = await runBlender(blender, [
    "--background",
    "--factory-startup",
    "--python",
    SCRIPT,
    "--",
    tmpDir,
    ADDON
  ]);

  if (run.code === -1 || /not recognized|No such file|ENOENT/i.test(run.err)) {
    console.error(`  \u2716 Blender could not be launched: ${run.err.trim().split(/\r?\n/)[0] || "unknown error"}`);
    console.error("\n  Set BLENDER_BIN to the Blender executable, or install Blender 4.2+.\n");
    process.exitCode = 1;
    return;
  }

  const marker = /CINEBLOCK_SMOKE (\{.*\})/.exec(run.out);
  assert(run.code === 0, `Blender exited ${run.code}: ${run.err.trim().split(/\r?\n/).slice(-3).join(" | ")}`);
  assert(marker, "smoke script did not print CINEBLOCK_SMOKE (add-on import failed?)");
  const report = JSON.parse(marker[1]);

  check("Blender runs headless", () => `${report.blender} · Python ${report.python}`);
  check("add-on registers in the viewport", () => {
    assert(report.addon_registered, report.addon_error ?? "registration failed");
    return `CineBlock AI ${report.addon_version}`;
  });
  check("camera rig operator builds a target-locked camera", () => {
    assert(report.camera_created, "no scene camera");
    assert(report.camera_constraints.includes("TRACK_TO"), `constraints: ${report.camera_constraints.join(",") || "none"}`);
    assert(report.camera_dof_focus, "DOF has no focus object");
    assert(report.keyframes > 0, "no keyframes on the camera");
    return `${report.camera_lens}mm · keyframes ${report.keyframes} on ${report.fcurve_paths.join("+")}`;
  });
  check("frames are written to the output folder", () => {
    assert(report.rendered_frames.length === 3, `rendered ${report.rendered_frames.length}/3 frames`);
    const small = report.rendered_frames.filter((f, i) => report.rendered_bytes[i] < 2000);
    assert(small.length === 0, `suspiciously small frames: ${small.join(", ")}`);
    return `${report.rendered_frames.join(" ")} · ${report.rendered_bytes.join("/")} bytes`;
  });

  const glb = report.glb;
  let parsed;
  check("GLB is a valid glTF 2 binary", () => {
    parsed = readGlb(glb);
    const meshes = parsed.json.meshes?.length ?? 0;
    assert(meshes > 0, "no meshes in the GLB");
    return `${report.glb_bytes} bytes · ${meshes} meshes · ${parsed.json.nodes?.length ?? 0} nodes`;
  });
  check("GLB uses Draco compression", () => {
    const used = parsed.json.extensionsUsed ?? [];
    const required = parsed.json.extensionsRequired ?? [];
    assert(used.includes("KHR_draco_mesh_compression"), `extensionsUsed: ${used.join(",") || "none"}`);
    assert(required.includes("KHR_draco_mesh_compression"), "Draco is not declared required");
    return "KHR_draco_mesh_compression";
  });
  check("the local engine made no network call", () => {
    const addon = fs.readFileSync(ADDON, "utf8");
    const offenders = [/urllib/, /requests\./, /http\.client/, /\bsocket\b/, /subprocess/].filter((re) => re.test(addon));
    assert(offenders.length === 0, `add-on references network/subprocess APIs: ${offenders.join(", ")}`);
    return "add-on is offline · 0 credits";
  });

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed === 0 ? "PASS" : "FAIL"}  ${results.length - failed} passed, ${failed} failed`);

  if (!KEEP) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* Windows file locks are harmless here */
    }
  } else {
    console.log(`  output kept at ${tmpDir}`);
  }
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(`\nFATAL ${e.stack ?? e.message}`);
  process.exitCode = 1;
});
