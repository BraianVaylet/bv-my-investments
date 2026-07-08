# Deploy de BV Invest en Railway — single service: la API sirve el build del FE.
# Se usa Dockerfile en vez de Nixpacks para fijar Node + pnpm e instalar pnpm
# directo (sin Corepack), evitando el bug ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING
# de Corepack con pnpm 11 en Node 22.
FROM node:22-slim

# pnpm directo, sin Corepack
RUN corepack disable || true && npm install -g pnpm@11.7.0

WORKDIR /app

# Manifiestos primero para cachear la instalación de dependencias
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# Instala TODO (incluye devDeps: tsc, vite) sin importar el NODE_ENV del entorno
RUN pnpm install --frozen-lockfile --prod=false

# Código y build (pnpm -r respeta orden topológico: shared -> api, web)
COPY . .
RUN pnpm build

ENV NODE_ENV=production
CMD ["node", "apps/api/dist/index.js"]
