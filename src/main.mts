import { window, Hack } from '@cuclh/userscript-base';

const hack = new Hack();

hack.life.on('urlchange', ev => {
	alert(ev.url.toString());
});
