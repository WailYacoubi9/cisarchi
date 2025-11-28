# Plan d'Action : Implémentation Device Flow OAuth2

## 📋 Vue d'ensemble

Ce document détaille l'implémentation complète du **Device Flow OAuth2** pour permettre l'authentification de devices clients qui :
- Ne peuvent pas accepter de connexions entrantes
- Sont derrière des NAT/firewalls
- N'ont pas de navigateur intégré ou d'interface utilisateur complète

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE GLOBALE                      │
└─────────────────────────────────────────────────────────────┘

    Device Client                 Nginx Proxy              Backend Services
    (device-cli)

┌──────────────┐              ┌──────────────┐          ┌────────────────┐
│              │              │              │          │                │
│  Device CLI  │─────(1)─────▶│ auth.monapp  │─────────▶│   Keycloak     │
│              │              │    .fr       │          │   :8080        │
│              │              │              │          │                │
│              │◀────(2)──────│              │◀─────────│  (Auth Server) │
│              │              │              │          │                │
└──────────────┘              └──────────────┘          └────────────────┘
                                     │                           │
                              ┌──────────────┐          ┌────────────────┐
                              │              │          │                │
     Utilisateur ────(3)─────▶│ www.monapp   │─────────▶│    webapp2     │
     (navigateur)             │    .fr       │          │    :3000       │
                              │              │          │                │
                              └──────────────┘          └────────────────┘
                                                                 │
                                                         ┌───────▼────────┐
                                                         │ Device Service │
                                                         │ (Admin API)    │
                                                         └────────────────┘

FLUX D'AUTHENTIFICATION DEVICE FLOW:

(1) Device demande autorisation → obtient device_code + user_code
(2) Device affiche URL + code à l'utilisateur
(3) Utilisateur se connecte via navigateur sur auth.monapp.fr
(4) Utilisateur entre le user_code
(5) Device poll Keycloak → obtient access_token
(6) Device peut maintenant accéder aux ressources protégées
```

### Séparation des domaines

Conformément aux best practices OAuth2 :
- **auth.monapp.fr** : Serveur d'authentification/autorisation (Keycloak)
- **www.monapp.fr** : Application principale (webapp2)
- Communication directe entre device et serveur IDM (Keycloak)

---

## 🚀 Composants implémentés

### 1. Device Client (`device-client/`)

Application CLI Node.js qui implémente le Device Flow OAuth2.

#### Fichiers créés :
- `device-cli.js` : Application principale (240 lignes)
- `package.json` : Dépendances et scripts
- `.env.example` : Configuration exemple
- `.gitignore` : Fichiers à ignorer

#### Fonctionnalités :
✅ Demande d'autorisation device (obtention du device_code)
✅ Affichage des instructions utilisateur (URL + code)
✅ Polling pour obtenir le token
✅ Sauvegarde sécurisée des tokens (permissions 0600)
✅ Refresh automatique du token
✅ Gestion de la déconnexion
✅ Vérification du statut de session

#### Commandes disponibles :
```bash
npm run login    # Authentification (défaut)
npm run status   # Vérifier le statut
npm run logout   # Se déconnecter
npm run refresh  # Rafraîchir le token
```

### 2. Device Service (`webapp2/services/deviceService.js`)

Service backend pour gérer les devices via l'API Admin Keycloak.

#### Fonctionnalités :
✅ Authentification Admin Keycloak
✅ Listing des sessions actives
✅ Détails des sessions utilisateur
✅ Déconnexion d'un utilisateur/device
✅ Suppression de sessions
✅ Statistiques des connexions
✅ Vérification de connexion device
✅ Récupération des events (authentification, etc.)

### 3. Routes API (`webapp2/routes/devices.js`)

API REST pour la gestion des devices.

#### Endpoints implémentés :

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| `GET` | `/api/devices` | Lister tous les devices connectés | Admin |
| `GET` | `/api/devices/stats` | Statistiques des sessions | Admin |
| `GET` | `/api/devices/user/:userId` | Sessions d'un utilisateur | Admin |
| `GET` | `/api/devices/session/:sessionId` | Détails d'une session | Admin |
| `POST` | `/api/devices/user/:userId/logout` | Déconnecter un utilisateur | Admin |
| `DELETE` | `/api/devices/session/:sessionId` | Supprimer une session | Admin |
| `GET` | `/api/devices/check/:identifier` | Vérifier si device connecté | Auth |
| `GET` | `/api/devices/events` | Events récents | Admin |
| `GET` | `/api/devices/clients` | Lister les clients OAuth | Admin |
| `GET` | `/devices` | Page de gestion (HTML) | Admin |

### 4. Nginx Reverse Proxy (`nginx/`)

Configuration Nginx pour séparer les domaines et sécuriser l'architecture.

#### Fichiers créés :
- `nginx.conf` : Configuration complète du reverse proxy
- `docker-compose.yml` : Déploiement Docker de l'architecture complète
- `.env.example` : Variables d'environnement
- `README.md` : Documentation nginx

#### Fonctionnalités :
✅ Séparation auth.monapp.fr / www.monapp.fr
✅ Rate limiting (auth + API)
✅ Headers de sécurité
✅ Support WebSocket
✅ Endpoints de monitoring (/health, /nginx_status)
✅ Configuration HTTPS (production)
✅ Gzip compression

---

## 📦 Installation et Déploiement

### Prérequis

- Node.js >= 14
- Docker & Docker Compose (optionnel mais recommandé)
- Nginx (si installation manuelle)

### Option 1 : Déploiement complet avec Docker Compose

```bash
# 1. Aller dans le dossier nginx
cd nginx

