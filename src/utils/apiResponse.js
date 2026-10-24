export const successResponse = ({
	message = 'Request successful',
	data = null,
	meta,
}) => ({
	success: true,
	message,
	data,
	...(meta !== undefined && { meta }),
});

export const errorResponse = ({
	message = 'An unexpected error occurred',
	code = 'INTERNAL_SERVER_ERROR',
	details,
}) => ({
	success: false,
	error: {
		code,
		message,
		...(details !== undefined && { details }),
	},
});
