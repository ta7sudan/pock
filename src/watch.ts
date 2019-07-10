import chokidar from 'chokidar';
import { fork, ChildProcess } from 'child_process';
import { resolve, posix } from 'path';
import { existsSync } from 'fs';
import { logger, cleaner, Status } from './lib/utils';
import { ServerOptions } from './server';

let child: ChildProcess | null = null,
	killed = false,
	childIsAlive = false,
	exitDueToSelf = false;

function debounce(
	fn: (...args: any[]) => any,
	delay: number = 100,
	thisArg?: any
): (...args: any[]) => any {
	if (typeof fn !== 'function') {
		throw new TypeError('fn is not a function.');
	}
	// 同样, 考虑到后面返回的函数会被频繁调用, 则f的初始化放外面比放里面要好
	let handler: null | ReturnType<typeof setTimeout> = null;
	const f = function($thisArg: any, $args?: any[]): void {
		handler = null;
		fn.apply($thisArg, $args!);
	};
	return function(this: any): any {
		const args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments as any);

		if (handler) {
			clearTimeout(handler);
		}
		handler = setTimeout(f, delay, thisArg || this, args);
	};
}

function startChildProcess(options: ServerOptions, cwd: string): void {
	// 如果有子进程则kill再重新启动
	if (childIsAlive) {
		child!.kill('SIGTERM');
		killed = true;
	} else {
		if (killed) {
			logger.note('Restarting server...');
			killed = false;
		}
		child = fork(resolve(__dirname, './child.js'), undefined, {
			cwd
		});
		cleaner.child = child;

		child.addListener('message', (msg: Status): void => {
			if (msg === Status.ALREADY_START) {
				cleaner.childIsAlive = childIsAlive = true;
				child!.send({ options, cwd });
			} else if (msg === Status.INTERNAL_ERROR) {
				exitDueToSelf = true;
			}
		});
		child.addListener('error', (err: Error): never => {
			throw err;
		});
		child.addListener('exit', (code: number): void => {
			if (exitDueToSelf) {
				cleaner.childIsAlive = false;
				process.exit(code);
			} else if (!killed && !cleaner.cleaned) {
				logger.warn('Child process crashed.');
				childIsAlive = false;
				child = null;
				cleaner.child = undefined;
				cleaner.childIsAlive = false;
				killed = false;
				exitDueToSelf = false;
				startChildProcess(options, cwd);
			} else if (killed) {
				childIsAlive = false;
				child = null;
				cleaner.child = undefined;
				cleaner.childIsAlive = false;
				exitDueToSelf = false;
				startChildProcess(options, cwd);
			}
		});
	}
}

function watch(options: ServerOptions, cwd: string): void {
	let { dirs, files } = options;
	dirs = ([] as string[])
		.concat(dirs!)
		.filter((dir: string) => typeof dir === 'string')
		.map((dir: string) => posix.join(dir, '**/*.{js,json,yml,yaml}'));
	files = ([] as string[]).concat(files!).filter((file: string) => typeof file === 'string');

	const target = ([] as string[]).concat(options.dirs || []).concat(files);
	for (const dest of target) {
		if (!existsSync(resolve(cwd, dest))) {
			logger.error(`${dest} not exists.`);
			process.exit(1);
		}
	}

	const watcher = chokidar.watch(dirs.concat(files), {
		cwd,
		ignored: ['**/node_modules', '**/.git']
	});

	cleaner.watcher = watcher;

	watcher.on('ready', () => {
		const handler = debounce(() => startChildProcess(options, cwd));
		watcher
			.on('add', handler)
			.on('change', handler)
			.on('unlink', handler)
			.on('unlinkDir', handler)
			.on('error', (err: Error): never => {
				throw err;
			});
		startChildProcess(options, cwd);
	});
}

export default watch;
