/* ===== MiFinanzas — App Logic ===== */
'use strict';

const ACCOUNT_META = {
    bank1:     { name: 'Cuenta Bancaria 1', icon: '🏦', cssClass: 'bank1' },
    bank2:     { name: 'Cuenta Bancaria 2', icon: '🏧', cssClass: 'bank2' },
    piggybank: { name: 'Alcancía (Dinero en casa)', icon: '🐷', cssClass: 'piggybank' },
    wallet:    { name: 'Cartera (Efectivo)', icon: '👛', cssClass: 'wallet' }
};

const STORAGE_KEY = 'mifinanzas_data';

// ── State ──
let state = loadState();

function defaultState() {
    return {
        accounts: { bank1: 0, bank2: 0, piggybank: 0, wallet: 0 },
        transactions: [] // { id, type, amount, date, category, account, note }
    };
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            // Ensure structure integrity
            if (!parsed.accounts || !parsed.transactions) return defaultState();
            return parsed;
        }
    } catch { /* ignore */ }
    return defaultState();
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ── Helpers ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const fmtDate = (d) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// ── Computed balances ──
function getAccountBalance(accountKey) {
    let balance = state.accounts[accountKey] || 0;
    for (const tx of state.transactions) {
        if (tx.account === accountKey) {
            balance += tx.type === 'income' ? tx.amount : -tx.amount;
        }
    }
    return balance;
}

function getTotalBalance() {
    return Object.keys(ACCOUNT_META).reduce((sum, key) => sum + getAccountBalance(key), 0);
}

function getTotalIncome() {
    return state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
}

function getTotalExpense() {
    return state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
}

// ── Render: Dashboard ──
function renderDashboard() {
    // Total balance
    $('#total-balance').textContent = fmt(getTotalBalance());
    $('#dash-total-income').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
        Ingresos: ${fmt(getTotalIncome())}`;
    $('#dash-total-expense').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
        Gastos: ${fmt(getTotalExpense())}`;

    // Account cards
    const grid = $('#dashboard-accounts-grid');
    grid.innerHTML = Object.entries(ACCOUNT_META).map(([key, meta]) => `
        <div class="account-card">
            <div class="account-card-icon ${meta.cssClass}">${meta.icon}</div>
            <div class="account-card-name">${meta.name}</div>
            <div class="account-card-balance">${fmt(getAccountBalance(key))}</div>
        </div>
    `).join('');

    renderRecentTransactions();
}

function renderRecentTransactions() {
    const list = $('#recent-transactions');
    const sorted = [...state.transactions].sort((a, b) => b.id.localeCompare(a.id));
    const recent = sorted.slice(0, 6);

    if (recent.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <p>No hay transacciones aún</p>
                <span>Registra tu primer ingreso o gasto para comenzar</span>
            </div>`;
        return;
    }
    list.innerHTML = recent.map(tx => buildTransactionItem(tx)).join('');
}

function buildTransactionItem(tx) {
    const isIncome = tx.type === 'income';
    const iconSvg = isIncome
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>';
    const accountName = ACCOUNT_META[tx.account]?.name || tx.account;
    const title = tx.note || tx.category;
    const meta = `${fmtDate(tx.date)} · ${accountName}`;
    return `
        <div class="transaction-item" data-id="${tx.id}">
            <div class="tx-icon ${tx.type}">${iconSvg}</div>
            <div class="tx-info">
                <div class="tx-title">${title}</div>
                <div class="tx-meta"><span>${meta}</span></div>
            </div>
            <div class="tx-amount ${tx.type}">${isIncome ? '+' : '-'}${fmt(tx.amount)}</div>
            <button class="tx-delete" data-txid="${tx.id}" title="Eliminar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>`;
}

// ── Render: Accounts Setup ──
function renderAccountsSetup() {
    const grid = $('#accounts-setup-grid');
    grid.innerHTML = Object.entries(ACCOUNT_META).map(([key, meta]) => `
        <div class="account-setup-card">
            <div class="account-card-icon ${meta.cssClass}" style="margin-bottom:12px">${meta.icon}</div>
            <h3>${meta.name}</h3>
            <div class="subtitle">Saldo inicial configurado manualmente</div>
            <div class="current-balance">Saldo actual: <strong>${fmt(getAccountBalance(key))}</strong></div>
            <label style="font-size:0.85rem;color:var(--text-secondary);font-weight:600;display:block;margin-bottom:6px">Saldo Inicial ($)</label>
            <input type="number" class="account-initial-input" data-account="${key}" value="${state.accounts[key]}" min="0" step="0.01" style="margin-bottom:8px">
            <button class="btn-save-account" data-account="${key}">Guardar</button>
        </div>
    `).join('');

    // Attach save handlers
    grid.querySelectorAll('.btn-save-account').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.account;
            const input = grid.querySelector(`input[data-account="${key}"]`);
            const val = parseFloat(input.value);
            if (isNaN(val) || val < 0) { showToast('Ingresa un monto válido', 'error'); return; }
            state.accounts[key] = val;
            saveState();
            renderAll();
            showToast(`Saldo inicial de ${ACCOUNT_META[key].name} actualizado`, 'success');
        });
    });
}

