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

    init();
    setInterval(beautify, 2000);
    override_xhr();
    setInterval(appendUploadCsvButton, 1000);

    let intervalId = setInterval(()=>{
        const authorization = get_http_request_header('Authorization'),
              clientName = getClientName(),
              isWhiteList = WHITE_LIST.includes(clientName),
              uploadButton = document.querySelector('.custom-upload-btn'),
              reportAllButton = document.querySelector('#report li'),
              isDisabled = uploadButton?.getAttribute('disabled');

        console.log(`authorization: ${authorization}`);
        console.log(`clientName: ${clientName}`);
        console.log(`isWhiteList: ${isWhiteList}`);
        console.log(window.globalHeaders);
        if (!isWhiteList) return;

        if (isDisabled) {
            reportAllButton?.click(); // XHRをフックしてAuthorizationを取得する
        }
        if (authorization && !done) {
            done = true;
            clearInterval(intervalId);
            intervalId = null;

            getMediaList((json)=>{
                console.log(json);
                const {code, current_page, data, message, total} = json,
                      emails = [],
                      ids = [];
                console.log(data);
                if (data.length) {
                  uploadButton?.removeAttribute('disabled');
                }
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

    function init() {
        const style = `.media_id {
            width: 80px;
            margin-right: 4px;
            padding: 4px;
            text-align: center;
        `;
        appendStyle(style);
    }
    function getClientName() {
        return document.querySelector('.title-logo')?.textContent.trim();
    }
    function formatNumber() {
        document.querySelectorAll('.amount .number,.detail .point,.pieces .num,.s-point').forEach((v)=>{
            const text = v.textContent.trim(),
                  num = Number(text).toLocaleString();
            if (/^\d+$/.test(text)) v.textContent = num;
        });
        document.querySelectorAll('.text-black,.blue').forEach((v)=>{
            const text = v.textContent.trim(),
                  num = text.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            v.textContent = num;
        });
    }
    function insertPagination(isStyleAdd = true) {
        const expression = {
                origin: '.pagination.paging',
                clone: 'pagination-clone',
              },
              isDone = document.querySelectorAll(expression.origin)?.length == 2,
              origin = document.querySelector(expression.origin),
              clone = document.querySelector(`.${expression.clone}`),
              pagination = origin.cloneNode(true),
              container = {
                  table: document.querySelector('.table-info'),
                  pagination: clone || document.createElement('div'),
              },
              style = `
                  .pagination-clone {
                      margin-top: 16px;
                      margin-bottom: 16px;
                      height: 32px;
                  }
              `;

        if (!isDone) {
          if (isStyleAdd) {
            appendStyle(style);
          }
          container.pagination.classList.add(expression.clone);
          container.pagination.appendChild(pagination);
          container.table.before(container.pagination);
          const paginationNew = pagination.querySelectorAll('li.page-item'),
                paginationOrg = origin.querySelectorAll('li.page-item');
          paginationNew.forEach((li, i)=>{
              li.addEventListener('click', (event)=>{
                  const target = event.target,
                        active = target.closest('ul').querySelectorAll('.active'),
                        navi = (target.querySelector('a') || target),
                        text = navi.textContent.trim(),
                        isNumber = /^\d+$/.test(text),
                        element = isNumber ? paginationOrg[i] : paginationOrg[i].querySelector('button');

                  console.log(`i: ${i}`);
                  console.log(`text: ${text}`);
                  console.log(paginationOrg[i]);
                  element?.click();
                  pagination.remove();
                  setTimeout(()=>{
                    insertPagination(false);
                  }, 1000);
                  /*
                  active.forEach((a)=>{
                      a.classList.remove('active');
                  });
                  if (isNumber) {
                    (target.querySelector('a') || target).classList.add('active');
                  }
                  */
              });
          });
        }
    }
    function beautify() {
        const {pathname} = location,
              isDashboard = pathname == '/',
              isMediaList = pathname == '/media-list';
        if (isDashboard) {
            formatNumber();
            insertPagination();
        }
        if (isMediaList) {
            const css = `
                table td:nth-of-type(1) {
                    width: 90px;
                }
            `;
            appendStyle(css);
            document.querySelectorAll('table tr').forEach((tr)=>{
                const td = tr.querySelector('td:nth-of-type(1)'),
                      done = td?.querySelector('.media_id'),
                      text = td?.textContent.trim(),
                      isNumeric = /^\d+$/.test(text),
                      html = `<input type="text" class="media_id" value="${text}">`;
                if (isNumeric && !done) {
                    td.innerHTML = html;
                    td.classList.add('done');
                    td.querySelector('.media_id').addEventListener('mouseover', (event)=>{
                        const target = event.target,
                              media_id = target.value;
                        target.focus();
                        target.select();
                    });
                }
            });
        }
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
        button.disabled = 'true';
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
                      params = {
                        isDryRun: false,
                      };
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
                  contact_date = formatDate(updatedAt),
                  kind_list = Object.keys(contact_kind_list);

            return {media_id, isValidMedia, detail, nextaction_date, nextaction_content, memo, createdAt, contact_date, kind_list};
        }
        async function data2contact(row, label, params) {
            params = params || {};
            const {isDryRun = true, isMultiple = false} = params,
                  report = [],
                  data = row2data(row, label),
                  {media_id, isValidMedia, detail, nextaction_date, nextaction_content, memo, createdAt, contact_date, kind_list} = data2params(data);

            await delayedForEach(kind_list, async(kind)=>{
                const one = contact_kind_list[kind],
                      value = data[kind],
                      count = /^\d+$/.test(value) ? Number(value) : 0,
                      {contact_type_eng} = one;

                if (isValidMedia) {
                    for (let i=0; i<count; i++) {
                        const message = `コンタクトレポートを追加します。\ndate: ${contact_date}\n${kind}: ${value}\n詳細: ${detail}\ncontact_type_eng: ${contact_type_eng}`;
                        report.push(message);
                        if (!isDryRun) await createContact(contact_date, media_id, contact_type_eng, detail);
                        if (!isMultiple) break;
                    }
                }
            });
            return report;
        }
        async function data2action(row, label, params) {
            params = params || {};
            const {isDryRun = true, isMultiple = false} = params,
                  report = [],
                  data = row2data(row, label),
                  {media_id, isValidMedia, detail, nextaction_date, nextaction_content, memo, createdAt, contact_date, kind_list} = data2params(data);

            if (isValidMedia) {
                await getMediaInfo(media_id, async(json)=>{
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
                        if (!isDryRun) await updateMemo(media_id, update_note);
                    }
                    if (isFinishAction) {
                        const message = `ネクストアクションを完了にします。\nnext_action_id: ${next_action_id}`;
                        report.push(message);
                        if (!isDryRun) await terminateNextAction(next_action_id);
                    } else if (isCreateAction) {
                        const message = `ネクストアクションを作成します。\nmedia_id: ${media_id}\nnextaction_date: ${nextaction_date}\nnextaction_content: ${nextaction_content}`;
                        report.push(message);
                        if (!isDryRun) await createNextAction(media_id, nextaction_date, nextaction_content);
                    } else if (isUpdateAction) {
                        const message = `ネクストアクションを更新します。\nmedia_id: ${media_id}\nnextaction_date: ${nextaction_date}\nupdate_content: ${update_content}\nnext_action_id: ${next_action_id}`;
                        report.push(message);
                        if (!isDryRun) await updateNextAction(next_action_id, nextaction_date, update_content);
                    }
                });
            }
            return report;
        }

        function formatDate(date) {
          const [year, month, day] = date.split('/'),
                format = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          return format;
        }
        function loading(isShow) {
            const display = isShow ? '' : 'none',
                  overlay = document.querySelector('[aria-label="Loading"]');
            console.log(overlay);
            console.log(`display: ${display}`);
            overlay.style.display = display;
        }
        async function updataByCsv(arrayBuffer, params) {
            const encoding = detectUtf8OrSjis(arrayBuffer),
                  text = decodeArrayBuffer(arrayBuffer, encoding),
                  csv = parseCSV(text);

            console.log(`検出エンコーディング: ${encoding}`);
            console.log(list);
            let label, report = [];
            loading(true);
            await delayedForEach(csv, async(row, i)=>{
                // ラベル行
                if (i == 0) {
                    if (!row.length || row.every(v=>!v.trim())) {
                        throw new Error('アップロードしたCSVの１行目がブランクです。');
                    }
                    label = row;
                // ２行目以降
                } else {
                    const log = {
                            contact: await data2contact(row, label, params),
                            action: await data2action(row, label, params),
                          };
                    
                    console.log(log.contact);
                    console.log(log.action);
                    report = report.concat(log.contact, log.action);
                }
            });
            console.log(report);
            setTimeout(async()=>{
              loading(false);
              location.reload();
            }, 1000);
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
    async function delayedForEach(array, func, delaySeconds = 1) {
      async function _next(i) {
        if (i >= array.length) return;
        await func(array[i], i);
        // ここで待機してから次を呼び出す
        await wait(delaySeconds * XHR_WAIT);
        await _next(i + 1);
      }
      await _next(0);
    }
    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
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
    async function getMediaList(callback) {
        const authorization = get_http_request_header('Authorization'),
              method = 'GET',
              page = 1,
              pageSize = 100,
              sort_direction = 'ASC',
              query = {page, pageSize, sort_direction},
              queryString = Object.keys(query).map(v=>`${v}=${query[v]}`).join('&'),
              path = `/api/v1/client/medias?${queryString}`,
              params = null;
        await http(method, path, params, authorization, async(res)=>{
            callback(res);
        });
    }
    async function getMediaInfo(media_id, callback) {
        const authorization = get_http_request_header('Authorization'),
              method = 'GET',
              path = `/api/v1/client/medias/${media_id}`,
              params = null;
        await http(method, path, params, authorization, async(res)=>{
            callback(res);
        });
    }
    async function updateMemo(id, note) {
        const authorization = get_http_request_header('Authorization'),
              method = 'POST',
              path = `/api/v1/client/medias/note/edit`,
              params = {id, note};
        await http(method, path, params, authorization, async(res)=>{
            console.log(res);
        });
    }
    async function createNextAction(media_id, expired_date, content) {
        const authorization = get_http_request_header('Authorization'),
              method = 'POST',
              path = `/api/v1/client/next-action/add`,
              params = {expired_date, content, media_id};
        await http(method, path, params, authorization, async(res)=>{
            console.log(res);
        });
    }
    async function updateNextAction(next_action_id, expired_date, content) {
        const authorization = get_http_request_header('Authorization'),
              method = 'POST',
              path = `/api/v1/client/next-action/${next_action_id}/edit`,
              media_id = next_action_id,
              params = {expired_date, content, media_id};
        await http(method, path, params, authorization, async(res)=>{
            console.log(res);
        });
    }
    async function terminateNextAction(action_id) {
        const authorization = get_http_request_header('Authorization'),
              method = 'POST',
              path = `/api/v1/client/action/finish`,
              params = {action_id};
        await http(method, path, params, authorization, async(res)=>{
            console.log(res);
        });
    }
    async function createContact(contact_date, media_id, contact_type_eng, content = '') {
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

        await http(method, path, params, authorization, async(res)=>{
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
    async function http(method, path, params, authorization, callback) {
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
                await fetch(path, options)
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
    function updateReportInfo(json) {
        const {data} = json,
              table = document.querySelectorAll('#report table tr');

        table?.forEach((tr, i)=>{
            if (i > 0) {
                const index = i - 1,
                      cur = data[index] || {},
                      {media_id} = cur,
                      td = tr.querySelector('.details-field'),
                      detail = td?.textContent?.trim(),
                      html = `<input type="text" class="media_id" value="${media_id}"><span>${detail}</span>`;

                td.innerHTML = html;
                td.querySelector('.media_id').addEventListener('mouseover', (event)=>{
                    const target = event.target,
                          media_id = target.value;
                    target.focus();
                    target.select();
                });
            }
        });
    }
    function override_xhr() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    
        // ヘッダーを保存するグローバル変数
        window.globalHeaders = {};

        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            this._method = method;
            this._url = url;
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

            const xhr = this;
    
            function shouldCapture(url) {
                return url.indexOf('/api/v1/client/reports') == 0;
            }
    
            const onReady = function() {
                if (xhr.readyState === 4) {
                    if (shouldCapture(xhr._url)) {
                        console.log("✅ Captured response for:", xhr._url);
                        //console.log("📦 Response body:", xhr.responseText);
                        const json = JSON.parse(xhr.responseText);
                        console.log(json);
                        if (json) {
                          setTimeout(()=>{
                              updateReportInfo(json);
                          }, 2000);
                        }
    
                        // ここで保存（例: localStorage へ保存など）
                        //localStorage.setItem("response:" + xhr._url, xhr.responseText);
                    }
                }
            };
    
            // 複数回バインドしないように慎重に登録
            if (this.addEventListener) {
                this.addEventListener("readystatechange", onReady, false);
            } else {
                const oldHandler = this.onreadystatechange;
                this.onreadystatechange = function() {
                    if (typeof oldHandler === "function") oldHandler.apply(this, arguments);
                    onReady();
                };
            }
    
            return originalSend.apply(this, arguments);
        };
    }
    function _override_xhr() {
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
