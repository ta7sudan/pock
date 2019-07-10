const eventName = 'unhandledRejection';

function registerHandler(event: 'unhandledRejection'): void {
	process.addListener(event, (reason: any): void | never => {
		if (reason instanceof Error) {
			throw reason;
		} else {
			throw new Error(`Unhandled promise rejection. Reject reason is: ${JSON.stringify(reason)}`);
		}
	});
}

if (process.listenerCount(eventName) === 0) {
	registerHandler(eventName);
}
