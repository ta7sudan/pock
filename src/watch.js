'use strict';
const chokidar = require('chokidar');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const cleaner = require('./lib/utils/cleaner');
const { logger, status: { ALREADY_START, INTERNAL_ERROR } } = require('./lib/utils');

let child = null, killed = false, childISAlive = false, exitDueToSelf = false;

function debounce(fn, delay = 300, thisArg) {
	if (typeof fn !== 'function') {
		throw new TypeError('fn is not a function.');
	}
	let handler = null;
	const f = function (thisArg, args) {
		handler = null;
		fn.apply(thisArg, args);
	};
	return function (...args) {
		if (handler) {
			clearTimeout(handler);
		}
		handler = setTimeout(f, delay, thisArg, args);
	};
}

function startChildProcess(options, cwd) {
	// 如果有子进程则kill再重新启动
	if (childISAlive) {
		child.kill('SIGTERM');
		killed = true;
	} else {
		if (killed) {
			logger.note('Restarting server...');
			killed = false;
		} else {
			logger.note('Starting server...');
		}
		child = fork(path.resolve(__dirname, './child.js'));
		cleaner.child = child;

		child.addListener('message', msg => {
			if (msg === ALREADY_START) {
				cleaner.childISAlive = childISAlive = true;
				child.send({ options, cwd });
			} else if (msg === INTERNAL_ERROR) {
				exitDueToSelf = true;
			}
		});
		child.addListener('error', err => {
			throw err;
		});
		child.addListener('exit', (code, signal) => {
			if (exitDueToSelf) {
				cleaner.childIsAlive = false;
				process.exit(code);
			} else if (!killed && !cleaner.cleaned) {
				logger.warn('Child process crashed.');
				childISAlive = false;
				child = null;
				cleaner.child = null;
				cleaner.childIsAlive = false;
				killed = false;
				exitDueToSelf = false;
				startChildProcess(options, cwd);
			} else if (killed) {
				childISAlive = false;
				child = null;
				cleaner.child = null;
				cleaner.childIsAlive = false;
				exitDueToSelf = false;
				startChildProcess(options, cwd);
			}
		});
	}

}

function watch(options, cwd) {
	let { dirs, files } = options; //, getPath = dir => path.resolve(cwd, dir);
	dirs = (Array.isArray(dirs) ? dirs : typeof dirs === 'string' ? [dirs] : []).map(dir =>
		path.join(dir, '**/*.(js|json|yml|yaml)')
	);
	files = Array.isArray(files) ? files : typeof files === 'string' ? [files] : [];

	const target = [].concat(options.dirs || []).concat(files);
	for (const dest of target) {
		if (!fs.existsSync(path.resolve(cwd, dest))) {
			logger.error(`${dest} not exists.`);
			process.exit(1);
		}
	}


	const watcher = chokidar.watch(dirs.concat(files), {
		cwd,
		ignored: 'node_modules'
	});

	cleaner.watcher = watcher;

	watcher.on('ready', () => {
		watcher
			.on('add', debounce(() => startChildProcess(options, cwd)))
			.on('change', debounce(() => startChildProcess(options, cwd)))
			.on('unlink', debounce(() => startChildProcess(options, cwd)))
			.on('error', err => { throw err; });
		startChildProcess(options, cwd);
	});
}

module.exports = watch;