# 2. Copier et configurer .env
cp .env.example .env
nano .env  # Remplir les valeurs

# 3. Modifier /etc/hosts (pour développement local)
sudo nano /etc/hosts
# Ajouter :
# 127.0.0.1 auth.monapp.fr
# 127.0.0.1 www.monapp.fr

# 4. Démarrer tous les services
docker-compose up -d

# 5. Vérifier les logs
docker-compose logs -f

# 6. Accéder aux services
# - Application : http://www.monapp.fr
# - Auth : http://auth.monapp.fr
# - Health : http://localhost:8888/health
```

### Option 2 : Installation manuelle

#### Étape 1 : Démarrer Keycloak

```bash
docker run -d --name keycloak \
  -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -v $(pwd)/realm.json:/opt/keycloak/data/import/realm.json \
  quay.io/keycloak/keycloak:latest start-dev --import-realm
```

#### Étape 2 : Configurer et démarrer webapp2

```bash
cd webapp2

# Installer les dépendances
npm install

# Configurer .env
cp .env.example .env
nano .env  # Ajouter KEYCLOAK_ADMIN_PASSWORD

# Démarrer l'application
npm start
```

#### Étape 3 : Configurer Nginx

```bash
# Linux/Ubuntu
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl restart nginx

# macOS
sudo cp nginx/nginx.conf /usr/local/etc/nginx/nginx.conf
nginx -t
brew services restart nginx
```

#### Étape 4 : Configurer et utiliser device-client

```bash
cd device-client

# Installer les dépendances
npm install

# Configurer .env
cp .env.example .env
# KEYCLOAK_URL=http://auth.monapp.fr
# REALM=projetcis
# DEVICE_CLIENT_ID=devicecis

# S'authentifier
npm run login

# Vérifier le statut
npm run status
```

---

## 🔧 Configuration

### Variables d'environnement

#### device-client/.env
```env
KEYCLOAK_URL=http://auth.monapp.fr
REALM=projetcis
DEVICE_CLIENT_ID=devicecis
```

#### webapp2/.env
```env
# Keycloak
KEYCLOAK_URL=http://auth.monapp.fr
REALM=projetcis
CLIENT_ID=webapp
CLIENT_SECRET=<secret-depuis-keycloak>

# Admin API
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=<mot-de-passe-admin>

# Serveur
PORT=3000
REDIRECT_URI=https://www.monapp.fr/auth/callback
SESSION_SECRET=<secret-aleatoire-long>
```

#### nginx/.env (Docker Compose)
```env
KEYCLOAK_ADMIN_PASSWORD=<mot-de-passe-admin>
WEBAPP_CLIENT_SECRET=<secret-depuis-keycloak>
SESSION_SECRET=<secret-aleatoire-long>
```

### Configuration Keycloak

Le client `devicecis` est déjà configuré dans `realm.json` :

```json
{
  "clientId": "devicecis",
  "name": "Device Application",
  "enabled": true,
  "publicClient": true,
  "attributes": {
    "oauth2.device.authorization.grant.enabled": "true",
    "oauth2.device.polling.interval": "5"
  }
}
```

---

## 🎯 Utilisation

### Scénario 1 : Authentification d'un device

```bash
# Sur le device
cd device-client
npm run login

