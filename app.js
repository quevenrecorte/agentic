const STORAGE_KEY = "gmailResetMonitorAccounts";
let accounts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

const list = document.getElementById("accountList");
const emptyState = document.getElementById("emptyState");
const dialog = document.getElementById("accountDialog");
const form = document.getElementById("accountForm");
const emailInput = document.getElementById("email");
const limitDateInput = document.getElementById("limitDate");
const resetDaysInput = document.getElementById("resetDays");
const editIdInput = document.getElementById("editId");
const modalTitle = document.getElementById("modalTitle");

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getResetTime(account) {
  return new Date(account.limitDate).getTime() + Number(account.resetDays) * 86400000;
}

function getCountdown(ms) {
  if (ms <= 0) return "Ready to use";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function render() {
  const now = Date.now();
  let ready = 0;

  list.innerHTML = accounts.map(account => {
    const resetTime = getResetTime(account);
    const isReady = now >= resetTime;
    if (isReady) ready++;

    return `
      <article class="card">
        <div class="card-top">
          <div class="email">${escapeHtml(account.email)}</div>
          <span class="status ${isReady ? "ready" : "waiting"}">
            ${isReady ? "● READY" : "● WAITING"}
          </span>
        </div>

        <div class="countdown">${getCountdown(resetTime - now)}</div>
        <div class="countdown-label">${isReady ? "Weekly limit should be reset" : "Time remaining before expected reset"}</div>

        <div class="details">
          <div class="detail">
            <small>Limit fully used</small>
            <strong>${formatDate(account.limitDate)}</strong>
          </div>
          <div class="detail">
            <small>Expected reset</small>
            <strong>${formatDate(resetTime)}</strong>
          </div>
        </div>

        <div class="actions">
          <button class="secondary" onclick="editAccount('${account.id}')">Edit</button>
          <button class="danger" onclick="deleteAccount('${account.id}')">Delete</button>
        </div>
      </article>
    `;
  }).join("");

  document.getElementById("totalCount").textContent = accounts.length;
  document.getElementById("readyCount").textContent = ready;
  document.getElementById("limitedCount").textContent = accounts.length - ready;
  emptyState.hidden = accounts.length > 0;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function openAdd() {
  form.reset();
  editIdInput.value = "";
  resetDaysInput.value = "7";
  modalTitle.textContent = "Add Gmail";
  dialog.showModal();
}

window.editAccount = function(id) {
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  editIdInput.value = account.id;
  emailInput.value = account.email;
  limitDateInput.value = account.limitDate;
  resetDaysInput.value = account.resetDays;
  modalTitle.textContent = "Edit Gmail";
  dialog.showModal();
};

window.deleteAccount = function(id) {
  if (!confirm("Delete this Gmail account from the monitor?")) return;
  accounts = accounts.filter(a => a.id !== id);
  save();
  render();
};

form.addEventListener("submit", event => {
  event.preventDefault();

  const data = {
    id: editIdInput.value || crypto.randomUUID(),
    email: emailInput.value.trim(),
    limitDate: limitDateInput.value,
    resetDays: Number(resetDaysInput.value)
  };

  const index = accounts.findIndex(a => a.id === data.id);
  if (index >= 0) accounts[index] = data;
  else accounts.push(data);

  save();
  dialog.close();
  render();
});

document.getElementById("addBtn").addEventListener("click", openAdd);
document.getElementById("emptyAddBtn").addEventListener("click", openAdd);
document.getElementById("closeBtn").addEventListener("click", () => dialog.close());
document.getElementById("cancelBtn").addEventListener("click", () => dialog.close());

render();
setInterval(render, 1000);
