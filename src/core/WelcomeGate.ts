/**
 * Welcome / signature gate shown before the arcade. Ana and Elene must EACH
 * sign their own name to acknowledge a friendly debt of 5 litres of draught
 * Paulaner beer owed to the host.
 *
 * Signatures live in a SHARED store (Vercel Blob via /api/signatures), so they
 * sync across devices: Ana signs on her phone, Elene on hers — and once both
 * have signed, every phone (theirs and the host's) unlocks the games. Each
 * person plays on their own phone.
 *
 * Access is split by secret URL tokens so nobody can act as anyone else:
 *   ?signer=anushkushkushka  → Ana's signing page (signs as Ana, then plays)
 *   ?signer=elenikobeleniko  → Elene's signing page (signs as Elene, then plays)
 *   ?host=nikushakvelazemagaria → host page (sees status, plays once both sign)
 *   (anything else)          → a locked PRIVATE dead-end
 *
 * Falls back to localStorage only if the API is unreachable (e.g. local dev).
 */

interface Signer {
  key: "ana" | "elene";
  /** Secret token in this person's personal ?signer= link. */
  token: string;
  first: string;
  full: string;
}

const SIGNERS: Signer[] = [
  { key: "ana", token: "anushkushkushka", first: "Ana", full: "Ana Khuskivadze" },
  { key: "elene", token: "elenikobeleniko", first: "Elene", full: "Elene Turmanidze" },
];

/** Secret host token — only this opens the host/status page. */
const HOST_TOKEN = "nikushakvelazemagaria";

const STORE_KEY = "crash-arcade-signatures";

type SignState = { ana: boolean; elene: boolean };

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

// --- Shared store access (Vercel Blob API, localStorage fallback) -----------

function localState(): SignState {
  try {
    const arr = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    const set = new Set(Array.isArray(arr) ? arr : []);
    return { ana: set.has("ana"), elene: set.has("elene") };
  } catch {
    return { ana: false, elene: false };
  }
}

function saveLocal(state: SignState) {
  try {
    const keys = (["ana", "elene"] as const).filter((k) => state[k]);
    localStorage.setItem(STORE_KEY, JSON.stringify(keys));
  } catch { /* ignore */ }
}

