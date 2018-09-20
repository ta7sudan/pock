#!/usr/bin/env node
'use strict';
require('../src/lib/utils/safe-promise');

const semver = require('semver');
const yargs = require('yargs');
const yargonaut = require('yargonaut');
const chalk = require('chalk');
const {version, author} = require('../package');
const {handleError, handleExit} = require('../src/lib/utils/error-handler');
const {logger, getCmds, getFiglet} = require('../src/lib/utils');
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
	const cmdName = getCmds()[0],
		logo = await getFiglet(cmdName);
	yargs.logo = logo;
	yargonaut
		.helpStyle('blue.underline')
		.style('red.bold', 'required')
		.style('magenta', ['boolean', 'string']);

	const argv = yargs
		.scriptName(cmdName)
		.completion('completion', 'get completion script')
		.options({
			't': {
				alias: 'todo',
				demandOption: true,
				desc: 'the option value is todo',
				default: 'todo',
				type: 'string'
			}
		})
		.alias('h', 'help')
		.alias('v', 'version')
		.example(`${cmdName} create multicmd-cli myproject`, 'create a project from multicmd-cli template')
		.usage(`${chalk.yellowBright(logo)}\n\n${chalk.blue.underline('Usage:')} ${cmdName} <command> [options]`)
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
		.check(argv => {
			// TODO, 做参数校验
			console.log(argv);
			return true;
		}).argv;

	require('../src')(argv);
})();

