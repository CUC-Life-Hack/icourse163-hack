import { Hack, Cookie, Ajax, Ne, Utils, window } from '@cuclh/userscript-base';

const hack = new Hack();

function AddEventListenerIsHijacked(): boolean {
	return !HTMLElement.prototype.addEventListener.toString().includes('native code');
}

async function TryRestoreAddEventListener(): Promise<boolean> {
	if(!AddEventListenerIsHijacked())
		return true;
	hack.panel.Log('addEventListener 已被劫持，尝试恢复', 'warning');
	try {
		const iframe = Ne.Create('iframe', {
			rawAttributes: {
				sandbox: 'allow-same-origin',
			},
		});
		// Attach iframe to body
		await Utils.Until(() => {
			const body = window.document.body;
			if(!body)
				return false;
			body.appendChild(iframe);
			return !!iframe.parentNode;
		}, 10, 500);
		// Wait for its document to load
		await Utils.Until(() => !!iframe.contentDocument, 10, 500);
		const fetched = iframe.contentDocument?.addEventListener;
		// Won't work
		try {
			Object.defineProperty(HTMLElement.prototype, 'addEventListener', {
				value: fetched,
				writable: false,
				configurable: false,
			});
		} catch {}
		Ne.Remove(iframe);
		if(AddEventListenerIsHijacked())
			throw `从 iframe 获取到了 ${fetched.toString()}`;
	}
	catch(e) {
		hack.panel.Log(`恢复失败：${e}`, 'warning');
		return true;
	}
	hack.panel.Log('恢复成功', 'warning');
	return true;
}

hack.life.on('start', function() {
	hack.panel.title = '慕课 Hack';
});

class AjaxWithCsrf extends Ajax {
	static readonly cookieName = 'NTESSTUDYSI';

	override Post() {
		const csrf = Cookie.get(AjaxWithCsrf.cookieName);
		if(!csrf || !/^[a-f\d]+$/.test(csrf))
			throw `Invalid CSRF key: ${csrf}`;
		this.searchParams.set('csrfKey', csrf);
		return super.Post();
	}
}

// Content

const content = {
	sectionId: "",
	contentId: "",
};

function UpdateContentInformationFromHref() {
	try {
		const currentUrl = new URL(window.location.href);
		const hashUrl = new URL(`http://domain${currentUrl.hash.slice(1)}`);
		if(
			hashUrl.pathname !== '/learn/content' ||
			hashUrl.searchParams.get('type') !== 'detail'
		)
			throw `Not viewing content.`;
		if(!hashUrl.searchParams.has('id'))
			throw `URL lacks section ID.`;
		content.sectionId = hashUrl.searchParams.get('id');
		if(hashUrl.searchParams.has('cid'))
			content.contentId = hashUrl.searchParams.get('cid');
	}
	catch(e) {
		throw e;
	}
}

async function FinishPagedContent() {
	hack.panel.Log('正在完成分页课件');
	const pathname = '/web/j/courseRpcBean.saveMocContentLearn.rpc';
	const payload = {
		dto: {
			unitId: parseInt(content.contentId),
			pageNum: 0,
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

Object.entries({
	'Viewing actual content': {
		validate(): boolean {
			try {
				UpdateContentInformationFromHref();
			}
			catch(e) {
				return false;
			}
			return true;
		},
		async load() {
			hack.panel.Clear();
			hack.panel.Log(`id=${content.sectionId}, cid=${content.contentId}`);
			if(!await TryRestoreAddEventListener()) {
				hack.panel.Log('放弃加载功能', 'warning');
				return;
			}
			hack.panel.Header('UI 层操作');
			hack.panel.Button('视频加速', () => {
				const video = window.document.querySelector('.u-edu-h5player-mainvideo video') as HTMLVideoElement;
				if(!video) {
					hack.panel.Log('未找到可播放视频', 'warning');
					return;
				}
				const playbackRates = [5, 10, 16, 20, 32, 50, 100];
				for(const rate of playbackRates) {
					try {
						video.playbackRate = rate;
					}
					catch {}
				}
				video.play();
				hack.panel.Log(`已将视频提速至 ${video.playbackRate.toFixed(2)}x`);
			});
			hack.panel.Header('数据层操作');
			hack.panel.Button('完成分页课件', FinishPagedContent);
		},
		unload() {
			content.sectionId = "";
			content.contentId = "";
		},
	}
}).forEach(([name, state]) => hack.states.set(name, state));

hack.life.on('urlchange', function() {
	hack.TriggerAutoTransit();
});
