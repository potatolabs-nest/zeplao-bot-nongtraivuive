// Khung widget **chạy thật trong một trình duyệt thật**, cho tới khi nó vẽ ra chữ.
//
//   node tools/widget-selftest.mjs                       # gói trên máy này
//   node tools/widget-selftest.mjs --live <botId> <ver>  # bản **đã upload**, đọc từ web công khai
//
// Hai chế độ, và chế độ thứ hai là chế độ đáng giá: gói trên máy này đã chạy được rồi mới tới lúc
// upload, còn cái cần kiểm là **cái mà người chơi thật sự tải về** — qua CDN, qua ba cái máy chủ,
// và sau khi nền tảng ghi đè `zeplao.js` bằng bản của nó. Một file 404 kèm `immutable` một năm, một
// gói giải nén lên nhầm máy: cả hai đều cho ra một cái khung trắng mà gói trên đĩa không hề có.
//
// Công cụ này tồn tại vì mọi lần upload widget đều là một dịp để trao cho người chơi một màn hình
// trắng, và một màn hình trắng không nói gì cả: không log, không lỗi, không một dòng ở đâu. Cách
// duy nhất người ta từng tìm ra nó là mở trò chơi lên rồi nhắn "trắng bóc". Ba thứ dưới đây đều
// đã xảy ra thật, và cả ba đều không nhìn ra được bằng mắt thường trên máy đã viết ra chúng:
//
//   * một file trả về `200` với thân rỗng — `onerror` không kêu một tiếng nào;
//   * hai file cùng khai một cái tên ở tầng toàn cục — `SyntaxError` lúc phân tích, và cả trang
//     không chạy một dòng nào;
//   * một file không bao giờ trả lời — `onload` không kêu mà `onerror` cũng không.
//
// Nên phép kiểm này mở đúng bộ file ấy trong Chrome, đóng vai máy chủ, đẩy vào một trạng thái như
// thật, và chỉ chịu đi tiếp khi trang **vẽ ra được khu vườn**.
//
// Ở chế độ thường nó chạy trên ba file của gói, không cần token và không cần mạng; `zeplao.js` được
// lấy từ đĩa nếu có, không thì lấy từ bản công khai mà bất kỳ ai cũng tải được. Ở chế độ `--live`
// nó tải cả gói từ web công khai trước, và phần còn lại giống hệt — cùng một trang, cùng một phép
// kiểm.
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIDGET = join(here, 'bots', 'farmbot', 'widget');
const BRIDGE_URL = 'https://api-bot.kuku.vn/zeplao.js';

