import crypto from "node:crypto";
import path from "node:path";
import { badRequest, notFound, unavailable } from "./errors.mjs";
import { isDone, isFailed } from "./renderful.mjs";

const MEDIA_TYPES = {
  "image-to-image": "image_url",
  "image-to-video": "image_url",
  "image-to-3d": "image_url",
  "video-to-video": "video_url",
  "audio-to-audio": "audio_url",
  "speech-to-text": "audio_url"
};

export function kindOfType(type) {
  const t = String(type ?? "").toLowerCase();
  if (t.includes("video")) return "video";
  if (t.includes("3d")) return "3d";
  if (t.includes("image")) return "image";
  if (t.includes("audio") || t.includes("music") || t.includes("speech")) return "audio";
  return "other";
}

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("Generation input must be a JSON object");
  }
  if (!input.type || typeof input.type !== "string") throw badRequest("`type` is required");
  if (!input.model || typeof input.model !== "string") throw badRequest("`model` is required");

  const textDriven = input.type.startsWith("text-to-") && input.type !== "text-to-text";
  if (textDriven && !String(input.prompt ?? "").trim()) {
    throw badRequest(`\`prompt\` is required for ${input.type}`);
  }
  if (input.type === "text-to-text" && !String(input.prompt ?? "").trim() && !Array.isArray(input.messages)) {
    throw badRequest("`prompt` or `messages` is required for text-to-text");
  }
  const mediaField = MEDIA_TYPES[input.type];
  if (mediaField && !input[mediaField] && !(Array.isArray(input.images) && input.images.length)) {
    throw badRequest(`\`${mediaField}\` is required for ${input.type}`);
  }
  const count = Number(input.num_outputs ?? 1);
  if (Number.isFinite(count) && (count < 1 || count > 10)) {
    throw badRequest("`num_outputs` must be between 1 and 10");
  }
}

const iso = (ms) => new Date(ms).toISOString();

