import { env } from './src/config/env.js';
import { logger } from './src/config/logger.js';
import { prisma } from './src/config/prisma.js';
import { createApp } from './src/app.js';
const server = createApp().listen(env.PORT, () => logger.info(`SkillUp API sur le port ${env.PORT} (${env.NODE_ENV})`));
const stop = async () => { server.close(); await prisma.$disconnect(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
