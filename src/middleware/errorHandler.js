import { env } from '../config/env.js';
import { errorResponse } from '../utils/apiResponse.js';

export const notFoundHandler = (req, res) => {
	return res.status(404).json(
		errorResponse({
			code: 'ROUTE_NOT_FOUND',
			message: `Route ${req.method} ${req.originalUrl} was not found`,
		}),
	);
};

export const errorHandler = (err, req, res, next) => {
	if (res.headersSent) {
		return next(err);
	}

	const statusCode =
		Number.isInteger(err.statusCode) &&
		err.statusCode >= 400 &&
		err.statusCode <= 599
			? err.statusCode
			: err.status === 400 && err.type === 'entity.parse.failed'
				? 400
				: err.status === 413
					? 413
					: 500;

	const isServerError = statusCode >= 500;

	req.log?.error(
		{
			err,
			method: req.method,
			url: req.originalUrl,
			statusCode,
		},
		'Request failed',
	);

	return res.status(statusCode).json(
		errorResponse({
			code: isServerError
				? 'INTERNAL_SERVER_ERROR'
				: statusCode === 413
					? 'PAYLOAD_TOO_LARGE'
					: statusCode === 400
						? 'INVALID_REQUEST'
						: err.code || 'REQUEST_ERROR',

			message: isServerError
				? env.NODE_ENV === 'development'
					? err.message
					: 'An unexpected error occurred'
				: statusCode === 413
					? 'Request body exceeds the allowed size'
					: statusCode === 400
						? 'Request contains invalid JSON'
						: err.message || 'Request failed',
		}),
	);
};
