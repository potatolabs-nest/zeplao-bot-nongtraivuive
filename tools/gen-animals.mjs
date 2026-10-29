// Emits bots/farmbot/rules/animals.mjs from the real QFarm ranch tables.
//
//   node tools/gen-animals.mjs
//
// Every number is `config/mc/animaltype.php`'s and `config/mc/animaltime.php`'s: what a beast
// costs, what level unlocks it, how much it eats, how long it takes to grow up, how long it
// lives, how much it gives, and what the giving is worth. Names are Vietnamese, and the ones
// that are products rather than beasts are named as products.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const raw = (n) => JSON.parse(readFileSync(join(here, '..', 'data-raw', n + '.json'), 'utf8'));
const animaltype = raw('animaltype');
const animaltime = raw('animaltime');

/// Which housing a beast lives in is a cId range in QFarm and stays one here: 1000–1499 is a
/// nest (chuồng), 1500 and up is a shed (bãi). Two kinds rather than one because the two cost
/// different money to build and unlock at different levels, and a farm with only nests is a
/// farm you can read at a glance.
const KEPT = {
  1001: ['Gà', 'Trứng gà'], 1002: ['Thỏ', 'Thỏ con'], 1003: ['Ngỗng', 'Trứng ngỗng'],
  1004: ['Mèo', 'Mèo con'], 1005: ['Công', 'Công con'], 1006: ['Chim cánh cụt', 'Cánh cụt con'],
  1501: ['Cừu', 'Lông cừu'], 1502: ['Bò', 'Bê con'], 1503: ['Khỉ', 'Khỉ con'],
  1504: ['Kangaroo', 'Kangaroo con'], 1505: ['Hươu sao', 'Hươu con'],
  1507: ['Linh dương', 'Linh dương con'], 1508: ['Đà điểu', 'Trứng đà điểu'],
  1509: ['Gấu mèo', 'Gấu mèo con'],
};

const rows = Object.entries(KEPT).map(([id, [name, product]]) => {
  const a = animaltype[id];
  const t = animaltime[id];
  if (!a || !t) throw new Error(`no table row for animal ${id}`);
  const [cub, growing, procreation, productime, produce, life] = t.map(Number);
  return {
    id: Number(id),
    name,
    product,
    cn: a.cName,
    house: Number(id) < 1500 ? 'nest' : 'shed',
    level: Number(a.cLevel),
    price: Number(a.price),
    // Ăn mấy bó cỏ mỗi bốn giờ. Cỏ là nhiên liệu, không phải một bữa ăn — xem `rules/ranch.mjs`.
    eats: Number(a.consum),
    yield: Number(a.output),
    // Giá một đơn vị sản phẩm, và giá của chính con vật khi nó đã sống hết đời.
    productPrice: Number(a.byproductprice),
    beastPrice: Number(a.productprice),
    productExp: Number(a.harvestbExp),
    beastExp: Number(a.harvestpExp),
    // Lớn lên trong `cub + growing`, sống tới `life`, và giữa hai mốc ấy thì cứ mỗi `produce`
    // giây lại cho ra một phần sản lượng.
    grow: cub + growing,
    produce,
    life,
    productime,
    procreation,
  };
}).sort((x, y) => x.level - y.level || x.price - y.price);

/// Chuồng và bãi: số có sẵn lúc đầu, trần, và giá từng lần nâng.
///
/// QFarm đếm bằng `decorative.item2` / `item3` và nâng tới cấp 13 mỗi thứ. Ở đây cấp đó thành
/// **số chỗ**, vì cái người chơi quan tâm là còn chỗ nào không, không phải cái chuồng đang ở cấp
/// mấy — và mười ba cấp chuồng cho hai con vật là một bảng nâng cấp dài hơn cái nó quản lý.
export const HOUSES = {
  nest: { start: 2, max: 8, costs: [0, 3_000, 20_000, 60_000, 120_000, 210_000, 300_000] },
  shed: { start: 0, max: 6, costs: [5_000, 40_000, 90_000, 160_000, 250_000, 350_000] },
};

/// Cỏ. Là cây số 40 của nông trại — trồng được, và trồng thì rẻ hơn mua.
export const GRASS = { crop: 40, buy: 60, hopper: 1000, perHours: 4 };

const out = `/**
 * Vật nuôi: bảng số của QFarm, và hai cái chuồng.
 *
 * Sinh ra bởi \`tools/gen-animals.mjs\` từ \`config/mc/animaltype.php\` và
 * \`config/mc/animaltime.php\`. Giá, cấp, sức ăn, vòng đời và sản lượng đều là số thật của bản
 * gốc; tên đổi sang tiếng Việt.
 *
 * Đừng sửa tay. Sửa \`gen-animals.mjs\` rồi chạy lại.
 */

export const ANIMALS = ${JSON.stringify(rows, null, 2)};

const BY_ID = new Map(ANIMALS.map((one) => [one.id, one]));
export const animalById = (id) => BY_ID.get(Number(id)) ?? null;

/// Hai loại chuồng, số chỗ có sẵn, trần, và giá từng lần mở thêm một chỗ.
export const HOUSES = ${JSON.stringify({ nest: HOUSES.nest, shed: HOUSES.shed }, null, 2)};

/// Cỏ: cây số 40 của nông trại, giá mua, và sức chứa của máng.
///
/// **Cỏ trồng rẻ hơn cỏ mua, và đó là cả thiết kế.** Một gói hạt cỏ 80 đồng cho 25 bó, tức 3,2
/// đồng một bó; mua thẳng ở tiệm thì 60. Nên nông trại nuôi bãi chăn, và bãi chăn trả lại bằng
/// sản phẩm — vòng ấy là vòng của bản gốc, chỉ có điều ở đây nó nhìn thấy được ngay trên một
/// khung hình thay vì nằm trong hai chỗ khác nhau của một trang Flash.
export const GRASS = ${JSON.stringify(GRASS, null, 2)};
`;
writeFileSync(join(here, '..', 'bots', 'farmbot', 'rules', 'animals.mjs'), out);
console.log(`animals.mjs: ${rows.length} animals, levels ${rows.map((r) => r.level).join(',')}`);
