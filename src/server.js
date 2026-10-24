
import { createServer } from "node:http";

import app from "./app.js";
import { env } from "./config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "./config/database.js";

const server = createServer(app);

let isShuttingDown = false;

const startServer = async () => {
  try {
    await connectDatabase();

    server.listen(env.PORT, env.HOST, () => {
      console.log(
        `V8Telemetry API running at http://${env.HOST}:${env.PORT}`,
      );
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
    await disconnectDatabase();
  }
};


const shutdownServer = async (signal) => {
	if (isShuttingDown) return;

	isShuttingDown = true;
	console.log(`${signal} received. Shutting down gracefully...`);

	const forceShutdown = setTimeout(() => {
		console.error('Graceful shutdown timed out.');
		process.exit(1);
	}, 10_000);

	forceShutdown.unref();

	try {
		if (server.listening) {
			await new Promise((resolve, reject) => {
				server.close((error) => {
					if (error) reject(error);
					else resolve();
				});
			});
		}

		await disconnectDatabase();

		console.log('V8Telemetry shut down successfully.');
		process.exitCode = 0;
	} catch (error) {
		console.error('Shutdown failed:', error.message);
		process.exitCode = 1;
	} finally {
		clearTimeout(forceShutdown);
	}
};


process.on("SIGINT", () => {
  void shutdownServer("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdownServer("SIGTERM");
});

await startServer();
