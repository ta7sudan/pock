import figures from 'figures';
import chalk from 'chalk';

export const error = (msg: string): void => console.error(chalk.red(`${figures.cross} ${msg}`));

export const success = (msg: string): void => console.log(`${chalk.green(figures.tick)} ${msg}`);

export const warn = (msg: string): void =>
	console.warn(`${chalk.red(figures.warning)} ${chalk.yellow(msg)}`);

export const note = (msg: string): void =>
	console.log(`${chalk.blue(figures.pointer)} ${chalk.cyan(msg)}`);