# Output :
# 🔐 Démarrage de l'authentification Device Flow...
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📱 AUTHENTIFICATION REQUISE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# 1. Ouvrez cette URL dans votre navigateur:
#    http://auth.monapp.fr/realms/projetcis/device?user_code=ABCD-EFGH
#
# ⏱️  Ce code expire dans 10 minutes
#
# ⏳ En attente de votre authentification...
```

### Scénario 2 : Vérifier le statut de connexion

```bash
npm run status

# Output :
# ✅ Session active
# 👤 Utilisateur: john.doe
# 📧 Email: john.doe@example.com
# ⏱️  Expire dans: 420 secondes
```

### Scénario 3 : Gérer les devices (admin)

```bash
# Lister tous les devices connectés
curl -X GET http://www.monapp.fr/api/devices \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"

# Déconnecter un utilisateur
curl -X POST http://www.monapp.fr/api/devices/user/{userId}/logout \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"

# Voir les statistiques
curl -X GET http://www.monapp.fr/api/devices/stats \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"
```

### Scénario 4 : Utiliser le token pour accéder aux ressources

Dans votre code device :

```javascript
const DeviceFlowClient = require('./device-cli');

async function main() {
    const client = new DeviceFlowClient();

    // Charger les tokens
    const tokens = await client.loadTokens();

    if (!tokens) {
        // Pas de token, s'authentifier
        await client.authenticate();
    }

    // Utiliser le token pour accéder aux ressources
    const response = await fetch('http://www.monapp.fr/api/protected-resource', {
        headers: {
            'Authorization': `Bearer ${client.tokens.access_token}`
        }
    });

    const data = await response.json();
    console.log(data);
}

