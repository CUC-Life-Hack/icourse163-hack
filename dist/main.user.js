// ==UserScript==
// @name    慕课 Hack
// @version 0.0.1
// @include https://www.icourse163.org/learn/*
// ==/UserScript==

(()=>{"use strict";var e={};(e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})})(e),(()=>{unsafeWindow||window&&(window.wrappedJSObject||window);class e extends Event{page;constructor(e,t,n){super(t,n),this.page=e}}class t extends EventTarget{constructor(){super(),window.addEventListener("locationchange",(()=>{this.dispatchEvent(new PageUrlChangeEvent(window.location.href,this,"urlchange"))}))}addEventListener(e,t,n){super.addEventListener(e,t,n)}dispatchEvent(e){return super.dispatchEvent(e)}removeEventListener(e,t,n){super.removeEventListener(e,t,n)}}})(),(new e.Hack).page.addEventListener("urlchange",(e=>{console.log(e)}))})();