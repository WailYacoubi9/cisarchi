/**
 * Routes pour la gestion des devices
 *
 * Ces routes permettent de :
 * - Lister les devices connectés (sessions actives)
 * - Obtenir les détails d'un device
 * - Déconnecter un device
 * - Voir les statistiques des connexions
 */

const express = require('express');
const router = express.Router();
const { createDeviceService } = require('../services/deviceService');

// Middleware pour vérifier l'authentification
function requireAuth(req, res, next) {
    if (!req.session.tokenSet || !req.session.userinfo) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Vous devez être authentifié pour accéder à cette ressource',
        });
    }
    next();
}

// Middleware pour vérifier les droits admin
function requireAdmin(req, res, next) {
    if (!req.session.userinfo) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentification requise',
        });
    }

    // Vérifier si l'utilisateur a le rôle admin
    const roles = req.session.userinfo.realm_access?.roles || [];
    if (!roles.includes('admin')) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Droits administrateur requis',
        });
    }

    next();
}

/**
 * GET /api/devices
 * Lister tous les devices connectés (sessions actives)
 */
router.get('/api/devices', requireAuth, requireAdmin, async (req, res) => {
    try {
        const deviceService = createDeviceService();
        const activeSessions = await deviceService.listActiveSessions();

        res.json({
            success: true,
            count: activeSessions.length,
            devices: activeSessions,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des devices:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

/**
 * GET /api/devices/stats
 * Obtenir les statistiques des sessions
 */
router.get('/api/devices/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
        const deviceService = createDeviceService();
        const stats = await deviceService.getSessionStats();

        res.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

/**
 * GET /api/devices/user/:userId
 * Obtenir les sessions d'un utilisateur spécifique
 */
router.get('/api/devices/user/:userId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const deviceService = createDeviceService();
        const sessions = await deviceService.getUserSessions(userId);

        res.json({
            success: true,
            userId,
            sessions,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des sessions utilisateur:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

/**
 * GET /api/devices/session/:sessionId
 * Obtenir les détails d'une session spécifique
 */
router.get('/api/devices/session/:sessionId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const deviceService = createDeviceService();
        const session = await deviceService.getSessionDetails(sessionId);

        res.json({
            success: true,
            session,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de la session:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

/**
 * POST /api/devices/user/:userId/logout
 * Déconnecter un utilisateur (fermer toutes ses sessions)
 */
router.post('/api/devices/user/:userId/logout', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const deviceService = createDeviceService();
        const result = await deviceService.logoutUser(userId);

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        console.error('Erreur lors de la déconnexion de l\'utilisateur:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

/**
 * DELETE /api/devices/session/:sessionId
 * Supprimer une session spécifique
 */
router.delete('/api/devices/session/:sessionId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const deviceService = createDeviceService();
        const result = await deviceService.deleteSession(sessionId);

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        console.error('Erreur lors de la suppression de la session:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

/**
 * GET /api/devices/check/:identifier
 * Vérifier si un device est connecté (par ID de session ou IP)
 */
router.get('/api/devices/check/:identifier', requireAuth, async (req, res) => {
    try {
        const { identifier } = req.params;
        const deviceService = createDeviceService();
        const result = await deviceService.isDeviceConnected(identifier);

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Erreur lors de la vérification du device:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

/**
 * GET /api/devices/events
 * Obtenir les events récents (authentifications, déconnexions, etc.)
 */
router.get('/api/devices/events', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { type, max } = req.query;
        const deviceService = createDeviceService();
        const events = await deviceService.getRecentEvents(type, max ? parseInt(max) : 100);

        res.json({
            success: true,
            count: events.length,
            events,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des events:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

/**
 * GET /api/devices/clients
 * Lister les clients configurés (incluant devicecis)
 */
router.get('/api/devices/clients', requireAuth, requireAdmin, async (req, res) => {
    try {
        const deviceService = createDeviceService();
        const clients = await deviceService.listClients();

        res.json({
            success: true,
            count: clients.length,
            clients,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des clients:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

/**
 * GET /devices (Page HTML)
 * Page de gestion des devices (admin uniquement)
 */
router.get('/devices', requireAuth, requireAdmin, (req, res) => {
    res.render('pages/devices', {
        title: 'Gestion des Devices',
        user: req.session.userinfo,
    });
});

module.exports = router;
