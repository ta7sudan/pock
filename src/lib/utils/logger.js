'use strict';
const figures = require('figures');
const chalk = require('chalk');

exports.error = msg => console.error(chalk.red(`${figures.cross} ${msg}`));

exports.success = msg => console.log(`${chalk.green(figures.tick)} ${msg}`);

exports.warn = msg => console.warn(`${chalk.red(figures.warning)} ${chalk.yellow(msg)}`);
