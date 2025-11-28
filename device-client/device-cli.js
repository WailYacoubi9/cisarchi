#!/usr/bin/env node
/**
 * Device Client - OAuth2 Device Flow Implementation
 *
 * Ce client implémente le Device Flow OAuth2 pour permettre l'authentification
 * sur des devices qui ne peuvent pas accepter de connexions entrantes
 * (derrière NAT/firewall).
 *
 * Flow:
 * 1. Demande d'autorisation device (obtient device_code et user_code)
 * 2. Affiche l'URL de vérification et le code à l'utilisateur
 * 3. Poll le serveur d'autorisation pour obtenir le token
 * 4. Stocke le token et le refresh token
 * 5. Gère le refresh automatique du token
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
    keycloakUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.REALM || 'projetcis',
    clientId: process.env.DEVICE_CLIENT_ID || 'devicecis',
    tokenFile: path.join(__dirname, '.device-tokens.json'),
    pollingInterval: 5000, // 5 secondes
};

// URLs Keycloak
const ENDPOINTS = {
    deviceAuth: `${CONFIG.keycloakUrl}/realms/${CONFIG.realm}/protocol/openid-connect/auth/device`,
    token: `${CONFIG.keycloakUrl}/realms/${CONFIG.realm}/protocol/openid-connect/token`,
    userInfo: `${CONFIG.keycloakUrl}/realms/${CONFIG.realm}/protocol/openid-connect/userinfo`,
    logout: `${CONFIG.keycloakUrl}/realms/${CONFIG.realm}/protocol/openid-connect/logout`,
};

/**
 * Classe principale pour gérer l'authentification Device Flow
 */
class DeviceFlowClient {
    constructor() {
        this.tokens = null;
        this.refreshTimer = null;
    }

    /**
     * Démarre le processus d'authentification Device Flow
     */
    async authenticate() {
        console.log('🔐 Démarrage de l\'authentification Device Flow...\n');

        try {
            // Étape 1: Demander l'autorisation device
            const deviceAuth = await this.requestDeviceAuthorization();

            // Étape 2: Afficher les instructions à l'utilisateur
            this.displayUserInstructions(deviceAuth);

            // Étape 3: Démarrer le polling pour obtenir le token
            const tokens = await this.pollForToken(deviceAuth);

            // Étape 4: Sauvegarder les tokens
            await this.saveTokens(tokens);

            // Étape 5: Configurer le refresh automatique
            this.scheduleTokenRefresh();

            console.log('\n✅ Authentification réussie !');
            return tokens;

        } catch (error) {
            console.error('❌ Erreur d\'authentification:', error.message);
            throw error;
        }
    }

