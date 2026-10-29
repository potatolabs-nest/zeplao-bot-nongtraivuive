// Emits bots/farmbot/rules/catalogue.mjs from the real QFarm tables.
//
// Every number a crop carries — its level gate, its growth cycle, the five stage thresholds, how
// many times it can be picked, what it yields, what a seed costs, what the produce sells for and
// what exp it pays — is the number from config/nc/cropstype.php and config/nc/cropstime.php. None
// of it was invented; the only thing added is a Vietnamese name per crop, because the source names
// are Chinese and a Vietnamese farm game with 白萝卜 on the seed packet is not ported, it is copied.
//
//   node tools/gen-catalogue.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const raw = (name) => JSON.parse(readFileSync(join(here, '..', 'data-raw', name + '.json'), 'utf8'));
const cropstype = raw('cropstype');
const cropstime = raw('cropstime');
const upgrade = raw('upgrade');

/// cId -> the Vietnamese name. Chosen to be what the thing is called in a Vietnamese market.
const NAMES = {
  40: 'Cỏ voi', 2: 'Củ cải trắng', 3: 'Cà rốt', 64: 'Hành lá', 59: 'Cải thảo',
  60: 'Lúa', 61: 'Lúa mì', 4: 'Ngô', 71: 'Cải thìa', 96: 'Xà lách', 5: 'Khoai tây',
  6: 'Cà tím', 51: 'Táo đỏ', 7: 'Cà chua', 8: 'Đậu Hà Lan', 41: 'Hoa hồng đỏ',
  9: 'Ớt', 103: 'Hoa loa kèn', 10: 'Bí ngô', 91: 'Sơn tra', 1: 'Dâu tây', 11: 'Táo',
  14: 'Dưa hấu', 15: 'Chuối', 18: 'Đào', 19: 'Cam', 13: 'Nho', 46: 'Quả tình yêu',
  23: 'Lựu', 26: 'Bưởi', 27: 'Dứa', 29: 'Dừa', 31: 'Bầu', 45: 'Kiwi', 38: 'Đu đủ',
  39: 'Khế', 42: 'Chanh', 48: 'Dâu ta', 33: 'Thanh long', 34: 'Anh đào', 35: 'Vải',
};

/// The catalogue, in the order the shop shows it: by the level that unlocks it.
const ids = Object.keys(NAMES).map(Number);

const rows = ids.map((id) => {
  const c = cropstype[String(id)];
  const t = cropstime[String(id)];
  if (!c || !t) throw new Error(`no table row for crop ${id}`);
  const total = Number(c.growthCycle);
  // The five thresholds, as a fraction of the whole cycle. The sixth entry in cropstime is a
  // sentinel (2e9) meaning "no further stage"; it is dropped rather than normalised.
  const stages = t.slice(0, 5).map((s) => Number((Number(s) / total).toFixed(4)));
  return {
    id,
    name: NAMES[id],
    level: Number(c.cLevel),
    cycle: total,
    stages,
    picks: Number(c.maturingTime),
    yield: Number(c.output),
    seed: Number(c.price),
    sell: Number(c.sale),
    exp: Number(c.cropExp),
    cn: c.cName,
  };
}).sort((a, b) => a.level - b.level || a.cycle - b.cycle);

/// The plots a farm starts with, and what each next one costs to clear.
///
/// From `user_reclaim.php`, which gates a new plot on a level and a sum of money. The level gate
/// there is dead code — it compares exp against a key called `exp` that the table does not have —
/// so the money is the real price and the level beside it is recorded as what it was meant to be.
const LAND = [
  { level: 0, cost: 0 }, { level: 0, cost: 0 }, { level: 0, cost: 0 },
  { level: 0, cost: 0 }, { level: 0, cost: 0 }, { level: 0, cost: 0 },
  { level: 5, cost: 10_000 }, { level: 7, cost: 20_000 }, { level: 9, cost: 30_000 },
  { level: 11, cost: 50_000 }, { level: 13, cost: 70_000 }, { level: 15, cost: 90_000 },
  { level: 17, cost: 120_000 }, { level: 19, cost: 150_000 }, { level: 21, cost: 180_000 },
  { level: 23, cost: 230_000 }, { level: 25, cost: 300_000 }, { level: 27, cost: 500_000 },
];

/// The land-levelling ladder from `config/nc/upgrade.php`, which turns the first N plots red.
/// Red ground yields 10% more; that multiplier is the whole of what it does.
const RED = Object.values(upgrade).map((one) => ({ level: Number(one.level), cost: Number(one.money) }));

const out = `/**
 * Cây trồng và đất: bảng số của QFarm, không phải bảng số tự nghĩ ra.
 *
 * Sinh ra bởi \`tools/gen-catalogue.mjs\` từ \`config/nc/cropstype.php\`, \`config/nc/cropstime.php\` và
 * \`config/nc/upgrade.php\` của QFarm 7.0. Mọi con số ở đây — cấp, vòng sinh trưởng, năm mốc
 * giai đoạn, số lần hái, sản lượng, giá hạt, giá bán, kinh nghiệm — đều là số thật; chỉ có tên
 * được đổi sang tiếng Việt, vì một trang trại tiếng Việt ghi 白萝卜 trên gói hạt thì không phải
 * là bản port, mà là bản sao.
 *
 * Đừng sửa tay file này. Sửa \`gen-catalogue.mjs\` rồi chạy lại.
 */

/// Một cây: ${rows.length} loại, xếp theo cấp mở khoá.
///
/// \`stages\` là **tỉ lệ của cả vòng**, không phải số giây — mốc thật trong QFarm được ghi bằng
/// giây tuyệt đối, mà giây tuyệt đối thì không co giãn được khi cả trò chơi chạy nhanh lên
/// (xem \`SPEED\`). Chia sẵn ở đây để chỗ dùng chỉ còn một phép nhân.
export const CROPS = ${JSON.stringify(rows, null, 2)};

/// Tra theo id. Không có gì để tra hộ: một cây không có trong bảng thì không trồng được.
const BY_ID = new Map(CROPS.map((one) => [one.id, one]));
export const cropById = (id) => BY_ID.get(Number(id)) ?? null;

/// Đất của một nông trại: sáu thửa lúc đầu, và mỗi thửa sau phải bỏ tiền ra khai.
///
/// Mười tám thửa là trần, không phải hai mươi tư như QFarm. Trần ở đây là **cái khung**: khung
/// widget rộng chừng 390 pixel, ba thửa một hàng, và hai mươi tư thửa là tám hàng — một trang
/// trại dài hơn cái điện thoại đang xem nó thì phần dưới không ai chạm tới.
export const LAND = ${JSON.stringify(LAND, null, 2).replace(/\n/g, '\n')};

/// Nâng thửa thứ \`n\` (tính từ 0) lên đất đỏ, theo bảng của QFarm.
export const RED_LAND = ${JSON.stringify(RED, null, 2)};

/// Bao nhiêu thửa một nông trại có thể có.
export const MAX_PLOTS = LAND.length;

/// Đất đỏ cho thêm ngần này sản lượng, cho cây không phải cây đỏ.
export const RED_BONUS = 1.1;
`;
writeFileSync(join(here, '..', 'bots', 'farmbot', 'rules', 'catalogue.mjs'), out);
console.log(`catalogue.mjs: ${rows.length} crops, ${LAND.length} plots`);
console.log('levels:', [...new Set(rows.map((r) => r.level))].join(','));
