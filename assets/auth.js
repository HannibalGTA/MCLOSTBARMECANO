// =========================================================
// AUTH — connexion Supabase, garde de rôle, navigation
// =========================================================

/**
 * Tente une connexion pour le rôle donné avec le mot de passe fourni.
 * Renvoie {ok:true, role} ou {ok:false, error}
 */
async function loginAs(role, password) {
  const email = ROLE_EMAILS[role];
  if (!email) return { ok: false, error: "Rôle inconnu." };

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Mot de passe incorrect." };

  // Vérifie que le profil correspond bien au rôle demandé (sécurité supplémentaire)
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== role) {
    await supabaseClient.auth.signOut();
    return { ok: false, error: "Ce compte n'est pas configuré pour ce rôle." };
  }
  return { ok: true, role: profile.role };
}

/**
 * Récupère le jeton d'accès (JWT) de la session en cours, nécessaire pour appeler
 * la fonction serveur de changement de mot de passe.
 */
async function getAccessToken() {
  const { data } = await supabaseClient.auth.getSession();
  return data?.session?.access_token || null;
}

/**
 * Nom/pseudo du joueur derrière ce navigateur (distinct du rôle partagé).
 * Stocké en sessionStorage : propre à cet onglet/cette session de connexion,
 * ce qui permet à plusieurs barmans (ou mécanos...) connectés en même temps
 * avec le même compte de rôle d'apparaître sous leur propre nom en caisse et en comptabilité.
 */
function getStaffName() {
  return sessionStorage.getItem("lostmc_staff_name") || "";
}
function setStaffName(name) {
  sessionStorage.setItem("lostmc_staff_name", name || "");
}

/**
 * Nom à utiliser comme "vendeur" sur une vente : le pseudo saisi si présent, sinon le rôle.
 */
function sellerDisplayName(profile) {
  const staff = getStaffName();
  return staff ? staff : ROLE_LABELS[profile.role];
}

/**
 * Appelle la fonction serveur "change-password" (Supabase Edge Function) pour modifier
 * le mot de passe d'un des 4 comptes de rôle. Réservé au gestionnaire (vérifié aussi côté serveur).
 */
async function changeRolePassword(targetRole, newPassword) {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Session expirée, reconnecte-toi." };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ target_role: targetRole, new_password: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Erreur serveur." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "Impossible de contacter le serveur." };
  }
}
async function logout() {
  await supabaseClient.auth.signOut();
  setStaffName("");
  window.location.href = "index.html";
}

/**
 * Récupère le profil (role, display_name) de l'utilisateur connecté.
 */
async function getCurrentProfile() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const session = sessionData?.session;
  if (!session) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", session.user.id)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * A appeler en haut de chaque page protégée.
 * allowedRoles: tableau des rôles autorisés à voir cette page.
 * Redirige vers index.html si non connecté ou rôle non autorisé.
 * Renvoie le profil si tout est ok.
 */
async function requireRole(allowedRoles) {
  const profile = await getCurrentProfile();
  if (!profile) {
    window.location.href = "index.html";
    return null;
  }
  if (!allowedRoles.includes(profile.role)) {
    window.location.href = "acces-refuse.html";
    return null;
  }
  renderNav(profile);
  return profile;
}

/**
 * Construit la barre de navigation en fonction du rôle connecté.
 */
function renderNav(profile) {
  const nav = document.getElementById("app-nav");
  if (!nav) return;

  const links = [];
  const role = profile.role;

  if (role === "barman" || role === "gestionnaire") {
    links.push({ href: "caisse-bar.html", label: "Caisse Bar" });
  }
  if (role === "mecano" || role === "gestionnaire") {
    links.push({ href: "caisse-mecano.html", label: "Caisse Mécano" });
  }
  if (role === "gestionnaire" || role === "superviseur") {
    links.push({ href: "bilan-bar.html", label: "Bilan Bar" });
    links.push({ href: "bilan-mecano.html", label: "Bilan Mécano" });
    links.push({ href: "employes.html", label: "Employés" });
  }
  if (role === "gestionnaire") {
    links.push({ href: "achats.html", label: "Achats" });
    links.push({ href: "salaires.html", label: "Salaires" });
    links.push({ href: "admin.html", label: "Administration" });
  }

  const here = window.location.pathname.split("/").pop();
  const staffName = getStaffName();
  nav.innerHTML = `
    <div class="nav-brand">
      <span class="nav-brand-top">THE LOST MC</span>
      <span class="nav-brand-bottom">Gestion Bar &amp; Garage</span>
    </div>
    <div class="nav-links">
      ${links
        .map(
          (l) =>
            `<a href="${l.href}" class="${l.href === here ? "active" : ""}">${l.label}</a>`
        )
        .join("")}
    </div>
    <div class="nav-user">
      <span>${ROLE_LABELS[role]}${staffName ? " — " + escapeHtml(staffName) : ""}</span>
      <button id="logout-btn" class="btn-ghost">Déconnexion</button>
    </div>
  `;
  document.getElementById("logout-btn").addEventListener("click", logout);
}
