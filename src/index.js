'use strict';
const {logger} = require('./lib/utils');

/**
 * TODO, 如果需要支持作为模块引入, 那应当在这里考虑合适的异常处理和未捕获的
 * Promise 的处理方案
 */
const oToString = Function.call.bind(Object.prototype.toString),
	isObject = obj => oToString(obj) === '[object Object]';

function main(
	{
		dirs = null,
		files = null,
		proxy = null,
		to = null,
		wechat = null,
		wechat: {appid, secret, path: apiPath = '/wechat-config'} = {
			path: null
		},
		ssl = null,
		ssl: {cert, key} = {},
		watch = false,
		host = '0.0.0.0',
		port = '3000',
		cors = false
	} = {},
	cwd = process.cwd()
) {
	// 可以被作为API调用, 所以多做一次类型检查
	if (
		((typeof dirs !== 'string' && !Array.isArray(dirs)) || (Array.isArray(dirs) && !dirs.length)) &&
		((typeof files !== 'string' && !Array.isArray(files)) || (Array.isArray(files) && !files.length)) &&
		typeof proxy !== 'string' &&
		!isObject(wechat)
	) {
		logger.error('One of dirs, files, proxy, wechat must be set, but none was found.');
		throw new TypeError('Expected dirs, files to be a string or Array<string>, proxy to be a string, and wechat to be an Object.');
	}

	if (isObject(wechat) && (typeof appid !== 'string' || typeof secret !== 'string')) {
		logger.error('appid and secret must be set correctly.');
		throw new TypeError('Expected appid, secret to be a string when wechat is set.');
	}

	if (isObject(ssl) && (typeof cert !== 'string' || typeof key !== 'string')) {
		logger.error('cert and key must be set correctly.');
		throw new TypeError('Expected cert, key to be a string when ssl is set.');
	}

	// 其他参数在相应的位置进行检查
	console.log('cwd:', cwd);
	console.log('dirs:', dirs);
	console.log('files:', files);
	console.log('proxy:', proxy);
	console.log('to:', to);
	console.log('wechat:', JSON.stringify(wechat));
	console.log('appid:', appid);
	console.log('secret:', secret);
	console.log('path:', apiPath);
	console.log('ssl:', ssl);
	console.log('cert:', cert);
	console.log('key:', key);
	console.log('watch:', watch);
	console.log('host:', host);
	console.log('port:', port);
	console.log('cors:', cors);
}

module.exports = main;
