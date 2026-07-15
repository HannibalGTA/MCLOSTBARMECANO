// =========================================================
// BILAN — logique partagée entre bilan-bar.html et bilan-mecano.html
// =========================================================

async function initBilan(domain) {
  const profile = await requireRole(["gestionnaire", "superviseur"]);
  if (!profile) return;

  const state = { from: null, to: null };

  const fromInput = document.getElementById("filter-from");
  const toInput = document.getElementById("filter-to");

  document.getElementById("filter-apply").addEventListener("click", () => {
    state.from = fromInput.value ? new Date(fromInput.value + "T00:00:00").toISOString() : null;
    state.to = toInput.value ? new Date(toInput.value + "T23:59:59").toISOString() : null;
    refreshAll();
  });
  document.getElementById("filter-reset").addEventListener("click", () => {
    fromInput.value = "";
    toInput.value = "";
    state.from = null;
    state.to = null;
    refreshAll();
  });

  async function refreshAll() {
    await Promise.all([refreshStock(), refreshSales(), refreshPurchases()]);
  }

  async function refreshStock() {
    const items = await listItems(domain);
    const tbody = document.getElementById("stock-tbody");
    tbody.innerHTML = "";
    let stockValue = 0;
    for (const item of items) {
      const value = item.track_stock ? item.stock * item.buy_price : 0;
      stockValue += value;
      const low = item.track_stock && item.stock <= 3;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(item.name)} ${!item.track_stock ? '<span class="badge muted" style="border:1px solid #444;">prestation</span>' : ""}</td>
        <td class="num">${item.track_stock ? item.stock + (low ? ' <span class="badge badge-low">bas</span>' : "") : '<span class="muted">Illimité</span>'}</td>
        <td class="num">${formatUSD(item.buy_price)}</td>
        <td class="num">${formatUSD(item.sell_price)}</td>
        <td class="num">${item.track_stock ? formatUSD(value) : '<span class="muted">—</span>'}</td>
      `;
      tbody.appendChild(tr);
    }
    document.getElementById("stat-stock-value").textContent = formatUSD(stockValue);
  }

  async function refreshSales() {
    const sales = await listSales(domain, { from: state.from, to: state.to });
    const tbody = document.getElementById("sales-tbody");
    tbody.innerHTML = "";
    document.getElementById("sales-empty").style.display = sales.length ? "none" : "block";

    let revenue = 0;
    for (const sale of sales) revenue += Number(sale.total);
    document.getElementById("stat-revenue").textContent = formatUSD(revenue);
    document.getElementById("stat-sales-count").textContent = sales.length;

    for (const sale of sales) {
      const tr = document.createElement("tr");
      const extra =
        domain === "mecano"
          ? `<td>${escapeHtml(sale.client_name || "—")}<br><span class="muted" style="font-size:0.75rem;">${escapeHtml(sale.vehicle_model || "")} ${sale.plate ? "· " + escapeHtml(sale.plate) : ""}</span></td>`
          : "";
      tr.innerHTML = `
        <td>${formatDateTime(sale.sale_date)}</td>
        <td>${escapeHtml(sale.seller_name || "—")}</td>
        ${extra}
        <td class="num">${formatUSD(sale.total)}</td>
        <td>
          <button class="btn-ghost btn-sm" data-action="view" data-id="${sale.id}">Détail</button>
          <button class="btn-danger btn-sm" data-action="delete" data-id="${sale.id}">Supprimer</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('[data-action="view"]').forEach((btn) => {
      btn.addEventListener("click", () => openSaleModal(sales.find((s) => s.id === btn.dataset.id)));
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Supprimer cette vente ? Le stock des articles sera recrédité.")) return;
        try {
          await deleteSale(domain, btn.dataset.id);
          toast("Vente supprimée.", "success");
          refreshAll();
        } catch (err) {
          toast("Erreur : " + err.message, "error");
        }
      });
    });
  }

  function openSaleModal(sale) {
    if (!sale) return;
    const backdrop = document.getElementById("sale-modal");
    const body = document.getElementById("sale-modal-body");
    const extraInfo =
      domain === "mecano"
        ? `<p class="muted">Client : ${escapeHtml(sale.client_name || "—")} · Véhicule : ${escapeHtml(sale.vehicle_model || "—")} · Plaque : ${escapeHtml(sale.plate || "—")}</p>`
        : "";
    const invoiceButton =
      domain === "mecano" && typeof showInvoiceModal === "function"
        ? `<button class="btn-secondary btn-sm" id="reopen-invoice-btn" type="button">Revoir la facture</button>`
        : "";
    body.innerHTML = `
      <div class="flex-between">
        <h3 class="mt-0">Vente du ${formatDateTime(sale.sale_date)}</h3>
        ${invoiceButton}
      </div>
      ${extraInfo}
      ${sale.note ? `<p class="muted">Note : ${escapeHtml(sale.note)}</p>` : ""}
      <table>
        <thead><tr><th>Article</th><th class="num">Qté</th><th class="num">P.U.</th><th class="num">Total</th><th></th></tr></thead>
        <tbody>
          ${sale.lines
            .map(
              (l) => `
            <tr>
              <td>${escapeHtml(l.item_name)}</td>
              <td class="num">${l.quantity}</td>
              <td class="num">${formatUSD(l.unit_price)}</td>
              <td class="num">${formatUSD(l.line_total)}</td>
              <td><button class="btn-danger btn-sm" data-line-id="${l.id}">Suppr.</button></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <div class="ticket-total"><span>Total</span><span>${formatUSD(sale.total)}</span></div>
    `;
    const reopenBtn = document.getElementById("reopen-invoice-btn");
    if (reopenBtn) {
      reopenBtn.addEventListener("click", () => {
        showInvoiceModal({
          docType: "Facture",
          date: sale.sale_date,
          client: sale.client_name,
          vehicle: sale.vehicle_model,
          plate: sale.plate,
          lines: sale.lines,
          total: sale.total,
          note: sale.note,
        });
      });
    }
    body.querySelectorAll("[data-line-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Supprimer cette ligne ? Le stock sera recrédité et le total recalculé.")) return;
        try {
          await deleteSaleLineAndRecalc(domain, sale, btn.dataset.lineId);
          toast("Ligne supprimée.", "success");
          closeSaleModal();
          refreshAll();
        } catch (err) {
          toast("Erreur : " + err.message, "error");
        }
      });
    });
    backdrop.style.display = "flex";
  }

  function closeSaleModal() {
    document.getElementById("sale-modal").style.display = "none";
  }
  document.getElementById("close-sale-modal").addEventListener("click", closeSaleModal);

  async function refreshPurchases() {
    const purchases = await listPurchases({ domain, from: state.from, to: state.to });
    const tbody = document.getElementById("purchases-tbody");
    tbody.innerHTML = "";
    document.getElementById("purchases-empty").style.display = purchases.length ? "none" : "block";

    let cost = 0;
    for (const p of purchases) cost += Number(p.total);
    document.getElementById("stat-cost").textContent = formatUSD(cost);

    const revenueText = document.getElementById("stat-revenue").textContent.replace("$", "").replace(/,/g, "");
    const revenueNum = parseFloat(revenueText) || 0;
    document.getElementById("stat-margin").textContent = formatUSD(revenueNum - cost);

    for (const p of purchases) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDateTime(p.purchase_date)}</td>
        <td>${escapeHtml(p.note || "—")}</td>
        <td class="num">${formatUSD(p.total)}</td>
        <td>
          <button class="btn-ghost btn-sm" data-action="view" data-id="${p.id}">Détail</button>
          <button class="btn-danger btn-sm" data-action="delete" data-id="${p.id}">Supprimer</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('[data-action="view"]').forEach((btn) => {
      btn.addEventListener("click", () => openPurchaseModal(purchases.find((p) => p.id === btn.dataset.id)));
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Supprimer cet achat ? Le stock sera ajusté en conséquence.")) return;
        try {
          await deletePurchase(btn.dataset.id);
          toast("Achat supprimé.", "success");
          refreshAll();
        } catch (err) {
          toast("Erreur : " + err.message, "error");
        }
      });
    });
  }

  function openPurchaseModal(p) {
    if (!p) return;
    const backdrop = document.getElementById("sale-modal");
    const body = document.getElementById("sale-modal-body");
    body.innerHTML = `
      <h3 class="mt-0">Achat du ${formatDateTime(p.purchase_date)}</h3>
      ${p.note ? `<p class="muted">Note : ${escapeHtml(p.note)}</p>` : ""}
      <table>
        <thead><tr><th>Libellé</th><th class="num">Qté</th><th class="num">P.U.</th><th class="num">Total</th></tr></thead>
        <tbody>
          ${p.lines.map((l) => `<tr><td>${escapeHtml(l.label)}</td><td class="num">${l.quantity}</td><td class="num">${formatUSD(l.unit_price)}</td><td class="num">${formatUSD(l.line_total)}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="ticket-total"><span>Total</span><span>${formatUSD(p.total)}</span></div>
    `;
    backdrop.style.display = "flex";
  }

  async function deleteSaleLineAndRecalc(domain, sale, lineId) {
    const table = domain === "bar" ? "bar_sale_lines" : "mecano_sale_lines";
    const salesTableName = domain === "bar" ? "bar_sales" : "mecano_sales";
    const { error: delError } = await supabaseClient.from(table).delete().eq("id", lineId);
    if (delError) throw delError;
    const remainingTotal = sale.lines.filter((l) => l.id !== lineId).reduce((s, l) => s + Number(l.line_total), 0);
    const { error: updError } = await supabaseClient.from(salesTableName).update({ total: remainingTotal }).eq("id", sale.id);
    if (updError) throw updError;
  }

  await refreshAll();
}
