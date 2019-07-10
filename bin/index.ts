#!/usr/bin/env node
import * as semver from 'semver';
import yargs, { Argv, Arguments } from 'yargs';
import yargonaut from 'yargonaut';
import chalk from 'chalk';
import { safeLoad } from 'js-yaml';
import { existsSync, readFileSync } from 'fs';
import { extname, dirname } from 'path';
import { handleError, handleSignal } from '../src/lib/utils/error-handler';
import { logger, getCmds, getFiglet, getAbsolutePath } from '../src/lib/utils';
import '../src/lib/utils/safe-promise';

interface CmdArgv {
	config?: string;
	wechat?: string;
	appId?: string;
	secret?: string;
	d?: Array<string>;
	f?: Array<string>;
	s?: string;
	x?: string;
	P?: string;
	u?: string;
	m?: string;
	t?: string;
	w?: boolean;
	h?: string;
	p?: number;
	C?: boolean;
	S?: boolean;
	c?: string;
	k?: string;
}

interface CmdAlias {
	config?: string;
	wechat?: string;
	appId?: string;
	secret?: string;
	dirs?: Array<string>;
	files?: Array<string>;
	static?: string;
	staticPrefix?: string;
	prefix?: string;
	upstream?: string;
	mitm?: string;
	to?: string;
	watch?: boolean;
	host?: string;
	port?: number;
	cors?: boolean;
	ssl?: boolean;
	cert?: string;
	key?: string;
}

// 这东西用require直接引入, 防止被tsc直接copy到dist导致一些问题, 并且以
// 打包后的相对路径来引入
const {
	version,
	author,
	engines: { node: nodeVersion }
} = require('../../package.json');
const authorName = typeof author === 'string' ? author : ((author as any).name as string);

function checkNodeVersion(wanted: string, cliName: string): void {
	const curNodeVersion = process.version;
	if (!semver.satisfies(curNodeVersion, wanted)) {
		logger.error(
			`You are using Node ${curNodeVersion}, but this version of ${cliName} requires Node ${wanted}. Please upgrade your Node version.`
		);
		process.exit(1);
	}
}

checkNodeVersion(nodeVersion, getCmds()[0]);

process.once('SIGHUP', handleSignal);
process.once('SIGQUIT', handleSignal);
process.once('SIGINT', handleSignal);
process.once('SIGTERM', handleSignal);
process.addListener('uncaughtException', handleError);