    /**
     * Étape 1: Demander l'autorisation device à Keycloak
     */
    async requestDeviceAuthorization() {
        try {
            const response = await axios.post(
                ENDPOINTS.deviceAuth,
                new URLSearchParams({
                    client_id: CONFIG.clientId,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            return response.data;
        } catch (error) {
            throw new Error(`Échec de la demande d'autorisation: ${error.message}`);
        }
    }

    /**
     * Étape 2: Afficher les instructions à l'utilisateur
     */
    displayUserInstructions(deviceAuth) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 AUTHENTIFICATION REQUISE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(`1. Ouvrez cette URL dans votre navigateur:`);
        console.log(`   ${deviceAuth.verification_uri_complete || deviceAuth.verification_uri}\n`);

        if (!deviceAuth.verification_uri_complete) {
            console.log(`2. Entrez ce code:`);
            console.log(`   ${deviceAuth.user_code}\n`);
        }

        console.log(`⏱️  Ce code expire dans ${Math.floor(deviceAuth.expires_in / 60)} minutes\n`);
        console.log('⏳ En attente de votre authentification...\n');
    }

    /**
     * Étape 3: Polling pour obtenir le token
     */
    async pollForToken(deviceAuth) {
        const interval = (deviceAuth.interval || 5) * 1000;
        const expiresAt = Date.now() + (deviceAuth.expires_in * 1000);

        while (Date.now() < expiresAt) {
            try {
                const response = await axios.post(
                    ENDPOINTS.token,
                    new URLSearchParams({
                        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                        device_code: deviceAuth.device_code,
                        client_id: CONFIG.clientId,
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    }
                );

                return response.data;

            } catch (error) {
                if (error.response) {
                    const errorCode = error.response.data.error;

                    switch (errorCode) {
                        case 'authorization_pending':
                            // L'utilisateur n'a pas encore autorisé, continuer le polling
                            await this.sleep(interval);
                            continue;

                        case 'slow_down':
                            // Ralentir le polling
                            await this.sleep(interval + 5000);
                            continue;

                        case 'access_denied':
                            throw new Error('L\'utilisateur a refusé l\'autorisation');

                        case 'expired_token':
                            throw new Error('Le code d\'autorisation a expiré');

                        default:
                            throw new Error(`Erreur: ${errorCode}`);
                    }
                }
                throw error;
            }
        }

        throw new Error('Délai d\'attente expiré');
    }

    /**
     * Étape 4: Sauvegarder les tokens dans un fichier
     */
    async saveTokens(tokens) {
        this.tokens = {
            ...tokens,
            obtained_at: Date.now(),
            expires_at: Date.now() + (tokens.expires_in * 1000),
        };

        try {
            await fs.writeFile(
                CONFIG.tokenFile,
                JSON.stringify(this.tokens, null, 2),
                { mode: 0o600 } // Permissions restrictives
            );
        } catch (error) {
            console.warn('⚠️  Impossible de sauvegarder les tokens:', error.message);
        }
    }

    /**
     * Charger les tokens depuis le fichier
     */
    async loadTokens() {
        try {
            const data = await fs.readFile(CONFIG.tokenFile, 'utf-8');
            this.tokens = JSON.parse(data);

            // Vérifier si le token est expiré
            if (Date.now() >= this.tokens.expires_at) {
                console.log('🔄 Token expiré, refresh en cours...');
                await this.refreshToken();
            }

            return this.tokens;
        } catch (error) {
            return null;
        }
    }

    /**
     * Rafraîchir le token d'accès
     */
    async refreshToken() {
        if (!this.tokens || !this.tokens.refresh_token) {
            throw new Error('Aucun refresh token disponible');
        }

        try {
            const response = await axios.post(
                ENDPOINTS.token,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: this.tokens.refresh_token,
                    client_id: CONFIG.clientId,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            await this.saveTokens(response.data);
            console.log('✅ Token rafraîchi avec succès');

            return this.tokens;
        } catch (error) {
            console.error('❌ Échec du refresh:', error.message);
            // Si le refresh échoue, supprimer les tokens et ré-authentifier
            await this.clearTokens();
            throw new Error('Veuillez vous ré-authentifier');
        }
    }

    /**
     * Planifier le refresh automatique du token
     */
    scheduleTokenRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        if (!this.tokens || !this.tokens.expires_at) {
            return;
        }

        // Rafraîchir 1 minute avant l'expiration
        const refreshIn = this.tokens.expires_at - Date.now() - 60000;

        if (refreshIn > 0) {
            this.refreshTimer = setTimeout(async () => {
                try {
                    await this.refreshToken();
                    this.scheduleTokenRefresh();
                } catch (error) {
                    console.error('❌ Erreur lors du refresh automatique:', error.message);
                }
            }, refreshIn);
        }
    }

    /**
     * Obtenir les informations de l'utilisateur
     */
    async getUserInfo() {
        if (!this.tokens) {
            await this.loadTokens();
        }

        if (!this.tokens) {
            throw new Error('Aucun token disponible. Veuillez vous authentifier.');
        }

        try {
            const response = await axios.get(ENDPOINTS.userInfo, {
                headers: {
                    Authorization: `Bearer ${this.tokens.access_token}`,
                },
            });

            return response.data;
        } catch (error) {
            throw new Error(`Échec de récupération des informations utilisateur: ${error.message}`);
        }
    }

    /**
     * Se déconnecter
     */
    async logout() {
        if (!this.tokens) {
            console.log('Aucune session active');
            return;
        }

        try {
            await axios.post(
                ENDPOINTS.logout,
                new URLSearchParams({
                    client_id: CONFIG.clientId,
                    refresh_token: this.tokens.refresh_token,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            await this.clearTokens();
            console.log('✅ Déconnexion réussie');
        } catch (error) {
            console.error('❌ Erreur lors de la déconnexion:', error.message);
            await this.clearTokens();
        }
    }

    /**
     * Supprimer les tokens
     */
    async clearTokens() {
        this.tokens = null;
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        try {
            await fs.unlink(CONFIG.tokenFile);
        } catch (error) {
            // Fichier déjà supprimé ou n'existe pas
        }
    }

    /**
     * Utilitaire: sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Interface en ligne de commande
 */
async function main() {
    const client = new DeviceFlowClient();
    const args = process.argv.slice(2);
    const command = args[0] || 'login';

    try {
        switch (command) {
            case 'login':
                await client.authenticate();
                const userInfo = await client.getUserInfo();
                console.log('\n👤 Utilisateur connecté:', userInfo.preferred_username);
                console.log('📧 Email:', userInfo.email);
                break;

            case 'status':
                const tokens = await client.loadTokens();
                if (tokens) {
                    const info = await client.getUserInfo();
                    console.log('✅ Session active');
                    console.log('👤 Utilisateur:', info.preferred_username);
                    console.log('📧 Email:', info.email);
                    const expiresIn = Math.floor((tokens.expires_at - Date.now()) / 1000);
                    console.log(`⏱️  Expire dans: ${expiresIn} secondes`);
                } else {
                    console.log('❌ Aucune session active');
                }
                break;

            case 'logout':
                await client.loadTokens();
                await client.logout();
                break;

            case 'refresh':
                await client.loadTokens();
                await client.refreshToken();
                console.log('✅ Token rafraîchi');
                break;

            case 'help':
                console.log('Usage: node device-cli.js [command]');
                console.log('\nCommandes disponibles:');
                console.log('  login    - S\'authentifier avec Device Flow (défaut)');
                console.log('  status   - Vérifier le statut de la session');
                console.log('  logout   - Se déconnecter');
                console.log('  refresh  - Rafraîchir le token');
                console.log('  help     - Afficher cette aide');
                break;

            default:
                console.error(`❌ Commande inconnue: ${command}`);
                console.log('Utilisez "help" pour voir les commandes disponibles');
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

// Exporter la classe pour utilisation en tant que module
module.exports = DeviceFlowClient;

// Exécuter le CLI si appelé directement
if (require.main === module) {
    main();
}
