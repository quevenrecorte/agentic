/* ═══════════════════════════════════════════════════════
   AGENTIC USAGE MONITOR v2.0
   Modules: Firebase Auth + Realtime DB
   Features: Agentic cooldown tracking + Email security
   ═══════════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getDatabase, ref, push, set, update, remove, onValue, serverTimestamp, query, limitToLast } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

/* ── Firebase Config ── */
const firebaseConfig = {
  apiKey: "AIzaSyA4aHl9xv_v3fFPfgQ10-T_ifJ00Frni8Y",
  authDomain: "main-128f7.firebaseapp.com",
  databaseURL: "https://main-128f7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "main-128f7",
  storageBucket: "main-128f7.firebasestorage.app",
  messagingSenderId: "50099445496",
  appId: "1:50099445496:web:382017fc1daea3ec86a50d",
  measurementId: "G-6ET6VBK9L0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = x => document.getElementById(x);

/* ── State ── */
let user = null;
let accounts = {};
let emails = {};
let privacy = localStorage.getItem("agenticPrivacy") === "true";
let activeTab = "agentic";

/* ── Helpers ── */
const esc = s => { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; };
const fmt = v => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
const fmtTime = v => new Intl.DateTimeFormat("en-PH", { timeStyle: "short", dateStyle: "short" }).format(new Date(v));

function reset(a) {
  let d = new Date(a.limitDate), p = a.period || "week";
  if (p === "month") d.setMonth(d.getMonth() + 1);
  else if (p === "custom") {
    const v = Number(a.customValue) || 1, u = a.customUnit || "days";
    if (u === "months") d.setMonth(d.getMonth() + v);
    else d.setDate(d.getDate() + v * (u === "weeks" ? 7 : 1));
  } else d.setDate(d.getDate() + 7);
  return d.getTime();
}

function localDT(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function countdown(ms) {
  if (ms <= 0) return "Available";
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return [d ? `${d}d` : "", h ? `${h}h` : "", `${m}m`].filter(Boolean).join(" ");
}

function periodLabel(a) {
  if ((a.period || "week") === "month") return "1 month";
  if (a.period === "custom") return `${a.customValue} ${a.customUnit}`;
  return "1 week";
}

/* ── Privacy ── */
function applyPrivacy() {
  document.querySelectorAll(".email").forEach(x => x.classList.toggle("privacy-blur", privacy));
  document.querySelectorAll(".email-addr").forEach(x => x.classList.toggle("privacy-blur", privacy));
  $("user").classList.toggle("privacy-blur", privacy);
  $("activitySection").classList.toggle("is-hidden", privacy);

  const icon = $("privacyIcon");
  if (icon) {
    icon.innerHTML = privacy
      ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
      : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  }
  localStorage.setItem("agenticPrivacy", privacy);
}

/* ── App Filter ── */
function refreshAppFilter() {
  const s = $("appFilter"), current = s.value;
  const names = [...new Set(Object.values(accounts).map(a => (a.agenticName || "Unspecified").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  s.innerHTML = '<option value="all">All services</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  if (names.includes(current)) s.value = current;
}

/* ── Security Score ── */
const SECURITY_FIELDS = ["sec2FA", "secTOTP", "secSMS", "secPasskey", "secRecoveryCodes", "secRecoveryEmail", "secRecoveryPhone", "secPasswordManager", "secTrustedDevices", "secBreachAlerts"];

function getSecurityScore(email) {
  let score = 0;
  SECURITY_FIELDS.forEach(f => { if (email[f]) score++; });
  return { score, max: SECURITY_FIELDS.length, pct: Math.round((score / SECURITY_FIELDS.length) * 100) };
}

function getSecurityLevel(pct) {
  if (pct >= 70) return "full";
  if (pct >= 30) return "partial";
  return "none";
}

function secBadgeHTML(id, label, icon, active) {
  if (!active) return "";
  return `<span class="sec-badge on">
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    ${esc(label)}
  </span>`;
}

/* ── Render Agentic Cards ── */
function render() {
  const n = Date.now();
  const all = Object.entries(accounts).sort(([, a], [, b]) => reset(a) - reset(b));
  const totalReady = all.filter(([, a]) => n >= reset(a)).length;
  const q = ($("search")?.value || "").toLowerCase().trim();
  const sf = $("statusFilter")?.value || "all";
  const af = $("appFilter")?.value || "all";

  const filtered = all.filter(([, a]) => {
    const ok = n >= reset(a), service = a.agenticName || "Unspecified";
    return (!q || a.email.toLowerCase().includes(q) || service.toLowerCase().includes(q))
      && (sf === "all" || (sf === "ready" && ok) || (sf === "cooldown" && !ok))
      && (af === "all" || service === af);
  });

  $("list").innerHTML = filtered.length
    ? filtered.map(([id, a]) => {
        const t = reset(a), ok = n >= t;
        return `<article class="card ${ok ? "is-ready" : "is-wait"}">
          <div class="identity">
            <div class="email">${esc(a.email)}</div>
            <span class="service-tag">${esc(a.agenticName || "Unspecified")}</span>
            <span class="period-tag">${periodLabel(a)}</span>
          </div>
          <div class="usage">
            <div class="count-line">
              <span class="count">${countdown(t - n)}</span>
              <span class="badge ${ok ? "ok" : "wait"}">${ok ? "READY" : "COOLDOWN"}</span>
            </div>
            <div class="reset-text">Resets ${fmt(t)}</div>
          </div>
          <div class="card-actions">
            <button class="btn-used btn-sm" data-used="${id}">Used</button>
            <button class="btn-edit btn-sm" data-edit="${id}">Edit</button>
            <button class="btn-delete btn-sm" data-delete="${id}">Delete</button>
          </div>
        </article>`;
      }).join("")
    : `<div class="empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>No accounts match your filters.</p>
      </div>`;

  $("total").textContent = all.length;
  $("ready").textContent = totalReady;
  $("waiting").textContent = all.length - totalReady;
  $("tabCountAgentic").textContent = all.length;
  $("filterCount").textContent = filtered.length < all.length ? `Showing ${filtered.length} of ${all.length} accounts` : "";
  applyPrivacy();
}

/* ── Render Email Security Cards ── */
function renderEmails() {
  const q = ($("emailSearch")?.value || "").toLowerCase().trim();
  const sf = $("emailSecFilter")?.value || "all";

  // Emails explicitly saved in the emails node
  const savedEmails = Object.entries(emails);
  const savedAddrs = new Set(savedEmails.map(([, e]) => (e.emailAddr || "").toLowerCase().trim()));

  // Agentic-linked: unique emails from accounts NOT already in the emails node
  const agenticLinked = [...new Set(
    Object.values(accounts)
      .map(a => (a.email || "").trim())
      .filter(addr => addr && !savedAddrs.has(addr.toLowerCase()))
  )].sort().map(addr => ([ `__linked__${addr}`, { emailAddr: addr, _linked: true } ]));

  // Merge: saved entries first (sorted), then agentic-linked
  const allSaved = savedEmails.sort(([, a], [, b]) => (a.emailAddr || "").localeCompare(b.emailAddr || ""));
  const all = [...allSaved, ...agenticLinked];

  // Filter
  const filtered = all.filter(([, e]) => {
    const { pct } = getSecurityScore(e);
    const lvl = getSecurityLevel(pct);
    const matchQ = !q || (e.emailAddr || "").toLowerCase().includes(q);
    const matchS = sf === "all"
      || (sf === "secured" && lvl === "full")
      || (sf === "partial" && lvl === "partial")
      || (sf === "none" && lvl === "none");
    return matchQ && matchS;
  });

  // Stat: only count saved emails (linked ones have no security data yet)
  const securedCount = allSaved.filter(([, e]) => getSecurityLevel(getSecurityScore(e).pct) === "full").length;
  $("secured").textContent = securedCount;
  $("tabCountEmail").textContent = all.length;
  $("emailFilterCount").textContent = filtered.length < all.length ? `Showing ${filtered.length} of ${all.length} emails` : "";

  if (!filtered.length) {
    $("emailList").innerHTML = `<div class="empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <p>${all.length ? "No emails match your filters." : "Add an email to track its security status."}</p>
    </div>`;
    return;
  }

  $("emailList").innerHTML = filtered.map(([id, e]) => {
    // ── Agentic-linked (no security data yet) ──
    if (e._linked) {
      return `<article class="email-card sec-none">
        <div class="email-card-main">
          <div class="email-linked-tag">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Synced from Agentic
          </div>
          <div class="email-addr">${esc(e.emailAddr)}</div>
          <div class="security-badges"><span class="sec-badge off">No security configured yet</span></div>
          <div class="security-score-wrap score-none">
            <div class="score-bar-bg"><div class="score-bar" style="width:0%"></div></div>
            <span class="score-label">0/10 · 0% secure</span>
          </div>
        </div>
        <div class="email-card-actions">
          <button class="btn-secure btn-sm" data-email-secure="${esc(e.emailAddr)}">Set Security</button>
        </div>
      </article>`;
    }

    // ── Saved email with security data ──
    const { score, max, pct } = getSecurityScore(e);
    const lvl = getSecurityLevel(pct);
    const scoreClass = lvl === "full" ? "score-full" : lvl === "partial" ? "score-partial" : "score-none";
    const cardClass = lvl === "full" ? "sec-full" : lvl === "partial" ? "sec-partial" : "sec-none";

    // Check if this email is also used in an agentic account
    const isLinked = Object.values(accounts).some(a => (a.email || "").toLowerCase() === (e.emailAddr || "").toLowerCase());

    const badges = [
      e.sec2FA              && "2FA",
      e.secTOTP             && "Authenticator",
      e.secSMS              && "SMS 2FA",
      e.secPasskey          && "Passkey",
      e.secRecoveryCodes    && "Backup Codes",
      e.secRecoveryEmail    && "Recovery Email",
      e.secRecoveryPhone    && "Recovery Phone",
      e.secPasswordManager  && "Pwd Manager",
      e.secTrustedDevices   && "Trusted Devices",
      e.secBreachAlerts     && "Breach Monitor",
    ].filter(Boolean);

    return `<article class="email-card ${cardClass}">
      <div class="email-card-main">
        ${isLinked ? `<div class="email-linked-tag">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Agentic account
        </div>` : ""}
        <div class="email-addr">${esc(e.emailAddr)}</div>
        ${e.emailProvider ? `<div class="email-provider">${esc(e.emailProvider)}</div>` : ""}
        <div class="security-badges">
          ${badges.length ? badges.map(lbl => `<span class="sec-badge on">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ${esc(lbl)}</span>`).join("") : `<span class="sec-badge off">No security configured</span>`}
        </div>
        <div class="security-score-wrap ${scoreClass}">
          <div class="score-bar-bg"><div class="score-bar" style="width:${pct}%"></div></div>
          <span class="score-label">${score}/${max} · ${pct}% secure</span>
        </div>
        ${e.emailNotes ? `<div class="email-notes">${esc(e.emailNotes)}</div>` : ""}
      </div>
      <div class="email-card-actions">
        <button class="btn-edit btn-sm" data-email-edit="${id}">Edit</button>
        <button class="btn-delete btn-sm" data-email-delete="${id}">Delete</button>
      </div>
    </article>`;
  }).join("");

  applyPrivacy();
}

/* ── Activity Log ── */
async function log(m) {
  if (user) await set(push(ref(db, `users/${user.uid}/activity`)), { message: m, timestamp: serverTimestamp() });
}

/* ── Auth State ── */
onAuthStateChanged(auth, u => {
  user = u;
  $("auth").classList.toggle("is-hidden", !!u);
  $("dashboard").classList.toggle("is-hidden", !u);

  if (u) {
    $("user").textContent = u.email;

    onValue(ref(db, `users/${u.uid}/accounts`), s => {
      accounts = s.val() || {};
      refreshAppFilter();
      render();
    });

    onValue(ref(db, `users/${u.uid}/emails`), s => {
      emails = s.val() || {};
      renderEmails();
    });

    onValue(query(ref(db, `users/${u.uid}/activity`), limitToLast(20)), s => {
      const a = Object.values(s.val() || {}).sort((x, y) => (y.timestamp || 0) - (x.timestamp || 0));
      $("activity").innerHTML = a.length
        ? a.map(x => `<div class="activity-item">
            <span>${esc(x.message)}</span>
            <span class="activity-time">${x.timestamp ? fmtTime(x.timestamp) : "Just now"}</span>
          </div>`).join("")
        : `<div class="activity-item" style="justify-content:center;color:var(--muted2)">No activity yet</div>`;
      applyPrivacy();
    });
  }
});

/* ── Auth Forms ── */
$("loginForm").onsubmit = async e => {
  e.preventDefault();
  try { await signInWithEmailAndPassword(auth, $("loginEmail").value, $("loginPassword").value); }
  catch { $("msg").textContent = "Sign in failed. Check your credentials."; }
};
$("register").onclick = async () => {
  try { await createUserWithEmailAndPassword(auth, $("loginEmail").value, $("loginPassword").value); }
  catch (err) { $("msg").textContent = err.message || "Registration failed."; }
};
$("logout").onclick = () => signOut(auth);

/* ── Privacy ── */
$("privacy").onclick = () => { privacy = !privacy; applyPrivacy(); };

/* ── Theme ── */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("agenticTheme", t);
  const icon = $("themeIcon");
  if (icon) {
    icon.innerHTML = t === "dark"
      ? `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
      : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
  }
}
applyTheme(localStorage.getItem("agenticTheme") || "dark");
$("theme").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

/* ── Tab Switching ── */
document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    const target = tab.dataset.tab;
    activeTab = target;
    document.querySelectorAll(".tab").forEach(t => { t.classList.toggle("active", t.dataset.tab === target); t.setAttribute("aria-selected", t.dataset.tab === target); });
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("active", p.id === `pane-${target}`));
  };
});

/* ── Agentic Modal ── */
function openAdd() {
  $("accountForm").reset();
  $("editId").value = "";
  $("limitDate").value = localDT();
  $("period").value = "week";
  $("customWrap").classList.add("is-hidden");
  $("modalTitle").textContent = "Add Account";
  $("modal").showModal();
}
$("add").onclick = openAdd;
$("cancel").onclick = $("x").onclick = () => $("modal").close();
$("period").onchange = () => $("customWrap").classList.toggle("is-hidden", $("period").value !== "custom");

$("list").onclick = async e => {
  const usedId = e.target.dataset.used;
  if (usedId) {
    const a = accounts[usedId];
    await update(ref(db, `users/${user.uid}/accounts/${usedId}`), { limitDate: localDT(), updatedAt: serverTimestamp() });
    await log(`Marked ${a.email} (${a.agenticName || "Unspecified"}) as fully used.`);
    return;
  }
  const editId = e.target.dataset.edit;
  if (editId) {
    const a = accounts[editId];
    $("editId").value = editId;
    $("email").value = a.email;
    $("agenticName").value = a.agenticName || "";
    $("limitDate").value = a.limitDate;
    $("period").value = a.period || "week";
    $("customValue").value = a.customValue || 1;
    $("customUnit").value = a.customUnit || "days";
    $("customWrap").classList.toggle("is-hidden", $("period").value !== "custom");
    $("modalTitle").textContent = "Edit Account";
    $("modal").showModal();
    return;
  }
  const delId = e.target.dataset.delete;
  if (delId && confirm("Delete this agentic account?")) {
    const a = accounts[delId];
    await remove(ref(db, `users/${user.uid}/accounts/${delId}`));
    await log(`Deleted ${a.email} (${a.agenticName || "Unspecified"}).`);
  }
};

$("accountForm").onsubmit = async e => {
  e.preventDefault();
  const id = $("editId").value;
  const data = {
    email: $("email").value.trim(),
    agenticName: $("agenticName").value.trim(),
    limitDate: $("limitDate").value,
    period: $("period").value,
    customValue: Number($("customValue").value) || 1,
    customUnit: $("customUnit").value,
    updatedAt: serverTimestamp()
  };
  if (id) await update(ref(db, `users/${user.uid}/accounts/${id}`), data);
  else { data.createdAt = serverTimestamp(); await set(push(ref(db, `users/${user.uid}/accounts`)), data); }
  await log(`${id ? "Updated" : "Added"} ${data.email} (${data.agenticName}).`);
  $("modal").close();
};

/* ── Email Security Modal ── */
function openAddEmail() {
  $("emailForm").reset();
  $("emailEditId").value = "";
  $("emailModalTitle").textContent = "Add Email";
  $("emailModal").showModal();
}
$("addEmail").onclick = openAddEmail;
$("emailCancel").onclick = $("emailX").onclick = () => $("emailModal").close();

$("emailList").onclick = async e => {
  // Edit saved email
  const editId = e.target.dataset.emailEdit;
  if (editId) {
    const em = emails[editId];
    $("emailEditId").value = editId;
    $("emailAddr").value = em.emailAddr || "";
    $("emailProvider").value = em.emailProvider || "";
    $("emailNotes").value = em.emailNotes || "";
    SECURITY_FIELDS.forEach(f => { const el = $(f); if (el) el.checked = !!em[f]; });
    $("emailModalTitle").textContent = "Edit Email Security";
    $("emailModal").showModal();
    return;
  }
  // Set security on an agentic-linked email (no saved record yet)
  const secureAddr = e.target.dataset.emailSecure;
  if (secureAddr) {
    $("emailForm").reset();
    $("emailEditId").value = "";
    $("emailAddr").value = secureAddr;
    // Pre-fill provider hint if we can find it in accounts
    const match = Object.values(accounts).find(a => (a.email || "").toLowerCase() === secureAddr.toLowerCase());
    $("emailProvider").value = match ? (match.agenticName || "") : "";
    $("emailNotes").value = "";
    SECURITY_FIELDS.forEach(f => { const el = $(f); if (el) el.checked = false; });
    $("emailModalTitle").textContent = "Set Email Security";
    $("emailModal").showModal();
    return;
  }
  // Delete saved email
  const delId = e.target.dataset.emailDelete;
  if (delId && confirm("Remove this email entry?")) {
    const em = emails[delId];
    await remove(ref(db, `users/${user.uid}/emails/${delId}`));
    await log(`Removed email ${em.emailAddr} from security monitor.`);
  }
};

$("emailForm").onsubmit = async e => {
  e.preventDefault();
  const id = $("emailEditId").value;
  const data = {
    emailAddr: $("emailAddr").value.trim(),
    emailProvider: $("emailProvider").value.trim(),
    emailNotes: $("emailNotes").value.trim(),
    updatedAt: serverTimestamp()
  };
  SECURITY_FIELDS.forEach(f => { const el = $(f); if (el) data[f] = el.checked; });
  if (id) await update(ref(db, `users/${user.uid}/emails/${id}`), data);
  else { data.createdAt = serverTimestamp(); await set(push(ref(db, `users/${user.uid}/emails`)), data); }
  await log(`${id ? "Updated" : "Added"} email security for ${data.emailAddr}.`);
  $("emailModal").close();
};

/* ── Filter Events ── */
$("search").addEventListener("input", render);
$("statusFilter").addEventListener("change", render);
$("appFilter").addEventListener("change", render);
$("emailSearch").addEventListener("input", renderEmails);
$("emailSecFilter").addEventListener("change", renderEmails);

/* ── Live countdown refresh ── */
setInterval(() => { if (user) render(); }, 30000);