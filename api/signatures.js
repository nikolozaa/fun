// Shared signature store for the welcome gate, backed by Vercel Blob (free
// tier). All devices read/write the same blob so signatures + the master
// on/off switch sync across phones.
//
// Requires BLOB_READ_WRITE_TOKEN in the project env (created by connecting /
// rotating the Blob store credentials in the Vercel dashboard).
//
// State shape: { ana: bool, elene: bool, enabled: bool }
//   - ana / elene  : whether each person has signed
//   - enabled      : master switch. When false, NOBODY can play even if both
//                    signed. Defaults to true.
//
// Endpoints:
//   GET  /api/signatures                       → state
//   POST /api/signatures { signer }            → record a signature (secret token)
//   POST /api/signatures { admin, enabled }    → flip the master switch (admin token)

import { put, list } from "@vercel/blob";

const BLOB_PATH = "crash-arcade/signatures.json";

// Secret link tokens → stable signer key.
const TOKEN_TO_KEY = {
  anushkushkushka: "ana",
  elenikobeleniko: "elene",
};

// Secret admin token (the ?host=adminivarbichooe link) allowed to flip enabled.
const ADMIN_TOKEN = "adminivarbichooe";

const DEFAULT = { ana: false, elene: false, enabled: true };

/** Read the current state from the blob (defaults if it doesn't exist yet). */
async function readState() {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH });
    const found = blobs.find((b) => b.pathname === BLOB_PATH) || blobs[0];
    if (!found) return { ...DEFAULT };
    const res = await fetch(`${found.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { ...DEFAULT };
    const data = await res.json();
    return {
      ana: !!data.ana,
      elene: !!data.elene,
      // Missing `enabled` (old data) is treated as enabled.
      enabled: data.enabled === undefined ? true : !!data.enabled,
    };
  } catch {
    return { ...DEFAULT };
  }
}

/** Persist the state blob (public, but it only holds a few booleans). */
async function writeState(state) {
  await put(BLOB_PATH, JSON.stringify(state), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "blob not configured" });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json(await readState());
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

      // Admin: flip the master enable/disable switch.
      if (body.admin !== undefined) {
        if (body.admin !== ADMIN_TOKEN) {
          return res.status(403).json({ error: "forbidden" });
        }
        const current = await readState();
        current.enabled = !!body.enabled;
        await writeState(current);
        return res.status(200).json(current);
      }

      // Signer: record a signature.
      const key = TOKEN_TO_KEY[body.signer];
      if (!key) return res.status(400).json({ error: "unknown signer" });
      const current = await readState();
      current[key] = true;
      await writeState(current);
      return res.status(200).json(current);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "store unavailable", detail: String(err) });
  }
}