(async (): Promise<void> => {
	const cmdName = getCmds()[0],
		logo = await getFiglet(cmdName);
	(yargs as any).logo = logo;

	yargonaut
		.helpStyle('blue.underline')
		.style('red.bold', 'required')
		.style('magenta', ['boolean', 'string', 'array']);

	const pockrc = ['.pockrc.js', '.pockrc.json', '.pockrc.yml', '.pockrc.yaml']
		.map(getAbsolutePath)
		.filter(existsSync)
		.toString()
		.split(',')[0];

	const argv = yargs
		.scriptName(cmdName)
		.completion('completion', 'get completion script')
		.options({
			config: {
				desc:
					'specify configuration file, default is .pockrc.js, .pockrc.json, .pockrc.yml, .pockrc.yaml',
				string: true
			},
			d: {
				alias: 'dirs',
				desc: 'directories contains route files',
				array: true
			},
			f: {
				alias: 'files',
				desc: 'files of routes',
				array: true
			},
			s: {
				alias: 'static',
				desc: 'static resource directory',
				string: true,
				coerce(val: string): string {
					return val === '' ? process.cwd() : val;
				}
			},
			x: {
				alias: 'staticPrefix',
				desc: 'path/prefix for static resource server, default /',
				string: true,
				coerce(val: string): string {
					return val === '' ? '/' : val;
				}
			},
			P: {
				alias: 'prefix',
				desc: 'path/prefix for proxy, default /',
				string: true,
				coerce(val: string): string {
					return val === '' ? '/' : val;
				}
			},
			u: {
				alias: 'upstream',
				desc: 'upstream for proxy',
				string: true
			},
			m: {
				alias: 'mitm',
				desc: 'origin for mitm, when --mitm is set, --to is also required',
				string: true
			},
			t: {
				alias: 'to',
				desc: 'dest for mitm, valid when --mitm is set',
				string: true
			},
			wechat: {
				desc:
					'enable wechat js-sdk authorization and specify API path, eg. /wechat-config, default /wechat-config. when --wechat is set, --appId and --secret is also required',
				string: true,
				coerce(val: string): string {
					return val === '' ? '/wechat-config' : val;
				}
			},
			appId: {
				desc: 'wechat appid, valid when --wechat is set',
				string: true
			},
			secret: {
				desc: 'wechat appsecret, valid when --wechat is set',
				string: true
			},
			w: {
				alias: 'watch',
				desc: 'watch route folder or files for changes',
				boolean: true
			},
			h: {
				alias: 'host',
				desc: 'address to bind',
				string: true
			},
			p: {
				alias: 'port',
				desc: 'port to listen',
				number: true
			},
			C: {
				alias: 'cors',
				desc: 'enable cors',
				boolean: true
			},
			S: {
				alias: 'ssl',
				desc: 'enable https, when --ssl is set, --cert and --key is also required',
				boolean: true
			},
			c: {
				alias: 'cert',
				desc: 'path to ssl cert file, valid when --ssl is set',
				string: true
			},
			k: {
				alias: 'key',
				desc: 'path to ssl key file, valid when --ssl is set',
				string: true
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
		// 尽量不要用async函数, 不过这里用用也没事
		// MMP第三方的types这里类型少一个参数
		// tslint:disable-next-line
		.fail((async (msg: string, err: Error, $yargs: Argv): Promise<void> => {
			// 这个坑爹东西会捕获掉所有同步异常, 子命令的fail还会向上一级命令的fail冒泡
			if (err) {
				await handleError(err);
			} else if (msg) {
				// 处理子命令不带参数
				$yargs.showHelp();
				process.exit(1);
			}
		}) as any)
		.check(
			({
				config: $config,
				dirs: $dirs,
				files: $files,
				static: $staticDir,
				prefix: $prefix,
				upstream: $upstream,
				mitm: $mitm,
				to: $to,
				wechat: $wechat,
				appId: $appId,
				secret: $secret,
				watch: $watch,
				host: $host,
				port: $port,
				cors: $cors,
				ssl: $ssl,
				cert: $cert,
				key: $key
			}: Arguments<CmdArgv & CmdAlias>): boolean => {
				if ($config === '') {
					logger.error('Configuration must set, and other options will be ignored.');
					return false;
				}
				if ($config) {
					if (
						[
							$dirs,
							$files,
							$staticDir,
							$prefix,
							$upstream,
							$mitm,
							$to,
							$wechat,
							$appId,
							$secret,
							$watch,
							$host,
							$port,
							$cors,
							$ssl,
							$cert,
							$key
						].some((v: any) => typeof v !== 'undefined')
					) {
						logger.warn('Configuration is set, and other options will be ignored.');
					}
				} else if ($dirs || $files || $staticDir || $upstream || $mitm || $wechat) {
					if ($dirs && !$dirs.length) {
						logger.error('--dirs must set correctly.');
						return false;
					}

					if ($files && !$files.length) {
						logger.error('--files must set correctly.');
						return false;
					}

					if ($wechat && (!$appId || !$secret)) {
						logger.error('--appId and secret also must set.');
						return false;
					}

					if ($ssl && (!$cert || !$key)) {
						logger.error('--cert and --key also must set.');
						return false;
					}

					if ($upstream && $mitm) {
						logger.error('--upstream is conflict with --mitm');
						return false;
					}

					if ($mitm && !$to) {
						logger.error('--to also must set.');
						return false;
					}
				} else if (!pockrc) {
					logger.error(
						'One of --config, --dirs, --files, --static, --upstream, --mitm, --wechat must set or have .pockrc file in current directory.'
					);
					return false;
				}
				return true;
			}
		).argv as CmdAlias;

	const {
			config,
			dirs,
			files,
			static: staticDir,
			staticPrefix,
			prefix,
			upstream,
			mitm,
			to,
			wechat,
			appId,
			secret,
			watch,
			host,
			port,
			cors,
			ssl,
			cert,
			key
		} = argv,
		configuration = config ? getAbsolutePath(config) : pockrc;

	let options = null;

	if (!config && (dirs || files || staticDir || wechat || mitm || upstream)) {
		await require('../src').default({
			dirs,
			files,
			static: staticDir
				? {
						root: staticDir,
						prefix: staticPrefix
					}
				: undefined,
			proxy: upstream
				? {
						prefix,
						upstream
					}
				: undefined,
			mitm: mitm
				? {
						origin: mitm,
						dest: to!
					}
				: undefined,
			wechat: wechat
				? {
						appId: appId!,
						secret: secret!,
						path: wechat
					}
				: undefined,
			ssl: ssl
				? {
						cert: cert!,
						key: key!
					}
				: undefined,
			watch,
			host,
			port,
			cors
		}, process.cwd());
	} else if (config || pockrc) {
		if (!existsSync(configuration)) {
			logger.error(`${configuration} not found.`);
			process.exit(1);
		}

		const ext = extname(configuration);

		if (ext === '.js' || ext === '.json') {
			options = require(configuration);
		} else if (ext === '.yml' || ext === '.yaml') {
			try {
				options = safeLoad(readFileSync(configuration, 'utf8'));
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

		await require('../src').default(options, dirname(configuration));
	} else {
		// 理论上来讲不会到这里
		logger.error(
			'One of --config, --dirs, --files, --static, --upstream, --mitm, --wechat must set or have .pockrc file in current directory.'
		);
		process.exit(1);
	}
})();
