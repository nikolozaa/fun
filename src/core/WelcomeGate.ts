/**
 * Welcome / signature gate shown before the arcade. Two people must EACH sign
 * their own name to acknowledge a friendly debt of 5 litres of draught Paulaner
 * beer owed to the host.
 *
 * No backend / no database — it works across devices via a "code relay":
 *   1. Ana opens HER link, signs → the page shows a CODE she sends to the host.
 *   2. Elene opens HER link, signs → shows a CODE she sends to the host.
 *   3. The host opens the plain page, pastes BOTH codes → the games unlock.
 *
 * Each code is a signed token (hash of a shared secret + the signer), so it
 * can't be forged by just typing a name — only that person's link can mint a
 * valid code. Once both valid codes are entered they're saved to localStorage
 * so the host doesn't re-enter them.
 *
 * Signing is split by a secret URL token so nobody can sign for the other:
 *   ?signer=anushkushkushka  → Ana's signing page (shows Ana's code)
 *   ?signer=elenikobeleniko  → Elene's signing page (shows Elene's code)
 *   (no/invalid)             → the host page to paste both codes
 */

interface Signer {
  key: "ana" | "elene";
  /** Secret token in this person's personal ?signer= link. */
  token: string;
  /** Prefix shown on their relay code, e.g. "ANA". */
  prefix: string;
  first: string;
  full: string;
}

const SIGNERS: Signer[] = [
  { key: "ana", token: "anushkushkushka", prefix: "ANA", first: "Ana", full: "Ana Khuskivadze" },
  { key: "elene", token: "elenikobeleniko", prefix: "ELE", first: "Elene", full: "Elene Turmanidze" },
];

/** Shared secret folded into every code so codes can't be guessed. */
const CODE_SECRET = "paulaner-5-litres-2026";
const STORE_KEY = "crash-arcade-unlocked";

/**
 * Secret host token. The code-entry page only appears at
 *   ?host=nikushakvelazemagaria
 * Anyone opening the plain URL (or a wrong path) hits a locked dead-end.
 */
const HOST_TOKEN = "nikushakvelazemagaria";

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Small deterministic string hash (djb2), returned as base-36. */
function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(7, "0");
}

/** The valid relay code for a given signer (e.g. "ANA-x1y2z3q"). */
function codeFor(s: Signer): string {
  return `${s.prefix}-${hash(CODE_SECRET + "|" + s.key)}`;
}

/** Does a pasted string match a given signer's valid code (case-insensitive)? */
function codeValid(s: Signer, entered: string): boolean {
  return entered.trim().toUpperCase() === codeFor(s).toUpperCase();
}

function alreadyUnlocked(): boolean {
  try { return localStorage.getItem(STORE_KEY) === "yes"; } catch { return false; }
}
function rememberUnlocked() {
  try { localStorage.setItem(STORE_KEY, "yes"); } catch { /* ignore */ }
}