const CHROME = process.env.CHROME
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/// Một khu vườn để đẩy vào khung: đúng hình dạng bot gửi, đủ để mọi nhánh của trang có việc làm.
///
/// Nó được viết tay chứ không lấy từ bot, cố ý: nếu nó lấy từ bot thì một thay đổi ở bot làm hỏng
/// trang sẽ được **cả hai bên** đồng ý, và phép kiểm này sẽ im lặng đi qua đúng cái lỗi nó tồn tại
/// để bắt.
function sampleFarm() {
  const crop = (id, name, stage, extra = {}) => ({
    index: 0, crop: { id, name, picks: 2, yield: 20 }, stage, grown: 100,
    etaMs: stage < 6 ? 120000 : null, weeds: 0, pests: 0, dry: false, red: false,
    ripe: stage === 6, yieldLeft: stage === 6 ? 20 : 0, floor: 12, dead: stage === 7,
    can: {
      harvest: stage === 6 ? { ok: true, amount: 20 } : { ok: false, why: 'Cây chưa chín.' },
      water: { ok: false, why: 'Thửa này còn ẩm.' },
      weed: { ok: false, why: 'Thửa này không có cỏ.' },
      pest: { ok: false, why: 'Thửa này không có sâu.' },
      clear: { ok: false, why: 'Cây còn sống.' },
      sow: { ok: true },
      red: { ok: false, why: 'Phải có ít nhất 12 thửa mới lên được đất đỏ.' },
    },
    ...extra,
  });

  const plots = [
    crop(2, 'Củ cải trắng', 6),
    crop(2, 'Củ cải trắng', 3, { weeds: 2, dry: true }),
    crop(4, 'Ngô', 5, { pests: 1, red: true }),
    crop(1, 'Dâu tây', 7),
    { ...crop(0, null, 0), crop: null, can: { ...crop(0, null, 0).can, sow: { ok: true } } },
    { ...crop(0, null, 0), crop: null, can: { ...crop(0, null, 0).can, sow: { ok: true } } },
  ].map((one, index) => ({ ...one, index }));

  return {
    at: Date.now(), speed: 20, me: { id: 'user-an', name: 'An' },
    level: 4, exp: 2100, next: 3000, into: 100, span: 1000, coin: 12345,
    chores: { harvest: 1, water: 1, weeds: 1, pests: 1, dead: 1, total: 5 },
    ranchChores: { collected: 1, finished: 0, mouse: 1, hungry: false, total: 2 },
    plots,
    seeds: [{ id: 2, name: 'Củ cải trắng', count: 3 }, { id: 4, name: 'Ngô', count: 1 }],
    fruit: [{ id: 2, name: 'Củ cải trắng', count: 16, worth: 17 }],
    store: [
      { id: 2, name: 'Củ cải trắng', level: 0, price: 125, minutes: 30, picks: 1, yield: 16, sell: 17, afford: true },
      { id: 35, name: 'Vải', level: 23, price: 6588, minutes: 231, picks: 4, yield: 34, sell: 86, afford: false },
    ],
    land: { have: 6, max: 18, next: { cost: 10000, level: 5 }, why: null },
    ranch: {
      pens: [
        {
          index: 0, house: 'nest',
          animal: { id: 1001, name: 'Gà', product: 'Trứng gà', grown: 40000, life: 158400, grownUp: true, spent: false, percent: 25 },
          ready: 3, max: 20,
          collect: { ok: true, amount: 3 },
          butcher: { ok: false, why: 'Chưa sống hết đời.' },
        },
        {
          index: 1, house: 'nest', animal: null, ready: 0, max: 0,
          collect: { ok: false, why: 'Chuồng trống.' },
          butcher: { ok: false, why: 'Chưa sống hết đời.' },
        },
      ],
      hopper: 42, hopperMax: 1000, lastsHours: 6.5, hungry: false, mouse: true,
      nests: 2, sheds: 0,
      pens_max: { nest: { start: 2, max: 8, costs: [0, 3000] }, shed: { start: 0, max: 6, costs: [5000] } },
      store: [{
        id: 1001, name: 'Gà', product: 'Trứng gà', house: 'nest', level: 0, price: 700,
        minutes: 24, eats: 1, afford: true,
      }],
      grass: { buy: 60, crop: 40, max: 100 },
    },
    neighbours: [{
      id: 'user-binh', name: 'Bình', ripe: 2,
      help: { harvest: 0, water: 1, weeds: 3, pests: 0, dead: 0, total: 4 },
      animals: 1, last: Date.now() - 120000,
    }],
    dog: null,
    daily: { taken: false, worth: 5000 },
    log: [{ at: Date.now() - 60000, text: 'Hái được 16 Củ cải trắng.' }],
  };
}

/**
 * Đoạn mã đóng vai máy chủ, **tiêm thẳng vào trang widget**.
 *
 * Không phải trong một `iframe`. Một khung thật có `sandbox="allow-scripts"` và **gốc mờ**, nên
 * trang mẹ không đọc được DOM của nó — đó chính là điều làm cho sandbox có nghĩa, và cũng là điều
 * làm cho một bộ thử kiểu "iframe rồi soi vào trong" không thể chạy. Nên thay vào đó: nạp chính
 * `index.html` ở **tầng trên cùng**, nơi `parent === window`, và để cho `postMessage` của trang rơi
 * trở lại vào chính nó. Một người nghe đặt trước khi trang chạy sẽ nghe `ready` đúng như máy chủ
 * thật nghe — cùng một đường, cùng một thứ tự.
 *
 * Nó cũng là cách duy nhất kiểm được thứ đáng kiểm: **trang có vẽ ra chữ hay không**. Mọi phép
 * kiểm khác chỉ hỏi "file có tải về không", mà một file tải về được vẫn có thể là một trang trắng.
 */
