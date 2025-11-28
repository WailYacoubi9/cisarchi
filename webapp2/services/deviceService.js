/**
 * Device Service - Gestion des devices via Keycloak Admin API
 *
 * Ce service permet de gérer les devices connectés via le Device Flow OAuth2.
 * Il utilise l'API Admin de Keycloak pour :
 * - Lister les sessions actives des devices
 * - Obtenir les détails d'un device
 * - Déconnecter un device
 * - Surveiller l'activité des devices
 */

const axios = require('axios');

class DeviceService {
    constructor(keycloakUrl, realm, adminCredentials) {
        this.keycloakUrl = keycloakUrl;
        this.realm = realm;
        this.adminCredentials = adminCredentials;
        this.adminToken = null;
        this.tokenExpiresAt = 0;
    }

    /**
     * Obtenir un token d'administration Keycloak
     */
    async getAdminToken() {
        // Si le token est encore valide, le retourner
        if (this.adminToken && Date.now() < this.tokenExpiresAt) {
            return this.adminToken;
        }

        try {
            const response = await axios.post(
                `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`,
                new URLSearchParams({
                    grant_type: 'password',
                    client_id: 'admin-cli',
                    username: this.adminCredentials.username,
                    password: this.adminCredentials.password,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            this.adminToken = response.data.access_token;
            // Expiration 30 secondes avant la vraie expiration
            this.tokenExpiresAt = Date.now() + ((response.data.expires_in - 30) * 1000);

            return this.adminToken;
        } catch (error) {
            console.error('Erreur lors de l\'obtention du token admin:', error.message);
            throw new Error('Impossible d\'obtenir le token d\'administration Keycloak');
        }
    }

    /**
     * Faire une requête à l'API Admin Keycloak
     */
    async adminRequest(method, endpoint, data = null) {
        const token = await this.getAdminToken();

        try {
            const config = {
                method,
                url: `${this.keycloakUrl}/admin/realms/${this.realm}${endpoint}`,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            };

            if (data) {
                config.data = data;
            }

            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(`API Keycloak error: ${error.response.status} - ${error.response.statusText}`);
            }
            throw error;
        }
    }

    /**
     * Lister tous les utilisateurs avec leurs sessions actives
     */
    async listActiveSessions() {
        try {
            // Récupérer tous les utilisateurs
            const users = await this.adminRequest('GET', '/users');

            // Pour chaque utilisateur, récupérer ses sessions
            const userSessions = await Promise.all(
                users.map(async (user) => {
                    try {
                        const sessions = await this.adminRequest('GET', `/users/${user.id}/sessions`);
                        return {
                            userId: user.id,
                            username: user.username,
                            email: user.email,
                            sessions: sessions || [],
                        };
                    } catch (error) {
                        console.error(`Erreur lors de la récupération des sessions pour ${user.username}:`, error.message);
                        return {
                            userId: user.id,
                            username: user.username,
                            email: user.email,
                            sessions: [],
                        };
                    }
                })
            );

            // Filtrer uniquement les utilisateurs avec des sessions actives
            return userSessions.filter(user => user.sessions.length > 0);
        } catch (error) {
            console.error('Erreur lors de la récupération des sessions actives:', error.message);
            throw error;
        }
    }

    /**
     * Obtenir les sessions d'un utilisateur spécifique
     */
    async getUserSessions(userId) {
        try {
            const sessions = await this.adminRequest('GET', `/users/${userId}/sessions`);
            return sessions || [];
        } catch (error) {
            console.error(`Erreur lors de la récupération des sessions pour l'utilisateur ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Obtenir les détails d'une session spécifique
     */
    async getSessionDetails(sessionId) {
        try {
            const session = await this.adminRequest('GET', `/sessions/${sessionId}`);
            return session;
        } catch (error) {
            console.error(`Erreur lors de la récupération de la session ${sessionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Déconnecter un utilisateur (fermer toutes ses sessions)
     */
    async logoutUser(userId) {
        try {
            await this.adminRequest('POST', `/users/${userId}/logout`);
            return { success: true, message: 'Utilisateur déconnecté avec succès' };
        } catch (error) {
            console.error(`Erreur lors de la déconnexion de l'utilisateur ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Supprimer une session spécifique
     */
    async deleteSession(sessionId) {
        try {
            await this.adminRequest('DELETE', `/sessions/${sessionId}`);
            return { success: true, message: 'Session supprimée avec succès' };
        } catch (error) {
            console.error(`Erreur lors de la suppression de la session ${sessionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Lister tous les clients configurés (incluant devicecis)
     */
    async listClients() {
        try {
            const clients = await this.adminRequest('GET', '/clients');
            return clients;
        } catch (error) {
            console.error('Erreur lors de la récupération des clients:', error.message);
            throw error;
        }
    }

    /**
     * Obtenir les détails du client device
     */
    async getDeviceClient(clientId = 'devicecis') {
        try {
            const clients = await this.listClients();
            const deviceClient = clients.find(c => c.clientId === clientId);
            return deviceClient || null;
        } catch (error) {
            console.error(`Erreur lors de la récupération du client ${clientId}:`, error.message);
            throw error;
        }
    }

    /**
     * Obtenir les statistiques des sessions
     */
    async getSessionStats() {
        try {
            const activeSessions = await this.listActiveSessions();

            const stats = {
                totalUsers: activeSessions.length,
                totalSessions: activeSessions.reduce((sum, user) => sum + user.sessions.length, 0),
                users: activeSessions.map(user => ({
                    username: user.username,
                    email: user.email,
                    sessionCount: user.sessions.length,
                    sessions: user.sessions.map(session => ({
                        id: session.id,
                        ipAddress: session.ipAddress,
                        start: new Date(session.start),
                        lastAccess: new Date(session.lastAccess),
                        clients: session.clients,
                    })),
                })),
            };

            return stats;
        } catch (error) {
            console.error('Erreur lors de la récupération des statistiques:', error.message);
            throw error;
        }
    }

    /**
     * Vérifier si un device spécifique est connecté
     * (basé sur l'IP ou l'ID de session)
     */
    async isDeviceConnected(identifier) {
        try {
            const activeSessions = await this.listActiveSessions();

            for (const user of activeSessions) {
                for (const session of user.sessions) {
                    if (session.id === identifier || session.ipAddress === identifier) {
                        return {
                            connected: true,
                            session,
                            user: {
                                username: user.username,
                                email: user.email,
                            },
                        };
                    }
                }
            }

            return { connected: false };
        } catch (error) {
            console.error('Erreur lors de la vérification de la connexion:', error.message);
            throw error;
        }
    }

    /**
     * Obtenir les events récents (authentifications, déconnexions, etc.)
     * Note: Nécessite que les events soient activés dans Keycloak
     */
    async getRecentEvents(type = null, max = 100) {
        try {
            let endpoint = `/events?max=${max}`;
            if (type) {
                endpoint += `&type=${type}`;
            }

            const events = await this.adminRequest('GET', endpoint);
            return events || [];
        } catch (error) {
            console.error('Erreur lors de la récupération des events:', error.message);
            // Les events peuvent ne pas être activés, retourner un tableau vide
            return [];
        }
    }

    /**
     * Obtenir les events d'administration récents
     */
    async getAdminEvents(max = 100) {
        try {
            const events = await this.adminRequest('GET', `/admin-events?max=${max}`);
            return events || [];
        } catch (error) {
            console.error('Erreur lors de la récupération des admin events:', error.message);
            return [];
        }
    }
}

/**
 * Factory function pour créer une instance du service
 */
function createDeviceService() {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.REALM || 'projetcis';
    const adminCredentials = {
        username: process.env.KEYCLOAK_ADMIN_USER || 'admin',
        password: process.env.KEYCLOAK_ADMIN_PASSWORD,
    };

    if (!adminCredentials.password) {
        throw new Error('KEYCLOAK_ADMIN_PASSWORD doit être défini dans les variables d\'environnement');
    }

    return new DeviceService(keycloakUrl, realm, adminCredentials);
}

module.exports = {
    DeviceService,
    createDeviceService,
};
