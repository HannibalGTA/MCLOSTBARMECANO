// =========================================================
// EXPORT — génération de fichiers .xlsx multi-onglets
// (s'ouvrent nativement dans Google Sheets via Fichier > Importer,
//  ou en les glissant dans Google Drive)
// Nécessite la librairie SheetJS (XLSX) chargée sur la page.
// =========================================================

/**
 * Construit un classeur à partir de {NomOnglet: [ {colonne: valeur, ...}, ... ]}
 * et déclenche son téléchargement.
 */
function downloadWorkbook(sheetsData, filename) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheetsData)) {
    const safeRows = rows && rows.length ? rows : [{ Info: "Aucune donnée sur cette période" }];
    const ws = XLSX.utils.json_to_sheet(safeRows);
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31)); // 31 caractères max pour un nom d'onglet
  }
  XLSX.writeFile(wb, filename);
}

function stockRowsFlat(items) {
  return items.map((i) => ({
    Article: i.name,
    "Stock suivi": i.track_stock ? "Oui" : "Non",
    Stock: i.track_stock ? i.stock : "Illimité",
    "Prix achat": Number(i.buy_price),
    "Prix vente": Number(i.sell_price),
    "Valeur stock": i.track_stock ? Math.round(i.stock * i.buy_price) : 0,
    Actif: i.active ? "Oui" : "Non",
  }));
}

function saleRowsFlat(sales, domain) {
  return sales.map((s) => {
    const base = {
      Date: formatDateTime(s.sale_date),
      Vendeur: s.seller_name || "",
      Total: Number(s.total),
      "Code promo": s.promo_code || "",
      "% Réduction": s.promo_discount_percent || "",
      Note: s.note || "",
    };
    if (domain === "mecano") {
      base["Client"] = s.client_name || "";
      base["Véhicule"] = s.vehicle_model || "";
      base["Plaque"] = s.plate || "";
      base["Document"] = s.doc_type || "";
    }
    return base;
  });
}

function saleLineRowsFlat(sales) {
  const rows = [];
  for (const s of sales) {
    for (const l of s.lines || []) {
      rows.push({
        "Date vente": formatDateTime(s.sale_date),
        Vendeur: s.seller_name || "",
        Article: l.item_name,
        Quantité: Number(l.quantity),
        "Prix vente unitaire": Number(l.unit_price),
        "Prix achat unitaire": Number(l.buy_price || 0),
        "Total ligne": Number(l.line_total),
      });
    }
  }
  return rows;
}

function purchaseRowsFlat(purchases) {
  return purchases.map((p) => ({
    Date: formatDateTime(p.purchase_date),
    Note: p.note || "",
    Total: Number(p.total),
  }));
}

function purchaseLineRowsFlat(purchases) {
  const rows = [];
  for (const p of purchases) {
    for (const l of p.lines || []) {
      rows.push({
        "Date achat": formatDateTime(p.purchase_date),
        Libellé: l.label,
        Quantité: Number(l.quantity),
        "Prix unitaire": Number(l.unit_price),
        "Total ligne": Number(l.line_total),
      });
    }
  }
  return rows;
}

function salaryRowsFlat(payments) {
  return payments.map((p) => ({
    Date: formatDateTime(p.paid_at),
    Vendeur: p.seller_name || p.employee_name || "",
    Service: p.domain === "bar" ? "Bar" : p.domain === "mecano" ? "Mécano" : "",
    Période_début: p.period_from ? formatDate(p.period_from) : "",
    Période_fin: p.period_to ? formatDate(p.period_to) : "",
    Marge: Number(p.margin_amount),
    "%": Number(p.percentage),
    Montant_versé: Number(p.amount),
  }));
}
