// Mọi id và class mà trang vẽ ra, đối chiếu với thứ chúng phải khớp.
//
//   node tools/css-check.mjs
//
// Công cụ này tồn tại vì một lần tìm-và-thay đã lặng lẽ ăn mất cả phần tạo hình của một màn hình,
// và thứ duy nhất nhận ra là một tấm ảnh chụp. Một class không có trong bảng kiểu không báo lỗi:
// trình duyệt vẽ ra một phần tử không có gì, và "không có gì" trông giống hệt "chưa tải xong".
//
// Hai phép kiểm, và chúng khớp với hai thứ khác nhau:
//
//   * một `id` mà đoạn mã tìm tới phải **có trong HTML** — không thì `getElementById` trả `null` và
//     dòng ngay sau đó ném lỗi, ở một chỗ cách xa cái tên viết sai;
//   * một `class` mà đoạn mã vẽ ra phải **có trong bảng kiểu** — không thì phần tử ấy không có gì.
//
// Kiểm cái đầu với bảng kiểu là sai: một phần tử được tạo hình bằng class của nó thì cái id chỉ để
// tìm, và bắt nó phải có một quy tắc `#id` riêng là bắt người ta viết một quy tắc không làm gì.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const widget = join(here, 'bots', 'farmbot', 'widget');
const read = (name) => readFileSync(join(widget, name), 'utf8');

const html = read('index.html');
const css = read('style.css');
const script = read('farm.js') + read('draw.js');

/// Id mà HTML khai.
const inHtml = new Set([...html.matchAll(/\sid="([^"$]+)"/g)].map((one) => one[1]));

/// Id mà đoạn mã tìm tới.
const wanted = new Set();
for (const source of [html, script]) {
  for (const one of source.matchAll(/getElementById\(\s*['"]([^'"$]+)['"]\s*\)/g)) wanted.add(one[1]);
  // Và cái bọc mỏng quanh nó: `$('plots')`.
  for (const one of source.matchAll(/\$\(\s*['"]([^'"$]+)['"]\s*\)/g)) wanted.add(one[1]);
}

/// Class được viết ra: trong `class="..."`, trong `className = '...'`, trong chuỗi mẫu, và trong
/// tham số `kind` truyền vào `button()`.
///
/// Chuỗi mẫu là chỗ khó: `class="plot${ripe ? ' ripe' : ''}"` có cả chữ lẫn biểu thức, nên nó được
/// cắt thành từng mẩu chữ rồi ghép lại — mẩu nào trông như một cái tên class thì được giữ.
const classes = new Set();
/// Một cái tên class, chứ không phải một từ tiếng Anh lọt ra từ một chuỗi mẫu. Từ chối những từ
/// đứng một mình trong một biểu thức — `class="tab${key === tab ? ' on' : ''}"` cho ra `key`, `tab`,
/// `on`, và chỉ hai cái sau là tên class.
const names = (text) => text.split(/\s+/).filter((one) => /^[a-z][a-z0-9-]*$/.test(one)
  && one !== 'key' && one !== 'value' && one !== 'name');
const harvest = (pattern) => {
  for (const source of [html, script]) {
    for (const one of source.matchAll(pattern)) {
      for (const part of one[1].split(/\$\{[^}]*\}/)) for (const name of names(part)) classes.add(name);
    }
  }
};
harvest(/class="([^"]*)"/g);
harvest(/className\s*=\s*[`'"]([^`'"]*)/g);
harvest(/kind\s*=\s*'([a-z ]+)'/g);

const missingIds = [...wanted].filter((id) => !inHtml.has(id));
const missingClasses = [...classes].filter((one) => !new RegExp(`\\.${one}\\b`).test(css));

if (missingIds.length) {
  console.error(`getElementById tìm một id không có trong HTML: ${missingIds.join(', ')}`);
  process.exit(1);
}
if (missingClasses.length) {
  // Không phải lỗi chặn: một cái tên không tạo hình vẫn đọc được. Nhưng nó thường là một cái tên
  // viết sai, nên nói ra.
  console.warn(`class không có quy tắc nào trong bảng kiểu: ${missingClasses.join(', ')}`);
}
console.log(`css ok — ${wanted.size} id, ${classes.size} class`);
