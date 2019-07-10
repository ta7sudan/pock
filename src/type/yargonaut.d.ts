declare const yargonaut: YargonautInstance;

interface YargonautInstance {
	help(...args: any[]): this;
	errors(...args: any[]): this;
	font(...args: any[]): this;
	helpStyle(...args: any[]): this;
	errorsStyle(...args: any[]): this;
	style(...args: any[]): this;
	transformWholeString(...args: any[]): this;
	transformUpToFirstColon(...args: any[]): this;
	ocd(...args: any[]): this;
	getAllKeys(...args: any[]): this;
	getHelpKeys(...args: any[]): this;
	getErrorKeys(...args: any[]): this;
	asFont(...args: any[]): this;
	listFonts(...args: any[]): this;
	printFont(...args: any[]): this;
	printFonts(...args: any[]): this;
	figlet(...args: any[]): this;
	chalk(...args: any[]): this;
}

declare module 'yargonaut' {
	export default yargonaut;
}
