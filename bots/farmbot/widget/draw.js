/**
 * Vẽ: một cây ở từng giai đoạn, một con vật ở từng đoạn đời, và mấy thứ lặt vặt quanh chúng.
 *
 * Tách khỏi `farm.js` vì hai thứ ấy trả lời hai câu hỏi khác nhau. `farm.js` biết **cái gì đang
 * xảy ra** — ai vừa bấm gì, bot vừa đẩy gì, màn nào đang hiện. File này biết **nó trông ra sao**,
 * và nó là một hàm từ số sang hình: đưa vào một giai đoạn, trả về một cái cây.
 *
 * Cây được vẽ bằng SVG chứ không bằng một tấm ảnh, và không phải vì SVG oai hơn. Một cái khung
 * widget **không gọi được ra ngoài** — không CDN, không ảnh từ máy chủ nào, kể cả máy chủ của
 * chính bot. Nên hoặc là ảnh nhét thẳng vào gói (mỗi cây một tấm, mỗi tấm một giai đoạn, nhân với
 * bốn mươi mốt cây), hoặc là hình được **dựng ra**. Dựng ra thì cây mọc thật sự: cùng một đoạn mã
 * cho ra mầm ở giai đoạn một và quả chín ở giai đoạn sáu, và thêm một cây mới không cần thêm một
 * tấm ảnh nào.
 *
 * `window.farmArt` ở cuối file không phải để tiện — nó là **bằng chứng file này đã chạy**, và
 * `index.html` đọc đúng cái tên ấy để biết có nên thử tải lại hay không. Một file trả về `200` với
 * thân rỗng không kêu một tiếng nào qua `onerror`; một cái tên để lại ở tầng toàn cục thì kêu.
 *
 * **Và cái tên ấy phải là của riêng file này.** Hai file trong cùng một gói khai trùng một cái tên
 * ở tầng toàn cục là một lỗi không báo gì cả: cả hai đều tải về được, cả hai đều chạy xong, và cái
 * được gọi sau **ghi đè** cái trước — im lặng, không lỗi, không cảnh báo. Bản đầu của gói này đặt
 * tên ấy là `drawFarm`, mà `farm.js` có một hàm tên `drawFarm`; hàm ấy thắng, `farm.js` mất đường
 * lấy hàm vẽ, và cái khung trắng hiện ra đúng như thiết kế của cái vòng nạp này là để phòng.
 */

/// Màu quả của từng cây, theo id.
///
/// Chọn tay chứ không suy ra từ id: một bảng băm cho ra quả xanh cho cà chua và quả đỏ cho dưa
/// chuột, và cái sai ấy là cái sai người ta nhìn thấy ngay mà không gọi được tên. Cây nào không có
/// trong bảng thì lấy màu mặc định — thêm một cây mới không nên là một lỗi hiển thị.
const FRUIT = {
  1: '#e0405a',    // dâu tây
  2: '#f2f0e4',    // củ cải trắng
  3: '#e8802a',    // cà rốt
  4: '#f0c33c',    // ngô
  5: '#c9a06a',    // khoai tây
  6: '#7a4a9c',    // cà tím
  7: '#e04a30',    // cà chua
  8: '#7cc25a',    // đậu Hà Lan
  41: '#d63864',   // hoa hồng đỏ
  9: '#d8302a',    // ớt
  103: '#f4eef2',  // hoa loa kèn
  10: '#e98a1e',   // bí ngô
  91: '#c03038',   // sơn tra
  11: '#d84a44',   // táo
  14: '#3f9c47',   // dưa hấu
  15: '#f2d64a',   // chuối
  18: '#ef9aa8',   // đào
  19: '#f29424',   // cam
  13: '#7a4a9c',   // nho
  46: '#e8e0ea',   // quả tình yêu
  23: '#d63a3a',   // lựu
  26: '#e0d05a',   // bưởi
  27: '#e0b032',   // dứa
  29: '#8a6038',   // dừa
  31: '#a8c860',   // bầu
  45: '#8a6438',   // kiwi
  38: '#e89040',   // đu đủ
  39: '#e8d040',   // khế
  42: '#e8dc50',   // chanh
  48: '#8c3050',   // dâu ta
  33: '#e0407c',   // thanh long
  34: '#c8203c',   // anh đào
  35: '#d8384a',   // vải
};

