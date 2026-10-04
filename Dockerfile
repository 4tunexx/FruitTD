FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY server ./server
COPY src ./src
COPY tsconfig.json ./
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["npm", "run", "server"]