const HOST = (state) => `<script>
  (function () {
    var log = [];
    window.__farm = { log: log };

    // Giao thức của cầu nối, đọc từ chính zeplao.js: mọi thứ đi vào là một đối tượng có khoá
    // \`zeplao\`, và mọi thứ đi ra cũng vậy. Đây là chỗ dễ sai nhất khi viết một bản đóng vai —
    // gửi \`{method: 'state'}\` thì cầu nối **lặng lẽ bỏ qua**, trang không nhận được gì, và triệu
    // chứng đúng bằng cái khung trắng mà công cụ này tồn tại để bắt.
    window.addEventListener('message', function (event) {
      var one = event.data;
      if (!one || typeof one !== 'object' || one.zeplao !== 'call') return;
      log.push(one.method === 'send' ? 'send:' + JSON.stringify(one.action) : one.method);
    });

    function say(data) { window.postMessage(data, '*'); }

    // Máy chủ nói trước: nó là ai, khung rộng bao nhiêu, người xem là ai, màu gì.
    say({
      zeplao: 'hello',
      viewer: { id: 'user-an', displayName: 'An', role: 'player' },
      theme: {
        background: '#0d2a1c', text: '#e8f0e9', primary: '#e9c46a', muted: '#9db4a5', line: '#1d4531',
      },
      room: { host: 'web', width: 390, height: 640 },
    });
    say({ zeplao: 'room', host: 'web', width: 390, height: 640 });

    // Rồi trạng thái. Muộn hơn một nhịp, để ba file kịp nạp và trang kịp đăng ký nghe — đúng như
    // thật, nơi bot đẩy trạng thái trước khi ứng dụng mở khung.
    setTimeout(function () { say({ zeplao: 'state', state: ${JSON.stringify(state)} }); }, 400);

    setTimeout(function () {
      var result = { ok: true, problems: [], log: log };
      function want(what, condition) { if (!condition) { result.ok = false; result.problems.push(what); } }

      // 1. Cả ba file đã nạp **và đã chạy** — không chỉ tải về. Đây là thứ mà một file 200-rỗng
      //    đi qua được, và là thứ đã làm cả trang chết trong im lặng.
      want('zeplao.js chưa chạy (window.Zeplao không có)', typeof window.Zeplao === 'object');
      want('draw.js chưa chạy (window.farmArt không có)', typeof window.farmArt === 'object');
      want('farm.js chưa chạy (window.farmReady không có)', window.farmReady === true);
      // Và đường nối phải **đúng là bộ hàm vẽ**. Hai file trong cùng một gói khai trùng một cái tên
      // ở tầng toàn cục thì cả hai đều tải về được, cả hai đều chạy xong, và cái được gọi sau ghi
      // đè cái trước — im lặng. Triệu chứng là "draw.plot is not a function" ở một chỗ cách cái tên
      // trùng cả trăm dòng, nên phép kiểm phải hỏi thẳng.
      var art = window.farmArt;
      want('window.farmArt không phải bộ hàm vẽ', typeof art?.plot === 'function'
        && typeof art?.plant === 'function' && typeof art?.escape === 'function');

      // 2. Khung đã chào máy chủ. Không có dòng này thì ứng dụng phủ một lớp "đang tải" lên trang
      //    và người chơi thấy một khung trắng — đúng cái bệnh này.
      want('khung chưa gọi ready()', log.indexOf('ready') !== -1);

      // 3. Và nó đã **vẽ ra một khu vườn**.
      var text = document.body.innerText || '';
      want('không có chữ nào trên màn hình', text.trim().length > 20);
      want('không vẽ ra thửa đất nào', document.querySelectorAll('.plot').length > 0);
      var who = document.getElementById('who');
      want('không hiện tên người chơi', who && who.textContent.trim() === 'An');
      want('không hiện số tiền', text.indexOf('12.345') !== -1);
      want('không có tab nào ở đáy', document.querySelectorAll('#tabs .tab').length > 0);
      want('thửa chín không được đánh dấu', document.querySelectorAll('.plot.ripe').length > 0);
      want('cỏ dại không được vẽ ra', document.querySelectorAll('.plot .badge.weed').length > 0);
      want('sâu bọ không được vẽ ra', document.querySelectorAll('.plot .badge.pest').length > 0);
      want('đất khô không được vẽ ra', document.querySelectorAll('.plot.dry').length > 0);
      // Một cái cây phải thật sự được vẽ, không phải một ô rỗng.
      want('không vẽ ra hình cái cây nào', document.querySelectorAll('.plot svg').length > 0);

      // 4. Bảng kiểu phải tới nơi. Một trang không có CSS vẫn "vẽ ra chữ", nên phép kiểm chữ ở
      //    trên không bắt được nó — thứ bắt được là một kích thước.
      var box = document.querySelector('.plot');
      if (box) {
        var rect = box.getBoundingClientRect();
        want('không có bảng kiểu (thửa đất cao 0)', rect.height > 20);
        want('không có bảng kiểu (thửa đất rộng 0)', rect.width > 20);
      } else {
        want('không có thửa đất nào để đo', false);
      }

      // 5. Không có gì ném ra ngoài. Một lỗi trong lúc vẽ để lại đúng một trang trắng, và
      //    window.onerror là chỗ duy nhất nó để lại dấu.
      want('có lỗi chạy trên trang', !window.__farmThrew);

      var out = document.createElement('div');
      out.id = 'result';
      out.textContent = JSON.stringify(result);
      document.body.appendChild(out);
      document.title = result.ok ? 'PASS' : 'FAIL';
    }, 1100);
  }());
<\/script>`;

