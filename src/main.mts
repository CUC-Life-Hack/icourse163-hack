import { Hack, Cookie, Ajax, Ne } from '@cuclh/userscript-base';

const hack = new Hack();

hack.life.on('start', function() {
	hack.panel.title = '慕课 Hack';

	if(!Ne.Legacy.addEventListener.toString().includes('native code'))
		hack.panel.Log('addEventListener 已被劫持！', 'warning');
});

class AjaxWithCsrf extends Ajax {
	static readonly cookieName = 'AjaxWithCsrf';

	override Post() {
		const csrf = Cookie.get(AjaxWithCsrf.cookieName);
		if(!csrf || !/^[a-f\d]+$/.test(csrf))
			throw 'Invalid CSRF key';
		this.searchParams.set('csrfKey', csrf);
		return super.Post();
	}
}

const content = {
	sectionId: "",
	contentId: "",
};

async function FinishPagedContent() {
	hack.panel.Log('正在完成分页课件');
	const pathname = '/web/j/courseRpcBean.saveMocContentLearn.rpc';
	const payload = {
		dto: {
			unitId: content.contentId,
			pageNum: -1,
			finished: true,
			contentType: 3
		}
	};
	const ajax = new AjaxWithCsrf(pathname, 'POST');
	ajax.payload = JSON.stringify(payload);
	try {
		const response = JSON.parse(await ajax.Post());
		if(response.result !== true)
			throw '完成失败';
	}
	catch(e) {
		hack.panel.Log(e + '');
		return;
	}
	hack.panel.Log('完成成功');
}

interface Entry {
	validate(url: URL): boolean;
	load(): any;
};
const entries: Entry[] = [
	// Content
	{
		validate(url: URL): boolean {
			try {
				const hashUrl = new URL(`http://domain${url.hash.slice(1)}`);
				if(hashUrl.pathname !== '/learn/content')
					throw `Path name is not "/learn/content".`;
				if(hashUrl.searchParams.get('type') !== 'detail')
					throw `Content type is not "detail".`;
				if(!hashUrl.searchParams.has('id'))
					throw `URL lacks section ID.`;
				content.sectionId = hashUrl.searchParams.get('id');
				if(hashUrl.searchParams.has('cid'))
					content.contentId = hashUrl.searchParams.get('cid');
			}
			catch(e) {
				hack.panel.Log(e + '');
				return false;
			}
			return true;
		},
		load() {
			hack.panel.Clear();
			hack.panel.Log(`id=${content.sectionId}, cid=${content.contentId}`);
			hack.panel.Button('完成分页课件', FinishPagedContent);
		},
	},
];

hack.life.on('urlchange', function(
	{ url }: { url: URL; }
) {
	for(const entry of entries) {
		if(entry.validate(url)) {
			entry.load();
			break;
		}
	}
});
