#!/bin/bash

# Script de vérification de l'installation
# Vérifie que tous les services sont opérationnels

echo "🔍 Vérification de l'installation OAuth2 Device Flow"
echo "=================================================="
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de vérification
check_service() {
    local name=$1
    local url=$2
    local expected_code=$3

    echo -n "Vérification $name... "

    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 5 --insecure 2>/dev/null)

    if [ "$response_code" == "$expected_code" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $response_code)"
        return 0
    else
        echo -e "${RED}✗ ERREUR${NC} (HTTP $response_code, attendu $expected_code)"
        return 1
    fi
}

# Fonction pour vérifier Docker
check_docker() {
    echo -n "Vérification Docker... "
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ Docker non trouvé${NC}"
        return 1
    fi
}

# Fonction pour vérifier les conteneurs
check_containers() {
    echo ""
    echo "📦 État des conteneurs Docker:"
    echo "------------------------------"

    containers=("cisarchi-keycloak" "cisarchi-webapp" "cisarchi-nginx")
    all_running=true

    for container in "${containers[@]}"; do
        echo -n "$container: "
        status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null)
        health=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null)

        if [ "$status" == "running" ]; then
            if [ "$health" == "healthy" ] || [ "$health" == "<no value>" ]; then
                echo -e "${GREEN}✓ Running${NC}"
            else
                echo -e "${YELLOW}⚠ Running (health: $health)${NC}"
                all_running=false
            fi
        else
            echo -e "${RED}✗ $status${NC}"
            all_running=false
        fi
    done

    if [ "$all_running" = false ]; then
        echo ""
        echo -e "${YELLOW}⚠ Certains conteneurs ne sont pas encore prêts.${NC}"
        echo "Attendez quelques secondes et relancez ce script."
        return 1
    fi

    return 0
}

# Début des vérifications
echo "1️⃣ Vérification de Docker"
echo "=========================="
if ! check_docker; then
    echo ""
    echo -e "${RED}Docker n'est pas installé ou accessible.${NC}"
    exit 1
fi

echo ""
check_containers
containers_ok=$?

echo ""
echo "2️⃣ Vérification des services"
echo "============================="

# Vérifier Keycloak
check_service "Keycloak" "http://localhost:8080/health/ready" "200"
keycloak_ok=$?

# Vérifier Webapp (page d'accueil)
check_service "Webapp (HTTP)" "http://localhost:3000" "200"
webapp_ok=$?

# Vérifier Nginx (si configuré)
# check_service "Nginx" "http://localhost:80" "200"

echo ""
echo "3️⃣ Vérification de l'API Keycloak"
echo "===================================="

# Vérifier les endpoints Keycloak
check_service "Realm Config" "http://localhost:8080/realms/projetcis/.well-known/openid-configuration" "200"
realm_ok=$?

check_service "Device Endpoint" "http://localhost:8080/realms/projetcis/protocol/openid-connect/auth/device" "405"
device_ok=$?

echo ""
echo "4️⃣ Vérification de la configuration Device-Client"
echo "==================================================="

if [ -f "device-client/.env" ]; then
    echo -e "${GREEN}✓${NC} Fichier .env existe"
else
    echo -e "${RED}✗${NC} Fichier .env manquant dans device-client/"
fi

if [ -d "device-client/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Dependencies installées"
else
    echo -e "${YELLOW}⚠${NC} Dependencies manquantes (npm install dans device-client/)"
fi

echo ""
echo "5️⃣ Vérification de la configuration Webapp"
echo "============================================"

if [ -f "nginx/.env" ]; then
    echo -e "${GREEN}✓${NC} Fichier nginx/.env existe"

    # Vérifier les variables requises
    if grep -q "KEYCLOAK_ADMIN_PASSWORD" nginx/.env && \
       grep -q "WEBAPP_CLIENT_SECRET" nginx/.env && \
       grep -q "SESSION_SECRET" nginx/.env; then
        echo -e "${GREEN}✓${NC} Variables d'environnement configurées"
    else
        echo -e "${YELLOW}⚠${NC} Variables manquantes dans nginx/.env"
    fi
else
    echo -e "${RED}✗${NC} Fichier nginx/.env manquant"
fi

if [ -d "webapp2/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Dependencies installées"
else
    echo -e "${YELLOW}⚠${NC} Dependencies manquantes (npm install dans webapp2/)"
fi

echo ""
echo "=================================================="
echo "📊 RÉSUMÉ"
echo "=================================================="

total_checks=0
passed_checks=0

if [ $containers_ok -eq 0 ]; then ((passed_checks++)); fi
((total_checks++))

if [ $keycloak_ok -eq 0 ]; then ((passed_checks++)); fi
((total_checks++))

if [ $webapp_ok -eq 0 ]; then ((passed_checks++)); fi
((total_checks++))

if [ $realm_ok -eq 0 ]; then ((passed_checks++)); fi
((total_checks++))

echo "Tests passés: $passed_checks/$total_checks"
echo ""

if [ $passed_checks -eq $total_checks ]; then
    echo -e "${GREEN}✅ Tous les services sont opérationnels !${NC}"
    echo ""
    echo "🚀 Prochaines étapes :"
    echo "   1. Testez Device Flow: cd device-client && npm run login"
    echo "   2. Accédez à webapp: http://localhost:3000"
    echo "   3. Console Keycloak: http://localhost:8080 (admin / [KEYCLOAK_ADMIN_PASSWORD])"
    echo ""
    echo "📖 Guide de test complet: TESTING_GUIDE.md"
    exit 0
else
    echo -e "${YELLOW}⚠ Certains services ne sont pas encore prêts${NC}"
    echo ""
    echo "🔧 Actions recommandées :"

    if [ $containers_ok -ne 0 ]; then
        echo "   • Attendez que tous les conteneurs soient healthy"
        echo "     docker ps"
    fi

    if [ $keycloak_ok -ne 0 ]; then
        echo "   • Vérifiez les logs Keycloak:"
        echo "     docker logs cisarchi-keycloak"
    fi

    if [ $webapp_ok -ne 0 ]; then
        echo "   • Vérifiez les logs Webapp:"
        echo "     docker logs cisarchi-webapp"
    fi

    echo ""
    echo "Relancez ce script après avoir résolu les problèmes."
    exit 1
fi
