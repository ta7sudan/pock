'use strict';

async function mitm(app, options) {
	// 不在参数解构是考虑到时候也许直接把options传给某个库
	const {origin, dest} = options;
	if (typeof origin !== 'string' || !origin) {
		throw new TypeError('origin in mitm options must set correctly.');
	}

	// TODO
	console.log(dest);
	
}

module.exports = mitm;