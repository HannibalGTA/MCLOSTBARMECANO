# The Lost MC — Gestion Bar & Garage

Application web (HTML/CSS/JS pur, sans build) pour gérer la caisse du bar, la caisse du garage, les stocks, la comptabilité et les achats, pour un serveur GTA5 RP. Base de données : Supabase (Postgres + Auth). Hébergement : GitHub Pages (ou n'importe quel hébergeur statique).

## 1. Arborescence

```
lostmc/
├── index.html              Connexion (choix du rôle + mot de passe)
├── acces-refuse.html        Page affichée si le rôle n'a pas accès
├── admin.html                Administration des articles (gestionnaire uniquement)
├── caisse-bar.html           Caisse enregistreuse du bar (barman + gestionnaire)
├── caisse-mecano.html        Caisse + facture/devis du garage (mécano + gestionnaire)
├── bilan-bar.html             Comptabilité + stock du bar (gestionnaire + superviseur)
├── bilan-mecano.html          Comptabilité + stock du garage (gestionnaire + superviseur)
├── achats.html                Saisie des achats/dépenses (gestionnaire uniquement)
├── assets/
│   ├── config.js              À COMPLÉTER : URL + clé Supabase
│   ├── style.css               Feuille de style
│   ├── auth.js                  Connexion / garde de rôle / navigation
│   ├── data.js                   Accès aux données Supabase
│   ├── helpers.js                Formatage, redimensionnement d'image, toasts
│   ├── bilan.js                    Logique partagée des pages de bilan
│   ├── MCbar.png                    Logo bar (fourni)
│   └── MCmecano.png                 Logo garage (fourni)
└── supabase/
    └── schema.sql               Script SQL complet à exécuter sur Supabase
```

## 2. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com), crée un compte puis un nouveau projet (choisis une région proche de tes joueurs).
2. Une fois le projet créé, ouvre **SQL Editor** (menu de gauche) → **New query**.
3. Colle l'intégralité du contenu de `supabase/schema.sql` et exécute-le (bouton **Run**). Ce script crée :
   - les tables des articles (bar/mécano), des ventes, des lignes de vente, des achats et lignes d'achat,
   - les règles de sécurité (Row Level Security) qui limitent l'accès selon le rôle,
   - des triggers qui mettent à jour le stock automatiquement à chaque vente ou achat (et le recréditent en cas de suppression).

## 3. Créer les 4 comptes (un par rôle)

Le mot de passe de chaque rôle est **le vrai mot de passe du compte Supabase Auth correspondant** — c'est Supabase qui le sécurise (hashage, HTTPS), pas le site lui-même.

1. Dans Supabase, va dans **Authentication → Users → Add user → Create new user**.
2. Crée les 4 comptes suivants (email au choix, mais garde ceux-ci pour correspondre à `assets/config.js`) :
   - `barman@lostmc.local` — mot de passe du barman
   - `mecano@lostmc.local` — mot de passe du mécano
   - `gestionnaire@lostmc.local` — mot de passe du gestionnaire
   - `superviseur@lostmc.local` — mot de passe du superviseur
   - Coche **Auto Confirm User** pour chacun (pas de mail de confirmation à gérer).
3. Pour chaque utilisateur créé, copie son **UID** (visible dans la liste des utilisateurs).
4. Retourne dans **SQL Editor** et exécute (en remplaçant les UUID par ceux copiés) :

```sql
insert into public.profiles (id, role, display_name) values
  ('uuid-du-barman', 'barman', 'Barman'),
  ('uuid-du-mecano', 'mecano', 'Mécano'),
  ('uuid-du-gestionnaire', 'gestionnaire', 'Gestionnaire'),
  ('uuid-du-superviseur', 'superviseur', 'Superviseur');
```

Pour changer un mot de passe plus tard : **Authentication → Users → sélectionner l'utilisateur → Reset password** (ou "Send magic link" désactivé, tu peux forcer un nouveau mot de passe directement).

## 4. Connecter le site à Supabase

1. Dans Supabase : **Project Settings → API**.
2. Copie **Project URL** et la clé **anon public**.
3. Ouvre `assets/config.js` et remplace :

```js
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
```

> La clé "anon" est publique par nature (elle apparaît côté navigateur) : c'est normal et sans danger, car ce sont les règles RLS définies dans `schema.sql` qui empêchent réellement un rôle d'accéder aux données d'un autre.

## 5. Publier sur GitHub Pages

1. Crée un nouveau dépôt GitHub (public ou privé selon ton offre), par exemple `lostmc-app`.
2. Mets tout le contenu de ce dossier (`index.html`, `assets/`, etc. — le dossier `supabase/` peut être inclus ou non, il ne contient que du SQL de référence) à la racine du dépôt.
3. Dans les paramètres du dépôt : **Settings → Pages → Source : Deploy from a branch**, choisis la branche `main` et le dossier `/ (root)`.
4. Après quelques minutes, ton site sera accessible à une adresse du type `https://ton-pseudo.github.io/lostmc-app/`.

## 6. Créer les premiers articles

1. Connecte-toi avec le rôle **Gestionnaire**.
2. Va dans **Administration**, choisis l'onglet **Bar** ou **Mécano**.
3. Crée un article : nom, prix d'achat, prix de vente (ne peut pas être inférieur au prix d'achat), stock de départ, et optionnellement une image (elle est automatiquement redimensionnée et centrée, et compressée si besoin pour rester sous ~150 Ko).
4. L'article apparaît immédiatement dans la caisse correspondante.

## 7. Utilisation au quotidien

- **Barman / Mécano** : caisse enregistreuse — clique sur les articles pour les ajouter au ticket, ajuste les quantités, valide la vente. Le stock et la comptabilité sont mis à jour automatiquement.
- **Mécano** : renseigne en plus le nom du client, la plaque et le modèle du véhicule. Le bouton **Aperçu devis** affiche un document avec le logo du garage sans l'enregistrer en comptabilité ; **Enregistrer la facture** l'enregistre réellement (stock décrémenté) puis affiche la facture. Le bouton **Copier l'image** copie le document dans le presse-papier (utile pour le coller dans un téléphone RP).
- **Gestionnaire** : accès à tout — administration des articles, achats, et les deux bilans comptables.
- **Superviseur** : accès en lecture/contrôle aux deux bilans comptables uniquement (pas aux caisses, pas à l'administration, pas aux achats).
- Sur les pages de bilan : filtre par date, détail d'une vente ou d'un achat, suppression d'une ligne ou d'une vente/achat entière (le stock est automatiquement recrédité/ajusté).

## 8. Notes de sécurité

- Aucun mot de passe n'est stocké dans le code du site : ils vivent uniquement dans Supabase Auth (hashés).
- Chaque rôle ne peut lire/écrire que ce que les policies RLS autorisent (voir `schema.sql`), même si quelqu'un inspecte le code source du site.
- Pense à changer les 4 mots de passe par défaut dès la mise en production, et à ne jamais publier tes identifiants Supabase (mot de passe de la base, service role key) — seule la clé **anon** doit apparaître dans `config.js`.
