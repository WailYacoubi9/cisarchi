# 🚀 Guide de Démarrage Rapide - OAuth2 Device Flow

## 📦 Démarrage des Services

```bash
# Démarrer tous les services Docker
cd nginx
docker-compose up -d

# Vérifier l'état des conteneurs
docker ps

# Attendre que Keycloak soit healthy (peut prendre 30-60 secondes)
watch -n 2 docker ps
# Sortir avec Ctrl+C quand tous sont "Up" et Keycloak est "(healthy)"
```

## ✅ Vérification de l'Installation

```bash
# Lancer le script de vérification
./verify-setup.sh

# Si tous les tests passent, vous êtes prêt ! ✅
```

## 🔐 Test Device Flow (Device-Client)

### Authentification

```bash
cd device-client
npm run login
```

**Ce qui se passe :**
1. Le CLI affiche une URL et un code utilisateur
2. Ouvrez l'URL dans votre navigateur
3. Entrez le code utilisateur
4. Connectez-vous avec vos identifiants
5. Le CLI récupère automatiquement le token

### Vérifier le Statut

```bash
npm run status
```

### Rafraîchir le Token

```bash
npm run refresh
```

### Se Déconnecter

```bash
npm run logout
```

## 🌐 Test Application Web (Webapp)

### Accéder à l'Application

```
http://localhost:3000
```

### Se Connecter

1. Cliquez sur "Se connecter"
2. Authentifiez-vous sur Keycloak
3. Vous serez redirigé vers votre profil

### Page de Profil

```
http://localhost:3000/profile
```

Affiche :
- Informations utilisateur
- État du token
- Temps avant expiration

### Page Admin (Gestion des Devices)

```
http://localhost:3000/admin/devices
```

**Note :** Nécessite le rôle `admin` !

## 👨‍💼 Ajouter le Rôle Admin à un Utilisateur

```bash
# 1. Accédez à la console Keycloak
# http://localhost:8080

# 2. Connectez-vous avec admin / [KEYCLOAK_ADMIN_PASSWORD]

# 3. Sélectionnez le realm "projetcis"

# 4. Menu "Users" → Sélectionnez votre utilisateur

# 5. Onglet "Role mappings"

# 6. "Assign role" → Sélectionnez "admin" → "Assign"
```

## 🧪 Test de l'API Device Management

### Ouvrez la console du navigateur (F12) sur http://localhost:3000

```javascript
// Lister les devices/sessions actives
fetch('/api/devices', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log);

// Obtenir les statistiques
fetch('/api/devices/stats', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log);

// Lister les événements récents
fetch('/api/devices/events?max=10', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log);

// Lister les clients OAuth2 configurés
fetch('/api/devices/clients', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log);

// Déconnecter une session spécifique
fetch('/api/devices/session/SESSION_ID', {
  method: 'DELETE',
  credentials: 'include'
}).then(r => r.json()).then(console.log);

// Déconnecter toutes les sessions d'un utilisateur
fetch('/api/devices/user/USER_ID/logout', {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json()).then(console.log);
```

## 📊 Monitoring et Logs

### Voir les logs en temps réel

```bash
# Tous les services
cd nginx
docker-compose logs -f

# Keycloak uniquement
docker logs -f cisarchi-keycloak

# Webapp uniquement
docker logs -f cisarchi-webapp

# Nginx uniquement
docker logs -f cisarchi-nginx
```

### Redémarrer un service

```bash
cd nginx

# Redémarrer Keycloak
docker-compose restart keycloak

# Redémarrer Webapp
docker-compose restart webapp

# Redémarrer tous les services
docker-compose restart
```

### Arrêter les services

```bash
cd nginx

# Arrêter tous les services
docker-compose down

# Arrêter et supprimer les volumes (⚠️ supprime les données !)
docker-compose down -v
```

## 🔧 Dépannage Rapide

### Problème : Keycloak ne démarre pas

```bash
# Vérifier les logs
docker logs cisarchi-keycloak

# Vérifier les variables d'environnement
cat nginx/.env

# Redémarrer proprement
cd nginx
docker-compose down
docker-compose up -d
```

