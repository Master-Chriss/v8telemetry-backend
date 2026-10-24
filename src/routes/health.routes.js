import { Router } from 'express';
import mongoose from 'mongoose';
import { successResponse } from '../utils/apiResponse.js';

const healthRouter = Router();

// Liveness: confirms the application process can respond.
healthRouter.get('/live', (req, res) => {
	return res.status(200).json(
		successResponse({
			message: 'V8Telemetry API is alive',
			data: {
				status: 'alive',
			},
		}),
	);
});

// Readiness: confirms MongoDB is connected.
healthRouter.get('/ready', (req, res) => {
	const databaseReady = mongoose.connection.readyState === 1;

	if (!databaseReady) {
		return res.status(503).json({
			success: false,
			error: {
				code: 'SERVICE_NOT_READY',
				message: 'The service is not ready to handle database requests',
			},
			data: {
				status: 'not_ready',
				database: 'disconnected',
			},
		});
	}

	return res.status(200).json(
		successResponse({
			message: 'V8Telemetry API is ready',
			data: {
				status: 'ready',
				database: 'connected',
			},
		}),
	);
});

export default healthRouter;
