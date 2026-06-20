/**
 * Welcome / signature gate shown before the arcade. Two people must EACH sign
 * their own name to acknowledge a friendly debt of 5 litres of draught Paulaner
 * beer owed to the host.
 *
 * Signing is split by URL so nobody can sign for the other person:
 *   ?signer=ana    → only Ana's signature box
 *   ?signer=elene  → only Elene's signature box
 *   (no/invalid)   → a landing page with both links to share + status
 *
 * A completed signature is saved to localStorage, so signing persists: if Elene
 * signs on her link but Ana hasn't on hers, the games stay locked until Ana
 * signs too. Only when BOTH are signed does the gate open.
 *
 * Built as a plain HTML overlay because it needs real text inputs, which Pixi
 * does not provide natively.
 */

interface Signer {
  /** Stable key used for persistence. */
  key: string;
  /** Secret token that goes in the ?signer= link sent to this person. */
  token: string;
  /** First name, for headings/buttons. */
  first: string;
  /** Exact full name the person must type. */
  full: string;
}

// The `token` is the secret in each person's personal link — hand the matching
// link to the right person:
//   ?signer=anushkushkushka  → Ana
//   ?signer=elenikobeleniko  → Elene
const SIGNERS: Signer[] = [
  { key: "ana", token: "anushkushkushka", first: "Ana", full: "Ana Khuskivadze" },
  { key: "elene", token: "elenikobeleniko", first: "Elene", full: "Elene Turmanidze" },
];

const STORE_KEY = "crash-arcade-signatures";

/** Normalize a signature for comparison: trim + collapse spaces + lowercase. */
function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Read the set of signer keys that have already signed (persisted). */
function loadSigned(): Set<string> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSigned(signed: Set<string>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...signed]));
  } catch {
    /* ignore storage failures — gate just won't persist */
  }
}

/**
 * Show the gate, returning a promise that resolves once BOTH people have
 * signed (across visits, via saved signatures).
 */
export function showWelcomeGate(): Promise<void> {
  return new Promise((resolve) => {
    const signed = loadSigned();
    const param = new URLSearchParams(window.location.search).get("signer");
    const signer = SIGNERS.find((s) => s.token === param) ?? null;

    const overlay = document.createElement("div");
    overlay.className = "gate-overlay";
    document.body.appendChild(overlay);

    const bothSigned = () => SIGNERS.every((s) => signed.has(s.key));

    const debtBlock = `
      <p class="gate-debt">
        By signing, <b>Ana Khuskivadze</b> &amp; <b>Elene Turmanidze</b>
        acknowledge that they owe <b>5 litres of draught Paulaner beer</b>.
      </p>`;

    const statusChips = () => `
      <div class="gate-progress">
        ${SIGNERS.map((s) => `
          <span class="gate-chip ${signed.has(s.key) ? "done" : ""}">
            ${signed.has(s.key) ? "✓" : "•"} ${s.first}
          </span>`).join("")}
      </div>`;

    /** Decide what to show: a person's signing step, the share page, or done. */
    const render = () => {
      if (bothSigned()) return renderDone();
      if (signer) return renderSign(signer);
      return renderShare();
    };

    /** A single person's signing step (only their own box). */
    const renderSign = (s: Signer) => {
      const alreadyMe = signed.has(s.key);
      const other = SIGNERS.find((o) => o.key !== s.key)!;
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">🍺</div>
          <h1 class="gate-title">${s.first.toUpperCase()}'S SIGNATURE</h1>
          ${debtBlock}
          ${statusChips()}
          ${alreadyMe
            ? `<p class="gate-instructions">You've already signed, ${s.first}. Waiting for <b>${other.first}</b> to sign on their own link.</p>`
            : `<p class="gate-instructions"><b>${s.first}</b>, sign your full name below.</p>
               <label class="gate-field">
                 <span>Signature — ${s.full}</span>
                 <input id="sig" type="text" autocomplete="off" spellcheck="false" placeholder="${s.full}" />
               </label>
               <div class="gate-error" id="gateError"></div>
               <button class="gate-enter" id="gateSign">SIGN AS ${s.first.toUpperCase()} 🖊️</button>`}
          <p class="gate-fine">This link only signs for ${s.first}. ${other.first} must sign on their own link. Uppercase / lowercase doesn't matter.</p>
        </div>`;

      if (alreadyMe) return;
      const input = overlay.querySelector<HTMLInputElement>("#sig")!;
      const errorEl = overlay.querySelector<HTMLDivElement>("#gateError")!;
      const signBtn = overlay.querySelector<HTMLButtonElement>("#gateSign")!;
      const matches = () => norm(input.value) === norm(s.full);

      const attempt = () => {
        if (matches()) {
          signed.add(s.key);
          saveSigned(signed);
          render();
          return;
        }
        errorEl.textContent = input.value
          ? `That doesn't match "${s.full}".`
          : `${s.first}, type your full name to sign.`;
        const card = overlay.querySelector(".gate-card") as HTMLElement;
        card.classList.remove("shake");
        void card.offsetWidth;
        card.classList.add("shake");
      };

      signBtn.addEventListener("click", attempt);
      input.addEventListener("input", () => {
        errorEl.textContent = "";
        input.classList.toggle("good", matches() && input.value.length > 0);
      });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") attempt(); });
      input.focus();
    };

    /** Landing page (no ?signer=): show each person's personal link + status. */
    const renderShare = () => {
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">🍺</div>
          <h1 class="gate-title">WELCOME TO CRASH ARCADE</h1>
          ${debtBlock}
          ${statusChips()}
          <p class="gate-instructions">Each person signs on their <b>own</b> private link.</p>
          ${SIGNERS.map((s) => `
            <div class="gate-link-row">
              <span class="gate-link-name">${s.first}</span>
              <span class="gate-status ${signed.has(s.key) ? "done" : ""}">
                ${signed.has(s.key) ? "✓ signed" : "awaiting signature"}
              </span>
            </div>`).join("")}
          <p class="gate-fine">Both must sign on their own links before anyone can play.</p>
        </div>`;
    };

    /** Both have signed — show the unlock button. */
    const renderDone = () => {
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">🍻</div>
          <h1 class="gate-title">BOTH SIGNED!</h1>
          <p class="gate-debt">
            <b>Ana</b> &amp; <b>Elene</b> have signed — that's
            <b>5 litres of draught Paulaner beer</b> on the tab. Cheers!
          </p>
          ${statusChips()}
          <button class="gate-enter" id="gateEnter">ENTER THE ARCADE 🎮</button>
        </div>`;
      overlay.querySelector<HTMLButtonElement>("#gateEnter")!.addEventListener("click", () => {
        overlay.classList.add("gate-leaving");
        setTimeout(() => { overlay.remove(); resolve(); }, 450);
      });
    };

    render();
  });
}
