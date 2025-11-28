# Device Client - OAuth2 Device Flow

Client CLI Node.js implémentant le **OAuth2 Device Flow** pour l'authentification sur des devices qui ne peuvent pas accepter de connexions entrantes (derrière NAT/firewall).

## 🎯 Cas d'usage

Ce client est conçu pour :
- **Devices IoT** : Appareils sans interface utilisateur complète
- **Applications CLI** : Scripts et outils en ligne de commande
- **Machines isolées** : Serveurs derrière NAT/firewall
- **TV connectées** : Appareils avec interface limitée

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Copier la configuration
cp .env.example .env

# Éditer la configuration
nano .env
```

## ⚙️ Configuration

Fichier `.env` :

```env
KEYCLOAK_URL=http://auth.monapp.fr
REALM=projetcis
DEVICE_CLIENT_ID=devicecis
```

## 📖 Utilisation

### Commandes disponibles

```bash
# S'authentifier (Device Flow)
npm run login
# ou
node device-cli.js login

# Vérifier le statut de la session
npm run status
# ou
node device-cli.js status

# Se déconnecter
npm run logout
# ou
node device-cli.js logout

# Rafraîchir le token
npm run refresh
# ou
node device-cli.js refresh

# Afficher l'aide
node device-cli.js help
```

### Exemple complet

```bash
# 1. Lancer l'authentification
$ npm run login

🔐 Démarrage de l'authentification Device Flow...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 AUTHENTIFICATION REQUISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Ouvrez cette URL dans votre navigateur:
   http://auth.monapp.fr/realms/projetcis/device?user_code=ABCD-EFGH

⏱️  Ce code expire dans 10 minutes

⏳ En attente de votre authentification...

# 2. Ouvrir l'URL dans un navigateur
# 3. Se connecter avec vos identifiants
# 4. Autoriser l'application

✅ Authentification réussie !

👤 Utilisateur connecté: john.doe
📧 Email: john.doe@example.com

# 5. Vérifier le statut
$ npm run status

✅ Session active
👤 Utilisateur: john.doe
📧 Email: john.doe@example.com
⏱️  Expire dans: 420 secondes
```

## 🔐 Sécurité

### Stockage des tokens

Les tokens sont stockés dans `.device-tokens.json` avec des permissions restrictives (`0600`) :

```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "token_type": "Bearer",
  "obtained_at": 1700000000000,
  "expires_at": 1700000300000
}
```

⚠️ **Important** :
- Ce fichier contient des informations sensibles
- Ne jamais le committer dans Git (déjà dans `.gitignore`)
- Permissions 0600 = lecture/écriture uniquement par le propriétaire

### Refresh automatique

Le client rafraîchit automatiquement le token 1 minute avant son expiration.

### Public Client

Ce client est configuré comme **public client** dans Keycloak :
- Pas de client secret
- Sécurisé par le Device Flow lui-même
- Le user_code sert de preuve d'autorisation

## 🔧 Utilisation comme module

Vous pouvez également utiliser ce client comme module dans votre code :

```javascript
const DeviceFlowClient = require('./device-cli');

async function main() {
    const client = new DeviceFlowClient();

    try {
        // Charger les tokens existants
        const tokens = await client.loadTokens();

        if (!tokens) {
            // Pas de token, lancer l'authentification
            await client.authenticate();
        }

        // Obtenir les informations utilisateur
        const userInfo = await client.getUserInfo();
        console.log('Utilisateur:', userInfo.preferred_username);

        // Utiliser le token pour une requête
        const response = await fetch('https://api.example.com/data', {
            headers: {
                'Authorization': `Bearer ${client.tokens.access_token}`
            }
        });

        const data = await response.json();
        console.log(data);

    } catch (error) {
        console.error('Erreur:', error.message);
    }
}