/// Chrome ở chế độ không đầu, chạy tới khi đồng hồ ảo đi hết, rồi đổ DOM ra.
async function runChrome(url, ms) {
  const profile = mkdtempSync(join(tmpdir(), 'farm-chrome-'));
  const args = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    `--user-data-dir=${profile}`,
    `--virtual-time-budget=${ms}`,
    '--dump-dom', url,
  ];
  const child = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  let err = '';
  child.stdout.on('data', (chunk) => { out += chunk; });
  child.stderr.on('data', (chunk) => { err += chunk; });
  const [code] = await once(child, 'exit');
  return { code, out, err };
}

// ---- chạy --------------------------------------------------------------------------------------

if (!existsSync(CHROME)) {
  console.error(`không có Chrome ở ${CHROME} — đặt CHROME=... nếu nó nằm chỗ khác`);
  process.exit(2);
}

/// Chế độ `--live`: tải đúng những file mà trình duyệt của người chơi sẽ tải.
///
/// Từ **web công khai**, không phải từ API: một lần deploy đã từng upload thành công, API báo
/// version mới, và các edge thì chưa có file — nên bản đã công bố trả 404 ở đúng những host mà
/// người chơi đi qua. Kiểm bằng `getWidget` là kiểm cái API biết; kiểm bằng cách này là kiểm cái
/// người chơi nhận.
async function fetchLive(botId, version) {
  const dir = mkdtempSync(join(tmpdir(), 'farm-live-'));
  const hosts = ['https://kuku.vn', 'https://api-bot.kuku.vn'];
  const names = ['index.html', 'style.css', 'zeplao.js', 'draw.js', 'farm.js'];
  const missing = [];

  for (const name of names) {
    let saved = false;
    for (const host of hosts) {
      const answer = await fetch(`${host}/api/widgets/${botId}/${version}/${name}`,
        { headers: { 'Cache-Control': 'no-cache' } }).catch(() => null);
      if (!answer?.ok) continue;
      const bytes = Buffer.from(await answer.arrayBuffer());
      // Một file trả về `200` mà rỗng là đúng cái bệnh `onerror` không báo — nên nó bị coi như
      // thiếu, ngay ở đây, trước khi trình duyệt có cơ hội im lặng về nó.
      if (bytes.length === 0) { missing.push(`${name} (rỗng, từ ${host})`); continue; }
      writeFileSync(join(dir, name), bytes);
      saved = true;
      break;
    }
    if (!saved && !missing.some((one) => one.startsWith(name))) missing.push(`${name} (404 ở mọi host)`);
  }

  if (missing.length) {
    console.error(`bản v${version} trả về thiếu file — đây là khung trắng:`);
    for (const one of missing) console.error(`  · ${one}`);
    process.exit(1);
  }
  console.log(`bản v${version}: tải được cả ${names.length} file từ web công khai`);
  return dir;
}

const live = process.argv[2] === '--live'
  ? await fetchLive(process.argv[3], process.argv[4])
  : null;
/// Thư mục phục vụ: gói đã tải nếu đang ở chế độ `--live`, không thì gói trên máy này.
const SERVE = live ?? WIDGET;

