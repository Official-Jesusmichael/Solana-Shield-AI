# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js"

WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential python-is-python3 pkg-config && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM deps AS build

COPY . .

RUN npm run build
RUN npm prune --omit=dev

FROM base AS final

COPY --from=build /app /app

EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.js"]
CMD ["npm", "run", "start"]