main();
```

## 📚 API

### Classe `DeviceFlowClient`

#### Méthodes

| Méthode | Description | Retour |
|---------|-------------|--------|
| `authenticate()` | Lance le Device Flow complet | `Promise<tokens>` |
| `loadTokens()` | Charge les tokens depuis le fichier | `Promise<tokens \| null>` |
| `refreshToken()` | Rafraîchit le token d'accès | `Promise<tokens>` |
| `getUserInfo()` | Récupère les infos utilisateur | `Promise<userInfo>` |
| `logout()` | Se déconnecte et supprime les tokens | `Promise<void>` |
| `clearTokens()` | Supprime les tokens localement | `Promise<void>` |

#### Configuration

```javascript
const CONFIG = {
    keycloakUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.REALM || 'projetcis',
    clientId: process.env.DEVICE_CLIENT_ID || 'devicecis',
    tokenFile: path.join(__dirname, '.device-tokens.json'),
    pollingInterval: 5000, // 5 secondes
};
```

## 🐛 Troubleshooting

### Erreur : "authorization_pending"

**Cause** : L'utilisateur n'a pas encore autorisé le device

**Solution** : Attendre que l'utilisateur se connecte et entre le code

---

### Erreur : "expired_token"

**Cause** : Le code d'autorisation a expiré (> 10 min)

**Solution** : Relancer `npm run login`

---

### Erreur : "slow_down"

**Cause** : Polling trop rapide

**Solution** : Le client ralentit automatiquement (rien à faire)

---

### Erreur : "access_denied"

**Cause** : L'utilisateur a refusé l'autorisation

**Solution** : Relancer `npm run login` et accepter l'autorisation

---

### Erreur : "Cannot find module 'axios'"

**Cause** : Dépendances non installées

**Solution** :
```bash
npm install
```

---

### Erreur : "ECONNREFUSED"

**Cause** : Keycloak n'est pas accessible

**Solution** :
1. Vérifier que Keycloak est démarré : `curl http://auth.monapp.fr`
2. Vérifier `KEYCLOAK_URL` dans `.env`
3. Vérifier `/etc/hosts` si en développement local

---

## 🔄 Flow détaillé

```
┌─────────────┐                                    ┌──────────────┐
│   Device    │                                    │   Keycloak   │
│   Client    │                                    │ (Auth Server)│
└──────┬──────┘                                    └──────┬───────┘
       │                                                  │
       │ 1. POST /auth/device                            │
       │    client_id=devicecis                          │
       ├────────────────────────────────────────────────▶│
       │                                                  │
       │ 2. device_code, user_code, verification_uri     │
       │◀────────────────────────────────────────────────┤
       │                                                  │
       │ 3. Afficher à l'utilisateur :                   │
       │    URL + user_code                              │
       │                                                  │
       │                  ┌──────────────┐               │
       │                  │ Utilisateur  │               │
       │                  │ (navigateur) │               │
       │                  └──────┬───────┘               │
       │                         │                       │
       │                         │ 4. Ouvre l'URL        │
       │                         ├──────────────────────▶│
       │                         │                       │
       │                         │ 5. Se connecte        │
       │                         │    + entre user_code  │
       │                         ├──────────────────────▶│
       │                         │                       │
       │                         │ 6. Autorisation OK    │
       │                         │◀──────────────────────┤
       │                         │                       │
       │ 7. POST /token (polling)                        │
       │    grant_type=device_code                       │
       ├────────────────────────────────────────────────▶│
       │                                                  │
       │ 8. access_token + refresh_token                 │
       │◀────────────────────────────────────────────────┤
       │                                                  │
       │ 9. Sauvegarder les tokens                       │
       │                                                  │
       │ 10. Utiliser access_token pour les requêtes     │
       │                                                  │
       │ 11. Refresh automatique avant expiration        │
       │                                                  │
```

## 📄 Fichiers

```
device-client/
├── device-cli.js          # Application principale (240 lignes)
├── package.json           # Dépendances et scripts
├── .env.example           # Configuration exemple
├── .gitignore            # Fichiers à ignorer
├── README.md             # Cette documentation
└── .device-tokens.json   # Tokens (créé automatiquement, gitignored)
```

## 🔗 Liens utiles

- [RFC 8628 - OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628)
- [Keycloak Device Flow Documentation](https://www.keycloak.org/docs/latest/securing_apps/#_device_authorization_grant)
- [Documentation complète du projet](../ACTION_PLAN.md)

## 📝 License

ISC