// Cầu nối: bản trên đĩa nếu có, không thì bản công khai mà mọi tác giả đều dùng.
const bridgePath = join(WIDGET, 'zeplao.js');
if (!live && !existsSync(bridgePath)) {
  const answer = await fetch(BRIDGE_URL).catch(() => null);
  if (!answer?.ok) {
    console.error(`không tải được ${BRIDGE_URL} và cũng không có bản nào trên đĩa`);
    process.exit(2);
  }
  writeFileSync(bridgePath, Buffer.from(await answer.arrayBuffer()));
}

const state = sampleFarm();
const host = HOST(state);
const files = ['index.html', 'style.css', 'draw.js', 'farm.js', 'zeplao.js'];

/// Chính `index.html`, cộng đoạn mã đóng vai máy chủ, cộng một cái lưới bắt lỗi.
///
/// Cái lưới ấy phải nằm **trước** mọi file khác: một `SyntaxError` lúc phân tích một file xảy ra
/// trước khi bất cứ thứ gì trong file ấy chạy, nên một người nghe đặt sau nó không bao giờ nghe
/// được gì.
const page = (() => {
  const html = readFileSync(join(SERVE, 'index.html'), 'utf8');
  // Cái lưới bắt lỗi phải được đăng ký trước khi `draw.js` hay `farm.js` chạy, vì một `SyntaxError`
  // lúc phân tích xảy ra trước khi bất cứ dòng nào trong file ấy chạy. Nhưng nó phải nằm **sau
  // doctype**: một thẻ `<script>` đặt trước `<!doctype html>` đẩy cả trang vào **quirks mode**, và
  // trong quirks mode thì mọi phép đo bố cục đều khác — tức là bộ thử này sẽ kiểm một trang không
  // phải trang mà trình duyệt thật vẽ ra.
  //
  // **Nối vào cuối file**, không chèn vào giữa.
  //
  // `index.html` không có `<head>` và cũng không có `<body>` — HTML cho phép bỏ cả hai, và một
  // trang widget thì không cần chúng. Nghĩa là mọi cách chèn "vào đầu tài liệu" đều phải đoán một
  // cái mốc không tồn tại, và đoán sai thì **im lặng**: đoạn mã được chèn nằm ngoài `<html>`, trình
  // duyệt coi nó là chữ trong thân trang, và nó không bao giờ chạy.
  //
  // Nối vào cuối thì không đoán gì cả, và thứ tự vẫn đúng: khối `<script>` cuối cùng của trang
  // chạy xong (nó chỉ *lên lịch* việc nạp ba file), rồi tới đoạn này — tức là trước khi `zeplao.js`
  // kịp chạy. Cái lưới bắt lỗi ở đúng chỗ nó cần ở.
  const net = `<script>window.addEventListener('error', function () { window.__farmThrew = true; });<\/script>`;
  return `${html}${net}${host}`;
})();

// Một cái công tắc để đọc trang mà bộ thử đang phục vụ. Không có nó thì khi phép kiểm đỏ, câu hỏi
// "nó đỏ vì trang hay vì bộ thử" không trả lời được — mà đó là câu hỏi của mọi lần đỏ.
if (process.env.DUMP_PAGE) writeFileSync(process.env.DUMP_PAGE, page);

const server = createServer((request, response) => {
  const name = new URL(request.url, 'http://x').pathname.slice(1) || 'index.html';
  if (name === 'index.html' || name === '') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(page);
    return;
  }
  if (!files.includes(name)) {
    response.writeHead(404).end();
    return;
  }
  const type = name.endsWith('.css') ? 'text/css'
    : name.endsWith('.js') ? 'text/javascript' : 'text/html';
  response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
  response.end(readFileSync(join(SERVE, name)));
});

server.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const { out } = await runChrome(url, 4000);
server.close();

const found = /<div id="result">(.*?)<\/div>/s.exec(out);
if (!found) {
  console.error('khung không chạy tới lúc kiểm tra — đây chính là khung trắng');
  console.error(out.slice(0, 600));
  process.exit(1);
}

const result = JSON.parse(found[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
if (!result.ok) {
  console.error('khung chạy nhưng không vẽ ra được khu vườn:');
  for (const one of result.problems) console.error(`  · ${one}`);
  process.exit(1);
}

console.log(`khung chạy thật — ${result.log.filter((one) => one === 'ready').length} lần ready, `
  + `${result.log.filter((one) => one.startsWith('send:')).length} hành động gửi về bot`);
console.log('khu vườn vẽ ra được: thửa đất, cỏ, sâu, đất khô, và bảng kiểu đã tới');
