import figlet from 'figlet';
import { resolve } from 'path';
import * as logger from './logger';
import { cleaner } from './cleaner';
import Status from './status';
const { bin } = require('../../../../package.json');

const oToString = Function.call.bind(Object.prototype.toString);

type PromiseData = [undefined, any];

type PromiseError = [any, undefined];

export type Callable = (...args: any[]) => any;

export type AsyncCallable = (...args: any[]) => Promise<any>;

export const isAsyncFunction = (fn: any): fn is AsyncCallable =>
	fn[Symbol.toStringTag] === 'AsyncFunction';

export const to = (p: Promise<any>): Promise<PromiseData | PromiseError> =>
	p
		.then((data: any): PromiseData => [undefined, data])
		.catch((err: any): PromiseError => [err, undefined]);

export const sleep = (time: number): Promise<any> =>
	new Promise<any>((rs: any): any => setTimeout(rs, time));

export const getAbsolutePath = (rel: string): string => resolve(process.cwd(), rel);

export const getCmds = (): string[] => Object.keys(bin);

export const getFiglet = (cmd: string): Promise<string> =>
	new Promise<string>((rs: any, rj: any): void => {
		figlet(
			cmd,
			{
				horizontalLayout: 'fitted'
			},
			(err: Error | null, data?: string): void => {
				if (err) {
					rj(err);
				} else {
					rs(data);
				}
			}
		);
	});

export const isObject = (obj: any): boolean => oToString(obj) === '[object Object]';

export { logger, cleaner, Status };

export type HTTPMethodLowerCase = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export type HTTPMethodUpperCase = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type FastifyHTTPMethod = HTTPMethodLowerCase | 'all';

export function debounce(
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