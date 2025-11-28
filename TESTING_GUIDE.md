# Guide de Test - OAuth2 Device Flow

## 📋 Pré-requis

Avant de commencer les tests, vérifiez que tous les conteneurs Docker sont démarrés et sains :

```bash
docker ps
```

Vous devriez voir :
- `cisarchi-keycloak` - Status: `Up (healthy)`
- `cisarchi-webapp` - Status: `Up`
- `cisarchi-nginx` - Status: `Up`

Si Keycloak n'est pas encore `healthy`, attendez environ 30-60 secondes supplémentaires.

---

## 🧪 Phase 1 : Test du Device Flow (Device-Client)

### 1.1 Accéder au répertoire device-client

```bash
cd device-client
```

### 1.2 Vérifier la configuration

Le fichier `.env` devrait contenir :

```env
DEVICE_CLIENT_ID=devicecis
KEYCLOAK_URL=http://localhost:8080
REALM=projetcis
TOKEN_FILE=.device-tokens.json
```

### 1.3 Lancer l'authentification Device Flow

```bash
npm run login
```

**Comportement attendu :**
1. Le CLI affiche :
   ```
   🔐 Authentification Device Flow
   ════════════════════════════════

   👉 Ouvrez cette URL dans votre navigateur :
   http://localhost:8080/realms/projetcis/device

   🔢 Code utilisateur : XXXX-XXXX

   ⏳ En attente de votre authentification...
   ```

2. Ouvrez l'URL affichée dans votre navigateur
3. Entrez le code utilisateur (XXXX-XXXX)
4. Connectez-vous avec vos identifiants Keycloak :
   - Username: `admin` ou créez un nouvel utilisateur
   - Password: votre mot de passe
5. Autorisez l'accès
6. Le CLI devrait afficher :
   ```
   ✅ Authentification réussie !
   Token sauvegardé dans .device-tokens.json
   ```

### 1.4 Vérifier le statut de l'authentification

```bash
npm run status
```

**Résultat attendu :**
```
📊 Statut de l'authentification
════════════════════════════════
✅ Authentifié
👤 Utilisateur : admin
📧 Email : admin@example.com
⏰ Token expire dans : XXX secondes
🔄 Refresh token disponible
```

### 1.5 Tester le rafraîchissement du token

```bash
npm run refresh
```

**Résultat attendu :**
```
🔄 Rafraîchissement du token...
✅ Token rafraîchi avec succès !
Nouveau token expire dans XXX secondes
```

### 1.6 Tester la déconnexion

```bash
npm run logout
```

**Résultat attendu :**
```
🚪 Déconnexion...
✅ Déconnexion réussie
Token révoqué et fichier de tokens supprimé
```

---

## 🌐 Phase 2 : Test de l'Application Web (webapp2)

### 2.1 Accéder à l'application

Ouvrez votre navigateur et accédez à :
```
http://localhost:3000
```

### 2.2 Tester le flux d'authentification Web

1. Cliquez sur "Se connecter"
2. Vous serez redirigé vers Keycloak
3. Connectez-vous (ou inscrivez-vous)
4. Vous serez redirigé vers `/profile`

### 2.3 Vérifier le profil utilisateur

Sur la page `/profile`, vous devriez voir :
- Votre nom d'utilisateur
- Votre email
- Vos rôles
- L'état de votre token (temps restant)
- Vos informations de session

---

## 🔧 Phase 3 : Test de l'API Device Management

### 3.1 Prérequis

