import { logger, Status } from './lib/utils';
import { FastifyInstance } from 'fastify';
import { ServerOptions } from './server';

type UncaughtExceptionListener = (error: Error) => void;

type UnhandledRejectionListener = (reason: {} | null | undefined, promise: Promise<any>) => void;

let server: FastifyInstance | null = null;

function handleError(err: Error): void {
	err && logger.error(err.message);
	err && logger.error(err.stack!);
	process.send!(Status.INTERNAL_ERROR);
	setTimeout(() => process.exit(1), 30);
}

process.send!(Status.ALREADY_START);

process.addListener('SIGTERM', () => {
	if (server) {
		server.close();
	}
	process.exit();
});

process.addListener('unhandledRejection', (handleError as unknown) as UnhandledRejectionListener);

process.addListener('uncaughtException', handleError as UncaughtExceptionListener);

process.addListener(
	'message',
	async ({ options, cwd }: { cwd: string; options: ServerOptions }) => {
		server = await require('./server').default(options, cwd);
	}
);
