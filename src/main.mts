import { Hack as HackBase, Cookie, Ajax, Ne, Utils, window } from '@cuclh/userscript-base';

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

class Hack extends HackBase {
	AddEventListenerIsHijacked(): boolean {
		return !HTMLElement.prototype.addEventListener.toString().includes('native code');
	}
	async TryRestoreAddEventListener(): Promise<boolean> {
		if(!this.AddEventListenerIsHijacked())
			return true;
		this.panel.Log('addEventListener 已被劫持，尝试恢复', 'warning');
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
			if(this.AddEventListenerIsHijacked())
				throw `从 iframe 获取到了 ${fetched.toString()}`;
		}
		catch(e) {
			this.panel.Log(`恢复失败：${e}`, 'warning');
			return true;
		}
		this.panel.Log('恢复成功', 'warning');
		return true;
	}

	hashUrl: URL;
	content = {
		sectionId: "",
		contentId: "",
	};

	IsViewingContent(): boolean {
		if(
			this.hashUrl.pathname !== '/learn/content' ||
			this.hashUrl.searchParams.get('type') !== 'detail'
		)
			return false;
		if(!this.hashUrl.searchParams.has('id'))
			return false;
		return true;
	}
	UpdateContentInformationFromHref() {
		this.content.sectionId = this.hashUrl.searchParams.get('id');
		if(this.hashUrl.searchParams.has('cid'))
			this.content.contentId = this.hashUrl.searchParams.get('cid');
	}

	async FinishPagedContent() {
		this.panel.Log('正在完成分页课件');
		const pathname = '/web/j/courseRpcBean.saveMocContentLearn.rpc';
		const payload = {
			dto: {
				unitId: parseInt(this.content.contentId),
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
			this.panel.Log(e + '');
			return;
		}
		this.panel.Log('完成成功');
	}

	constructor() {
		super();

		this.life.on('start', () => {
			this.panel.title = '慕课 Hack';
			this.TryRestoreAddEventListener();
		});

		Object.entries({
			'Viewing actual content': {
				validate: () => this.IsViewingContent(),
				async load() {
					this.panel.Clear();

					this.UpdateContentInformationFromHref();
					this.panel.Log(`id=${this.content.sectionId}, cid=${this.content.contentId}`);

					this.panel.Header('UI 层操作');
					this.panel.Button('视频加速', () => {
						const video = window.document.querySelector('.u-edu-h5player-mainvideo video') as HTMLVideoElement;
						if(!video) {
							this.panel.Log('未找到可播放视频', 'warning');
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
						this.panel.Log(`已将视频提速至 ${video.playbackRate.toFixed(2)}x`);
					});
					this.panel.Header('数据层操作');
					this.panel.Button('完成分页课件', this.FinishPagedContent);
				},
				unload() {
					this.panel.Clear();
					this.content.sectionId = "";
					this.content.contentId = "";
				},
			}
		}).forEach(([name, state]) => this.states.set(name, state));

		this.life.on('urlchange', function() {
			const currentUrl = new URL(window.location.href);
			this.hashUrl = new URL(`http://domain${currentUrl.hash.slice(1)}`);
			try {
				this.TriggerAutoTransit();
			}
			catch(e) {
				this.panel.Log(e.toString(), 'warning');
			}
		});
	}
}

new Hack();