const fruitColor = (cropId) => FRUIT[cropId] ?? '#c8a03c';

/// Lá và thân: một sắc xanh, đậm dần theo giai đoạn để một cây đang lớn đọc ra là đang lớn.
const LEAF_EARLY = '#8fc46a';
const LEAF_FULL = '#3f8f42';
const LEAF_DEAD = '#9a7a52';

/// Một cây ở một giai đoạn. `stage` là số của QFarm: 1–5 đang lớn, 6 chín, 7 tàn.
///
/// Cả cây nằm trong một `viewBox` 100×100 và được vẽ bằng toạ độ tuyệt đối, nên cái khung quyết
/// định nó to bao nhiêu và hình thì không phải biết. Một cái cây vẽ theo phần trăm của chính nó sẽ
/// méo ở mọi tỷ lệ khác tỷ lệ nó được vẽ ra.
function plant(cropId, stage, { dry = false } = {}) {
  const fruit = fruitColor(cropId);
  const ground = dry ? '#8a6a4a' : '#5a3a24';

  if (stage === 0) {
    // Đất trống: ba luống cày, và không gì khác.
    return `<svg viewBox="0 0 100 100" class="art art-empty" aria-hidden="true">
      <path d="M8 74h84" stroke="${ground}" stroke-width="4" stroke-linecap="round" opacity=".55"/>
      <path d="M14 84h72" stroke="${ground}" stroke-width="4" stroke-linecap="round" opacity=".35"/>
    </svg>`;
  }

  if (stage === 7) {
    // Cây tàn: thân khô, lá rủ, và một cái màu nói rằng thửa này cần được dọn.
    return `<svg viewBox="0 0 100 100" class="art art-dead" aria-hidden="true">
      <path d="M50 88V52" stroke="${LEAF_DEAD}" stroke-width="5" stroke-linecap="round"/>
      <path d="M50 62c-14 2-20-6-22-14 12-2 20 4 22 14z" fill="${LEAF_DEAD}" opacity=".8"/>
      <path d="M50 70c14 0 20-8 22-16-12-2-20 6-22 16z" fill="${LEAF_DEAD}" opacity=".8"/>
      <path d="M28 88h44" stroke="${ground}" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
  }

  // Một cây đang lớn: thân cao dần, lá nhiều dần. Bốn mức, và mức thứ năm đã có quả xanh.
  const grown = Math.min(5, Math.max(1, stage));
  const height = [18, 30, 42, 52, 58][grown - 1];
  const top = 88 - height;
  const leaves = grown;
  const leaf = grown <= 2 ? LEAF_EARLY : LEAF_FULL;

  let foliage = '';
  for (let at = 0; at < leaves; at++) {
    const side = at % 2 === 0 ? -1 : 1;
    const along = top + 10 + at * (height / (leaves + 1));
    const reach = 12 + grown * 2.5;
    foliage += `<path d="M50 ${along.toFixed(0)}c${(side * reach * 0.6).toFixed(0)} `
      + `${(-reach * 0.5).toFixed(0)} ${(side * reach * 1.3).toFixed(0)} ${(-reach * 0.2).toFixed(0)} `
      + `${(side * reach * 1.5).toFixed(0)} ${(reach * 0.35).toFixed(0)}-${(side * reach * 1.0).toFixed(0)} `
      + `${(reach * 0.5).toFixed(0)}-${(side * reach * 0.9).toFixed(0)} 0z" fill="${leaf}"/>`;
  }

  // Quả: chín thì to và đúng màu, gần chín thì xanh và bé. Một vườn mà thửa chín trông y hệt thửa
  // sắp chín là một vườn phải bấm vào từng thửa để biết mình có việc gì.
  let berries = '';
  if (grown >= 4) {
    const ripe = stage === 6;
    const color = ripe ? fruit : '#7fb85a';
    const size = ripe ? 7 : 4.5;
    const count = ripe ? 5 : 3;
    for (let at = 0; at < count; at++) {
      const angle = (-Math.PI / 2) + (at - (count - 1) / 2) * 0.6;
      const x = 50 + Math.cos(angle) * 17;
      const y = top + 6 + Math.sin(angle) * 10;
      berries += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${size}" fill="${color}"`
        + `${ripe ? ` stroke="#00000022" stroke-width="1"` : ''}/>`;
    }
  }

  return `<svg viewBox="0 0 100 100" class="art art-plant" aria-hidden="true">
    <path d="M50 88V${top}" stroke="${leaf}" stroke-width="${3 + grown}" stroke-linecap="round"/>
    ${foliage}
    ${berries}
  </svg>`;
}