export function createService({ config, db, pricing, renderful, storage, signedUrls, stripe, log, now = () => Date.now() }) {
  const makeId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  const packs = new Map(config.packs.map((p) => [p.id, p]));

  function packList() {
    return config.packs.map((p) => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      priceCents: p.priceCents,
      price: `$${(p.priceCents / 100).toFixed(2)}`,
      perCredit: `$${(p.priceCents / 100 / p.credits).toFixed(4)}`
    }));
  }

  function account(accountId) {
    return db.ensureAccount(accountId);
  }

  function balanceOf(accountId) {
    account(accountId);
    return { accountId, balance: db.balance(accountId), creditUsd: pricing.creditUsd };
  }

  function historyOf(accountId, limit = 50) {
    account(accountId);
    return db.history(accountId, limit);
  }

  function parseOutputs(job) {
    if (!job.outputs_json) return [];
    try {
      const parsed = JSON.parse(job.outputs_json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function publicJob(job) {
    const outputs = parseOutputs(job).map((o) => {
      let url = null;
      try {
        url = signedUrls.sign(o.path);
      } catch (e) {
        log?.warn("could not sign output url", { jobId: job.id, error: e.message });
      }
      return {
        name: path.basename(o.path),
        url,
        bytes: o.bytes ?? null,
        contentType: o.contentType ?? null,
        expiresIn: signedUrls.ttlSec
      };
    });

    return {
      id: job.id,
      status: job.status,
      type: job.type,
      model: job.model,
      providerId: job.provider_id ?? null,
      credits: {
        min: job.quote_min,
        max: job.quote_max,
        reserved: job.reserved_credits,
        charged: job.charged_credits
      },
      providerCostUsd: job.provider_cost,
      outputs,
      error: job.error ?? null,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at ?? null
    };
  }

  async function quote(accountId, input) {
    const priced = await pricing.quote(input);
    const balance = db.balance(accountId);
    return {
      quote: priced,
      balance,
      affordable: balance >= priced.credits.reserved,
      shortfall: Math.max(0, priced.credits.reserved - balance),
      packs: packList()
    };
  }

  async function createGeneration(accountId, input, { idempotencyKey } = {}) {
    validateInput(input);
    account(accountId);
    const priced = await pricing.quote(input);
    const reserved = priced.credits.reserved;
    const jobId = makeId("job");

    let job;
    try {
      job = db.tx(() => {
        if (idempotencyKey) {
          const prior = db.getJobByKey(accountId, idempotencyKey);
          if (prior) return prior;
        }
        db.debit(accountId, reserved, {
          op: "reserve",
          jobId,
          note: `${priced.model} · ${priced.type}`,
          idempotencyKey: `job:${jobId}:reserve`
        });
        return db.createJob({
          id: jobId,
          accountId,
          status: "submitting",
          type: priced.type,
          model: priced.model,
          inputJson: JSON.stringify(input),
          quoteMin: priced.credits.min,
          quoteMax: priced.credits.max,
          reservedCredits: reserved,
          chargedCredits: null,
          idempotencyKey: idempotencyKey ?? null
        });
      });
    } catch (e) {
      // A concurrent request with the same key won the unique index race.
      if (idempotencyKey && /UNIQUE/i.test(e?.message ?? "")) {
        const prior = db.getJobByKey(accountId, idempotencyKey);
        if (prior) return { job: publicJob(prior), replay: true };
      }
      throw e;
    }

    if (job.id !== jobId) return { job: publicJob(job), replay: true };

    try {
      const created = await renderful.createGeneration(input);
      job = db.updateJob(jobId, {
        providerId: created.id,
        status: created.status === "processing" ? "processing" : "queued",
        providerCost: created.cost ?? null,
        error: ""
      });
    } catch (e) {
      refundJob(db.getJob(jobId), e.message);
      throw e;
    }

    log?.info("generation submitted", {
      jobId,
      accountId,
      model: priced.model,
      type: priced.type,
      reserved,
      providerCost: job.provider_cost
    });

    return { job: publicJob(job), replay: false };
  }

  /**
   * Refunds a job's reservation exactly once and marks it failed. Safe to call
   * from the submit path, the poller, and the timeout path.
   */
  function refundJob(job, reason) {
    if (!job) return null;
    return db.tx(() => {
      const fresh = db.getJob(job.id);
      if (!fresh) return null;
      if (fresh.status === "failed" || fresh.status === "completed") return fresh;
      const refundable = fresh.charged_credits ?? fresh.reserved_credits ?? 0;
      if (refundable > 0) {
        db.credit(fresh.account_id, refundable, {
          op: "refund",
          jobId: fresh.id,
          note: reason.slice(0, 200),
          idempotencyKey: `job:${fresh.id}:refund`
        });
      }
      const failedAt = iso(now());
      return db.updateJob(fresh.id, {
        status: "failed",
        chargedCredits: 0,
        error: reason.slice(0, 1000),
        completedAt: failedAt
      });
    });
  }

  /**
   * Settles the reserved credits against Renderful's authoritative cost and
   * records the final charge. Refunds the difference when the quote was high;
   * tops up (as far as the balance allows) when the actual cost was higher.
   */
  function reconcile(job, actualUsd) {
    return db.tx(() => {
      const fresh = db.getJob(job.id);
      const reserved = fresh.reserved_credits ?? 0;
      if (!Number.isFinite(Number(actualUsd))) {
        return { charged: reserved, refunded: 0, extra: 0 };
      }
      const actualCredits = pricing.creditsFromUsd(Number(actualUsd));
      if (actualCredits < reserved) {
        const refund = reserved - actualCredits;
        db.credit(fresh.account_id, refund, {
          op: "refund",
          jobId: fresh.id,
          note: "quote reconciliation",
          idempotencyKey: `job:${fresh.id}:reconcile`
        });
        return { charged: actualCredits, refunded: refund, extra: 0 };
      }
      if (actualCredits > reserved) {
        const owed = actualCredits - reserved;
        const available = db.balance(fresh.account_id);
        const take = Math.min(owed, available);
        if (take > 0) {
          db.debit(fresh.account_id, take, {
            op: "settle",
            jobId: fresh.id,
            note: "actual cost above quote",
            idempotencyKey: `job:${fresh.id}:extra`
          });
        }
        if (take < owed) {
          log?.warn("actual cost exceeded balance during settle", {
            jobId: fresh.id,
            owed,
            chargedExtra: take
          });
        }
        return { charged: reserved + take, refunded: 0, extra: take };
      }
      return { charged: reserved, refunded: 0, extra: 0 };
    });
  }

  async function pollJob(job) {
    if (job.status === "completed" || job.status === "failed") return job;

    const timeoutMs = config.jobs.timeoutsMs[kindOfType(job.type)] ?? config.jobs.timeoutsMs.other;
    const age = now() - Date.parse(job.created_at);

    if (!job.provider_id) {
      return refundJob(job, "Generation was not submitted cleanly; credits refunded");
    }
    if (age > timeoutMs) {
      return refundJob(job, `Generation timed out after ${Math.round(timeoutMs / 1000)}s`);
    }

    let remote;
    try {
      remote = await renderful.getGeneration(job.provider_id);
    } catch (e) {
      log?.warn("generation poll failed", { jobId: job.id, error: e.message });
      return job;
    }

    if (isFailed(remote.status)) {
      return refundJob(job, remote.error || "Generation failed upstream");
    }

    if (!isDone(remote.status)) {
      return db.updateJob(job.id, {
        status: remote.status === "processing" ? "processing" : "queued"
      });
    }

    const urls = remote.outputs ?? [];
    if (urls.length === 0) {
      if (age > timeoutMs - 5000) {
        return refundJob(job, "Generation completed without any output files");
      }
      log?.warn("generation completed without outputs; retrying", { jobId: job.id });
      return db.updateJob(job.id, { status: "storing" });
    }

    db.updateJob(job.id, { status: "storing" });
    let saved;
    try {
      saved = await storage.saveOutputs({
        accountId: job.account_id,
        jobId: job.id,
        urls,
        kind: kindOfType(job.type),
        download: renderful.download
      });
      if (saved.length === 0) throw new Error("no output files were stored");
    } catch (e) {
      log?.error("output ingest failed", { jobId: job.id, error: e.message });
      return refundJob(job, `Output download failed: ${e.message}`);
    }

    const actualUsd = Number.isFinite(Number(remote.cost)) ? Number(remote.cost) : job.provider_cost;
    const settlement = reconcile(job, actualUsd);
    const finishedAt = iso(now());
    const finished = db.updateJob(job.id, {
      status: "completed",
      providerCost: Number.isFinite(Number(actualUsd)) ? Number(actualUsd) : job.provider_cost,
      outputsJson: JSON.stringify(saved),
      chargedCredits: settlement.charged,
      error: "",
      completedAt: finishedAt
    });

    log?.info("generation completed", {
      jobId: job.id,
      charged: settlement.charged,
      refunded: settlement.refunded,
      extra: settlement.extra,
      files: saved.length
    });
    return finished;
  }

  async function pollBatch() {
    const pending = db.pendingJobs(config.jobs.maxPollBatch);
    const results = await Promise.allSettled(pending.map((job) => pollJob(job)));
    for (const result of results) {
      if (result.status === "rejected") log?.warn("poll batch item failed", { error: result.reason?.message });
    }
    return pending.length;
  }

  async function getJob(accountId, jobId) {
    let job = db.getJob(jobId);
    if (!job || job.account_id !== accountId) throw notFound("Generation not found");

    if (job.status !== "completed" && job.status !== "failed") {
      const staleFor = now() - Date.parse(job.updated_at);
      if (staleFor >= config.jobs.pollMinIntervalMs) {
        await pollJob(job).catch((e) => log?.warn("on-demand poll failed", { jobId, error: e.message }));
        job = db.getJob(jobId);
      }
    }
    return publicJob(job);
  }

  function listJobs(accountId, limit = 20) {
    return db.recentJobs(accountId, limit).map(publicJob);
  }

  async function createCheckout(accountId, packId, { customerEmail } = {}) {
    account(accountId);
    const pack = packs.get(String(packId ?? ""));
    if (!pack) {
      throw badRequest(`Unknown credit pack "${packId}"`, { packs: config.packs.map((p) => p.id) });
    }

    const intent = db.createIntent({
      accountId,
      packId: pack.id,
      credits: pack.credits,
      priceCents: pack.priceCents
    });

    if (stripe?.configured) {
      const session = await stripe.createCheckoutSession({ intent, accountId, pack, customerEmail });
      db.attachSession(intent.id, session.id);
      return {
        intentId: intent.id,
        provider: "stripe",
        url: session.url,
        sessionId: session.id,
        pack: packList().find((p) => p.id === pack.id)
      };
    }

    if (config.checkoutFallbackUrl) {
      return {
        intentId: intent.id,
        provider: "external",
        url: config.checkoutFallbackUrl,
        creditedAutomatically: false,
        note: "This checkout is not connected to the proxy; credits are applied by the store operator.",
        pack: packList().find((p) => p.id === pack.id)
      };
    }

    throw unavailable("No credit checkout is configured");
  }

  /**
   * Read-only status for the post-checkout landing page. The Stripe session id is
   * the only credential needed: it is unguessable and reveals no account details,
   * just the pack the visitor just bought and whether the webhook has landed.
   */
  function checkoutStatus(sessionId) {
    const intent = db.getIntentBySession(sessionId);
    if (!intent) return null;
    const pack = packs.get(intent.pack_id);
    return {
      status: intent.status,
      packId: intent.pack_id,
      packName: pack?.name ?? intent.pack_id,
      credits: intent.credits,
      priceCents: intent.price_cents,
      paidAt: intent.paid_at ?? null
    };
  }

  /**
   * Applies a verified Stripe event. Idempotent by event id and by intent id,
   * so duplicate webhook deliveries cannot double-credit an account.
   */
  async function handleStripeEvent(event) {
    if (db.webhookSeen(event.id)) return { duplicate: true, granted: 0 };

    if (!stripe.paidEvents.has(event.type)) {
      db.recordWebhook(event.id, event.type);
      return { ignored: event.type, granted: 0 };
    }

    const session = event.data?.object ?? {};
    if (event.type === "checkout.session.completed" && session.payment_status && session.payment_status !== "paid") {
      db.recordWebhook(event.id, event.type);
      return { pending: true, granted: 0 };
    }

    const intentId = session.metadata?.intent_id || session.client_reference_id;
    if (!intentId) {
      db.recordWebhook(event.id, event.type);
      log?.error("stripe webhook is missing a checkout intent id", { eventId: event.id });
      return { ignored: "missing_intent", granted: 0 };
    }
    const intent = db.getIntent(intentId);
    if (!intent) {
      db.recordWebhook(event.id, event.type);
      log?.error("stripe webhook references an unknown checkout intent", { eventId: event.id, intentId });
      return { ignored: "unknown_intent", granted: 0 };
    }

    const paidAmount = Number(session.amount_total ?? session.amount_received);
    if (Number.isFinite(paidAmount) && paidAmount !== intent.price_cents) {
      db.recordWebhook(event.id, event.type);
      log?.error("stripe amount does not match the pack price", {
        eventId: event.id,
        intentId,
        paidAmount,
        expected: intent.price_cents
      });
      return { ignored: "amount_mismatch", granted: 0 };
    }

    const outcome = db.tx(() => {
      const fresh = db.getIntent(intentId);
      if (!fresh) return { granted: 0 };
      if (fresh.status === "paid") {
        db.recordWebhook(event.id, event.type);
        return { alreadyCredited: true, granted: 0 };
      }
      if (!db.markIntentPaid(intentId)) {
        db.recordWebhook(event.id, event.type);
        return { alreadyCredited: true, granted: 0 };
      }
      const result = db.credit(fresh.account_id, fresh.credits, {
        op: "purchase",
        packId: fresh.pack_id,
        note: `stripe ${event.type} ${event.id}`,
        idempotencyKey: `intent:${intentId}`
      });
      db.recordWebhook(event.id, event.type);
      return { granted: fresh.credits, balance: result.balance };
    });

    if (outcome.granted > 0) {
      log?.info("credits purchased", { intentId, credits: outcome.granted, balance: outcome.balance });
    }
    return outcome;
  }

  function adminGrant({ accountId, credits, note, idempotencyKey }) {
    if (!accountId || typeof accountId !== "string") throw badRequest("`accountId` is required");
    const amount = Number.parseInt(credits, 10);
    if (!Number.isInteger(amount) || amount <= 0) throw badRequest("`credits` must be a positive integer");
    account(accountId);
    const result = db.credit(accountId, amount, {
      op: "admin",
      note: note ?? "admin grant",
      idempotencyKey: idempotencyKey ?? null
    });
    log?.info("admin credit grant", { accountId, credits: amount, balance: result.balance });
    return { accountId, balance: result.balance, credited: amount, replayed: Boolean(result.replayed) };
  }

  async function models(filters) {
    return pricing.listModels(filters);
  }

  return {
    packs: packList,
    account,
    balanceOf,
    historyOf,
    quote,
    createGeneration,
    getJob,
    listJobs,
    pollJob,
    pollBatch,
    refundJob,
    createCheckout,
    checkoutStatus,
    handleStripeEvent,
    adminGrant,
    models,
    publicJob
  };
}