### Problème : "Client not found: devicecis"

Le realm devrait déjà contenir le client `devicecis`. Si ce n'est pas le cas :

```bash
# Vérifier que realm.json est monté correctement
docker exec cisarchi-keycloak ls -la /opt/keycloak/data/import/

# Vérifier les logs d'import
docker logs cisarchi-keycloak | grep -i import

# Si nécessaire, recréer les conteneurs
cd nginx
docker-compose down -v
docker-compose up -d
```

### Problème : "Unauthorized" dans les requêtes API

```javascript
// Vérifiez que vous êtes authentifié
fetch('/api/devices', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log);

// Si erreur 401 : connectez-vous d'abord sur /login
// Si erreur 403 : vous n'avez pas le rôle admin
```

### Problème : Device-client timeout

```bash
# Vérifier que Keycloak est accessible
curl http://localhost:8080/health/ready

# Vérifier la configuration
cat device-client/.env

# Augmenter le timeout dans device-cli.js si nécessaire
```

## 📁 Structure du Projet

```
cisarchi/
├── device-client/           # CLI Device Flow
│   ├── device-cli.js        # Application principale
│   ├── package.json         # Dépendances
│   └── .env                 # Configuration
├── webapp2/                 # Application Web
│   ├── routes/
│   │   ├── auth.js          # Routes d'authentification
│   │   ├── devices.js       # Routes API devices
│   │   └── pages.js         # Pages web
│   ├── services/
│   │   └── deviceService.js # Keycloak Admin API
│   └── middleware/
│       └── auth.js          # Middleware auth
├── nginx/                   # Reverse Proxy
│   ├── docker-compose.yml   # Orchestration Docker
│   ├── nginx.conf           # Configuration Nginx
│   └── .env                 # Variables d'environnement
├── realm.json               # Configuration Keycloak realm
├── verify-setup.sh          # Script de vérification ✨
├── TESTING_GUIDE.md         # Guide de test complet 📖
└── ACTION_PLAN.md           # Plan d'implémentation détaillé 📋
```

## 🌐 URLs Importantes

| Service | URL | Description |
|---------|-----|-------------|
| Webapp | http://localhost:3000 | Application web principale |
| Profil | http://localhost:3000/profile | Page profil utilisateur |
| Admin Devices | http://localhost:3000/admin/devices | Gestion des devices (admin) |
| Keycloak Console | http://localhost:8080 | Console admin Keycloak |
| Keycloak Realm | http://localhost:8080/realms/projetcis | Configuration OpenID |
| Device Auth | http://localhost:8080/realms/projetcis/device | Device Flow endpoint |

## 📚 Documentation Complète

- **Guide de Test Détaillé** : `TESTING_GUIDE.md`
- **Plan d'Implémentation** : `ACTION_PLAN.md`
- **Documentation Device-Client** : `device-client/README.md`

## 🎯 Checklist de Démarrage

- [ ] Créer le fichier `nginx/.env` avec les credentials
- [ ] Lancer `docker-compose up -d` depuis le dossier `nginx/`
- [ ] Attendre que Keycloak soit `(healthy)` (~60 secondes)
- [ ] Exécuter `./verify-setup.sh` pour vérifier l'installation
- [ ] Tester Device Flow : `cd device-client && npm run login`
- [ ] Tester Webapp : http://localhost:3000
- [ ] Ajouter le rôle `admin` à votre utilisateur
- [ ] Tester l'API : ouvrir la console navigateur et tester les endpoints
- [ ] Vérifier la page admin : http://localhost:3000/admin/devices

## 🚀 Prochaines Étapes

1. ✅ Valider tous les tests dans `TESTING_GUIDE.md`
2. 🔒 Configurer SSL/TLS pour la production
3. 🌍 Configurer les domaines réels (auth.monapp.fr, www.monapp.fr)
4. 📊 Mettre en place le monitoring
5. 📝 Documenter les procédures de déploiement

---

**Besoin d'aide ?** Consultez `TESTING_GUIDE.md` pour un guide détaillé étape par étape !
