# Configuration Nginx - Reverse Proxy

Ce dossier contient la configuration Nginx pour le reverse proxy qui sépare :
- **auth.monapp.fr** : Serveur d'authentification (Keycloak)
- **www.monapp.fr** : Application principale (webapp2)

## Architecture

```
┌─────────────┐
│   Client    │
│  (Device)   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Nginx Reverse Proxy         │
│                                     │
│  ┌───────────────┐ ┌──────────────┐│
│  │ auth.monapp.fr│ │www.monapp.fr ││
│  └───────┬───────┘ └──────┬───────┘│
└──────────┼────────────────┼────────┘
           │                │
           ▼                ▼
    ┌──────────┐     ┌──────────┐
    │ Keycloak │     │  webapp2 │
    │  :8080   │     │  :3000   │
    └──────────┘     └──────────┘
```

## Configuration locale (développement)

### 1. Modifier /etc/hosts

Ajoutez ces lignes à votre fichier `/etc/hosts` :

```
127.0.0.1 auth.localhost
127.0.0.1 www.localhost
127.0.0.1 auth.monapp.fr
127.0.0.1 www.monapp.fr
```

Sur **Linux/Mac** : `/etc/hosts`
Sur **Windows** : `C:\Windows\System32\drivers\etc\hosts`

### 2. Démarrer avec Docker Compose

```bash
# Copier le fichier .env
cp .env.example .env

# Éditer .env et remplir les valeurs
nano .env

# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter les services
docker-compose down
```

### 3. Accéder aux services

- **Application** : http://www.monapp.fr ou http://www.localhost
- **Authentification** : http://auth.monapp.fr ou http://auth.localhost
- **Health Check** : http://localhost:8888/health
- **Nginx Status** : http://localhost:8888/nginx_status

## Configuration manuelle (sans Docker)

Si vous préférez installer Nginx directement :

### 1. Installer Nginx

**Ubuntu/Debian** :
```bash
sudo apt update
sudo apt install nginx
```

**macOS** :
```bash
brew install nginx
```

**Windows** :
Télécharger depuis http://nginx.org/en/download.html

### 2. Copier la configuration

```bash
# Linux
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo nginx -t  # Tester la configuration
sudo systemctl restart nginx

# macOS
sudo cp nginx.conf /usr/local/etc/nginx/nginx.conf
nginx -t
brew services restart nginx

# Windows
copy nginx.conf C:\nginx\conf\nginx.conf
nginx -t
nginx -s reload
```

### 3. Démarrer les services backend

```bash
# Terminal 1 : Keycloak
cd /path/to/cisarchi
docker run -d --name keycloak -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -v $(pwd)/realm.json:/opt/keycloak/data/import/realm.json \
  quay.io/keycloak/keycloak:latest start-dev --import-realm

# Terminal 2 : webapp2
cd /path/to/cisarchi/webapp2
npm install
npm start
```

## Configuration en production

Pour la production, il est recommandé de :

1. **Utiliser HTTPS** : Décommenter les blocs `server` HTTPS dans `nginx.conf`
2. **Obtenir des certificats SSL** : Utilisez Let's Encrypt avec certbot
3. **Configurer les DNS** : Pointer `auth.monapp.fr` et `www.monapp.fr` vers votre serveur
4. **Activer les headers de sécurité** : HSTS, CSP, etc.
5. **Configurer le rate limiting** : Ajuster selon vos besoins

### Obtenir des certificats SSL avec Let's Encrypt

```bash
# Installer certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir les certificats
sudo certbot --nginx -d auth.monapp.fr -d www.monapp.fr -d monapp.fr

# Les certificats seront automatiquement configurés dans nginx
```

## Rate Limiting

La configuration inclut du rate limiting :

- **auth.monapp.fr** : 10 requêtes/minute (endpoints d'authentification)
- **www.monapp.fr/api/** : 100 requêtes/minute (API endpoints)

Ajustez ces valeurs dans `nginx.conf` selon vos besoins :

```nginx
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
```

## Monitoring

### Health Check

```bash
curl http://localhost:8888/health
# Devrait retourner: healthy
```

### Nginx Status

```bash
curl http://localhost:8888/nginx_status
```

### Logs

```bash
# Avec Docker
docker-compose logs -f nginx

# Installation manuelle
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Nginx ne démarre pas

```bash
# Tester la configuration
nginx -t

# Voir les erreurs
journalctl -u nginx -f  # Linux
tail -f /usr/local/var/log/nginx/error.log  # macOS
```

### Erreur 502 Bad Gateway

Vérifiez que les services backend sont démarrés :

```bash
# Keycloak
curl http://localhost:8080

# webapp2
curl https://localhost:3000
```

### Impossible d'accéder à auth.monapp.fr

Vérifiez le fichier `/etc/hosts` et assurez-vous que la ligne est bien ajoutée.

## Sécurité

- ✅ Rate limiting configuré
- ✅ Headers de sécurité (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ Version Nginx masquée
- ✅ HTTPS recommandé en production
- ✅ Séparation des domaines (app vs auth)
- ✅ Proxy headers correctement configurés

## Support

Pour plus d'informations, consultez :
- [Documentation Nginx](https://nginx.org/en/docs/)
- [Guide Keycloak Reverse Proxy](https://www.keycloak.org/server/reverseproxy)