/// Một con vật. `percent` là phần đời nó đã sống, và nó quyết định con vật to bao nhiêu — một con
/// gà non và một con gà đã lớn phải nhìn ra được là hai con khác nhau, vì đó là toàn bộ điều mà
/// cái bãi chăn này đang nói.
function beast(animalId, percent) {
  const grown = Math.max(0.2, Math.min(1, percent / 100));
  const size = 26 + grown * 22;
  // Con nào cũng là một thân và một đầu, và cái khác nhau là màu. Đủ để nhận ra con gà với con bò
  // trong một cái chuồng nhỏ, mà không cần mười bốn tấm hình.
  const skin = BEAST[animalId] ?? '#c8a06a';
  const box = 100;
  const half = size / 2;

  return `<svg viewBox="0 0 ${box} ${box}" class="art art-beast" aria-hidden="true">
    <ellipse cx="${box / 2}" cy="${84}" rx="${size * 0.42}" ry="4" fill="#00000018"/>
    <ellipse cx="${box / 2}" cy="${72 - half * 0.2}" rx="${half}" ry="${half * 0.78}" fill="${skin}"/>
    <circle cx="${box / 2 + half * 0.72}" cy="${72 - half * 0.95}" r="${half * 0.46}" fill="${skin}"/>
    <circle cx="${box / 2 + half * 0.86}" cy="${72 - half * 1.05}" r="2.1" fill="#22201c"/>
    <path d="M${box / 2 - half * 0.35} ${72 + half * 0.5}v${half * 0.22}"
      stroke="${skin}" stroke-width="4" stroke-linecap="round"/>
    <path d="M${box / 2 + half * 0.35} ${72 + half * 0.5}v${half * 0.22}"
      stroke="${skin}" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}

/// Màu lông của từng con. Cùng lý do như bảng màu quả.
const BEAST = {
  1001: '#e8c86a',  // gà
  1002: '#e8e2d8',  // thỏ
  1003: '#f0f0e8',  // ngỗng
  1004: '#8a8078',  // mèo
  1005: '#3a8ac0',  // công
  1006: '#4a4e58',  // chim cánh cụt
  1501: '#efeade',  // cừu
  1502: '#a08a72',  // bò
  1503: '#9a7a58',  // khỉ
  1504: '#c09060',  // kangaroo
  1505: '#c08850',  // hươu sao
  1507: '#d0a878',  // linh dương
  1508: '#7a7068',  // đà điểu
  1509: '#a89888',  // gấu mèo
};

/// Cỏ, một bó. Dùng ở máng và ở hàng mua.
function grass() {
  return `<svg viewBox="0 0 40 40" class="art art-grass" aria-hidden="true">
    <path d="M20 34V14" stroke="#4f9440" stroke-width="3" stroke-linecap="round"/>
    <path d="M20 26c-7 0-10-4-11-9 6-1 10 3 11 9z" fill="#5faa48"/>
    <path d="M20 22c7-2 10-6 11-11-6-1-10 4-11 11z" fill="#72bd55"/>
  </svg>`;
}

/**
 * Một thửa đất: hình của nó, và những gì đang đứng trên nó.
 *
 * Trả về một chuỗi HTML chứ không phải một phần tử, vì người gọi cần ghép nó vào một danh sách
 * cùng với mấy thứ khác. Đổi lại, mọi thứ ở đây phải **thoát ký tự** trước khi nhét vào: tên cây
 * đến từ máy chủ, và một cái tên có dấu `<` trong đó là một cái tên vẽ ra được một cái nút.
 */
function plot(plot, index, label) {
  const stage = plot.dead ? 7 : plot.ripe ? 6 : plot.stage;
  const badges = [];
  if (plot.dry && plot.crop) badges.push('<b class="badge dry" title="Khô">💧</b>');
  if (plot.weeds > 0) badges.push(`<b class="badge weed" title="Cỏ dại">🌿${plot.weeds}</b>`);
  if (plot.pests > 0) badges.push(`<b class="badge pest" title="Sâu bọ">🐛${plot.pests}</b>`);
  if (plot.red) badges.push('<b class="badge red" title="Đất đỏ">◆</b>');

  return `<button class="plot${plot.ripe ? ' ripe' : ''}${plot.dead ? ' dead' : ''}`
    + `${plot.dry ? ' dry' : ''}${plot.red ? ' land-red' : ''}"
      type="button" data-plot="${index}">
      <span class="soil">${plant(plot.crop ? plot.crop.id : 0, stage, { dry: plot.dry })}</span>
      <span class="label">${escape(label ?? '')}</span>
      ${badges.join('')}
      ${plot.ripe ? '<b class="ready">hái</b>' : ''}
      ${plot.dead ? '<b class="ready dead">dọn</b>' : ''}
    </button>`;
}

