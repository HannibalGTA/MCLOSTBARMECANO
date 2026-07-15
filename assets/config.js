// =========================================================
// CONFIGURATION SUPABASE
// Remplace les deux valeurs ci-dessous par celles de ton projet
// (Supabase > Project Settings > API).
// =========================================================
const SUPABASE_URL = "https://hriwvtdjzfohdwqvedjc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_onkd7yp_8c2fHjlCEKl_7A_wM6O438k";

// Client global, réutilisé par toutes les pages
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Emails techniques associés à chaque rôle (comptes créés dans Supabase Auth)
const ROLE_EMAILS = {
  mecano: "mecano@lostmc.local",
  barman: "barman@lostmc.local",
  gestionnaire: "gestionnaire@lostmc.local",
  superviseur: "superviseur@lostmc.local",
};

const ROLE_LABELS = {
  mecano: "Mécano",
  barman: "Barman",
  gestionnaire: "Gestionnaire",
  superviseur: "Superviseur",
};

// Taille max autorisée pour une image d'item, en octets (150 Ko)
const MAX_IMAGE_BYTES = 150 * 1024;
