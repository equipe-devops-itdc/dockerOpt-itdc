# Base Debian (glibc) plutôt qu'Alpine (musl) — voir explication ci-dessous.
FROM node:20-bookworm-slim
WORKDIR /app

# ==================== Trivy (scan de vulnérabilités d'images) ====================
#
# Historique du problème : l'image tournait auparavant sur node:20-alpine
# (musl), et deux tentatives d'installation de Trivy y ont échoué :
#   1. Le script d'installation officiel télécharge un binaire lié à
#      glibc → incompatible avec musl, ne s'exécute pas sur Alpine.
#   2. `apk add trivy` (dépôt "community" d'Alpine) — le paquet peut être
#      absent ou incompatible selon la version d'Alpine de l'image de base,
#      ce qui a également échoué silencieusement.
#
# Solution retenue : passer sur une base Debian (glibc native) et installer
# Trivy depuis son dépôt APT officiel — la méthode la plus fiable et la
# mieux documentée par l'éditeur (Aqua Security). Note : le binaire `docker`
# (CLI) n'a jamais été nécessaire ici — le backend parle directement au
# socket Docker via la librairie `dockerode`, sans jamais invoquer de
# commande `docker` — donc ce changement de base n'affecte aucune autre
# fonctionnalité.
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget gnupg ca-certificates \
    && wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor -o /usr/share/keyrings/trivy.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb bookworm main" > /etc/apt/sources.list.d/trivy.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends trivy \
    && apt-get purge -y wget gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY package.json .
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
