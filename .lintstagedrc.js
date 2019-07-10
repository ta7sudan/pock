'use strict';
module.exports = {
	'*.js': files => files.map(file => `eslint ${file}`),
	'*.ts': files => files.filter(file => !/\.d\.ts$/.test(file)).map(file => `tslint ${file}`)
};