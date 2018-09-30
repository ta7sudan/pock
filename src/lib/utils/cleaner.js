'use strict';

const cleaner = {
	watcher: null,
	child: null,
	childIsAlive: false,
	cleaned: false,
	cleanup() {
		if (this.watcher && typeof this.watcher.close === 'function') {
			this.watcher.close();
		}
		if (this.childIsAlive && this.child && typeof this.child.kill === 'function') {
			this.child.kill('SIGTERM');
		}
		this.cleaned = true;
	}
};

module.exports = cleaner;