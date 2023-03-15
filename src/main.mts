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
	windowUrl: URL;
	hashUrl: URL;
	content = {
		sectionId: "",
		contentId: "",
	};
	#speedrunning: boolean = false;

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
			}, 10, 2000);
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

	IsViewingCatalogue(): boolean {
		if(this.hashUrl.pathname !== '/learn/content')
			return false;
		if(this.hashUrl.search.length > 0)
			return false;
		return true;
	}
	IsViewingContent(): boolean {
		if(this.hashUrl.pathname !== '/learn/content')
			return false;
		if(this.hashUrl.searchParams.get('type') !== 'detail')
			return false;
		if(!this.hashUrl.searchParams.has('id'))
			return false;
		return true;
	}
	IsViewingCourse(): boolean {
		const path = this.windowUrl.pathname.slice(1).split('/');
		if(path.length !== 2)
			return false;
		if(path[0] !== 'learn')
			return false;
		if(!this.windowUrl.searchParams.has('tid'))
			return false;
		return true;
	}
	UpdateContentInformationFromHref(): void {
		this.content.sectionId = this.hashUrl.searchParams.get('id');
		if(this.hashUrl.searchParams.has('cid'))
			this.content.contentId = this.hashUrl.searchParams.get('cid');
	}

	async NavigateTo(url: URL | string): Promise<void> {
		window.location.href = url.toString();
		await Utils.Delay(1500);
	}
	NavigateToCatalogue(): Promise<void> {
		const url = new URL(this.windowUrl);
		url.hash = '/learn/content';
		return this.NavigateTo(url);
	}
	async NavigateToFirstUndoneLesson(): Promise<boolean> {
		if(!this.IsViewingCatalogue())
			await this.NavigateToCatalogue();
		const $chapterList = Array.from((await new Promise<HTMLElement>(async res => {
			let $: HTMLElement = null;
			await Utils.Until(() => {
				$ = window.document.querySelector('.m-learnChapterList');
				return $ !== null;
			}, 2000);
			res($);
		})).querySelectorAll('.m-learnChapterNormal')) as HTMLElement[];
		console.log($chapterList);
		console.group();
		const $firstUndoneLesson = await new Promise<HTMLElement>(async res => {
			for(const $chapter of $chapterList) {
				// $chapter.click();
				await Utils.Delay(1500);
				const $candidate = $chapter.querySelector('.lsicon:not(.learned)');
				console.log($candidate);
				if(!$candidate)
					continue;
				res($candidate as HTMLElement);
			}
			res(null);
		});
		console.groupEnd();
		console.warn($firstUndoneLesson);
		if($firstUndoneLesson === null)
			return false;
		$firstUndoneLesson.click();
		await Utils.Delay(1500);
	}

	async FinishPagedContent(): Promise<void> {
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
	async FinishContent(): Promise<void> {}

	get speedrunning(): boolean {
		return this.#speedrunning;
	}
	set speedrunning(value: boolean) {
		if(this.#speedrunning === value)
			return;
		switch(this.#speedrunning = value) {
			case true:
				this.TransitTo('Speedrunning');
				break;
			case false:
				this.TriggerAutoTransit();
				break;
		}
	}
	async ContinueSpeedrunning(): Promise<unknown> {
		if(!this.speedrunning)
			return;
		this.panel.Log('继续速通');
		/*
			可能有三种情况：
			(a) 在内容（课程）页，依次刷完后返回目录；
			(b) 在目录页，进入最前面的未完成内容或终止；
			(c) 在其他页，进入目录页。
		*/
		try {
			switch(true) {
				case this.IsViewingContent():
					this.panel.Log('进入内容页', 'warning');
					this.speedrunning = false;
					break;
				case this.IsViewingCatalogue():
					this.panel.Log('到达世界最高城，理塘！', 'warning');
					try {
						if(!await this.NavigateToFirstUndoneLesson()) {
							this.panel.Log(`全部课程已刷完，速通完毕`);
							this.speedrunning = false;
							break;
						}
					}
					catch(e) {
						this.panel.Log(`前往课程页时发生错误：${e}`, 'warning');
					}
					break;
				case this.IsViewingCourse():
					this.panel.Log('正在前往目录页');
					await this.NavigateToCatalogue();
					break;
				default:
					this.panel.Log('来到了未知页面，速通终止', 'warning');
					this.speedrunning = false;
					break;
			}
		}
		catch(e) {
			this.panel.Log(e + '', 'warning');
			this.speedrunning = false;
		}
		await Utils.Delay(100);
	}

	constructor() {
		super();

		this.life.on('start', () => {
			this.panel.title = '慕课 Hack';
			this.TryRestoreAddEventListener();
		});

		Object.entries({
			'Speedrunning': {
				validate(this: Hack) {
					return this.speedrunning;
				},
				async load(this: Hack) {
					this.panel.Button('停止速通', () => this.speedrunning = false);

					while(this.speedrunning) {
						await this.ContinueSpeedrunning();
					}
				},
				unload(this: Hack) {
					this.panel.Clear();
				}
			},
			'Viewing actual content': {
				validate(this: Hack) {
					return this.IsViewingContent();
				},
				async load(this: Hack) {
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
				unload(this: Hack) {
					this.panel.Clear();
					this.content.sectionId = "";
					this.content.contentId = "";
				},
			},
			'Idle': {
				validate(this: Hack) {
					return this.IsViewingCourse();
				},
				load(this: Hack) {
					this.panel.Button('开始速通', () => this.speedrunning = true);
				},
				unload(this: Hack) {
					this.panel.Clear();
				},
			},
		}).forEach(([name, state]) => this.states.set(name, state));

		this.life.on('urlchange', () => {
			this.windowUrl = new URL(window.location.href);
			this.hashUrl = new URL(`http://domain${this.windowUrl.hash.slice(1)}`);
			try {
				this.TriggerAutoTransit();
			}
			catch(e) {
				this.panel.Log(e + '', 'warning');
			}
		});
	}
}

new Hack();