// ── Render: History ──
function renderHistory(typeFilter = 'all', accountFilter = 'all') {
    const list = $('#all-transactions');
    let txs = [...state.transactions].sort((a, b) => b.id.localeCompare(a.id));

    if (typeFilter !== 'all') txs = txs.filter(t => t.type === typeFilter);
    if (accountFilter !== 'all') txs = txs.filter(t => t.account === accountFilter);

    if (txs.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <p>No hay transacciones</p>
                <span>Ajusta los filtros o registra nuevos movimientos</span>
            </div>`;
        return;
    }
    list.innerHTML = txs.map(tx => buildTransactionItem(tx)).join('');
}

// ── Render All ──
function renderAll() {
    renderDashboard();
    renderAccountsSetup();
    renderHistory($('#filter-type').value, $('#filter-account').value);
}

// ── Navigation ──
function navigateTo(sectionId) {
    $$('.section').forEach(s => s.classList.remove('active'));
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    $(`#section-${sectionId}`).classList.add('active');
    $(`[data-section="${sectionId}"]`).classList.add('active');
    // Close mobile sidebar
    $('#sidebar').classList.remove('open');
    $('#sidebar-overlay').classList.remove('active');
}

// ── Toast ──
function showToast(msg, type = 'success') {
    const container = $('#toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconSvg = type === 'success'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    toast.innerHTML = `<span class="toast-icon">${iconSvg}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// ── Modal (delete confirmation) ──
let pendingDeleteId = null;

function showDeleteModal(txId) {
    pendingDeleteId = txId;
    $('#modal-overlay').classList.add('active');
}

function hideDeleteModal() {
    pendingDeleteId = null;
    $('#modal-overlay').classList.remove('active');
}

function confirmDelete() {
    if (!pendingDeleteId) return;
    state.transactions = state.transactions.filter(t => t.id !== pendingDeleteId);
    saveState();
    renderAll();
    showToast('Transacción eliminada', 'success');
    hideDeleteModal();
}

// ── Form Handlers ──
function handleIncomeSubmit(e) {
    e.preventDefault();
    const amount = parseFloat($('#income-amount').value);
    const date = $('#income-date').value;
    const origin = $('#income-origin').value;
    const dest = $('#income-destination').value;
    const note = $('#income-note').value.trim();

    if (!amount || amount <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
    if (!date) { showToast('Selecciona una fecha', 'error'); return; }

    state.transactions.push({
        id: genId(),
        type: 'income',
        amount,
        date,
        category: origin,
        account: dest,
        note: note || origin
    });
    saveState();
    renderAll();
    e.target.reset();
    $('#income-date').value = todayStr();
    showToast(`Ingreso de ${fmt(amount)} registrado`, 'success');
    navigateTo('dashboard');
}

function handleExpenseSubmit(e) {
    e.preventDefault();
    const amount = parseFloat($('#expense-amount').value);
    const date = $('#expense-date').value;
    const category = $('#expense-category').value;
    const source = $('#expense-source').value;
    const note = $('#expense-note').value.trim();

    if (!amount || amount <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
    if (!date) { showToast('Selecciona una fecha', 'error'); return; }

    // Check sufficient balance
    const currentBalance = getAccountBalance(source);
    if (amount > currentBalance) {
        showToast(`Fondos insuficientes en ${ACCOUNT_META[source].name}. Disponible: ${fmt(currentBalance)}`, 'error');
        return;
    }

    state.transactions.push({
        id: genId(),
        type: 'expense',
        amount,
        date,
        category,
        account: source,
        note: note || category
    });
    saveState();
    renderAll();
    e.target.reset();
    $('#expense-date').value = todayStr();
    showToast(`Gasto de ${fmt(amount)} registrado`, 'success');
    navigateTo('dashboard');
}

// ── Event Delegation for Delete Buttons ──
document.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.tx-delete');
    if (deleteBtn) {
        showDeleteModal(deleteBtn.dataset.txid);
    }
});

// ── Init ──
function init() {
    // Set default dates
    $('#income-date').value = todayStr();
    $('#expense-date').value = todayStr();

    // Navigation
    $$('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.section));
    });

    // Quick actions
    $('#quick-add-income').addEventListener('click', () => navigateTo('income'));
    $('#quick-add-expense').addEventListener('click', () => navigateTo('expense'));
    $('#view-all-transactions').addEventListener('click', () => navigateTo('history'));

    // Forms
    $('#income-form').addEventListener('submit', handleIncomeSubmit);
    $('#expense-form').addEventListener('submit', handleExpenseSubmit);

    // Filters
    $('#filter-type').addEventListener('change', () => renderHistory($('#filter-type').value, $('#filter-account').value));
    $('#filter-account').addEventListener('change', () => renderHistory($('#filter-type').value, $('#filter-account').value));
    $('#clear-filters').addEventListener('click', () => {
        $('#filter-type').value = 'all';
        $('#filter-account').value = 'all';
        renderHistory();
    });

    // Modal
    $('#modal-cancel').addEventListener('click', hideDeleteModal);
    $('#modal-confirm').addEventListener('click', confirmDelete);
    $('#modal-overlay').addEventListener('click', (e) => { if (e.target === $('#modal-overlay')) hideDeleteModal(); });

    // Mobile menu
    $('#menu-toggle').addEventListener('click', () => {
        $('#sidebar').classList.toggle('open');
        $('#sidebar-overlay').classList.toggle('active');
    });
    $('#sidebar-overlay').addEventListener('click', () => {
        $('#sidebar').classList.remove('open');
        $('#sidebar-overlay').classList.remove('active');
    });

    // Initial render
    renderAll();
}

document.addEventListener('DOMContentLoaded', init);
