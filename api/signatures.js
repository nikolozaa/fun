// Shared signature store for the welcome gate, backed by Vercel Blob (free
// tier). All devices read/write the same blob so signatures sync across phones
// — Ana signing on her phone becomes visible to Elene's phone and yours.
//
// Requires BLOB_READ_WRITE_TOKEN in the project env (created by connecting /
// rotating the Blob store credentials in the Vercel dashboard).
//
// Endpoints:
//   GET  /api/signatures            → { ana: bool, elene: bool }
//   POST /api/signatures { signer } → records that signer signed, returns state
//
// `signer` is the SECRET TOKEN from each person's link (not the plain name),
// so only someone holding the link can sign for that person.

import { put, list } from "@vercel/blob";

// Fixed pathname for the single state blob.
const BLOB_PATH = "crash-arcade/signatures.json";

// Map each person's secret link token → their stable signer key.
const TOKEN_TO_KEY = {
  anushkushkushka: "ana",
  elenikobeleniko: "elene",
};

const EMPTY = { ana: false, elene: false };

/** Read the current state from the blob (empty if it doesn't exist yet). */
async function readState() {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH });
    const found = blobs.find((b) => b.pathname === BLOB_PATH) || blobs[0];
    if (!found) return { ...EMPTY };
    // Cache-bust so we always read the latest write.
    const res = await fetch(`${found.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { ...EMPTY };
    const data = await res.json();
    return { ana: !!data.ana, elene: !!data.elene };
  } catch {
    return { ...EMPTY };
  }
}

/** Persist the state blob (public, but it only holds two booleans). */
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
