# HackaMetz — image unique : API Express + front React servis sur le même port.
# Les données vivent dans deux volumes (server/data et server/storage) : l'image reste jetable.

FROM node:22-alpine AS build
WORKDIR /app

# Les manifestes d'abord : le cache npm ne saute qu'en cas de changement de dépendances.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY . .
# Une clé factice suffit pour construire : le build ne parle jamais au serveur.
ENV ADMIN_KEY=cle-de-build-suffisamment-longue
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_PATH=server/data
ENV STORAGE_PATH=server/storage

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev && npm cache clean --force

# Le paquet partagé est du TypeScript embarqué dans le bundle serveur (tsup noExternal) :
# on copie quand même ses sources, c'est trois fichiers et ça évite toute surprise de résolution.
COPY --from=build /app/shared/src shared/src
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist

# Les volumes appartiennent à l'utilisateur node : le serveur n'a pas besoin de root.
RUN mkdir -p server/data server/storage && chown -R node:node /app
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health > /dev/null || exit 1

CMD ["node", "server/dist/server.js"]
