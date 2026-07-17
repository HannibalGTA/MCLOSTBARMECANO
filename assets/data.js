// =========================================================
// DATA — couche d'accès Supabase (items, ventes, achats)
// domain: "bar" | "mecano"
// =========================================================

function itemsTable(domain) {
  return domain === "bar" ? "bar_items" : "mecano_items";
}
function salesTable(domain) {
  return domain === "bar" ? "bar_sales" : "mecano_sales";
}
function saleLinesTable(domain) {
  return domain === "bar" ? "bar_sale_lines" : "mecano_sale_lines";
}

// ---------- ITEMS ----------
async function listItems(domain, { onlyActive = false } = {}) {
  let q = supabaseClient.from(itemsTable(domain)).select("*").order("sort_order").order("name");
  if (onlyActive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function upsertItem(domain, item) {
  const { data, error } = await supabaseClient
    .from(itemsTable(domain))
    .upsert({ ...item, updated_at: new Date().toISOString() })
    .select();
  if (error) throw error;
  return data[0];
}

async function updateItem(domain, id, patch) {
  const { error } = await supabaseClient
    .from(itemsTable(domain))
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

async function deleteItem(domain, id) {
  const { error } = await supabaseClient.from(itemsTable(domain)).delete().eq("id", id);
  if (error) throw error;
}

// ---------- SALES (caisse) ----------
/**
 * header: {seller_id, seller_name, note, sale_date, ...extra fields for mecano}
 * lines: [{item_id, item_name, unit_price, quantity, line_total}]
 */
async function createSale(domain, header, lines, overrideTotal = null) {
  const computedTotal = lines.reduce((s, l) => s + l.line_total, 0);
  const total = overrideTotal !== null && overrideTotal !== undefined ? Math.round(overrideTotal) : Math.round(computedTotal);
  const { data: sale, error } = await supabaseClient
    .from(salesTable(domain))
    .insert({ ...header, total })
    .select()
    .single();
  if (error) throw error;

  const linesWithSaleId = lines.map((l) => ({ ...l, sale_id: sale.id }));
  const { error: linesError } = await supabaseClient.from(saleLinesTable(domain)).insert(linesWithSaleId);
  if (linesError) throw linesError;

  return sale;
}

async function listSales(domain, { from, to } = {}) {
  let q = supabaseClient
    .from(salesTable(domain))
    .select(`*, lines:${saleLinesTable(domain)}(*)`)
    .order("sale_date", { ascending: false });
  if (from) q = q.gte("sale_date", from);
  if (to) q = q.lte("sale_date", to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function deleteSale(domain, id) {
  const { error } = await supabaseClient.from(salesTable(domain)).delete().eq("id", id);
  if (error) throw error;
}

async function updateSale(domain, id, patch) {
  const { error } = await supabaseClient.from(salesTable(domain)).update(patch).eq("id", id);
  if (error) throw error;
}

async function updateSaleLine(domain, lineId, patch) {
  const { error } = await supabaseClient.from(saleLinesTable(domain)).update(patch).eq("id", lineId);
  if (error) throw error;
}

// ---------- PURCHASES (achats) ----------
/**
 * header: {domain, buyer_id, note, purchase_date}
 * lines: [{domain, item_id, label, unit_price, quantity, line_total}]
 */
async function createPurchase(header, lines, overrideTotal = null) {
  const computedTotal = lines.reduce((s, l) => s + l.line_total, 0);
  const total = overrideTotal !== null && overrideTotal !== undefined ? Math.round(overrideTotal) : Math.round(computedTotal);
  const { data: purchase, error } = await supabaseClient
    .from("purchases")
    .insert({ ...header, total })
    .select()
    .single();
  if (error) throw error;

  const linesWithId = lines.map((l) => ({ ...l, purchase_id: purchase.id }));
  const { error: linesError } = await supabaseClient.from("purchase_lines").insert(linesWithId);
  if (linesError) throw linesError;

  return purchase;
}

async function listPurchases({ domain, from, to } = {}) {
  let q = supabaseClient
    .from("purchases")
    .select("*, lines:purchase_lines(*)")
    .order("purchase_date", { ascending: false });
  if (domain) q = q.eq("domain", domain);
  if (from) q = q.gte("purchase_date", from);
  if (to) q = q.lte("purchase_date", to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function deletePurchase(id) {
  const { error } = await supabaseClient.from("purchases").delete().eq("id", id);
  if (error) throw error;
}

async function updatePurchase(id, patch) {
  const { error } = await supabaseClient.from("purchases").update(patch).eq("id", id);
  if (error) throw error;
}

async function updatePurchaseLine(lineId, patch) {
  const { error } = await supabaseClient.from("purchase_lines").update(patch).eq("id", lineId);
  if (error) throw error;
}

// ---------- EMPLOYÉS ----------
async function listEmployees({ onlyActive = false } = {}) {
  let q = supabaseClient.from("employees").select("*").order("last_name");
  if (onlyActive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function upsertEmployee(employee) {
  const { data, error } = await supabaseClient.from("employees").upsert({ ...employee, updated_at: new Date().toISOString() }).select();
  if (error) throw error;
  return data[0];
}

async function deleteEmployee(id) {
  // Le fichier de contrat est stocké directement dans la ligne (comme les images d'articles) :
  // le supprimer supprime donc aussi le fichier, aucune action séparée n'est nécessaire.
  const { error } = await supabaseClient.from("employees").delete().eq("id", id);
  if (error) throw error;
}

// ---------- SALAIRES (par nom de vendeur, séparés Bar / Mécano) ----------
async function listSellerPercentages(domain) {
  const { data, error } = await supabaseClient.from("seller_percentages").select("*").eq("domain", domain);
  if (error) throw error;
  return data; // [{seller_name, domain, percentage}]
}

async function setSellerPercentage(sellerName, domain, percentage) {
  const { error } = await supabaseClient
    .from("seller_percentages")
    .upsert({ seller_name: sellerName, domain, percentage, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function listSalaryPayments(domain) {
  let q = supabaseClient.from("salary_payments").select("*").order("paid_at", { ascending: false });
  if (domain) q = q.eq("domain", domain);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function createSalaryPayment(payment) {
  const { data, error } = await supabaseClient.from("salary_payments").insert(payment).select().single();
  if (error) throw error;
  return data;
}

async function deleteSalaryPayment(id) {
  const { error } = await supabaseClient.from("salary_payments").delete().eq("id", id);
  if (error) throw error;
}

// ---------- PURGE COMPLÈTE (zone dangereuse, admin) ----------
/**
 * Supprime TOUTES les ventes (bar + mécano), tous les achats/dépenses,
 * et tous les versements de salaire. Les catalogues d'articles, les employés
 * et les comptes de connexion ne sont jamais touchés.
 * A n'appeler qu'après avoir généré et téléchargé la sauvegarde de sécurité.
 */
async function purgeAllTransactions() {
  const NIL = "00000000-0000-0000-0000-000000000000";
  const results = await Promise.allSettled([
    supabaseClient.from("bar_sales").delete().neq("id", NIL),
    supabaseClient.from("mecano_sales").delete().neq("id", NIL),
    supabaseClient.from("purchases").delete().neq("id", NIL),
    supabaseClient.from("salary_payments").delete().neq("id", NIL),
  ]);
  const failed = results.find((r) => r.status === "fulfilled" && r.value.error);
  if (failed) throw failed.value.error;
  const rejected = results.find((r) => r.status === "rejected");
  if (rejected) throw rejected.reason;
}

// ---------- CODES PROMO ----------
async function listPromoCodes() {
  const { data, error } = await supabaseClient.from("promo_codes").select("*").order("code");
  if (error) throw error;
  return data;
}

async function upsertPromoCode(promo) {
  const { data, error } = await supabaseClient.from("promo_codes").upsert(promo).select();
  if (error) throw error;
  return data[0];
}

async function deletePromoCode(id) {
  const { error } = await supabaseClient.from("promo_codes").delete().eq("id", id);
  if (error) throw error;
}

// ---------- RÉGLAGES GÉNÉRAUX ----------
async function getSetting(key, defaultValue) {
  const { data, error } = await supabaseClient.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? data.value : defaultValue;
}

async function setSetting(key, value) {
  const { error } = await supabaseClient.from("app_settings").upsert({ key, value: String(value), updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ---------- PRIMES EXCEPTIONNELLES ----------
async function listBonusPayments(domain) {
  let q = supabaseClient.from("bonus_payments").select("*").order("paid_at", { ascending: false });
  if (domain) q = q.eq("domain", domain);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function createBonusPayment(payment) {
  const { data, error } = await supabaseClient.from("bonus_payments").insert(payment).select().single();
  if (error) throw error;
  return data;
}

async function deleteBonusPayment(id) {
  const { error } = await supabaseClient.from("bonus_payments").delete().eq("id", id);
  if (error) throw error;
}

// ---------- CATÉGORIES MÉCANO ----------
async function listMecanoCategories() {
  const { data, error } = await supabaseClient.from("mecano_categories").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data;
}

async function upsertMecanoCategory(category) {
  const { data, error } = await supabaseClient.from("mecano_categories").upsert(category).select();
  if (error) throw error;
  return data[0];
}

async function updateMecanoCategory(id, patch) {
  const { error } = await supabaseClient.from("mecano_categories").update(patch).eq("id", id);
  if (error) throw error;
}

async function deleteMecanoCategory(id) {
  const { error } = await supabaseClient.from("mecano_categories").delete().eq("id", id);
  if (error) throw error;
}

async function listMecanoItemsWithCategory({ onlyActive = false } = {}) {
  let q = supabaseClient
    .from("mecano_items")
    .select("*, category:mecano_categories(id, name, type, color)")
    .order("sort_order")
    .order("name");
  if (onlyActive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