/// Một chuồng: con vật bên trong, hoặc chỗ trống.
function pen(pen, index) {
  if (!pen.animal) {
    return `<button class="pen empty" type="button" data-pen="${index}">
      <span class="label">${pen.house === 'shed' ? 'Bãi trống' : 'Chuồng trống'}</span>
    </button>`;
  }
  const a = pen.animal;
  return `<button class="pen${pen.ready > 0 ? ' ready' : ''}" type="button" data-pen="${index}">
    <span class="beast">${beast(a.id, a.percent)}</span>
    <span class="label">${escape(a.name)}</span>
    <span class="bar"><i style="width:${Math.min(100, a.percent)}%"></i></span>
    ${pen.ready > 0 ? `<b class="ready">${escape(a.product)} ×${pen.ready}</b>` : ''}
  </button>`;
}

/// Một dòng trong sổ, hoặc một dòng trong danh sách hàng xóm.
const line = (text, when) => `<div class="line"><span>${escape(text)}</span>`
  + `${when ? `<time>${ago(when)}</time>` : ''}</div>`;

/**
 * Bao lâu trước. Viết ra bằng lời vì đây là thứ người ta đọc để biết **có gì mới không**, và một
 * mốc thời gian tuyệt đối trả lời câu ấy chậm hơn nhiều so với "3 phút trước".
 */
function ago(when, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - when) / 1000));
  if (seconds < 60) return 'vừa xong';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  return `${Math.round(hours / 24)} ngày`;
}

/// Còn bao lâu nữa. Dùng cho cái cây đang lớn — con số duy nhất trên màn hình mà người chơi thật
/// sự đọc, và nó phải đọc được ngay chứ không phải đếm.
function until(ms) {
  if (ms === null || ms === undefined) return '';
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

/// Thoát ký tự. Mọi chữ ở đây đi qua hàm này trước khi vào HTML — tên cây và tên người đến từ máy
/// chủ, và cái khung là chỗ một cái tên như `<img onerror=...>` trở thành một cái nút.
function escape(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Bằng chứng file này đã chạy, cho `index.html` đọc — và cũng là chỗ nối sang `farm.js`.
 *
 * **Hai file này là script cổ điển, không phải module.** `index.html` nạp chúng bằng thẻ `<script>`
 * thường, và một thẻ thường thì không hiểu `export`: gặp nó là `SyntaxError` **lúc phân tích**, tức
 * là trước khi một dòng nào trong file chạy. Không phải một hàm không gọi được — cả file không tồn
 * tại. Và triệu chứng đúng bằng cái khung trắng mà cả cái vòng nạp này tồn tại để chống: file tải
 * về được, `onload` kêu, và trang chết ở chỗ chẳng liên quan.
 *
 * Nên đường nối là một cái tên ở tầng toàn cục. Nó vừa là chỗ `farm.js` lấy hàm vẽ, vừa là thứ
 * `index.html` kiểm để biết file này **đã thật sự chạy** chứ không chỉ đã tải về.
 */
window.farmArt = { plant, beast, grass, plot, pen, line, ago, until, escape };
