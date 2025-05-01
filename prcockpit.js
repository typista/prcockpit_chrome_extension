(function() {
    'use strict';
    const XHR_PER_SEC = 2, // １秒間に最大アクセスは２回
          XHR_WAIT = 1000 / XHR_PER_SEC,
          WHITE_LIST = [
              "株式会社ベジタブル電機",
          ],
          contact_kind_list = {
            'ページ遷移': { contact_type_eng: 'page_transition' },
            '資料DL': { contact_type_eng: 'document_dl', content: '資料ダウンロード' },
            'メール送信': { contact_type_eng: 'mail_sent', content: '一斉配信' },
            '電話会話': { contact_type_eng: 'phone_conversation' },
            '面会': { contact_type_eng: 'visitation' },
            '掲載前向き検討': { contact_type_eng: 'publication_consider' },
            '掲載': { contact_type_eng: 'publication' },
            '重要KW露出': { contact_type_eng: 'keywords' },
            '記者会見参加申込': { contact_type_eng: 'expect_press_conference' },
          },
          list = {};
    let done = false;

    override_xhr();
    setInterval(appendUploadCsvButton, 1000);

    let intervalId = setInterval(()=>{
        const authorization = get_http_request_header('Authorization'),
              clientName = getClientName(),
              isWhiteList = WHITE_LIST.includes(clientName);

        console.log(`authorization: ${authorization}`);
        console.log(`clientName: ${clientName}`);
        console.log(`isWhiteList: ${isWhiteList}`);
        if (!isWhiteList) return;

        if (authorization && !done) {
            done = true;
            clearInterval(intervalId);
            intervalId = null;

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
            });
        }
    }, 2000);

    function getClientName() {
        return document.querySelector('.title-logo')?.textContent.trim();
    }
    function appendUploadCsvButton() {
        const {pathname} = location,
              isDashboard = pathname == '/',
              report_title = document.querySelector('.report-title'),
              input = document.createElement('input'),
              button = document.createElement('button'),
              klass = 'custom-upload-btn',
              expression = `.${klass}`,
              css = `${expression} {
                float: right;
                padding: 14px 16px;
              }`;

        if (!isDashboard || !report_title || document.querySelector(expression)) {
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
                  file = target.files[0];
            loadCsv(file);
        });

        function loadCsv(file) {
            const reader = new FileReader();
            reader.addEventListener('load', ()=>{
                const arrayBuffer = reader.result,
                      params = {};
                updataByCsv(arrayBuffer, params);
            });
            reader.readAsArrayBuffer(file);
        }
        function row2data(row, label) {
            const data = {};
            row.forEach((col, i)=>{
                const key = label[i],
                      value = col;
                data[key] = value;
            });
            return data;
        }
        function data2params(data) {
            const media_id = data['ID'],
                  isValidMedia = /\d+$/.test(media_id),
                  detail = data['コンタクトレポート（詳細）'] || '詳細未記入',
                  nextaction_date = data['ネクストアクション期限日'],
                  nextaction_content = data['ネクストアクション内容'],
                  memo = data['メモ'],
                  createdAt = data['登録日'],
                  updatedAt = data['更新日'],
                  contact_date = updatedAt,
                  kind_list = Object.keys(contact_kind_list);

            return {media_id, isValidMedia, detail, nextaction_date, nextaction_content, memo, createdAt, contact_date, kind_list};
        }
        function data2contact(row, label, params) {
            params = params || {};
            const {isDryRun = true, isMultiple = false} = params,
                  report = [],
                  data = row2data(row, label),
                  {media_id, isValidMedia, detail, nextaction_date, nextaction_content, memo, createdAt, contact_date, kind_list} = data2params(data);

            console.log(`isDryRun: ${isDryRun}`);
            console.log(`isMultiple: ${isMultiple}`);

            delayedForEach(kind_list, (kind)=>{
                const one = contact_kind_list[kind],
                      value = data[kind],
                      count = /^\d+$/.test(value) ? Number(value) : 0,
                      {contact_type_eng} = one;

                if (isValidMedia) {
                    for (let i=0; i<count; i++) {
                        const message = `コンタクトレポートを追加します。\ndate: ${contact_date}\n${kind}: ${value}\n詳細: ${detail}\ncontact_type_eng: ${contact_type_eng}`;
                        report.push(message);
                        if (!isDryRun) createContact(contact_date, media_id, contact_type_eng, detail);
                        if (!isMultiple) break;
                    }
                }
            });
            return report;
        }
        function data2action(row, label, params) {
            params = params || {};
            const {isDryRun = true, isMultiple = false} = params,
                  report = [],
                  data = row2data(row, label),
                  {media_id, isValidMedia, detail, nextaction_date, nextaction_content, memo, createdAt, contact_date, kind_list} = data2params(data);

            if (isValidMedia) {
                getMediaInfo(media_id, (json)=>{
                    const {data} = json,
                          {next_action, note = ''} = data || {},
                          {id, content, expired_at = ''} = next_action || {},
                          next_action_id = id || media_id,
                          isValidDate = /\d{4}\-\d{2}\-\d{2}/.test(nextaction_date),
                          isCreateAction = isValidDate && !id,
                          isUpdateAction = isValidDate && id,
                          isFinishAction = nextaction_date == '完了' && id,
                          update_content = nextaction_content ? `${nextaction_content}\n${content}` : content,
                          isCreateNote = !note,
                          isUpdateNote = note,
                          current_note = isCreateNote ? `` : `\n${note}`,
                          update_note = memo ? `${memo}${current_note}` : null;

                    if (memo) {
                        const message = `メモを更新します。\n${update_note}`;
                        report.push(message);
                        if (!isDryRun) updateMemo(media_id, update_note);
                    }
                    if (isFinishAction) {
                        const message = `ネクストアクションを完了にします。\nnext_action_id: ${next_action_id}`;
                        report.push(message);
                        if (!isDryRun) terminateNextAction(next_action_id);
                    } else if (isCreateAction) {
                        const message = `ネクストアクションを作成します。\nmedia_id: ${media_id}\nnextaction_date: ${nextaction_date}\nnextaction_content: ${nextaction_content}`;
                        report.push(message);
                        if (!isDryRun) createNextAction(media_id, nextaction_date, nextaction_content);
                    } else if (isUpdateAction) {
                        const message = `ネクストアクションを更新します。\nmedia_id: ${media_id}\nnextaction_date: ${nextaction_date}\nupdate_content: ${update_content}\nnext_action_id: ${next_action_id}`;
                        report.push(message);
                        if (!isDryRun) updateNextAction(next_action_id, nextaction_date, update_content);
                    }
                });
            }
            return report;
        }

        function updataByCsv(arrayBuffer, params) {
            const encoding = detectUtf8OrSjis(arrayBuffer),
                  text = decodeArrayBuffer(arrayBuffer, encoding),
                  csv = parseCSV(text);

            console.log(`検出エンコーディング: ${encoding}`);
            console.log(list);
            let label;
            delayedForEach(csv, (row, i)=>{
                // ラベル行
                if (i == 0) {
                    if (!row.length || row.every(v=>!v.trim())) {
                        throw new Error('アップロードしたCSVの１行目がブランクです。');
                    }
                    label = row;
                // ２行目以降
                } else {
                    const log = {
                            contact: data2contact(row, label, params),
                            action: data2action(row, label, params),
                          },
                          report = log.contact.concat(log.action);
                }
            });
        }
        function ________updataByCsv(arrayBuffer) {
            const encoding = detectUtf8OrSjis(arrayBuffer),
                  text = decodeArrayBuffer(arrayBuffer, encoding),
                  csv = parseCSV(text);

            console.log(`検出エンコーディング: ${encoding}`);
            console.log(list);

            let mode, content;

            delayedForEach(csv, (row, i)=>{
                const col = row,
                      data = col[1];
                // ラベル行
                if (i == 0) {
                    const label = checkLabel(data);
                    mode = label.mode;
                    content = label.content;
                // ２行目以降
                } else if (mode) {
                    const isId = /^\d+$/.test(data),
                          contact_date = col[0],
                          {nextaction_date, nextaction_content, memo} = checkFormat(col),
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

                        if (nextaction_date || nextaction_content || memo) {
                            getMediaInfo(media_id, (json)=>{
                                console.log(json);
                                const {data} = json,
                                      {next_action, note = ''} = data,
                                      {id, content, expired_at = ''} = next_action || {},
                                      next_action_id = id || media_id,
                                      isValidDate = /\d{4}\-\d{2}\-\d{2}/.test(nextaction_date),
                                      isCreateAction = isValidDate && !id,
                                      isUpdateAction = isValidDate && id,
                                      isFinishAction = nextaction_date == '完了' && id,
                                      update_content = nextaction_content ? `${nextaction_content}\n${content}` : content,
                                      isCreateNote = !note,
                                      isUpdateNote = note,
                                      current_note = isCreateNote ? `` : `\n${note}`,
                                      update_note = memo ? `${memo}${current_note}` : null;

                                if (memo) {
                                    updateMemo(media_id, update_note);
                                }
                                if (isFinishAction) {
                                    terminateNextAction(next_action_id);
                                } else if (isCreateAction) {
                                    createNextAction(media_id, nextaction_date, nextaction_content);
                                } else if (isUpdateAction) {
                                    updateNextAction(next_action_id, nextaction_date, update_content);
                                }
                            });
                        }
                    });
                }
            }, 1);
        }
        function checkLabel(data) {
            let mode, content;
            console.log(`data: ${data}`);
            switch (data) {
                case 'ページ遷移':
                case '資料DL':
                case 'メール送信':
                case '電話会話':
                case '面会':
                case '掲載前向き検討':
                case '掲載':
                case '重要KW露出':
                case '記者会見参加申込':
                    mode = contact_kind[data].mode;
                    content = contact_kind[data].content || data;
                    break;
            }
            return {mode, content};
        }
        function checkFormat(col) {
            let nextaction_date,
                nextaction_content,
                memo;
            const length = col.length;
            console.log(`length: ${length}`);
            switch (length) {
                case 5: // メモ
                    memo = col[4];
                    // falls through
                case 4: // ネクストアクション日
                    nextaction_date = col[3];
                    // falls through
                case 3: // ネクストアクション
                    nextaction_content = col[2];
                    break;
            }
            return {nextaction_date, nextaction_content, memo};
        }
    }
    /**
     * CSV文字列を 2 次元配列にパースする
     * @param {string} text CSV 全体のテキスト
     * @param {string} [delimiter=','] セル区切り文字（デフォルトはカンマ）
     * @returns {string[][]} 解析結果の配列
     */
    function parseCSV(text, delimiter = ',') {
        const rows = [];
        let row = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    // エスケープされたダブルクォート
                    field += '"';
                    i++; // 次の " をスキップ
                } else if (char === '"') {
                    // QUOTE 終了
                    inQuotes = false;
                } else {
                    // 改行も含め、全てをフィールドに追加
                    field += char;
                }
            } else {
                if (char === '"') {
                    // QUOTE 開始
                    inQuotes = true;
                } else if (char === delimiter) {
                    // セル区切り
                    row.push(field);
                    field = '';
                } else if (char === '\r') {
                    // CR は無視（CRLF 対応）
                    continue;
                } else if (char === '\n') {
                    // 行区切り
                    row.push(field);
                    rows.push(row);
                    row = [];
                    field = '';
                } else {
                    // 通常文字
                    field += char;
                }
            }
        }

        // 最終行の処理（改行で終わらない場合に備えて）
        if (field !== '' || inQuotes || row.length > 0) {
            row.push(field);
            rows.push(row);
        }

        return rows;
    }
    function delayedForEach(array, func, delaySeconds = 1) {
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
            callback(res);
        });
    }
    function getMediaInfo(media_id, callback) {
        const authorization = get_http_request_header('Authorization'),
              method = 'GET',
              path = `/api/v1/client/medias/${media_id}`,
              params = null;
        http(method, path, params, authorization, (res)=>{
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
    function createNextAction(media_id, expired_date, content) {
        const authorization = get_http_request_header('Authorization'),
              method = 'POST',
              path = `/api/v1/client/next-action/add`,
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
            try {
                fetch(path, options)
                    .then(response => response.json())
                    .then(json => {
                    callback(json);
                });
            } catch (err) {
                console.log(`ERROR !!!!`);
                console.log(err);
            }
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
