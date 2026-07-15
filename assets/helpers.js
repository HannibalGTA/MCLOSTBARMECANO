// =========================================================
// HELPERS génériques réutilisés sur toutes les pages
// =========================================================

function formatUSD(n) {
  const v = Math.round(Number(n) || 0);
  return "$" + v.toLocaleString("en-US");
}

/**
 * Affiche une popup de confirmation stylée (Oui / Annuler).
 * Renvoie une Promise<boolean> : true si confirmé, false si annulé.
 */
function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal-box" style="max-width:400px;text-align:center;">
        <h3 class="mt-0">${escapeHtml(title)}</h3>
        <p class="muted">${escapeHtml(message)}</p>
        <div class="flex-between" style="margin-top:20px;justify-content:center;gap:12px;">
          <button type="button" class="btn-ghost" id="confirm-dialog-cancel">Annuler</button>
          <button type="button" class="btn-primary" id="confirm-dialog-ok">Confirmer</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    function cleanup(result) {
      backdrop.remove();
      resolve(result);
    }
    backdrop.querySelector("#confirm-dialog-ok").addEventListener("click", () => cleanup(true));
    backdrop.querySelector("#confirm-dialog-cancel").addEventListener("click", () => cleanup(false));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) cleanup(false);
    });
  });
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
        const approxBytes = (str) => Math.ceil((str.length * 3) / 4);

        const renderAt = (size) => {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          const ratio = Math.min(size / img.width, size / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          const x = (size - w) / 2;
          const y = (size - h) / 2;
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, x, y, w, h);
          return canvas;
        };

        let size = targetSize;
        let canvas = renderAt(size);
        let dataUrl = canvas.toDataURL("image/png");

        // Etape 1 : si trop lourd en PNG, passe en JPEG et réduit la qualité progressivement
        if (approxBytes(dataUrl) > MAX_IMAGE_BYTES) {
          let quality = 0.92;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          while (approxBytes(dataUrl) > MAX_IMAGE_BYTES && quality > 0.35) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
        }

        // Etape 2 : si toujours trop lourd, réduit aussi la taille du carré et refait l'étape 1
        let attempts = 0;
        while (approxBytes(dataUrl) > MAX_IMAGE_BYTES && attempts < 4 && size > 80) {
          size = Math.round(size * 0.7);
          canvas = renderAt(size);
          let quality = 0.85;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          while (approxBytes(dataUrl) > MAX_IMAGE_BYTES && quality > 0.3) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
          attempts++;
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
