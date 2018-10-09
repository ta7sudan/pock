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
const {handleError, handleSignal} = require('../src/lib/utils/error-handler');
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

process.addListener('SIGHUP', handleSignal);
process.addListener('SIGQUIT', handleSignal);
process.addListener('SIGINT', handleSignal);
process.addListener('SIGTERM', handleSignal);
process.addListener('uncaughtException', handleError);

(async () => {
	/**
	 * FOR DEBUG
	 */
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
				alias: 'prefix',
				desc: 'path/prefix for proxy, default /',
				type: 'string',
				coerce(val) {
					return val === '' ? '/' : val;
				}
			},
			u: {
				alias: 'upstream',
				desc: 'upstream for proxy',
				type: 'string'
			},
			m: {
				alias: 'mitm',
				desc: 'origin for mitm, when --mitm is set, --to is also required',
				type: 'string'
			},
			t: {
				alias: 'to',
				desc: 'dest for mitm, valid when --mitm is set',
				type: 'string'
			},
			wechat: {
				desc:
					'enable wechat js-sdk authorization and specify API path, eg. /wechat-config, default /wechat-config. when --wechat is set, --appId and --secret is also required',
				type: 'string',
				coerce(val) {
					return val === '' ? '/wechat-config' : val;
				}
			},
			appId: {
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
				`${cmdName} --wechat [path] --appId <appId> --secret <secret>\n  ` +
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
				config, dirs, files, prefix, upstream, mitm, to, wechat, appId, secret, watch, host, port, cors, ssl, cert, key
			}) => {
				if (config === '') {
					logger.error('Configuration must set, and other options will be ignored.');
					return false;
				}
				if (
					config &&
					[
						dirs, files, prefix, upstream, mitm, to, wechat, appId, 
						secret, watch, host, port, cors, ssl, cert, key
					].some(v => typeof v !== 'undefined')
				) {
					logger.warn('Configuration is set, and other options will be ignored.');
					wechat = null;
					ssl = null;
					mitm = null;
				}
				if (
					!pockrc &&
					!config &&
					(!dirs || !dirs.length) &&
					(!files || !files.length) &&
					!upstream &&
					!mitm &&
					!wechat
				) {
					logger.error(
						'One of --config, --dirs, --files, --upstream, --mitm, --wechat must set or have .pockrc file in current directory.'
					);
					return false;
				}

				if (wechat && (!appId || !secret)) {
					logger.error('--appId and secret also must set.');
					return false;
				}

				if (ssl && (!cert || !key)) {
					logger.error('--cert and --key also must set.');
					return false;
				}

				if (upstream && mitm) {
					logger.error('--upstream is conflict with --mitm');
					return false;
				}

				if (mitm && !to) {
					logger.error('--to also must set.');
					return false;
				}

				return true;
			}
		).argv;

	const {
			config, dirs, files, prefix, upstream, mitm, to, wechat,
			appId, secret, watch, host, port, cors, ssl, cert, key
		} = argv,
		configuration = config ? getAbsolutePath(config) : pockrc;

	let options = null;

	if (config || (configuration && !dirs && !files && !wechat && !mitm && !upstream)) {
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

		await require('../src')(options, path.dirname(configuration));
	} else {
		await require('../src')({
			dirs,
			files,
			proxy: upstream ? {
				prefix,
				upstream
			} : undefined,
			mitm: mitm ? {
				origin: mitm,
				dest: to
			} : undefined,
			wechat: wechat ? {
				appId,
				secret,
				path: wechat
			} : undefined,
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
