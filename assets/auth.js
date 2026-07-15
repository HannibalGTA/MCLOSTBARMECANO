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

async function logout() {
  await supabaseClient.auth.signOut();
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
  }
  if (role === "gestionnaire") {
    links.push({ href: "achats.html", label: "Achats" });
    links.push({ href: "admin.html", label: "Administration" });
  }

  const here = window.location.pathname.split("/").pop();
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
      <span>${ROLE_LABELS[role]}</span>
      <button id="logout-btn" class="btn-ghost">Déconnexion</button>
    </div>
  `;
  document.getElementById("logout-btn").addEventListener("click", logout);
}
