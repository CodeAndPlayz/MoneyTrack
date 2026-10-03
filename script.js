const STORAGE_KEY = "moneytrack_data_v1";

const categories = [
  "Food",
  "Transport",
  "Bills",
  "Shopping",
  "Entertainment",
  "Health",
  "Education",
  "Salary",
  "Freelance",
  "Other"
];

const state = {
  transactions: [],
  budgets: [],
  activeSection: "dashboard",
  dashboardMonth: getCurrentMonth(),
  budgetMonth: getCurrentMonth()
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getCurrentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

const CURRENCY_INFO = {
  PHP: { locale: "en-PH", decimals: 2 },
  USD: { locale: "en-US", decimals: 2 },
  GBP: { locale: "en-GB", decimals: 2 },
  EUR: { locale: "de-DE", decimals: 2 },
  JPY: { locale: "ja-JP", decimals: 0 },
  CAD: { locale: "en-CA", decimals: 2 },
  AUD: { locale: "en-AU", decimals: 2 },
  SGD: { locale: "en-SG", decimals: 2 },
  HKD: { locale: "en-HK", decimals: 2 },
  CNY: { locale: "zh-CN", decimals: 2 },
  KRW: { locale: "ko-KR", decimals: 0 },
  INR: { locale: "en-IN", decimals: 2 }
};

function getCurrency() {
  return localStorage.getItem("moneytrack_currency") || "PHP";
}

function money(value) {
  const code = getCurrency();
  const info = CURRENCY_INFO[code] || CURRENCY_INFO.PHP;
  return new Intl.NumberFormat(info.locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals
  }).format(Number(value) || 0);
}

function shortMoney(value) {
  const code = getCurrency();
  const info = CURRENCY_INFO[code] || CURRENCY_INFO.PHP;
  return new Intl.NumberFormat(info.locale, {
    style: "currency",
    currency: code,
    notation: "compact",
    maximumFractionDigits: info.decimals ? 1 : 0
  }).format(Number(value) || 0);
}

function formatDate(dateString) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatMonth(monthString) {
  if (!monthString) return "—";
  const [year, month] = monthString.split("-");
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric"
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function convertAllAmounts(rate) {
  state.transactions.forEach(transaction => {
    transaction.amount = Number((Number(transaction.amount) * rate).toFixed(2));
  });
  state.budgets.forEach(budget => {
    budget.amount = Number((Number(budget.amount) * rate).toFixed(2));
  });
}

function setupCurrency() {
  const select = $("#currencySelect");
  const current = getCurrency();
  select.value = CURRENCY_INFO[current] ? current : "PHP";

  select.addEventListener("change", event => {
    const next = event.target.value;
    const previous = getCurrency();
    if (next === previous) return;

    if (state.transactions.length || state.budgets.length) {
      const input = prompt(`Enter the conversion rate from ${previous} to ${next}.\n\nExample: if 1 ${previous} = 62.50 ${next}, enter 62.50.`);
      if (input === null) {
        select.value = previous;
        return;
      }
      const rate = Number(input);
      if (!Number.isFinite(rate) || rate <= 0) {
        alert("Please enter a valid conversion rate greater than 0.");
        select.value = previous;
        return;
      }
      convertAllAmounts(rate);
    }

    localStorage.setItem("moneytrack_currency", next);
    saveData();
    refresh();
    showToast(`Currency changed to ${next}.`);
  });
}

function setupTheme() {
  // MoneyTrack uses dark mode only.
  document.body.classList.add("dark-mode");
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    state.transactions = [];
    state.budgets = [];
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    state.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    state.budgets = Array.isArray(parsed.budgets) ? parsed.budgets : [];
  } catch {
    state.transactions = [];
    state.budgets = [];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    transactions: state.transactions,
    budgets: state.budgets
  }));
}

function getMonthTransactions(month) {
  return state.transactions.filter((transaction) => transaction.date.startsWith(month));
}

function getTotals(transactions) {
  return transactions.reduce((totals, transaction) => {
    if (transaction.type === "income") totals.income += Number(transaction.amount);
    else totals.expense += Number(transaction.amount);
    return totals;
  }, { income: 0, expense: 0 });
}