async function fetchState(): Promise<SignState> {
  try {
    const res = await fetch("/api/signatures", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const state = { ana: !!data.ana, elene: !!data.elene };
    saveLocal(state);
    return state;
  } catch {
    return localState();
  }
}

async function postSign(token: string): Promise<SignState> {
  try {
    const res = await fetch("/api/signatures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signer: token }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const state = { ana: !!data.ana, elene: !!data.elene };
    saveLocal(state);
    return state;
  } catch {
    const signer = SIGNERS.find((s) => s.token === token);
    const state = localState();
    if (signer) state[signer.key] = true;
    saveLocal(state);
    return state;
  }
}

/** Show the gate, resolving once BOTH people have signed (shared store). */
export function showWelcomeGate(): Promise<void> {
  return new Promise((resolve) => {
    const params = new URLSearchParams(window.location.search);
    const signer = SIGNERS.find((s) => s.token === params.get("signer")) ?? null;
    const isHost = params.get("host") === HOST_TOKEN;

    let state: SignState = { ana: false, elene: false };
    let pollTimer: number | undefined;

    const overlay = document.createElement("div");
    overlay.className = "gate-overlay";
    document.body.appendChild(overlay);

    const bothSigned = () => state.ana && state.elene;

    const debtBlock = `
      <p class="gate-debt">
        By signing, <b>Ana Khuskivadze</b> &amp; <b>Elene Turmanidze</b>
        acknowledge that they owe <b>5 litres of draught Paulaner beer</b>.
      </p>`;

    const statusChips = () => `
      <div class="gate-progress">
        ${SIGNERS.map((s) => `
          <span class="gate-chip ${state[s.key] ? "done" : ""}">
            ${state[s.key] ? "✓" : "•"} ${s.first}
          </span>`).join("")}
      </div>`;

    const stopPolling = () => {
      if (pollTimer !== undefined) { clearInterval(pollTimer); pollTimer = undefined; }
    };
    const startPolling = () => {
      stopPolling();
      pollTimer = window.setInterval(async () => {
        state = await fetchState();
        if (bothSigned()) { stopPolling(); render(); }
      }, 4000);
    };

    const enter = () => {
      stopPolling();
      overlay.classList.add("gate-leaving");
      setTimeout(() => { overlay.remove(); resolve(); }, 450);
    };

    /** Routing: signer page, host page, or locked dead-end. */
    const render = () => {
      stopPolling();
      if (signer) return renderSigner(signer);
      if (isHost) return renderHost();
      return renderLocked();
    };

    /** A person's own page: sign (if not yet), then play once both signed. */
    function renderSigner(s: Signer) {
      const other = SIGNERS.find((o) => o.key !== s.key)!;

      // Both signed → this person can play on their phone now.
      if (bothSigned()) {
        overlay.innerHTML = `
          <div class="gate-card">
            <div class="gate-emoji">🍻</div>
            <h1 class="gate-title">READY, ${s.first.toUpperCase()}!</h1>
            <p class="gate-debt">Both signed — <b>5 litres of draught Paulaner beer</b> on the tab. Enjoy!</p>
            ${statusChips()}
            <button class="gate-enter" id="play">PLAY 🎮</button>
          </div>`;
        overlay.querySelector<HTMLButtonElement>("#play")!.addEventListener("click", enter);
        return;
      }

      // This person already signed, waiting on the other.
      if (state[s.key]) {
        overlay.innerHTML = `
          <div class="gate-card">
            <div class="gate-emoji">✅</div>
            <h1 class="gate-title">SIGNED, ${s.first.toUpperCase()}!</h1>
            ${debtBlock}
            ${statusChips()}
            <p class="gate-instructions">Waiting for <b>${other.first}</b> to sign. The game unlocks here automatically.</p>
            <button class="gate-switch" id="refresh">↻ Check again</button>
            <p class="gate-fine">Keep this page open — it'll unlock for you the moment ${other.first} signs.</p>
          </div>`;
        overlay.querySelector<HTMLButtonElement>("#refresh")!
          .addEventListener("click", async () => { state = await fetchState(); render(); });
        startPolling();
        return;
      }

      // Not signed yet → show the signature box.
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">🍺</div>
          <h1 class="gate-title">${s.first.toUpperCase()}'S SIGNATURE</h1>
          ${debtBlock}
          ${statusChips()}
          <p class="gate-instructions"><b>${s.first}</b>, sign your full name below.</p>
          <label class="gate-field">
            <span>Signature — ${s.full}</span>
            <input id="sig" type="text" autocomplete="off" spellcheck="false" placeholder="${s.full}" />
          </label>
          <div class="gate-error" id="gateError"></div>
          <button class="gate-enter" id="gateSign">SIGN AS ${s.first.toUpperCase()} 🖊️</button>
          <p class="gate-fine">This link only signs for ${s.first}. Uppercase / lowercase doesn't matter.</p>
        </div>`;

      const input = overlay.querySelector<HTMLInputElement>("#sig")!;
      const errorEl = overlay.querySelector<HTMLDivElement>("#gateError")!;
      const signBtn = overlay.querySelector<HTMLButtonElement>("#gateSign")!;
      const matches = () => norm(input.value) === norm(s.full);

      const attempt = async () => {
        if (!matches()) {
          errorEl.textContent = input.value
            ? `That doesn't match "${s.full}".`
            : `${s.first}, type your full name to sign.`;
          const card = overlay.querySelector(".gate-card") as HTMLElement;
          card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
          return;
        }
        signBtn.setAttribute("disabled", "true");
        errorEl.textContent = "Saving…";
        state = await postSign(s.token);
        errorEl.textContent = "";
        render();
      };

      signBtn.addEventListener("click", attempt);
      input.addEventListener("input", () => {
        errorEl.textContent = "";
        input.classList.toggle("good", matches() && input.value.length > 0);
      });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") attempt(); });
      input.focus();
    }

    /** Host page: read-only status; play once both have signed. */
    function renderHost() {
      if (bothSigned()) {
        overlay.innerHTML = `
          <div class="gate-card">
            <div class="gate-emoji">🍻</div>
            <h1 class="gate-title">BOTH SIGNED!</h1>
            <p class="gate-debt"><b>Ana</b> &amp; <b>Elene</b> owe <b>5 litres of draught Paulaner beer</b>. Cheers!</p>
            ${statusChips()}
            <button class="gate-enter" id="play">ENTER THE ARCADE 🎮</button>
          </div>`;
        overlay.querySelector<HTMLButtonElement>("#play")!.addEventListener("click", enter);
        return;
      }
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">🍺</div>
          <h1 class="gate-title">WELCOME TO CRASH ARCADE</h1>
          ${debtBlock}
          ${statusChips()}
          <p class="gate-instructions">Waiting for both signatures. Send each person their own link.</p>
          ${SIGNERS.map((s) => `
            <div class="gate-link-row">
              <span class="gate-link-name">${s.first}</span>
              <span class="gate-status ${state[s.key] ? "done" : ""}">
                ${state[s.key] ? "✓ signed" : "awaiting signature"}
              </span>
            </div>`).join("")}
          <button class="gate-switch" id="refresh">↻ Check again</button>
          <p class="gate-fine">This page unlocks automatically once both have signed.</p>
        </div>`;
      overlay.querySelector<HTMLButtonElement>("#refresh")!
        .addEventListener("click", async () => { state = await fetchState(); render(); });
      startPolling();
    }

    /** Plain URL / wrong path — reveals nothing useful. */
    function renderLocked() {
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">🔒</div>
          <h1 class="gate-title">PRIVATE</h1>
          <p class="gate-debt">This is a private arcade. Access is by personal link only.</p>
          <p class="gate-fine">If you were given a link, open that exact link to continue.</p>
        </div>`;
    }

    // Locked pages need no data; signer/host pages load shared state first.
    if (!signer && !isHost) { renderLocked(); return; }
    overlay.innerHTML = `<div class="gate-card"><div class="gate-emoji">🍺</div>
      <p class="gate-instructions">Loading…</p></div>`;
    fetchState().then((s) => { state = s; render(); });
  });
}
