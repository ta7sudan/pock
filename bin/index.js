#!/usr/bin/env node
'use strict';
require('../src/lib/utils/safe-promise');

const semver = require('semver');
const yargs = require('yargs');
const yargonaut = require('yargonaut');
const chalk = require('chalk');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const {version, author} = require('../package');
const {handleError, handleExit} = require('../src/lib/utils/error-handler');
const {logger, getCmds, getFiglet, getAbsolutePath} = require('../src/lib/utils');
const {
	engines: {node: wanted}
} = require('../package');

const authorName = typeof author === 'string' ? author : author.name;

function checkNodeVersion(wanted, cliName) {
	const curNodeVersion = process.version;
	if (!semver.satisfies(curNodeVersion, wanted)) {
		logger.error(
			`You are using Node ${curNodeVersion}, but this version of ${cliName} requires Node ${wanted}. Please upgrade your Node version.`
		);
		process.exit(1);
	}
}

checkNodeVersion(wanted, getCmds()[0]);

process.addListener('SIGINT', handleExit);
process.addListener('SIGTERM', handleExit);
process.addListener('uncaughtException', handleError);

(async () => {
	/**
	 * FOR DEBUG
	 */
	// await sleep(10000);
	const cmdName = getCmds()[0],
		logo = await getFiglet(cmdName);
	yargs.logo = logo;
	yargonaut
		.helpStyle('blue.underline')
		.style('red.bold', 'required')
		.style('magenta', ['boolean', 'string', 'array']);

	const pockrc = ['.pockrc.js', '.pockrc.json', '.pockrc.yml', '.pockrc.yaml']
		.map(getAbsolutePath)
		.filter(fs.existsSync)
		.toString()
		.split(',')[0];

	const argv = yargs
		.scriptName(cmdName)
		.completion('completion', 'get completion script')
		.options({
			config: {
				desc:
					'specify configuration file, default is .pockrc.js, .pockrc.json, .pockrc.yml, .pockrc.yaml',
				type: 'string'
			},
			d: {
				alias: 'dirs',
				desc: 'directories contains route files',
				type: 'array'
			},
			f: {
				alias: 'files',
				desc: 'files of routes',
				type: 'array'
			},
			P: {
				alias: 'proxy',
				desc: 'origin host:port',
				type: 'string'
			},
			t: {
				alias: 'to',
				desc: 'target host:port',
				type: 'string'
			},
			wechat: {
				desc:
					'enable wechat js-sdk authorization and specify API path, eg. /wechat-config, default is /wechat-config. when --wechat is set, --appid and --secret is also required',
				type: 'string',
				coerce(val) {
					return val === '' ? '/wechat-config' : val;
				}
			},
			appid: {
				desc: 'wechat appid, valid when --wechat is set',
				type: 'string'
			},
			secret: {
				desc: 'wechat appsecret, valid when --wechat is set',
				type: 'string'
			},
			w: {
				alias: 'watch',
				desc: 'watch route folder or files for changes',
				type: 'boolean'
			},
			h: {
				alias: 'host',
				desc: 'address to bind',
				type: 'string'
			},
			p: {
				alias: 'port',
				desc: 'port to listen',
				type: 'string'
			},
			C: {
				alias: 'cors',
				desc: 'enable cors',
				type: 'boolean'
			},
			S: {
				alias: 'ssl',
				desc: 'enable https, when --ssl is set, --cert and --key is also required',
				type: 'boolean'
			},
			c: {
				alias: 'cert',
				desc: 'path to ssl cert file, valid when --ssl is set',
				type: 'string'
			},
			k: {
				alias: 'key',
				desc: 'path to ssl key file, valid when --ssl is set',
				type: 'string'
			}
		})
		.alias('v', 'version')
		.example(
			`${cmdName} -h 127.0.0.1 -p 8080 -w -d ./routes`,
			'create a http server on 127.0.0.1:8080 and register routes in ./routes, restart server when file changes'
		)
		.usage(
			`${chalk.yellowBright(logo)}\n\n${chalk.blue.underline('Usage:')}\n  ` +
				`${cmdName} -d <dir0> <dir1>\n  ` +
				`${cmdName} -f <file0> <file1>\n  ` +
				`${cmdName} -P <host:port> -t <host:port>\n  ` +
				`${cmdName} --wechat [path] --appid <appid> --secret <secret>\n  ` +
				`${cmdName} --config <configuration>`
		)
		.version(version)
		.epilog(`By ${authorName}`)
		.help()
		.fail((msg, err, yargs) => {
			if (err) {
				handleError(err);
			} else if (msg) {
				// 参数不匹配时显示帮助文档
				yargs.showHelp();
				process.exit(1);
			}
		})
		.check(
			({
				config, dirs, files, proxy, to, wechat, appid, secret, watch, host, port, cors, ssl, cert, key
			}) => {
				if (config === '') {
					logger.error('Configuration must be set, and other options will be ignored.');
					return false;
				}
				if (
					(config || pockrc) &&
					[
						dirs, files, proxy, to, wechat, appid, secret,
						watch, host, port, cors, ssl, cert, key
					].some(v => typeof v !== 'undefined')
				) {
					logger.warn('Configuration is set, and other options will be ignored.');
					wechat = null;
					ssl = null;
				}
				if (
					!pockrc &&
					!config &&
					(!dirs || !dirs.length) &&
					(!files || !files.length) &&
					!proxy &&
					!wechat
				) {
					logger.error(
						'One of --config, --dirs, --files, --proxy, --wechat must be set or have .pockrc file in current directory.'
					);
					return false;
				}

				if (wechat && (!appid || !secret)) {
					logger.error('--appid and secret also must be set.');
					return false;
				}

				if (ssl && (!cert || !key)) {
					logger.error('--cert and --key also must be set.');
					return false;
				}

				return true;
			}
		).argv;

	const {
			config, dirs, files, proxy, to, wechat, appid,
			secret, watch, host, port, cors, ssl, cert, key
		} = argv,
		configuration = config ? getAbsolutePath(config) : pockrc;

	let options = null;

	if (configuration) {
		if (!fs.existsSync(configuration)) {
			logger.error(`${configuration} not found.`);
			process.exit(1);
		}

		const ext = path.extname(configuration);

		if (ext === '.js' || ext === '.json') {
			options = require(configuration);
		} else if (ext === '.yml' || ext === '.yaml') {
			try {
				options = yaml.safeLoad(fs.readFileSync(configuration, 'utf8'));
			} catch (err) {
				logger.error(err.message);
				process.exit(1);
			}
		} else {
			logger.error(
				`Unexpected file type: ${configuration}. Extension of configuration must be .js, .json, .yml or .yaml.`
			);
			process.exit(1);
		}

		require('../src')(options, path.dirname(configuration));
	} else {
		require('../src')({
			dirs,
			files,
			proxy,
			to,
			wechat: wechat ? {
				appid,
				secret,
				path: wechat
			}
				: undefined,
			ssl: ssl ? {
				cert,
				key
			} : undefined,
			watch,
			host,
			port,
			cors
		});
	}
})();