/** Show the gate, resolving once both valid codes are present. */
export function showWelcomeGate(): Promise<void> {
  return new Promise((resolve) => {
    const params = new URLSearchParams(window.location.search);
    const signer = SIGNERS.find((s) => s.token === params.get("signer")) ?? null;
    const isHost = params.get("host") === HOST_TOKEN;

    const overlay = document.createElement("div");
    overlay.className = "gate-overlay";
    document.body.appendChild(overlay);

    const debtBlock = `
      <p class="gate-debt">
        By signing, <b>Ana Khuskivadze</b> &amp; <b>Elene Turmanidze</b>
        acknowledge that they owe <b>5 litres of draught Paulaner beer</b>.
      </p>`;

    const enter = () => {
      rememberUnlocked();
      overlay.classList.add("gate-leaving");
      setTimeout(() => { overlay.remove(); resolve(); }, 450);
    };

    // Routing:
    //   ?signer=<token>  → that person's signing page (mints their code)
    //   ?host=<token>    → the host code-entry page (or already-unlocked skip)
    //   anything else    → a locked dead-end (plain URL reveals nothing)
    if (signer) {
      renderSign(signer);
    } else if (isHost) {
      if (alreadyUnlocked()) renderDone();
      else renderHost();
    } else {
      renderLocked();
    }

    /** A person signs on their own link, then gets a code to send the host. */
    function renderSign(s: Signer) {
      const other = SIGNERS.find((o) => o.key !== s.key)!;
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">🍺</div>
          <h1 class="gate-title">${s.first.toUpperCase()}'S SIGNATURE</h1>
          ${debtBlock}
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

      const attempt = () => {
        if (!matches()) {
          errorEl.textContent = input.value
            ? `That doesn't match "${s.full}".`
            : `${s.first}, type your full name to sign.`;
          const card = overlay.querySelector(".gate-card") as HTMLElement;
          card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
          return;
        }
        showCode(s, other);
      };

      signBtn.addEventListener("click", attempt);
      input.addEventListener("input", () => {
        errorEl.textContent = "";
        input.classList.toggle("good", matches() && input.value.length > 0);
      });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") attempt(); });
      input.focus();
    }

    /** After signing: show the code to copy + send to the host. */
    function showCode(s: Signer, other: Signer) {
      const code = codeFor(s);
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">✅</div>
          <h1 class="gate-title">SIGNED, ${s.first.toUpperCase()}!</h1>
          <p class="gate-debt">Send this code to the host to confirm your signature:</p>
          <div class="gate-code" id="codeBox">${code}</div>
          <button class="gate-enter" id="copyBtn">📋 Copy code</button>
          <p class="gate-fine">The host enters your code and ${other.first}'s to unlock the games.</p>
        </div>`;
      const copyBtn = overlay.querySelector<HTMLButtonElement>("#copyBtn")!;
      copyBtn.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(code); copyBtn.textContent = "✓ Copied!"; }
        catch { copyBtn.textContent = "Select & copy the code above"; }
      });
    }

    /** Host page: paste both codes to unlock. */
    function renderHost() {
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">🍺</div>
          <h1 class="gate-title">WELCOME TO CRASH ARCADE</h1>
          ${debtBlock}
          <p class="gate-instructions">Enter the codes Ana &amp; Elene sent you after signing:</p>
          <label class="gate-field">
            <span>Ana's code</span>
            <input id="codeAna" type="text" autocomplete="off" spellcheck="false" placeholder="ANA-xxxxxxx" />
          </label>
          <label class="gate-field">
            <span>Elene's code</span>
            <input id="codeElene" type="text" autocomplete="off" spellcheck="false" placeholder="ELE-xxxxxxx" />
          </label>
          <div class="gate-error" id="gateError"></div>
          <button class="gate-enter" id="unlockBtn">UNLOCK THE ARCADE 🎮</button>
          <p class="gate-fine">Both codes are required. Each person's code only comes from their own signing link.</p>
        </div>`;

      const aEl = overlay.querySelector<HTMLInputElement>("#codeAna")!;
      const eEl = overlay.querySelector<HTMLInputElement>("#codeElene")!;
      const errorEl = overlay.querySelector<HTMLDivElement>("#gateError")!;
      const btn = overlay.querySelector<HTMLButtonElement>("#unlockBtn")!;
      const ana = SIGNERS[0], elene = SIGNERS[1];

      const mark = () => {
        aEl.classList.toggle("good", codeValid(ana, aEl.value));
        eEl.classList.toggle("good", codeValid(elene, eEl.value));
      };

      const attempt = () => {
        const okA = codeValid(ana, aEl.value);
        const okE = codeValid(elene, eEl.value);
        if (okA && okE) { enter(); return; }
        if (!aEl.value && !eEl.value) errorEl.textContent = "Enter both codes.";
        else if (!okA && !okE) errorEl.textContent = "Neither code is valid.";
        else if (!okA) errorEl.textContent = "Ana's code isn't valid.";
        else errorEl.textContent = "Elene's code isn't valid.";
        const card = overlay.querySelector(".gate-card") as HTMLElement;
        card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
      };

      btn.addEventListener("click", attempt);
      for (const el of [aEl, eEl]) {
        el.addEventListener("input", () => { errorEl.textContent = ""; mark(); });
        el.addEventListener("keydown", (e) => { if (e.key === "Enter") attempt(); });
      }
      aEl.focus();
    }

    /** Already unlocked on this device — quick "enter" screen. */
    function renderDone() {
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">🍻</div>
          <h1 class="gate-title">BOTH SIGNED!</h1>
          <p class="gate-debt">
            <b>Ana</b> &amp; <b>Elene</b> owe <b>5 litres of draught Paulaner beer</b>. Cheers!
          </p>
          <button class="gate-enter" id="gateEnter">ENTER THE ARCADE 🎮</button>
        </div>`;
      overlay.querySelector<HTMLButtonElement>("#gateEnter")!.addEventListener("click", enter);
    }

    /** Dead-end for the plain URL / wrong path — reveals nothing useful. */
    function renderLocked() {
      overlay.innerHTML = `
        <div class="gate-card">
          <div class="gate-emoji">🔒</div>
          <h1 class="gate-title">PRIVATE</h1>
          <p class="gate-debt">This is a private arcade. Access is by personal link only.</p>
          <p class="gate-fine">If you were given a link, open that exact link to continue.</p>
        </div>`;
    }
  });
}
