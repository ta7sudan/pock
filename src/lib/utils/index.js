'use strict';
const figlet = require('figlet');
const path = require('path');
const os = require('os');
const {bin} = require('../../../package');
const logger = require('./logger');
const cleaner = require('./cleaner');
const status = require('./status');

const oToString = Function.call.bind(Object.prototype.toString);
const CLI_ROOT = path.resolve(__dirname, '../../..');
const TODO_DIR = path.resolve(os.homedir(), '.todo');

exports.isAsyncFunction = fn => fn[Symbol.toStringTag] === 'AsyncFunction';

exports.to = p => p.then(data => [null, data]).catch(err => [err, undefined]);

exports.sleep = time => new Promise(rs => setTimeout(rs, time));

exports.getAbsolutePath = rel => path.resolve(process.cwd(), rel);

exports.getCmds = () => Object.keys(bin);

exports.getFiglet = cmd =>
	new Promise((rs, rj) => {
		figlet(
			cmd,
			{
				horizontalLayout: 'fitted'
			},
			(err, data) => {
				if (err) {
					rj(err);
				} else {
					rs(data);
				}
			}
		);
	});

exports.isObject = obj => oToString(obj) === '[object Object]';

exports.logger = logger;

exports.CLI_ROOT = CLI_ROOT;

exports.TODO_DIR = TODO_DIR;

exports.status = status;

exports.cleaner = cleaner;
