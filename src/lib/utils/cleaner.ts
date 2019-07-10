import { FSWatcher } from 'chokidar';
import { ChildProcess } from 'child_process';
import { FastifyInstance } from 'fastify';
import { Server } from 'http';
interface Cleaner {
	watcher?: FSWatcher;
	child?: ChildProcess;
	mitmProxy?: Server;
	server?: FastifyInstance;
	childIsAlive: boolean;
	cleaned: boolean;
	cleanup: () => void;
}
export const cleaner: Cleaner = {
	watcher: undefined,
	child: undefined,
	server: undefined,
	mitmProxy: undefined,
	childIsAlive: false,
	cleaned: false,
	cleanup(): void {
		if (this.watcher && typeof this.watcher.close === 'function') {
			this.watcher.close();
		}
		if (this.childIsAlive && this.child && typeof this.child.kill === 'function') {
			this.child.kill('SIGTERM');
		}
		if (this.server && typeof this.server.close === 'function') {
			this.server.close();
		}
		if (this.mitmProxy && typeof this.mitmProxy.close === 'function') {
			this.mitmProxy.close();
		}
		this.cleaned = true;
	}
};
