// ==UserScript==
// @name         PRコックピット
// @namespace    https://pr-cockpit.com/
// @version      0.4.0
// @description  コンタクトレポートの機能改善
// @author       You
// @match        https://pr-cockpit.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pr-cockpit.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const script = document.createElement('script');
    script.src = 'https://cdn.antil.jp/js/prcockpit.js';
    document.body.appendChild(script);
})();
