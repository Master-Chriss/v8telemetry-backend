import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import cors from 'cors';

import { env } from './config/env.js';
import healthRouter from './routes/health.routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
	cors({
		origin: env.CORS_ORIGIN,
		methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
	}),
);

// Request logging
app.use(
	pinoHttp({
		level: env.LOG_LEVEL,
		enabled: env.NODE_ENV !== 'test',
	}),
);

// Limit incoming JSON payloads
app.use(express.json({ limit: '1mb' }));

// Basic protection against excessive requests
app.use(
	rateLimit({
		windowMs: 15 * 60 * 1000,
		limit: 100, 
		standardHeaders: 'draft-8',
		legacyHeaders: false,
	}),
);

// Health endpoints
app.use('/api/health', healthRouter);

// Handle unknown routes
app.use(notFoundHandler);

// Handle errors from routes and middleware
app.use(errorHandler);

export default app;
