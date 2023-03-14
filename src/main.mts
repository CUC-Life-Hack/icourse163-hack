import { window, Hack } from '@cuclh/userscript-base';

const hack = new Hack();

hack.life.on('urlchange', ev => {
	hack.panel.Log(ev.url.toString());
});
