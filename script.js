// ==UserScript==
// @name         PRコックピット
// @namespace    https://pr-cockpit.com/
// @version      0.1.0
// @description  コンタクトレポートの機能改善
// @author       You
// @match        https://pr-cockpit.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pr-cockpit.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const XHR_PER_SEC = 2, // １秒間に最大アクセスは２回
          XHR_WAIT = 1000 / XHR_PER_SEC,
          contact_kind = {
            'ページ遷移': { mode: 'page_transition' },
            '資料DL': { mode: 'document_dl', content: '資料ダウンロード' },
            'メール送信': { mode: 'mail_sent', content: '一斉配信' },
            '電話会話': { mode: 'phone_conversation' },
            '面会': { mode: 'visitation' },
            '掲載前向き検討': { mode: 'publication_consider' },
            '掲載': { mode: 'publication' },
            '重要KW露出': { mode: 'keywords' },
            '記者会見参加申込': { mode: 'expect_press_conference' },
          },
          list = {};
    let done = false;
    override_xhr();
    appendUploadCsvButton();

    let intervalId = setInterval(()=>{
        const authorization = get_http_request_header('Authorization');
        console.log(`authorization: ${authorization}`);
        if (authorization && !done) {
            done = true;
            clearInterval(intervalId);
            intervalId = null;
            //createContact();
            //createNextAction();

            getMediaList((json)=>{
                console.log(json);
                const {code, current_page, data, message, total} = json,
                      emails = [],
                      ids = [];
                data.forEach((v)=>{
                    const {id, management_mail} = v;
                    list[management_mail] = list[management_mail] || [];
                    list[management_mail].push(id);
                    emails.push(management_mail);
                    ids.push(id);
                });
                console.log(list);
                //console.log(emails.join('\n'));
                //console.log(ids.join('\n'));
            });

            const media_id = 2612003,
                  add = 'フリーメモ欄に追記';

            getMediaInfo(media_id, (json)=>{
                console.log(json);
                const {data} = json,
                      {next_action, note} = data,
                      {id, content, expired_at = ''} = next_action || {},
                      next_action_id = id,
                      expired_date = expired_at.split(' ')[0],
                      update_content = `${add}\n${content}`,
                      update_note = `${add}\n${note}`;

                console.log(`note: ${note}`);
                console.log(`update_note: ${update_note}`);
                console.log(`update_note.length: ${update_note.length}`);
                console.log(data);
                console.log(next_action);
                //updateMemo(media_id, update_note);
                //updateNextAction(next_action_id, expired_date, update_content);
                //terminateNextAction(next_action_id);
            });
        }
    }, 2000);

    function appendUploadCsvButton() {
        const report_title = document.querySelector('.report-title'),
              input = document.createElement('input'),
              button = document.createElement('button'),
              klass = 'custom-upload-btn',
              expression = `.${klass}`,
              css = `${expression} {
                float: right;
                padding: 14px 16px;
              }`;

        if (!report_title || document.querySelector(expression)) {
            return;
        }

        appendStyle(css);
        input.type = 'file';
        input.accept = 'text/csv';
        input.style.display = 'none';
        button.textContent = 'CSVアップロード';
        button.classList.add('sign-up-btn', klass);
        report_title.appendChild(input);
        report_title.appendChild(button);
        button.addEventListener('click', (event)=>{
            input.click();
        });
        input.addEventListener('change', (event)=>{
            const target = event.target,
                  file = target.files[0],
                  reader = new FileReader();

            reader.addEventListener('load', ()=>{
                const arrayBuffer = reader.result,
                      encoding = detectUtf8OrSjis(arrayBuffer),
                      text = decodeArrayBuffer(arrayBuffer, encoding),
                      csv = text.split('\n');

                console.log(`検出エンコーディング: ${encoding}`);
                console.log(list);

                let mode, content;

                delayedForEach(csv, (row, i)=>{
                    const col = row.split(','),
                          data = col[1];
                    if (i == 0) {
                        console.log(`data: ${data}`);
                        switch (data) {
                            case 'メール送信':
                            case '資料DL':
                                mode = contact_kind[data].mode;
                                content = contact_kind[data].content;
                                break;
                        }
                    } else {
                        const isId = /^\d+$/.test(data),
                              contact_date = col[0],
                              temp = isId ? data : list[data],
                              media_id_list = Array.isArray(temp) ? temp : [temp],
                              key = isId ? 'id' : 'メールアドレス',
                              contact_type_eng = mode;

                        media_id_list.forEach((media_id, i)=>{
                            const value = isId ? data : `${media_id}(${data})`;
                            if (media_id) {
                                console.log(`コンタクトレポートを更新します。\ndate: ${contact_date}\n${key}: ${value}\ncontact_type_eng: ${contact_type_eng}`);
                                createContact(contact_date, media_id, contact_type_eng, content);
                            } else if (data) {
                                console.log(`メディアリストに存在しません: ${data}`);
                            }
                        });
                    }
                    //col.forEach((cell)=>{
                    //console.log(cell);
                    //});
                }, 1);
            });
            reader.readAsArrayBuffer(file);

        });
    }
    function delayedForEach(array, func, delaySeconds) {
        function _next(i) {
            if (i >= array.length) return;
            func(array[i], i);
            setTimeout(() => _next(i + 1), delaySeconds * XHR_WAIT);
        }
        _next(0);
    }
    /**
     * ArrayBuffer を指定エンコーディングで文字列化する
     * @param {ArrayBuffer} arrayBuffer
     * @param {string} encoding - 'utf-8' or 'shift_jis'
     * @returns {string}
     */
    function decodeArrayBuffer(arrayBuffer, encoding) {
        // TextDecoder は modern ブラウザで shift_jis をサポート
        const uint8 = new Uint8Array(arrayBuffer),
              decoder = new TextDecoder(encoding, { fatal: true });
        return decoder.decode(uint8.buffer);
    }

    /**
     * UTF-8 と SJIS を判別する
     * @param {ArrayBuffer} arrayBuffer
     * @returns {'utf-8' | 'shift_jis'}
     */
    function detectUtf8OrSjis(arrayBuffer) {
        const uint8 = new Uint8Array(arrayBuffer);
        // UTF-8 で fatal オプションを使いデコードを試みる
        try {
            new TextDecoder('utf-8', { fatal: true }).decode(uint8);
            // デコード成功 → UTF-8 と判断
            return 'utf-8';
        } catch (e) {
            // デコードエラー → UTF-8 として不正 → SJIS と判断
            return 'shift_jis';
        }
    }
    function getMediaList(callback) {
        const authorization = get_http_request_header('Authorization'),
              method = 'GET',
              page = 1,
              pageSize = 100,
              sort_direction = 'ASC',
              query = {page, pageSize, sort_direction},
              queryString = Object.keys(query).map(v=>`${v}=${query[v]}`).join('&'),
              path = `/api/v1/client/medias?${queryString}`,
              params = null;
        http(method, path, params, authorization, (res)=>{
            console.log(res);
            callback(res);
        });
    }
    function getMediaInfo(media_id, callback) {
        const authorization = get_http_request_header('Authorization'),
              method = 'GET',
              path = `/api/v1/client/medias/${media_id}`,
              params = null;
        http(method, path, params, authorization, (res)=>{
            console.log(res);
            callback(res);
        });
    }
    function updateMemo(id, note) {
        const authorization = get_http_request_header('Authorization'),
              method = 'POST',
              path = `/api/v1/client/medias/note/edit`,
              params = {id, note};
        http(method, path, params, authorization, (res)=>{
            console.log(res);
        });
    }
    function createNextAction() {
        const authorization = get_http_request_header('Authorization'),
              method = 'POST',
              path = `/api/v1/client/next-action/add`,
              expired_date = '2025-04-03',
              content = 'test',
              media_id = 2612006,
              params = {expired_date, content, media_id};
        http(method, path, params, authorization, (res)=>{
            console.log(res);
        });
    }
    function updateNextAction(next_action_id, expired_date, content) {
        const authorization = get_http_request_header('Authorization'),
              method = 'POST',
              path = `/api/v1/client/next-action/${next_action_id}/edit`,
              media_id = next_action_id,
              params = {expired_date, content, media_id};
        http(method, path, params, authorization, (res)=>{
            console.log(res);
        });
    }
    function terminateNextAction(action_id) {
        const authorization = get_http_request_header('Authorization'),
              method = 'POST',
              path = `/api/v1/client/action/finish`,
              params = {action_id};
        http(method, path, params, authorization, (res)=>{
            console.log(res);
        });
    }
    function createContact(contact_date, media_id, contact_type_eng, content = '') {
        const authorization = get_http_request_header('Authorization'),
              method = 'POST',
              path = `/api/v1/client/reports/add`,
              //contact_date = '2025-04-03',
              // 資料DL: document_dl
              // ページ遷移: page_transition
              // メール送信: mail_sent
              // 電話会話: phone_conversation
              // 面会: visitation
              // 掲載前向き検討: publication_consider
              // 掲載: publication
              // 重要KW露出: keywords
              // 記者会見参加申込: expect_press_conference
              //content = 'test',
              //media_id = 2794491,
              params = {contact_date, contact_type_eng, content, media_id};

        http(method, path, params, authorization, (res)=>{
            console.log(res);
        });
    }
    function getCookieValue(key) {
        const cookies = document.cookie.split(';')
        const foundCookie = cookies.find(
            (cookie) => cookie.split('=')[0].trim() === key.trim()
        )
        if (foundCookie) {
            const cookieValue = decodeURIComponent(foundCookie.split('=')[1])
            return cookieValue
        }
        return ''
    }
    function http(method, path, params, authorization, callback) {
		const {host, pathname} = location,
              cookie = document.cookie,
              token = getCookieValue('XSRF-TOKEN'),
              body = params ? stringify(params) : null,
              query = {
                  'Accept': 'application/json',
                  'Accept-Encoding': 'gzip, deflate, br, zstd',
                  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                  'Authorization': authorization,
                  'Origin': `https://${host}`,
                  'Referer': `https://${host}${pathname}`,
                  'Cookie': cookie,
                  //'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                  'Content-Type': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                  'X-Xsrf-Token': token
              };
              //body = params,
        if (body) {
            query['Content-Length'] = body.length;
        }
        const headers = new Headers(query),
              options = {method, headers};
        if (body) {
            options.body = body;
        }
        if (path) {
            fetch(path, options)
                .then(response => response.json())
                .then(json => {
                callback(json);
            });
        }
        function stringify(params) {
            return JSON.stringify(params);
        }
    }
    function get_http_request_header(key) {
        return window.globalHeaders[key];
    }
    function override_xhr() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

        // ヘッダーを保存するグローバル変数
        window.globalHeaders = {};

        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            this._url = url;
            this._method = method;
            this._headers = {}; // ヘッダーを保存するためのオブジェクト
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
            this._headers[header] = value; // ヘッダーを記録
            return originalSetRequestHeader.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(body) {
            console.log("XHR Request Intercepted:");
            console.log("Method:", this._method);
            console.log("URL:", this._url);
            console.log("Headers:", this._headers);
            console.log("Body:", body);

            // グローバル変数にヘッダーを保存
            window.globalHeaders = { ...this._headers };

            return originalSend.apply(this, arguments);
        };
    }
    function appendStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }
})();
