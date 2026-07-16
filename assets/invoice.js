// =========================================================
// INVOICE — remplissage et actions de la popup facture/devis (mécano)
// Nécessite que la page contienne le marquage HTML de la modale
// (#invoice-modal, #invoice-content, #inv-doctype, #inv-date, #inv-client,
//  #inv-vehicle, #inv-plate, #inv-lines, #inv-total, #inv-note,
//  #close-invoice, #copy-invoice, #print-invoice) et la librairie html2canvas.
// =========================================================

/**
 * Affiche la popup facture/devis.
 * @param {Object} data
 * @param {string} data.docType - "Facture" ou "Devis"
 * @param {Date|string} data.date
 * @param {string} data.client
 * @param {string} data.vehicle
 * @param {string} data.plate
 * @param {Array<{item_name:string, quantity:number, unit_price:number, line_total:number}>} data.lines
 * @param {number} data.total
 * @param {string} data.note
 */
function showInvoiceModal(data) {
  document.getElementById("inv-doctype").textContent = data.docType || "Facture";
  document.getElementById("inv-date").textContent = formatDate(data.date || new Date());
  document.getElementById("inv-client").textContent = data.client || "—";
  document.getElementById("inv-vehicle").textContent = data.vehicle || "—";
  document.getElementById("inv-plate").textContent = data.plate || "—";

  const tbody = document.getElementById("inv-lines");
  tbody.innerHTML = (data.lines || [])
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.item_name)}</td><td class="num">${l.quantity}</td><td class="num">${formatUSD(l.unit_price)}</td><td class="num">${formatUSD(l.line_total)}</td></tr>`
    )
    .join("");

  const subtotal = (data.lines || []).reduce((s, l) => s + Number(l.line_total), 0);
  const total = data.total !== undefined && data.total !== null ? data.total : subtotal;
  const discount = Math.max(0, Math.round(subtotal - total));

  const subtotalRow = document.getElementById("inv-subtotal-row");
  const discountRow = document.getElementById("inv-discount-row");
  if (subtotalRow && discountRow) {
    if (discount > 0) {
      subtotalRow.style.display = "flex";
      discountRow.style.display = "flex";
      document.getElementById("inv-subtotal").textContent = formatUSD(subtotal);
      const pct = data.discountPercent || (subtotal > 0 ? Math.round((discount / subtotal) * 100) : 0);
      document.getElementById("inv-discount-label").textContent = data.promoCode ? `Réduction (${data.promoCode} -${pct}%)` : `Réduction (-${pct}%)`;
      document.getElementById("inv-discount").textContent = "-" + formatUSD(discount);
    } else {
      subtotalRow.style.display = "none";
      discountRow.style.display = "none";
    }
  }

  document.getElementById("inv-total").textContent = formatUSD(total);
  document.getElementById("inv-note").textContent = data.note ? "Note : " + data.note : "";
  document.getElementById("invoice-modal").style.display = "flex";
}

function closeInvoiceModal() {
  document.getElementById("invoice-modal").style.display = "none";
}

function initInvoiceModalControls() {
  const closeBtn = document.getElementById("close-invoice");
  const printBtn = document.getElementById("print-invoice");
  const copyBtn = document.getElementById("copy-invoice");
  if (closeBtn) closeBtn.addEventListener("click", closeInvoiceModal);
  if (printBtn) printBtn.addEventListener("click", () => window.print());
  if (copyBtn)
    copyBtn.addEventListener("click", async () => {
      const el = document.getElementById("invoice-content");
      try {
        const canvas = await html2canvas(el, { backgroundColor: "#efe7d8", scale: 2 });
        canvas.toBlob(async (blob) => {
          try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            toast("Image copiée dans le presse-papier.", "success");
          } catch (err) {
            toast("Copie impossible sur ce navigateur, utilise Imprimer.", "error");
          }
        });
      } catch (err) {
        toast("Erreur lors de la génération de l'image.", "error");
      }
    });
}

// Attache les contrôles dès que ce script est chargé (la modale est déjà dans le HTML à ce moment)
initInvoiceModalControls();