main();
```

---

## ✅ Checklist de validation

### Tests Device Client

- [ ] `npm install` dans `device-client/` fonctionne
- [ ] `npm run login` démarre le Device Flow
- [ ] L'URL et le code sont affichés correctement
- [ ] La connexion via navigateur fonctionne
- [ ] Le token est obtenu et sauvegardé
- [ ] `npm run status` affiche les informations correctes
- [ ] Le refresh automatique du token fonctionne
- [ ] `npm run logout` déconnecte correctement

### Tests Backend (webapp2)

- [ ] Les routes `/api/devices/*` sont accessibles
- [ ] Seuls les admins peuvent accéder aux routes protégées
- [ ] La liste des devices connectés est correcte
- [ ] La déconnexion d'un device fonctionne
- [ ] Les statistiques sont précises
- [ ] Les events sont récupérés (si activés dans Keycloak)

### Tests Nginx

- [ ] `http://auth.monapp.fr` pointe vers Keycloak
- [ ] `http://www.monapp.fr` pointe vers webapp2
- [ ] Les headers de sécurité sont présents
- [ ] Le rate limiting fonctionne
- [ ] `/health` retourne "healthy"
- [ ] `/nginx_status` affiche les stats (localhost uniquement)

### Tests de sécurité

- [ ] Les tokens sont stockés avec permissions 0600
- [ ] Le client secret n'est pas exposé
- [ ] Les mots de passe admin ne sont pas en clair
- [ ] HTTPS est utilisé en production
- [ ] Les CORS sont correctement configurés
- [ ] Les sessions expirent correctement

### Tests d'intégration

- [ ] Un device peut s'authentifier de bout en bout
- [ ] L'admin peut voir le device dans la liste
- [ ] L'admin peut déconnecter le device
- [ ] Le device détecte la déconnexion
- [ ] Le refresh token fonctionne
- [ ] La reconnexion après expiration fonctionne

---

## 🔒 Sécurité

### Recommandations implémentées

✅ **Séparation des domaines** : auth.monapp.fr vs www.monapp.fr
✅ **Communication directe avec IDM** : Device ↔ Keycloak (pas de proxy applicatif)
✅ **Rate limiting** : Protection contre le brute force
✅ **Headers de sécurité** : X-Frame-Options, CSP, HSTS (en HTTPS)
✅ **Tokens sécurisés** : Stockage avec permissions restrictives
✅ **Public client** : Pas de client secret côté device
✅ **PKCE non requis** : Device Flow n'utilise pas PKCE
✅ **Session management** : Timeouts et refresh automatique

### Points d'attention

⚠️ **Expiration du user_code** : 10 minutes par défaut (configurable dans Keycloak)
⚠️ **Polling interval** : 5 secondes (configurable dans realm.json)
⚠️ **Admin credentials** : Stocker dans un gestionnaire de secrets en production
⚠️ **HTTPS obligatoire** : En production, toujours utiliser HTTPS

---

## 🐛 Troubleshooting

### Erreur : "authorization_pending"

✅ **Normal** : L'utilisateur n'a pas encore autorisé le device
➡️ **Solution** : Attendre que l'utilisateur se connecte et entre le code

### Erreur : "expired_token"

❌ **Problème** : Le code d'autorisation a expiré (> 10 min)
➡️ **Solution** : Relancer `npm run login`

### Erreur : "slow_down"

❌ **Problème** : Polling trop rapide
➡️ **Solution** : Le client ralentit automatiquement

### Erreur : "Impossible d'obtenir le token d'administration"

❌ **Problème** : Credentials admin incorrects
➡️ **Solution** : Vérifier `KEYCLOAK_ADMIN_PASSWORD` dans `.env`

### Erreur : 502 Bad Gateway (Nginx)

❌ **Problème** : Backend non accessible
➡️ **Solution** : Vérifier que Keycloak et webapp2 sont démarrés

### Erreur : "Cannot find module 'axios'"

❌ **Problème** : Dépendances non installées
➡️ **Solution** : `npm install` dans device-client/

---

## 📚 Ressources

### Standards OAuth2

- [RFC 8628 - OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628)
- [OAuth 2.0 Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

### Documentation Keycloak

- [Device Flow](https://www.keycloak.org/docs/latest/securing_apps/#_device_authorization_grant)
- [Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/)
- [Reverse Proxy](https://www.keycloak.org/server/reverseproxy)

### Documentation Nginx

- [Reverse Proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [Rate Limiting](https://www.nginx.com/blog/rate-limiting-nginx/)
- [SSL/TLS](https://nginx.org/en/docs/http/configuring_https_servers.html)

---

## 🎓 Prochaines étapes

### Améliorations possibles

1. **Interface web de gestion** : Créer une vue EJS pour `/devices`
2. **Webhooks Keycloak** : Notification en temps réel des nouveaux devices
3. **Backchannel logout** : Déconnexion automatique de tous les devices
4. **Device metadata** : Stocker des infos supplémentaires (OS, IP, etc.)
5. **Notifications** : Alerter l'admin des nouvelles connexions
6. **Métriques** : Prometheus/Grafana pour monitoring
7. **Logs centralisés** : ELK stack pour analyse

### Production

- [ ] Configurer HTTPS partout
- [ ] Obtenir des certificats SSL (Let's Encrypt)
- [ ] Configurer les DNS
- [ ] Utiliser un gestionnaire de secrets (Vault, AWS Secrets Manager)
- [ ] Configurer le monitoring et alerting
- [ ] Mettre en place des backups
- [ ] Documenter le runbook d'exploitation

---

## 📝 Changelog

### Version 1.0.0 (2025-11-28)

**Ajouté** :
- Implémentation complète du Device Flow OAuth2
- Client CLI device-client
- Service de gestion des devices (Keycloak Admin API)
- Routes API pour la gestion des devices
- Configuration Nginx reverse proxy
- Documentation complète
- Docker Compose pour déploiement

**Sécurité** :
- Rate limiting
- Headers de sécurité
- Séparation des domaines
- Stockage sécurisé des tokens

---

## 👥 Support

Pour toute question ou problème :
1. Consulter cette documentation
2. Vérifier les logs : `docker-compose logs -f` ou `journalctl -u nginx`
3. Tester la configuration : `nginx -t`
4. Vérifier Keycloak : http://auth.monapp.fr

---

**Statut** : ✅ Implémentation complète prête pour déploiement
