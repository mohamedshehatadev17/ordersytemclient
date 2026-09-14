(function () {
  "use strict";

  const API_BASE_URL = "https://orderingsystem.runasp.net";
  const KEYS = { access: "dispatch.accessToken", refresh: "dispatch.refreshToken", customer: "dispatch.customer", deletes: "dispatch.deleteAudit" };
  const state = {
    apiBase: API_BASE_URL,
    accessToken: localStorage.getItem(KEYS.access) || "",
    refreshToken: localStorage.getItem(KEYS.refresh) || "",
    customer: readJson(KEYS.customer, {}),
    orders: [],
    deletionAudit: readJson(KEYS.deletes, {}),
  };
  const $ = (id) => document.getElementById(id);
  const authView = $("authView"), ordersView = $("ordersView"), toast = $("toast");
  const loginForm = $("loginForm"), registerForm = $("registerForm");
  const loginNote = $("loginNote"), registerNote = $("registerNote"), orderNote = $("orderNote");
  const orderSubmit = $("orderSubmitBtn");
  const orderModal = $("orderModal"), editOrderForm = $("editOrderForm"), viewOrderDetails = $("viewOrderDetails");
  let modalOrder = null;

  function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
  function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function showToast(message, kind) { toast.textContent = message; toast.className = "toast" + (kind ? " is-" + kind : ""); toast.hidden = false; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.hidden = true; }, 3500); }
  function note(node, message, kind) { node.textContent = message || ""; node.className = "form-note" + (kind ? " is-" + kind : ""); }
  function apiUrl(path) { return state.apiBase.replace(/\/+$/, "") + path; }
  function setLoading(button, loading, text) { if (loading) { button.dataset.label = button.textContent; button.disabled = true; button.textContent = text; } else { button.disabled = false; button.textContent = button.dataset.label || button.textContent; } }
  function tokenFrom(data) { return data && (data.accessToken || data.access_token || data.token || data.jwt); }
  function refreshFrom(data) { return data && (data.refreshToken || data.refresh_token); }
  function customerFrom(data, fallbackEmail) {
    const source = data && (data.customer || data.user || data.account || data);
    const roles = data && Array.isArray(data.roles) ? data.roles : (source && Array.isArray(source.roles) ? source.roles : []);
    return { id: source && (source.customerId || source.customer_id || source.id || source.userId || ""), name: source && (source.name || source.fullName || source.customerName || source.username || fallbackEmail.split("@")[0]), email: source && (source.email || source.userEmail || fallbackEmail), roles };
  }
  function isAdmin() { return (state.customer.roles || []).some((role) => String(role).toLowerCase() === "admin"); }
  function ordersFrom(data) { if (Array.isArray(data)) return data; return (data && (data.orders || data.data || data.items)) || []; }
  function orderFields(order) {
    return { id: order.id ?? order.orderId ?? order._id ?? "-", customerId: order.customerId ?? order.customer_id ?? "", amount: order.amount ?? order.total ?? order.totalAmount ?? 0, status: order.orderStatus ?? order.status ?? "Unknown", createdAt: order.orderDate ?? order.createdAt ?? order.created_at ?? order.date ?? null, updatedAt: order.updatedAt ?? order.updated_at ?? null, isDeleted: Boolean(order.isDeleted) };
  }
  function extractId(value) { return value && (value.id || value.orderId || value.customerId || value.customer_id || value); }
  function buildOrderPayload() { return { amount: Number($("ordAmount").value) || 0 }; }
  function errorMessage(data, status) { return (data && (data.message || data.error || data.detail || data.title)) || `Request failed (${status})`; }

  async function request(path, options = {}) {
    const { method = "GET", body, auth = true, retry = true } = options;
    if (!state.apiBase) throw new Error("Set your API base URL from the top-right menu first.");
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
    let response;
    try { response = await fetch(apiUrl(path), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); } catch (_) { throw new Error("Could not reach the API. Check the URL and CORS settings."); }
    if (response.status === 401 && auth && retry && state.refreshToken && await refreshSession()) return request(path, { ...options, retry: false });
    const raw = await response.text(); let data = null;
    if (raw) { try { data = JSON.parse(raw); } catch (_) { data = raw; } }
    if (!response.ok) { const error = new Error(errorMessage(data, response.status)); error.status = response.status; throw error; }
    return data;
  }
  async function refreshSession() { try { const data = await request("/api/auth/refresh", { method: "POST", auth: false, retry: false, body: { refreshToken: state.refreshToken } }); const token = tokenFrom(data); if (!token) return false; const customer = data && (data.customerId || data.roles) ? customerFrom(data, state.customer.email || "") : state.customer; setSession(token, refreshFrom(data) || state.refreshToken, customer); return true; } catch (_) { clearSession(); return false; } }
  function setSession(access, refresh, customer) { state.accessToken = access || ""; state.refreshToken = refresh || ""; state.customer = customer || state.customer; localStorage.setItem(KEYS.access, state.accessToken); localStorage.setItem(KEYS.refresh, state.refreshToken); saveJson(KEYS.customer, state.customer); renderView(); }
  function clearSession() { state.accessToken = ""; state.refreshToken = ""; state.customer = {}; localStorage.removeItem(KEYS.access); localStorage.removeItem(KEYS.refresh); localStorage.removeItem(KEYS.customer); renderView(); }

  function activateTab(login, email) { $("tabLogin").classList.toggle("is-active", login); $("tabRegister").classList.toggle("is-active", !login); $("tabLogin").setAttribute("aria-selected", String(login)); $("tabRegister").setAttribute("aria-selected", String(!login)); loginForm.hidden = !login; registerForm.hidden = login; note(loginNote, ""); note(registerNote, ""); $("goToRegister").hidden = true; $("goToLogin").hidden = true; if (email) $(login ? "loginEmail" : "regEmail").value = email; }
  $("tabLogin").addEventListener("click", () => activateTab(true)); $("tabRegister").addEventListener("click", () => activateTab(false)); $("goToRegister").addEventListener("click", () => activateTab(false, $("loginEmail").value.trim())); $("goToLogin").addEventListener("click", () => activateTab(true, $("regEmail").value.trim()));

  loginForm.addEventListener("submit", async (event) => { event.preventDefault(); note(loginNote, ""); const button = loginForm.querySelector("button[type=submit]"); const email = $("loginEmail").value.trim(); setLoading(button, true, "Signing in..."); try { const data = await request("/api/auth/login", { method: "POST", auth: false, body: { email, password: $("loginPassword").value } }); const token = tokenFrom(data); if (!token) throw new Error("Login succeeded but no access token was returned."); setSession(token, refreshFrom(data), customerFrom(data, email)); loginForm.reset(); showToast("Signed in successfully.", "success"); } catch (error) { note(loginNote, error.status === 404 ? "No account was found for that email." : error.message, "error"); $("goToRegister").hidden = error.status === 404; } finally { setLoading(button, false); } });

  registerForm.addEventListener("submit", async (event) => { event.preventDefault(); note(registerNote, ""); const button = registerForm.querySelector("button[type=submit]"); const email = $("regEmail").value.trim(); const password = $("regPassword").value; setLoading(button, true, "Creating account..."); try { const data = await request("/api/auth/register", { method: "POST", auth: false, body: { name: $("regName").value.trim(), email, password } }); const token = tokenFrom(data); if (token) { setSession(token, refreshFrom(data), customerFrom(data, email)); } else { const login = await request("/api/auth/login", { method: "POST", auth: false, body: { email, password } }); setSession(tokenFrom(login), refreshFrom(login), customerFrom(login, email)); } registerForm.reset(); showToast("Account created successfully.", "success"); } catch (error) { note(registerNote, error.status === 409 ? "An account with that email already exists." : error.message, "error"); $("goToLogin").hidden = error.status !== 409; } finally { setLoading(button, false); } });

  async function loadOrders() { try { const customerId = String(state.customer.id || ""); const path = isAdmin() ? "/api/orders/all" : "/api/orders"; const data = await request(path); const allOrders = ordersFrom(data); state.orders = isAdmin() || !customerId ? allOrders : allOrders.filter((order) => String(order.customerId ?? order.customer_id ?? "") === customerId); renderOrders(); } catch (error) { showToast(error.message, "error"); if (error.status === 401) clearSession(); } }
  function formatMoney(value) { const amount = Number(value); return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "-"; }
  function formatDate(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  function renderOrders() { const rows = state.orders.map(orderFields).filter((order) => !order.isDeleted); $("ordersBody").innerHTML = ""; $("emptyState").hidden = rows.length > 0; $("orderCount").textContent = `${rows.length} ${rows.length === 1 ? "order" : "orders"}`; $("activeCount").textContent = rows.length; $("orderValue").textContent = formatMoney(rows.reduce((sum, order) => sum + Number(order.amount || 0), 0)); rows.forEach((order) => { const row = document.createElement("tr"); row.innerHTML = `<td>${escapeHtml(String(order.id))}</td><td>${escapeHtml(String(order.customerId))}</td><td>${formatMoney(order.amount)}</td><td>${escapeHtml(formatStatus(order.status))}</td><td>${escapeHtml(formatDate(order.createdAt))}</td><td><div class="row-actions"><button class="row-button" type="button" data-view="${escapeHtml(String(order.id))}">View</button><button class="row-button" type="button" data-edit="${escapeHtml(String(order.id))}">Edit</button><button class="row-button delete" type="button" data-delete="${escapeHtml(String(order.id))}">Delete</button></div></td>`; row.querySelector("[data-view]").addEventListener("click", () => viewOrder(order.id)); row.querySelector("[data-edit]").addEventListener("click", () => editOrder(order)); row.querySelector("[data-delete]").addEventListener("click", () => deleteOrder(order)); $("ordersBody").appendChild(row); }); updateAccessStatus(); }
  function formatStatus(status) { const statuses = { 0: "Pending", 1: "Processing", 2: "Completed", 3: "Cancelled" }; return statuses[status] ?? String(status); }
  function fillModal(order, edit) { modalOrder = order; $("modalTitle").textContent = `Order #${order.id}`; $("modalOrderId").textContent = order.id; $("modalCustomerId").textContent = order.customerId || "-"; $("modalOrderDate").textContent = formatDate(order.createdAt); $("modalAmountValue").textContent = formatMoney(order.amount); $("modalStatusValue").textContent = formatStatus(order.status); $("modalAmount").value = order.amount; $("modalStatus").value = String(order.status); editOrderForm.hidden = !edit; viewOrderDetails.hidden = edit; $("modalNote").textContent = ""; orderModal.hidden = false; }
  async function viewOrder(orderId) { try { const data = await request(`/api/orders/${encodeURIComponent(orderId)}`); fillModal(orderFields(data || state.orders.find((item) => String(orderFields(item).id) === String(orderId))), false); } catch (error) { showToast(error.message, "error"); } }
  function editOrder(order) { fillModal(order, true); }
  $("closeModal").addEventListener("click", () => { orderModal.hidden = true; });
  orderModal.addEventListener("click", (event) => { if (event.target === orderModal) orderModal.hidden = true; });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") orderModal.hidden = true; });
  editOrderForm.addEventListener("submit", async (event) => { event.preventDefault(); const amount = Number($("modalAmount").value); const status = Number($("modalStatus").value); if (!Number.isFinite(amount) || amount < 0) { note($("modalNote"), "Enter a valid amount.", "error"); return; } const button = $("saveOrderBtn"); setLoading(button, true, "Saving..."); try { await request(`/api/orders/${encodeURIComponent(modalOrder.id)}`, { method: "PUT", body: { amount, status, isDeleted: false } }); orderModal.hidden = true; showToast(`Order ${modalOrder.id} updated.`, "success"); await loadOrders(); } catch (error) { note($("modalNote"), error.message, "error"); } finally { setLoading(button, false); } });
  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function deletionKey(order) { const fields = orderFields(order); const date = fields.createdAt ? new Date(fields.createdAt).toISOString().slice(0, 10) : todayKey(); return `${state.customer.id || "customer"}:${date}`; }
  function banUntil() { const key = `until:${state.customer.id || "customer"}`; const value = Number(state.deletionAudit[key] || 0); return value > Date.now() ? value : 0; }
  function updateAccessStatus() { const until = banUntil(); const banned = Boolean(until); $("banMetric").classList.toggle("is-banned", banned); $("accessStatus").textContent = banned ? "Restricted" : "Available"; $("accessDetail").textContent = banned ? `Try again ${new Date(until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "No restrictions"; orderSubmit.disabled = banned; }
  async function deleteOrder(order) { const fields = orderFields(order); if (!confirm(`Delete order ${fields.id}?`)) return; const key = deletionKey(order); const audit = state.deletionAudit[key] || { count: 0 }; try { await request(`/api/orders/${encodeURIComponent(fields.id)}`, { method: "DELETE" }); audit.count += 1; state.deletionAudit[key] = audit; if (audit.count >= 3) state.deletionAudit[`until:${state.customer.id || "customer"}`] = Date.now() + 6 * 60 * 60 * 1000; saveJson(KEYS.deletes, state.deletionAudit); showToast(audit.count >= 3 ? "Order deleted. Ordering is restricted for 6 hours." : "Order deleted.", audit.count >= 3 ? "error" : "success"); await loadOrders(); } catch (error) { showToast(error.message, "error"); } }
  $("refreshOrders").addEventListener("click", loadOrders);
  $("orderForm").addEventListener("submit", async (event) => { event.preventDefault(); if (banUntil()) { updateAccessStatus(); showToast("Ordering is restricted for 6 hours after three same-day deletions.", "error"); return; } note(orderNote, ""); setLoading(orderSubmit, true, "Placing order..."); try { await request("/api/orders", { method: "POST", body: buildOrderPayload() }); note(orderNote, "Order placed successfully.", "success"); $("orderForm").reset(); $("ordCustomerId").value = state.customer.id || ""; await loadOrders(); } catch (error) { note(orderNote, error.message, "error"); } finally { setLoading(orderSubmit, false); updateAccessStatus(); } });

  function escapeHtml(value) { return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char])); }
  function renderView() { const signedIn = Boolean(state.accessToken); authView.hidden = signedIn; ordersView.hidden = !signedIn; if (signedIn) { $("customerName").textContent = state.customer.name || "customer"; $("customerEmail").textContent = state.customer.email || "Signed in customer"; $("customerIdLabel").textContent = state.customer.id ? `Customer ID: ${state.customer.id}` : "Customer ID unavailable"; $("customerInitial").textContent = (state.customer.name || "C").charAt(0).toUpperCase(); $("ordCustomerId").value = state.customer.id || ""; updateAccessStatus(); loadOrders(); } }
  $("signOutBtn").addEventListener("click", () => { clearSession(); showToast("Signed out."); });
  renderView();
})();