function populateCategorySelects() {
  const transactionCategory = $("#transactionCategory");
  const budgetCategory = $("#budgetCategory");
  const categoryFilter = $("#categoryFilter");

  transactionCategory.innerHTML = categories.map(category =>
    `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
  ).join("");

  budgetCategory.innerHTML = categories
    .filter(category => !["Salary", "Freelance"].includes(category))
    .map(category =>
      `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
    ).join("");

  const currentFilter = categoryFilter.value || "all";
  categoryFilter.innerHTML = `<option value="all">All categories</option>` +
    categories.map(category =>
      `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
    ).join("");
  categoryFilter.value = categories.includes(currentFilter) ? currentFilter : "all";
}

function getMonthOptions() {
  const months = new Set([getCurrentMonth(), state.dashboardMonth, state.budgetMonth]);

  state.transactions.forEach(transaction => months.add(transaction.date.slice(0, 7)));
  state.budgets.forEach(budget => months.add(budget.month));

  const currentYear = new Date().getFullYear();
  for (let i = 0; i < 12; i++) {
    months.add(`${currentYear}-${String(i + 1).padStart(2, "0")}`);
  }

  return [...months].sort().reverse();
}

function populateMonthSelects() {
  const months = getMonthOptions();
  const dashboard = $("#dashboardMonth");
  const budget = $("#budgetMonth");
  const filter = $("#monthFilter");

  dashboard.innerHTML = months.map(month =>
    `<option value="${month}">${formatMonth(month)}</option>`
  ).join("");
  budget.innerHTML = months.map(month =>
    `<option value="${month}">${formatMonth(month)}</option>`
  ).join("");

  const currentFilter = filter.value || "all";
  filter.innerHTML = `<option value="all">All months</option>` +
    months.map(month =>
      `<option value="${month}">${formatMonth(month)}</option>`
    ).join("");

  dashboard.value = months.includes(state.dashboardMonth) ? state.dashboardMonth : months[0];
  budget.value = months.includes(state.budgetMonth) ? state.budgetMonth : months[0];
  filter.value = months.includes(currentFilter) ? currentFilter : "all";

  state.dashboardMonth = dashboard.value;
  state.budgetMonth = budget.value;
  updateDashboardMonthLabel();
}

function updateDashboardMonthLabel() {
  const label = $("#dashboardMonthLabel");
  if (label) label.textContent = formatMonth(state.dashboardMonth);
}

function shiftDashboardMonth(offset) {
  const [year, month] = state.dashboardMonth.split("-").map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  state.dashboardMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  populateMonthSelects();
  $("#dashboardMonth").value = state.dashboardMonth;
  updateDashboardMonthLabel();
  renderDashboard();
}

function renderDashboard() {
  const month = state.dashboardMonth;
  const transactions = getMonthTransactions(month);
  const totals = getTotals(transactions);
  const balance = totals.income - totals.expense;
  const savingsRate = totals.income > 0 ? ((balance / totals.income) * 100) : 0;

  $("#balanceValue").textContent = money(balance);
  $("#incomeValue").textContent = money(totals.income);
  $("#expenseValue").textContent = money(totals.expense);
  $("#savingsValue").textContent = `${Math.round(savingsRate)}%`;
  $("#incomeFoot").textContent = `${transactions.filter(t => t.type === "income").length} income transaction${transactions.filter(t => t.type === "income").length === 1 ? "" : "s"}`;
  $("#expenseFoot").textContent = `${transactions.filter(t => t.type === "expense").length} expense transaction${transactions.filter(t => t.type === "expense").length === 1 ? "" : "s"}`;

  renderCategoryChart(transactions);
  renderDashboardBudgets(month);
  renderRecentTransactions();
}

function renderCategoryChart(transactions) {
  const container = $("#categoryChart");
  const expenses = transactions.filter(t => t.type === "expense");
  const totals = {};

  expenses.forEach(transaction => {
    totals[transaction.category] = (totals[transaction.category] || 0) + Number(transaction.amount);
  });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = expenses.reduce((sum, t) => sum + Number(t.amount), 0);

  if (!entries.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">₱</div><h3>No expenses yet</h3><p>Add an expense to see your spending breakdown.</p></div>`;
    return;
  }

  container.innerHTML = entries.slice(0, 7).map(([category, amount]) => {
    const percent = total ? (amount / total) * 100 : 0;
    return `
      <div class="category-row">
        <div class="category-label-row">
          <span>${escapeHTML(category)}</span>
          <span>${money(amount)} · ${Math.round(percent)}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="width:${Math.min(percent, 100)}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function budgetSpent(category, month) {
  return getMonthTransactions(month)
    .filter(t => t.type === "expense" && t.category === category)
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

function renderDashboardBudgets(month) {
  const container = $("#dashboardBudgets");
  const budgets = state.budgets.filter(b => b.month === month).slice(0, 5);

  if (!budgets.length) {
    container.innerHTML = `<div class="empty-state"><h3>No budgets for ${escapeHTML(formatMonth(month))}</h3><p>Create a budget to track your spending.</p></div>`;
    return;
  }

  container.innerHTML = budgets.map(budget => {
    const spent = budgetSpent(budget.category, month);
    const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
    const width = Math.min(percent, 100);
    return `
      <div class="budget-item ${percent > 100 ? "over-budget" : ""}">
        <div class="budget-meta">
          <strong>${escapeHTML(budget.category)}</strong>
          <span>${money(spent)} / ${money(budget.amount)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="width:${width}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderRecentTransactions() {
  const container = $("#recentTransactions");
  const transactions = [...state.transactions]
    .sort((a, b) => `${b.date}_${b.id}`.localeCompare(`${a.date}_${a.id}`))
    .slice(0, 6);

  if (!transactions.length) {
    container.innerHTML = `<tr><td colspan="4"><div class="empty-state"><h3>No transactions</h3><p>Add your first transaction.</p></div></td></tr>`;
    return;
  }

  container.innerHTML = transactions.map(transaction => transactionRow(transaction, false)).join("");
}

function transactionRow(transaction, actions = true) {
  const initial = escapeHTML(transaction.name.trim().charAt(0).toUpperCase() || "?");
  const amountClass = transaction.type === "income" ? "amount-income" : "amount-expense";
  const prefix = transaction.type === "income" ? "+" : "−";

  return `
    <tr>
      <td>
        <div class="transaction-name">
          <div class="transaction-icon">${initial}</div>
          <div>
            <div class="transaction-title">${escapeHTML(transaction.name)}</div>
            ${transaction.note ? `<div class="transaction-note">${escapeHTML(transaction.note)}</div>` : ""}
          </div>
        </div>
      </td>
      ${actions ? `<td><span class="type-badge ${transaction.type}">${transaction.type === "income" ? "Income" : "Expense"}</span></td>` : ""}
      <td><span class="category-badge">${escapeHTML(transaction.category)}</span></td>
      <td>${formatDate(transaction.date)}</td>
      <td class="align-right ${amountClass}">${prefix}${money(transaction.amount)}</td>
      ${actions ? `
        <td class="align-right">
          <div class="action-buttons">
            <button class="icon-button edit-transaction" data-id="${transaction.id}" title="Edit">✎</button>
            <button class="icon-button delete-transaction" data-id="${transaction.id}" title="Delete">×</button>
          </div>
        </td>
      ` : ""}
    </tr>
  `;
}

function getFilteredTransactions() {
  const search = $("#searchInput").value.trim().toLowerCase();
  const type = $("#typeFilter").value;
  const category = $("#categoryFilter").value;
  const month = $("#monthFilter").value;

  return [...state.transactions]
    .filter(transaction => {
      const matchesSearch =
        !search ||
        transaction.name.toLowerCase().includes(search) ||
        transaction.category.toLowerCase().includes(search) ||
        (transaction.note || "").toLowerCase().includes(search);

      const matchesType = type === "all" || transaction.type === type;
      const matchesCategory = category === "all" || transaction.category === category;
      const matchesMonth = month === "all" || transaction.date.startsWith(month);

      return matchesSearch && matchesType && matchesCategory && matchesMonth;
    })
    .sort((a, b) => `${b.date}_${b.id}`.localeCompare(`${a.date}_${a.id}`));
}

function renderTransactions() {
  const transactions = getFilteredTransactions();
  const table = $("#transactionsTable");
  const empty = $("#transactionEmpty");

  $("#transactionCount").textContent = `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`;

  if (!transactions.length) {
    table.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  table.innerHTML = transactions.map(transaction => transactionRow(transaction, true)).join("");
}

function renderBudgetPage() {
  const month = state.budgetMonth;
  const budgets = state.budgets.filter(b => b.month === month);
  const totalBudget = budgets.reduce((sum, budget) => sum + Number(budget.amount), 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budgetSpent(budget.category, month), 0);
  const remaining = totalBudget - totalSpent;

  $("#totalBudgetValue").textContent = money(totalBudget);
  $("#totalBudgetSpent").textContent = money(totalSpent);
  $("#totalBudgetRemaining").textContent = money(remaining);

  const container = $("#budgetCards");

  if (!budgets.length) {
    container.innerHTML = `
      <article class="panel empty-state">
        <div class="empty-icon">◫</div>
        <h3>No budgets for ${escapeHTML(formatMonth(month))}</h3>
        <p>Set a monthly limit for a category to start tracking.</p>
      </article>
    `;
    return;
  }

  container.innerHTML = budgets.map(budget => {
    const spent = budgetSpent(budget.category, month);
    const percent = budget.amount ? (spent / budget.amount) * 100 : 0;
    const width = Math.min(percent, 100);
    const remainingAmount = budget.amount - spent;
    const statusClass = percent > 100 ? "over-budget" : percent >= 80 ? "near-limit" : "";

    return `
      <article class="budget-card ${statusClass}">
        <div class="budget-card-head">
          <div>
            <h3>${escapeHTML(budget.category)}</h3>
            <div class="budget-number">${money(budget.amount)} <span>/ month</span></div>
          </div>
          <div class="action-buttons">
            <button class="icon-button edit-budget" data-id="${budget.id}" title="Edit">✎</button>
            <button class="icon-button delete-budget" data-id="${budget.id}" title="Delete">×</button>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="width:${width}%"></div>
        </div>
        <div class="budget-card-foot">
          <span>${money(spent)} spent</span>
          <span>${remainingAmount >= 0 ? money(remainingAmount) + " left" : money(Math.abs(remainingAmount)) + " over"}</span>
        </div>
      </article>
    `;
  }).join("");
}

function refresh() {
  populateMonthSelects();
  renderDashboard();
  renderTransactions();
  renderBudgetPage();
}

function showSection(section) {
  state.activeSection = section;

  $$(".section").forEach(el => el.classList.remove("active"));
  $(`#${section}Section`).classList.add("active");

  $$(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.section === section);
  });

  const titles = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    budget: "Budget"
  };

  $("#pageTitle").textContent = titles[section] || "Dashboard";
  $("#sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openTransactionModal(transaction = null) {
  $("#transactionModalTitle").textContent = transaction ? "Edit transaction" : "Add transaction";
  $("#transactionId").value = transaction?.id || "";
  $("#transactionName").value = transaction?.name || "";
  $("#transactionType").value = transaction?.type || "expense";
  $("#transactionAmount").value = transaction?.amount ?? "";
  $("#transactionCategory").value = transaction?.category || "Food";
  $("#transactionDate").value = transaction?.date || todayISO();
  $("#transactionNote").value = transaction?.note || "";
  $("#transactionModal").classList.remove("hidden");
  setTimeout(() => $("#transactionName").focus(), 50);
}

function closeModal(id) {
  $(`#${id}`).classList.add("hidden");
}

function openBudgetModal(budget = null) {
  $("#budgetModalTitle").textContent = budget ? "Edit budget" : "Add budget";
  $("#budgetId").value = budget?.id || "";
  $("#budgetCategory").value = budget?.category || "Food";
  $("#budgetAmount").value = budget?.amount ?? "";
  $("#budgetFormMonth").value = budget?.month || state.budgetMonth || getCurrentMonth();
  $("#budgetModal").classList.remove("hidden");
  setTimeout(() => $("#budgetAmount").focus(), 50);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2500);
}

function submitTransaction(event) {
  event.preventDefault();

  const id = $("#transactionId").value;
  const name = $("#transactionName").value.trim();
  const type = $("#transactionType").value;
  const amount = Number($("#transactionAmount").value);
  const category = $("#transactionCategory").value;
  const date = $("#transactionDate").value;
  const note = $("#transactionNote").value.trim();

  if (!name || !date || !Number.isFinite(amount) || amount <= 0) {
    showToast("Please enter valid transaction details.");
    return;
  }

  const transaction = { id: id || uid("txn"), name, type, amount, category, date, note };

  if (id) {
    const index = state.transactions.findIndex(item => item.id === id);
    if (index !== -1) state.transactions[index] = transaction;
    showToast("Transaction updated.");
  } else {
    state.transactions.push(transaction);
    showToast("Transaction added.");
  }

  saveData();
  closeModal("transactionModal");
  refresh();
}

function submitBudget(event) {
  event.preventDefault();

  const id = $("#budgetId").value;
  const category = $("#budgetCategory").value;
  const amount = Number($("#budgetAmount").value);
  const month = $("#budgetFormMonth").value;

  if (!month || !Number.isFinite(amount) || amount <= 0) {
    showToast("Please enter a valid budget.");
    return;
  }

  const duplicate = state.budgets.find(item =>
    item.category === category &&
    item.month === month &&
    item.id !== id
  );

  if (duplicate) {
    showToast("A budget for this category and month already exists.");
    return;
  }

  const budget = { id: id || uid("budget"), category, amount, month };

  if (id) {
    const index = state.budgets.findIndex(item => item.id === id);
    if (index !== -1) state.budgets[index] = budget;
    showToast("Budget updated.");
  } else {
    state.budgets.push(budget);
    showToast("Budget added.");
  }

  state.budgetMonth = month;
  state.dashboardMonth = month;
  saveData();
  closeModal("budgetModal");
  refresh();
}

function deleteTransaction(id) {
  const transaction = state.transactions.find(item => item.id === id);
  if (!transaction) return;

  if (!confirm(`Delete "${transaction.name}"?`)) return;

  state.transactions = state.transactions.filter(item => item.id !== id);
  saveData();
  refresh();
  showToast("Transaction deleted.");
}

function deleteBudget(id) {
  const budget = state.budgets.find(item => item.id === id);
  if (!budget) return;

  if (!confirm(`Delete the ${budget.category} budget?`)) return;

  state.budgets = state.budgets.filter(item => item.id !== id);
  saveData();
  refresh();
  showToast("Budget deleted.");
}

function exportCSV() {
  const rows = [
    ["id", "description", "type", "category", "amount", "date", "note"],
    ...state.transactions.map(transaction => [
      transaction.id,
      transaction.name,
      transaction.type,
      transaction.category,
      transaction.amount,
      transaction.date,
      transaction.note || ""
    ])
  ];

  const csv = rows.map(row =>
    row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")
  ).join("\n");

  downloadFile(csv, "moneytrack-transactions.csv", "text/csv;charset=utf-8");
  showToast("Transactions exported.");
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"' && line[i + 1] === '"' && quoted) {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function importCSV(file) {
  const reader = new FileReader();

  reader.onload = () => {
    const text = String(reader.result || "").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      showToast("The CSV file has no transaction rows.");
      return;
    }

    const headers = parseCSVLine(lines[0]).map(header => header.trim().toLowerCase());
    const indexOf = (name) => headers.indexOf(name);

    const nameIndex = indexOf("description");
    const typeIndex = indexOf("type");
    const categoryIndex = indexOf("category");
    const amountIndex = indexOf("amount");
    const dateIndex = indexOf("date");
    const noteIndex = indexOf("note");

    if ([nameIndex, typeIndex, categoryIndex, amountIndex, dateIndex].some(index => index === -1)) {
      showToast("CSV columns are missing or invalid.");
      return;
    }

    const imported = lines.slice(1).map(parseCSVLine).map(row => ({
      id: uid("txn"),
      name: row[nameIndex]?.trim() || "Imported transaction",
      type: row[typeIndex]?.trim() === "income" ? "income" : "expense",
      category: categories.includes(row[categoryIndex]?.trim()) ? row[categoryIndex].trim() : "Other",
      amount: Number(row[amountIndex]),
      date: row[dateIndex]?.trim(),
      note: noteIndex >= 0 ? row[noteIndex]?.trim() || "" : ""
    })).filter(transaction =>
      transaction.amount > 0 &&
      transaction.date &&
      /^\d{4}-\d{2}-\d{2}$/.test(transaction.date)
    );

    state.transactions.push(...imported);
    saveData();
    refresh();
    showToast(`${imported.length} transaction${imported.length === 1 ? "" : "s"} imported.`);
  };

  reader.readAsText(file);
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function resetData() {
  if (!confirm("Clear all MoneyTrack data? Your transactions and budgets will be permanently removed from this browser.")) return;

  state.transactions = [];
  state.budgets = [];
  localStorage.removeItem(STORAGE_KEY);
  refresh();
  showToast("All data cleared.");
}

function setupEvents() {
  $$(".nav-item").forEach(item => {
    item.addEventListener("click", () => showSection(item.dataset.section));
  });

  $$("[data-section-link]").forEach(button => {
    button.addEventListener("click", () => showSection(button.dataset.sectionLink));
  });

  $("#quickAddBtn").addEventListener("click", () => openTransactionModal());
  $("#transactionsAddBtn").addEventListener("click", () => openTransactionModal());
  $("#budgetAddBtn").addEventListener("click", () => openBudgetModal());

  $("#dashboardMonth").addEventListener("change", event => {
    state.dashboardMonth = event.target.value;
    updateDashboardMonthLabel();
    renderDashboard();
  });

  $("#prevMonthBtn").addEventListener("click", () => shiftDashboardMonth(-1));
  $("#nextMonthBtn").addEventListener("click", () => shiftDashboardMonth(1));
  $("#monthPickerBtn").addEventListener("click", () => {
    const picker = $("#dashboardMonth");
    if (typeof picker.showPicker === "function") picker.showPicker();
    else {
      picker.focus();
      picker.click();
    }
  });

  $("#budgetMonth").addEventListener("change", event => {
    state.budgetMonth = event.target.value;
    renderBudgetPage();
  });

  ["searchInput", "typeFilter", "categoryFilter", "monthFilter"].forEach(id => {
    $(`#${id}`).addEventListener("input", renderTransactions);
    $(`#${id}`).addEventListener("change", renderTransactions);
  });

  $("#clearFiltersBtn").addEventListener("click", () => {
    $("#searchInput").value = "";
    $("#typeFilter").value = "all";
    $("#categoryFilter").value = "all";
    $("#monthFilter").value = "all";
    renderTransactions();
  });

  $("#exportBtn").addEventListener("click", exportCSV);
  $("#importBtn").addEventListener("click", () => $("#csvInput").click());

  $("#csvInput").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) importCSV(file);
    event.target.value = "";
  });

  $("#transactionForm").addEventListener("submit", submitTransaction);
  $("#budgetForm").addEventListener("submit", submitBudget);

  $("#transactionsTable").addEventListener("click", event => {
    const editButton = event.target.closest(".edit-transaction");
    const deleteButton = event.target.closest(".delete-transaction");

    if (editButton) {
      const transaction = state.transactions.find(item => item.id === editButton.dataset.id);
      if (transaction) openTransactionModal(transaction);
    }

    if (deleteButton) deleteTransaction(deleteButton.dataset.id);
  });

  $("#budgetCards").addEventListener("click", event => {
    const editButton = event.target.closest(".edit-budget");
    const deleteButton = event.target.closest(".delete-budget");

    if (editButton) {
      const budget = state.budgets.find(item => item.id === editButton.dataset.id);
      if (budget) openBudgetModal(budget);
    }

    if (deleteButton) deleteBudget(deleteButton.dataset.id);
  });

  $$(".close-button, [data-close-modal]").forEach(button => {
    button.addEventListener("click", () => closeModal(button.dataset.closeModal));
  });

  $$(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) backdrop.classList.add("hidden");
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $$(".modal-backdrop").forEach(modal => modal.classList.add("hidden"));
    }
  });

  $("#resetDataBtn").addEventListener("click", resetData);
  $("#mobileMenuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  document.addEventListener("click", event => {
    const link = event.target.closest("[data-section-link]");
    if (link) showSection(link.dataset.sectionLink);
  });
}

function init() {
  $("#todayLabel").textContent = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date());

  loadData();
  populateCategorySelects();
  setupCurrency();
  setupTheme();
  setupEvents();
  refresh();
}

init();
