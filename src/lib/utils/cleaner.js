'use strict';

const cleaner = {
	watcher: null,
	child: null,
	server: null,
	childIsAlive: false,
	cleaned: false,
	cleanup() {
		if (this.watcher && typeof this.watcher.close === 'function') {
			this.watcher.close();
		}
		if (this.childIsAlive && this.child && typeof this.child.kill === 'function') {
			this.child.kill('SIGTERM');
		}
		if (this.server && typeof this.server.close === 'function') {
			this.server.close();
		}
		this.cleaned = true;
	}
};

module.exports = cleaner;