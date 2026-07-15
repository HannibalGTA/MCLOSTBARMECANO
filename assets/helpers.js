// =========================================================
// HELPERS génériques réutilisés sur toutes les pages
// =========================================================

function formatUSD(n) {
  const v = Number(n) || 0;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(d) {
  const date = new Date(d);
  return (
    date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " à " +
    date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

function toast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/**
 * Redimensionne et centre une image (fichier uploadé) dans un carré,
 * renvoie une data URL PNG limitée en poids (MAX_IMAGE_BYTES).
 * @param {File} file
 * @param {number} targetSize - taille du carré en px (ex: 300)
 * @returns {Promise<string>} data URL, ou rejette si trop lourde même compressée
 */
function resizeAndCenterImage(file, targetSize = 300) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Le fichier doit être une image."));
      return;
    }
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        // fond transparent, image centrée en mode "contain"
        const ratio = Math.min(targetSize / img.width, targetSize / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (targetSize - w) / 2;
        const y = (targetSize - h) / 2;
        ctx.clearRect(0, 0, targetSize, targetSize);
        ctx.drawImage(img, x, y, w, h);

        // essaie plusieurs qualités JPEG pour rester sous la limite de poids
        let quality = 0.92;
        let dataUrl = canvas.toDataURL("image/png");
        const approxBytes = (str) => Math.ceil((str.length * 3) / 4);

        if (approxBytes(dataUrl) > MAX_IMAGE_BYTES) {
          // Passe en JPEG (transparence perdue mais fond neutre) pour réduire le poids
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          while (approxBytes(dataUrl) > MAX_IMAGE_BYTES && quality > 0.3) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
        }

        if (approxBytes(dataUrl) > MAX_IMAGE_BYTES) {
          reject(new Error("Image trop lourde même après compression, choisis un fichier plus petit."));
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Impossible de lire cette image."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Impossible de lire ce fichier."));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function uuidShort(id) {
  return id ? id.slice(0, 8) : "";
}