1. Connectez-vous à webapp2 (http://localhost:3000)
2. Assurez-vous d'être connecté avec un compte administrateur
3. Ouvrez les DevTools de votre navigateur (F12)

### 3.2 Tester la liste des devices

Dans la console du navigateur :

```javascript
fetch('/api/devices', {
    credentials: 'include'
})
.then(r => r.json())
.then(console.log);
```

**Résultat attendu :**
```json
{
  "success": true,
  "count": 2,
  "devices": [
    {
      "id": "session-id-1",
      "userId": "user-id",
      "username": "admin",
      "ipAddress": "172.18.0.1",
      "start": 1701234567890,
      "lastAccess": 1701234890123,
      "clients": {
        "devicecis": "active"
      }
    }
  ]
}
```

### 3.3 Tester les statistiques

```javascript
fetch('/api/devices/stats', {
    credentials: 'include'
})
.then(r => r.json())
.then(console.log);
```

**Résultat attendu :**
```json
{
  "success": true,
  "stats": {
    "totalSessions": 2,
    "activeUsers": 1,
    "clientBreakdown": {
      "webapp": 1,
      "devicecis": 1
    }
  }
}
```

### 3.4 Tester la récupération des sessions d'un utilisateur

Remplacez `USER_ID` par l'ID d'un utilisateur réel :

```javascript
fetch('/api/devices/user/USER_ID', {
    credentials: 'include'
})
.then(r => r.json())
.then(console.log);
```

### 3.5 Tester les événements récents

```javascript
fetch('/api/devices/events?type=LOGIN&max=10', {
    credentials: 'include'
})
.then(r => r.json())
.then(console.log);
```

### 3.6 Tester la liste des clients OAuth2

```javascript
fetch('/api/devices/clients', {
    credentials: 'include'
})
.then(r => r.json())
.then(console.log);
```

**Résultat attendu :**
```json
{
  "success": true,
  "count": 2,
  "clients": [
    {
      "id": "client-uuid",
      "clientId": "webapp",
      "name": "WebApp Client",
      "enabled": true,
      "publicClient": false
    },
    {
      "id": "client-uuid-2",
      "clientId": "devicecis",
      "name": "Device Client",
      "enabled": true,
      "publicClient": true
    }
  ]
}
```

---

## 👨‍💼 Phase 4 : Test de l'Interface Admin

### 4.1 Accéder à la page d'administration

Connectez-vous avec un compte admin et accédez à :
```
http://localhost:3000/admin/devices
```

**Note :** Si vous n'êtes pas admin, vous devriez voir :
```json
{
  "error": "Forbidden",
  "message": "Droits administrateur requis"
}
```

### 4.2 Ajouter le rôle admin à un utilisateur

Si nécessaire, ajoutez le rôle admin via Keycloak :

1. Accédez à http://localhost:8080
2. Connectez-vous à la console admin (admin / KEYCLOAK_ADMIN_PASSWORD)
3. Sélectionnez le realm `projetcis`
4. Allez dans "Users" → Sélectionnez votre utilisateur
5. Onglet "Role mappings"
6. Cliquez "Assign role"
7. Sélectionnez "admin" (dans "Filter by realm roles")
8. Cliquez "Assign"

### 4.3 Vérifier la page admin

La page devrait afficher :
- Tableau des devices/sessions actives
- Options pour filtrer par utilisateur
- Boutons pour déconnecter des devices
- Statistiques en temps réel

---

## 🔥 Phase 5 : Tests de Déconnexion

### 5.1 Déconnecter une session spécifique (API)

```javascript
// Récupérez d'abord un sessionId via /api/devices
fetch('/api/devices/session/SESSION_ID', {
    method: 'DELETE',
    credentials: 'include'
})
.then(r => r.json())
.then(console.log);
```

**Résultat attendu :**
```json
{
  "success": true,
  "message": "Session supprimée avec succès"
}
```

### 5.2 Déconnecter toutes les sessions d'un utilisateur

```javascript
fetch('/api/devices/user/USER_ID/logout', {
    method: 'POST',
    credentials: 'include'
})
.then(r => r.json())
.then(console.log);
```

---

## 🧩 Phase 6 : Test Intégré Device + Web

### 6.1 Scénario complet

1. **Device-client** : Authentifiez un device
   ```bash
   cd device-client
   npm run login
   ```

2. **Webapp** : Connectez-vous sur http://localhost:3000

3. **API** : Vérifiez que les deux sessions apparaissent
   ```javascript
   fetch('/api/devices', { credentials: 'include' })
   .then(r => r.json())
   .then(data => {
       console.log(`Nombre de sessions actives : ${data.count}`);
       console.log(data.devices);
   });
   ```

4. **Device-client** : Vérifiez le statut
   ```bash
   npm run status
   ```

5. **API** : Déconnectez le device via l'API
   ```javascript
   // Trouvez le sessionId du device dans la liste
   fetch('/api/devices/session/DEVICE_SESSION_ID', {
       method: 'DELETE',
       credentials: 'include'
   });
   ```

6. **Device-client** : Vérifiez que le device est déconnecté
   ```bash
   npm run status
   # Devrait afficher "❌ Non authentifié"
   ```

---

## 🐛 Dépannage

### Problème : "Unauthorized" lors d'appels API

**Solution :**
- Assurez-vous d'être authentifié sur webapp2
- Vérifiez que votre session est active (`credentials: 'include'`)
- Pour les routes admin, vérifiez que vous avez le rôle `admin`

### Problème : Device-client timeout

**Solution :**
- Vérifiez que Keycloak est accessible : http://localhost:8080
- Vérifiez le fichier `.env` dans device-client
- Augmentez le timeout dans device-cli.js (ligne avec `interval`)

### Problème : "Client not found: devicecis"

**Solution :**
Le client `devicecis` n'existe pas dans Keycloak. Créez-le :

1. Accédez à http://localhost:8080
2. Console admin → Realm `projetcis`
3. "Clients" → "Create client"
4. Configuration :
   - Client ID: `devicecis`
   - Client type: `OpenID Connect`
   - Client authentication: `OFF` (public client)
   - Authorization: `OFF`
   - Authentication flow: Cochez uniquement "OAuth 2.0 Device Authorization Grant"
   - Valid redirect URIs: `*` (ou configurez spécifiquement)

### Problème : CORS errors

**Solution :**
- Si vous testez depuis un autre domaine, ajoutez les headers CORS dans nginx.conf
- Pour les tests locaux, utilisez `credentials: 'include'` dans fetch()

### Problème : Healthcheck ne passe pas

**Solution :**
```bash
# Vérifiez les logs Keycloak
docker logs cisarchi-keycloak

# Si nécessaire, redémarrez
docker-compose -f nginx/docker-compose.yml restart keycloak
```

---

## ✅ Checklist de Validation

- [ ] Device-client peut s'authentifier via Device Flow
- [ ] Le code utilisateur s'affiche correctement
- [ ] L'authentification dans le navigateur fonctionne
- [ ] Le token est sauvegardé dans .device-tokens.json
- [ ] Le refresh token fonctionne
- [ ] La déconnexion du device fonctionne
- [ ] Webapp2 permet l'authentification web (Authorization Code Flow)
- [ ] La page /profile affiche les informations utilisateur
- [ ] L'API /api/devices liste les sessions actives
- [ ] L'API /api/devices/stats retourne les statistiques
- [ ] L'API permet de déconnecter des sessions
- [ ] La page /admin/devices est accessible (avec rôle admin)
- [ ] Un admin peut déconnecter d'autres utilisateurs
- [ ] Les événements sont enregistrés et récupérables
- [ ] Nginx route correctement les requêtes (si configuré)

---

## 📊 Résultats Attendus

À la fin des tests, vous devriez avoir :

1. ✅ Device Flow fonctionnel pour devices isolés
2. ✅ Web Flow (Authorization Code + PKCE) pour webapp
3. ✅ API de gestion des devices via Keycloak Admin API
4. ✅ Interface admin pour visualiser et gérer les sessions
5. ✅ Refresh tokens fonctionnels des deux côtés
6. ✅ Révocation de tokens opérationnelle

---

## 🚀 Prochaines Étapes

Une fois les tests validés :

1. **Production** :
   - Configurer SSL/TLS dans nginx
   - Utiliser des secrets sécurisés (pas en .env)
   - Configurer les domaines réels (auth.monapp.fr, www.monapp.fr)

2. **Sécurité** :
   - Activer le mode production Keycloak (pas start-dev)
   - Configurer des limites de taux (rate limiting)
   - Ajouter HTTPS obligatoire

3. **Monitoring** :
   - Logger les événements d'authentification
   - Configurer des alertes pour activités suspectes
   - Mettre en place des métriques

4. **Documentation** :
   - Documenter le processus de déploiement
   - Créer un guide utilisateur pour le device-client
   - Documenter l'API REST
