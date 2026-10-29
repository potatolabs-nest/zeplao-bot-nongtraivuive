// Luật chơi: nông trại, bãi chăn, và tiền.
//
// Không mạng, không khung widget, không tiến trình bot — chỉ những hàm thuần. Đó là toàn bộ lý do
// luật nằm trong `rules/`: một luật kiểm được bằng một phép gọi hàm thì kiểm được, còn một luật chỉ
// kiểm được bằng cách mở điện thoại ra và nhìn thì không kiểm được lần thứ hai.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SPEED, levelOf, expFor, progressTo, stageOf, marksOf, plotOf, emptyPlot, newFarm,
  advance, grow, harvestOf, sow, water, weed, pest, harvest, pick, clear, steal, openLand,
  sowWeeds, sowPests, resetQuota, BAD_PER_DAY, BAD_MAX_PER_PLOT,
  upgradeLand, chores, isFarming, ripePlots, regrowthMark, seedsFor,
  PLANT_EXP, HELP_COIN, HELP_EXP, STEAL_MIN_COIN, STEAL_FLOOR, DOG_CHANCE,
  WEED_PENALTY, WEED_PENALTY_CAP, DAILY_COIN, STARTING_COIN, MAX_PLOTS,
} from './rules/farm.mjs';
import { CROPS, cropById, LAND, RED_LAND } from './rules/catalogue.mjs';
import {
  newRanch, graze, penOf, emptyPen, feed, buy, collect, butcher, raid, catchMouse,
  openHouse, chores as ranchChores, hungry, hopperLasts, penFor, roomFor, houseAt,
  appetite, bite, STEAL_SHARE, MAX_FEED, MOUSE_CHANCE, HELP_EXP_PER_TEN, capacityOf,
} from './rules/ranch.mjs';
import { ANIMALS, animalById, HOUSES, GRASS } from './rules/animals.mjs';

/// Một cái ngẫu nhiên đứng yên, để một bộ thử kiểm được nhánh nó muốn kiểm.
const fixed = (value) => () => value;
/// Một dãy số đã định, dùng hết thì quay lại đầu.
const seq = (...values) => {
  let at = 0;
  return () => values[at++ % values.length];
};
/// Một cái ngẫu nhiên luôn dưới ngưỡng (mọi thứ "có xảy ra") hoặc luôn trên (không gì xảy ra).
const always = () => 0;
const never = () => 0.999999;

const HOUR = 3600 * 1000;

// ---- bảng số sinh ra từ QFarm ----------------------------------------------------------------

test('bảng cây giữ nguyên số của QFarm', () => {
  // Ba cây được kiểm tay, đối chiếu thẳng với `config/nc/cropstype.php` và `cropstime.php`.
  const radish = cropById(2);
  assert.equal(radish.name, 'Củ cải trắng');
  assert.equal(radish.level, 0);
  assert.equal(radish.cycle, 36000);
  assert.equal(radish.picks, 1);
  assert.equal(radish.yield, 16);
  assert.equal(radish.seed, 125);
  assert.equal(radish.sell, 17);
  assert.equal(radish.exp, 15);
  // cropstime[2] = 7200,14400,25200,36000,36000 — chia cho 36000.
  assert.deepEqual(radish.stages, [0.2, 0.4, 0.7, 1, 1]);

  const strawberry = cropById(1);
  assert.equal(strawberry.name, 'Dâu tây');
  assert.equal(strawberry.level, 10);
  assert.equal(strawberry.cycle, 86400);
  assert.equal(strawberry.picks, 2, 'dâu tây là cây hái hai lần');

  const litchi = cropById(35);
  assert.equal(litchi.name, 'Vải');
  assert.equal(litchi.picks, 4);
  assert.equal(litchi.cycle, 277200);
});

/// Không có chữ Hán trong tên. `cam`, `nho`, `chanh` là tiếng Việt thật mà không có dấu, nên phép
/// kiểm phải là "không còn chữ Trung Quốc", không phải "phải có dấu".
const CJK = /[㐀-鿿豈-﫿]/;

test('mọi cây đều có tên tiếng Việt và mốc giai đoạn tăng dần', () => {
  for (const crop of CROPS) {
    assert.doesNotMatch(crop.name, CJK, `${crop.cn} còn nguyên chữ Hán trong tên`);
    assert.ok(crop.name.trim().length > 0);
    assert.equal(crop.cn.length > 0, true, 'tên gốc phải được giữ lại để đối chiếu');
    assert.ok(crop.cycle > 0, `${crop.name} không có vòng sinh trưởng`);
    assert.equal(crop.stages.length, 5);
    for (let at = 1; at < crop.stages.length; at++) {
      assert.ok(crop.stages[at] >= crop.stages[at - 1], `${crop.name} có mốc giai đoạn lùi`);
    }
    assert.ok(crop.stages[4] <= 1, `${crop.name} có mốc cuối vượt cả vòng`);
    assert.ok(crop.level >= 0 && crop.level <= 30);
    assert.ok(crop.yield > 0 && crop.seed > 0 && crop.sell > 0);
  }
});

test('cấp 0 phải có cây để trồng', () => {
  // Một trò chơi mở ra mà không có gì trồng được là một trò chơi hỏng.
  const level0 = CROPS.filter((crop) => crop.level === 0);
  assert.ok(level0.length >= 2, 'cấp 0 phải có ít nhất hai loại cây');
  // Và phải có loại đủ ngắn để thấy nó lớn trong một lần ngồi.
  const quickest = Math.min(...level0.map((crop) => crop.cycle)) / SPEED / 60;
  assert.ok(quickest < 35, `cây ngắn nhất ở cấp 0 mất ${quickest.toFixed(0)} phút, quá lâu để thấy`);
});

test('cấp và kinh nghiệm đúng công thức QFarm', () => {
  // qf_toLevel(exp) = floor(sqrt((exp+25)/100) - 0.5)
  assert.equal(levelOf(0), 0);
  assert.equal(levelOf(199), 0);
  assert.equal(levelOf(200), 1);
  assert.equal(levelOf(599), 1);
  assert.equal(levelOf(600), 2);
  assert.equal(levelOf(11_000), 10);
  assert.equal(levelOf(93_000), 30);

  // Và nghịch đảo của nó: exp để tới cấp L là 100·L·(L+1).
  for (const level of [1, 2, 3, 5, 10, 20, 30]) {
    assert.equal(expFor(level), 100 * level * (level + 1));
    assert.equal(levelOf(expFor(level)), level, `cấp ${level} không khớp`);
    assert.equal(levelOf(expFor(level) - 1), level - 1, `cấp ${level} bắt đầu sai chỗ`);
  }

  const gap = progressTo(200);
  assert.equal(gap.level, 1);
  assert.equal(gap.next, 600);
  assert.equal(gap.need, 400);
});

test('bảng giá đất giữ nguyên số của QFarm', () => {
  assert.equal(LAND.length, MAX_PLOTS);
  assert.equal(LAND[6].level, 5);
  assert.equal(LAND[6].cost, 10_000);
  assert.equal(LAND[17].level, 27);
  assert.equal(LAND[17].cost, 500_000);
  // Sáu thửa đầu là đất có sẵn, không mất tiền.
  for (const plot of LAND.slice(0, 6)) assert.equal(plot.cost, 0);
  // Và bảng đất đỏ cũng vậy.
  assert.equal(RED_LAND[0].level, 28);
  assert.equal(RED_LAND[0].cost, 200_000);
});

// ---- cây mọc ---------------------------------------------------------------------------------

test('giai đoạn của cây đi từ 1 tới 6 đúng theo mốc', () => {
  const radish = cropById(2);
  const marks = marksOf(radish);        // [7200, 14400, 25200, 36000, 36000]
  assert.deepEqual(marks, [7200, 14400, 25200, 36000, 36000]);

  assert.equal(stageOf(radish, 0), 1);
  assert.equal(stageOf(radish, 7199), 1);
  assert.equal(stageOf(radish, 7200), 2);
  assert.equal(stageOf(radish, 14399), 2);
  assert.equal(stageOf(radish, 14400), 3);
  assert.equal(stageOf(radish, 25200), 4);
  assert.equal(stageOf(radish, 36000), 6, 'đúng một vòng là chín');
  assert.equal(stageOf(radish, 999999), 6, 'chín thì ở nguyên chín');
});

test('cây lớn theo nhịp, không theo đồng hồ thật', () => {
  const farm = newFarm(0);
  // Củ cải trắng mất 36000 giây trò chơi. Ở tốc độ 20 lần, thế là 1800 giây thật, tức nửa tiếng.
  const half = (36000 / 2 / SPEED) * 1000;
  const later = advance(farm, half, never);
  const plot = later.plots[1];   // thửa 1 trồng sẵn từ 15% vòng
  assert.ok(plot.grown > 0.15 * 36000, 'cây phải lớn lên');
  assert.ok(plot.stage >= 3, `cây ở giai đoạn ${plot.stage}, đáng lẽ phải qua mốc thứ ba`);

  // Đúng trọn một vòng thì chín.
  const ripe = advance(farm, (36000 / SPEED) * 1000, never);
  assert.equal(ripe.plots[1].stage, 6);
});

test('cây khô thì đứng im, và một cơn khô không làm mất gì', () => {
  const farm = newFarm(0);
  const dry = farm.plots[2];
  assert.equal(dry.dry, true);
  const before = dry.grown;
  const later = advance(farm, 2 * HOUR, never);
  assert.equal(later.plots[2].grown, before, 'thửa khô không được lớn');
  // Nhưng nó cũng không chết, và tưới lên là chạy lại.
  assert.ok(later.plots[2].crop, 'thửa khô vẫn còn cây');
  assert.equal(water(later.plots[2]).ok, true);
});

test('cây chín thì đứng nguyên, không thối', () => {
  const plot = plotOf(2, { grown: 36000 });
  assert.equal(plot.stage, 6);
  const much = grow(plot, 999999, never);
  assert.equal(much.stage, 6);
  assert.equal(much.yieldLeft, plot.yieldLeft, 'sản lượng chốt lúc chín thì không đổi nữa');
});

test('cỏ dại và sâu bọ mọc khi sang giai đoạn, không phải lúc nào cũng mọc', () => {
  // Luôn gieo: mọi thứ xuất hiện.
  const plot = plotOf(2, { grown: 0 });
  const grew = grow({ ...plot, stage: 1, grown: 7100 }, 200, always);
  assert.ok(grew.weeds > 0, 'phải có cỏ');
  assert.ok(grew.pests > 0, 'phải có sâu');
  assert.equal(grew.dry, true, 'phải khô');

  // Không bao giờ gieo: không có gì.
  const quiet = grow({ ...plot, stage: 1, grown: 7100 }, 200, never);
  assert.equal(quiet.weeds, 0);
  assert.equal(quiet.pests, 0);
  assert.equal(quiet.dry, false);
});

test('cỏ và sâu ăn mất sản lượng, và không ăn quá một nửa', () => {
  const clean = plotOf(2, { grown: 36000 });
  assert.equal(clean.yieldLeft, 16, 'củ cải trắng được 16 quả');

  const weedy = plotOf(2, { grown: 36000, weeds: 1 });
  assert.equal(weedy.yieldLeft, 14, 'một thứ đang đứng là một phần mười vụ mùa');

  const awful = plotOf(2, { grown: 36000, weeds: 3, pests: 3 });
  const floor = Math.floor(16 * (1 - WEED_PENALTY_CAP));
  assert.equal(awful.yieldLeft, floor, 'sáu thứ đang đứng chỉ mất một nửa, không hơn');
  assert.equal(WEED_PENALTY_CAP / WEED_PENALTY, 5, 'trần là năm thứ');
});

test('cây lâu năm phải lớn lại rồi mới chín lần nữa', () => {
  const strawberry = cropById(1);            // hái được 2 lần
  assert.equal(strawberry.picks, 2);
  const regrow = regrowthMark(strawberry);
  assert.equal(regrow, marksOf(strawberry)[2], 'lớn lại từ mốc thứ ba');

  // Hái lần đầu, rồi cây phải còn sống và phải lớn tiếp từ mốc thứ ba.
  const ripe = plotOf(1, { grown: strawberry.cycle });
  assert.equal(ripe.stage, 6);

  const first = pick(ripe);
  assert.equal(first.ok, true);
  assert.equal(first.plot.crop, 1, 'cây lâu năm ở lại sau khi hái');
  assert.equal(first.plot.picks, 1);
  assert.equal(first.plot.grown, regrow, 'lớn lại từ mốc thứ ba');
  assert.equal(first.plot.stage, 4, 'sau khi hái thì về giai đoạn bốn');

  const done = grow(first.plot, strawberry.cycle - regrow, never);
  assert.equal(done.stage, 6, 'lớn nốt quãng cuối thì chín lại');

  // Hái lần thứ hai — hết số lần — thì cây tàn.
  const last = pick(done);
  assert.equal(last.ok, true);
  assert.equal(last.plot.stage, 7, 'hết số lần hái thì cây tàn');
  assert.equal(clear(last.plot).ok, true);
  assert.equal(harvest(last.plot).ok, false, 'cây tàn thì không hái được');

  // Cây một vụ thì hái xong là về đất trống.
  const radish = pick(plotOf(2, { grown: 36000 }));
  assert.equal(radish.plot.crop, 2, 'cây một vụ cũng ở lại dưới dạng cây tàn');
  assert.equal(radish.plot.stage, 7);
  assert.equal(radish.amount, 16);
});

// ---- việc làm trên nông trại -------------------------------------------------------------------

test('nông trại mới có sáu thửa, bốn thửa có sẵn bài học', () => {
  const farm = newFarm(0);
  assert.equal(farm.plots.length, 6);
  assert.ok(farm.coin >= 1000, 'ví rỗng đọc là hỏng, không đọc là nhiệm vụ');

  assert.equal(farm.plots[0].stage, 6, 'một thửa chín sẵn để dạy rằng hái ra tiền');
  assert.ok(farm.plots[1].weeds > 0, 'một thửa mọc cỏ');
  assert.equal(farm.plots[2].dry, true, 'một thửa khô');
  assert.ok(farm.plots[3].pests > 0, 'một thửa có sâu');
  assert.equal(farm.plots[4].crop, 0, 'và hai thửa trống');

  // Bốn tật khác nhau, không phải bốn lần cùng một tật.
  assert.equal(chores(farm).harvest, 1);
  assert.equal(chores(farm).weeds, 1);
  assert.equal(chores(farm).pests, 1);
});

test('gieo hạt: phải có hạt, thửa phải trống', () => {
  const farm = newFarm(0);
  const empty = farm.plots[4];
  assert.equal(sow(empty, 2, { 2: 1 }, 1000).ok, true);
  assert.equal(sow(empty, 2, { 2: 0 }, 1000).ok, false, 'không có hạt thì không gieo được');
  assert.equal(sow(farm.plots[0], 2, { 2: 1 }, 1000).ok, false, 'thửa đang có cây');
  assert.equal(sow(empty, 9999, { 9999: 5 }, 1000).ok, false, 'cây không có trong bảng');
  // Thửa trồng cây tàn thì phải dọn trước.
  const dead = { ...empty, crop: 2, stage: 7 };
  assert.match(sow(dead, 2, { 2: 1 }, 1000).why, /dọn/);
});

test('tưới, nhổ cỏ, bắt sâu: mỗi việc từ chối được và từ chối có lý do', () => {
  const wet = plotOf(2, { grown: 1000 });
  assert.equal(water(wet).ok, false);
  assert.match(water(wet).why, /ẩm/, 'câu từ chối phải nói được với người chơi');
  assert.equal(water(plotOf(2, { grown: 1000, dry: true })).ok, true);

  const weedy = plotOf(2, { grown: 1000, weeds: 1 });
  assert.equal(weed(weedy, 'me').ok, true);
  assert.equal(weed(plotOf(2, { grown: 1000 }), 'me').ok, false);

  const buggy = plotOf(2, { grown: 1000, pests: 2 });
  assert.equal(pest(buggy, 'me').ok, true);
  assert.equal(pest(plotOf(2, { grown: 1000 }), 'me').ok, false);
});

test('không nhổ được cỏ do chính mình gieo', () => {
  // Luật của QFarm: "证据是不能毁灭的" — bằng chứng thì không xoá được. Nó chặn đúng một trò:
  // gieo cỏ lên ruộng người khác rồi nhổ để lấy kinh nghiệm.
  const plot = plotOf(2, { grown: 1000, weeds: 2 });
  plot.sownBy = { me: { weeds: 2 } };
  const mine = weed(plot, 'me');
  assert.equal(mine.ok, false);
  assert.match(mine.why, /bạn gieo/);

  // Nhưng người khác thì nhổ được — kể cả khi mình đã gieo một ít.
  plot.sownBy = { me: { weeds: 1 } };
  assert.equal(weed(plot, 'other').ok, true);
  assert.equal(weed(plot, 'me').ok, true, 'còn một cái không phải của mình thì nhổ được');
});

test('hái: chỉ hái được cây chín, và hái thì mất phần đã chốt', () => {
  const farm = newFarm(0);
  const ripe = farm.plots[0];
  assert.equal(harvest(ripe).ok, true);
  assert.equal(harvest(ripe).amount, 16);

  const growing = plotOf(2, { grown: 1000 });
  assert.equal(harvest(growing).ok, false);
  assert.match(harvest(growing).why, /chưa chín/);
  assert.equal(harvest(emptyPlot()).ok, false);
});

// ---- hái trộm ---------------------------------------------------------------------------------

test('hái trộm: đủ bốn điều kiện của QFarm', () => {
  const ripe = plotOf(2, { grown: 36000 });
  const rich = { hasCrop: true, coin: 1000, hasDog: false };

  // Điều kiện 1: phải đang trồng cây.
  assert.equal(steal(ripe, 'thief', 'owner', { ...rich, hasCrop: false }, fixed(0)).ok, false);
  // Điều kiện 2: phải có tiền.
  assert.equal(steal(ripe, 'thief', 'owner', { ...rich, coin: 100 }, fixed(0)).ok, false);
  // Điều kiện 3: cây phải chín.
  assert.equal(steal(plotOf(2, { grown: 100 }), 'thief', 'owner', rich, fixed(0)).ok, false);
  // Điều kiện 4: chủ ruộng thì không hái trộm ruộng mình.
  assert.equal(steal(ripe, 'owner', 'owner', rich, fixed(0)).ok, false);

  // Đủ cả bốn thì hái được.
  const got = steal(ripe, 'thief', 'owner', rich, fixed(0.1));
  assert.equal(got.ok, true);
  assert.equal(got.amount, 1, 'một nửa số lần chỉ được một quả');
});

test('hái trộm không lấn vào phần sàn của chủ ruộng', () => {
  const ripe = plotOf(2, { grown: 36000 });
  const rich = { hasCrop: true, coin: 1000, hasDog: false };
  // Mười sáu quả, sàn là chín — nên chỉ có bảy quả nằm trong tầm với.
  assert.equal(ripe.yieldLeft, 16);
  assert.equal(ripe.floor, Math.floor(16 * STEAL_FLOOR));
  const reachable = ripe.yieldLeft - ripe.floor;
  assert.equal(reachable, 7);

  // Xin năm quả (roll cao nhất) vẫn chỉ được năm, và phần sàn còn nguyên.
  const got = steal(ripe, 'thief', 'owner', rich, fixed(0.99));
  assert.equal(got.amount, 5);
  assert.ok(got.amount <= reachable, 'không bao giờ lấy quá phần trên sàn');
});

test('một thửa chỉ bị hái trộm một lần một vụ, mỗi người', () => {
  const ripe = plotOf(2, { grown: 36000 });
  ripe.thieves = { an: 3 };
  const rich = { hasCrop: true, coin: 1000, hasDog: false };
  assert.equal(steal(ripe, 'an', 'owner', rich, fixed(0)).ok, false, 'an đã hái rồi');
  assert.equal(steal(ripe, 'binh', 'owner', rich, fixed(0)).ok, true, 'bình thì chưa');
});

test('chó cắn: mất tiền, về tay chủ nhà, và lần sau không thử được nữa', () => {
  const ripe = plotOf(2, { grown: 36000 });
  const rich = { hasCrop: true, coin: 1000, hasDog: true };
  // Một cái ngẫu nhiên luôn dưới ngưỡng chó: cắn.
  const bit = steal(ripe, 'thief', 'owner', rich, fixed(0.01));
  assert.equal(bit.ok, true);
  assert.equal(bit.caught, true);
  assert.equal(bit.amount, 0, 'bị cắn thì không lấy được gì');
  assert.ok(bit.fine >= 40 && bit.fine <= 80, `tiền phạt ${bit.fine} ngoài khoảng của QFarm`);

  // Không có chó thì không bao giờ bị cắn, dù cái ngẫu nhiên có thấp đến đâu.
  const noDog = steal(ripe, 'thief', 'owner', { ...rich, hasDog: false }, fixed(0.01));
  assert.equal(noDog.caught, false);
  assert.ok(noDog.amount > 0);
});

test('bảng số quả hái trộm đúng của QFarm', () => {
  const ripe = plotOf(2, { grown: 36000 });
  ripe.floor = 0;
  ripe.yieldLeft = 16;
  const rich = { hasCrop: true, coin: 1000, hasDog: false };
  // 50% một quả, 20% hai, 10% ba, 15% bốn, 5% năm.
  assert.equal(steal(ripe, 'a', 'o', rich, fixed(0.49)).amount, 1);
  assert.equal(steal(ripe, 'a', 'o', rich, fixed(0.51)).amount, 2);
  assert.equal(steal(ripe, 'a', 'o', rich, fixed(0.71)).amount, 3);
  assert.equal(steal(ripe, 'a', 'o', rich, fixed(0.81)).amount, 4);
  assert.equal(steal(ripe, 'a', 'o', rich, fixed(0.96)).amount, 5);
});

test('phải đang trồng cây mới đi hái trộm được', () => {
  const bare = newFarm(0);
  for (const plot of bare.plots) { plot.crop = 0; plot.stage = 0; }
  assert.equal(isFarming(bare), false);
  const farmed = newFarm(0);
  assert.equal(isFarming(farmed), true, 'nông trại mới đã có cây');
});

test('chủ ruộng giữ được phần của mình dù bao nhiêu người ghé', () => {
  // Mười người hái trộm, mỗi người một quả — sàn vẫn phải còn.
  let plot = plotOf(2, { grown: 36000 });
  const rich = { hasCrop: true, coin: 1000, hasDog: false };
  let taken = 0;
  for (let who = 0; who < 40; who++) {
    const got = steal(plot, `thief${who}`, 'owner', rich, fixed(0.1));
    if (!got.ok) break;
    plot = { ...plot, yieldLeft: plot.yieldLeft - got.amount, thieves: { ...plot.thieves, [`thief${who}`]: got.amount } };
    taken += got.amount;
  }
  assert.ok(taken <= plot.yieldLeft + taken - plot.floor, 'không lấy quá phần trên sàn');
  assert.ok(plot.yieldLeft >= plot.floor, 'sàn phải còn nguyên');
});

test('gieo cỏ và thả sâu: được, nhưng không lấy được gì', () => {
  // Đây là hai việc gây hại duy nhất của trò chơi, và cả hai đều **không có lãi**. Nếu chúng có
  // lãi thì trò chơi đang dạy người ta làm việc xấu.
  const fresh = plotOf(2, { grown: 1000 });
  const one = sowWeeds(fresh, 'me', BAD_PER_DAY);
  assert.equal(one.ok, true);
  assert.equal(one.weeds, 1);

  const bug = sowPests(fresh, 'me', BAD_PER_DAY);
  assert.equal(bug.ok, true);
  assert.equal(bug.pests, 1);

  // Đầy ba thứ thì thôi.
  const weedy = plotOf(2, { grown: 1000, weeds: BAD_MAX_PER_PLOT });
  assert.equal(sowWeeds(weedy, 'me', BAD_PER_DAY).ok, false);
  // Cây đã chín thì gieo cỏ lên cũng không kịp, nên không cho.
  assert.equal(sowWeeds(plotOf(2, { grown: 36000 }), 'me', BAD_PER_DAY).ok, false);
  // Thửa trống thì không có gì để phá.
  assert.equal(sowPests(emptyPlot(), 'me', BAD_PER_DAY).ok, false);
});

test('hạn mức phá trong ngày, và nó trở về đầy khi sang ngày', () => {
  const plot = plotOf(2, { grown: 1000 });
  assert.equal(sowWeeds(plot, 'me', 0).ok, false, 'hết hạn mức thì thôi');
  assert.match(sowWeeds(plot, 'me', 0).why, /50/);

  // Sang ngày thì đầy lại. Không có cron: con bot hỏi "hôm nay là ngày nào" lúc đọc.
  const farm = { ...newFarm(0), quotaDay: '2026-01-01', badLeft: 0, goodLeft: 3 };
  const same = resetQuota(farm, '2026-01-01');
  assert.equal(same.badLeft, 0, 'cùng ngày thì không đầy lại');
  const tomorrow = resetQuota(farm, '2026-01-02');
  assert.equal(tomorrow.badLeft, BAD_PER_DAY);
  assert.equal(tomorrow.goodLeft, 150);
  assert.equal(tomorrow.quotaDay, '2026-01-02');
});

test('cỏ do chính mình gieo thì không nhổ được, nhưng chủ ruộng nhổ được', () => {
  // Luật chống phá chỉ có nghĩa khi gieo cỏ là một việc làm được. Đây là phép kiểm nối hai nửa
  // ấy lại: gieo, rồi thử nhổ.
  const plot = plotOf(2, { grown: 1000 });
  const sowed = sowWeeds(plot, 'me', BAD_PER_DAY);
  assert.equal(sowed.ok, true);

  const withWeeds = { ...plot, weeds: 1, sownBy: { me: { weeds: 1 } } };
  assert.equal(weed(withWeeds, 'me').ok, false, 'tự gieo rồi tự nhổ để lấy kinh nghiệm');

  // Nhưng chủ ruộng — người không gieo — thì nhổ được, và nhổ xong thửa đất sạch.
  assert.equal(weed(withWeeds, 'owner').ok, true);

  // Và nếu hai người cùng gieo thì người thứ hai nhổ được một cái.
  const both = { ...plot, weeds: 2, sownBy: { me: { weeds: 1 } } };
  assert.equal(weed(both, 'me').ok, true, 'còn một cái không phải của mình');
});

// ---- đất ---------------------------------------------------------------------------------------

test('khai đất: cần cấp và cần tiền, và nói ra cái nào còn thiếu', () => {
  const farm = newFarm(0);
  farm.exp = expFor(5);

  // Thiếu tiền: câu từ chối phải nói ra giá, và có dấu phân cách cho dễ đọc.
  const poor = openLand(farm);
  assert.equal(poor.ok, false);
  assert.match(poor.why, /10\.000/, 'phải nói ra giá, có dấu phân cách');

  // Thiếu cấp: bản gốc gác hỏng chỗ này (so `exp` với một khoá tên `level`), ở đây không.
  farm.exp = 0;
  const lowLevel = openLand(farm);
  assert.equal(lowLevel.ok, false);
  assert.match(lowLevel.why, /cấp 5/, 'và phải nói ra cấp còn thiếu');

  // Đủ cả hai thì được.
  farm.exp = expFor(5);
  farm.coin = 10_000;
  const ok = openLand(farm);
  assert.equal(ok.ok, true);
  assert.equal(ok.cost, 10_000);
});

test('hết đất thì không khai thêm được', () => {
  const farm = newFarm(0);
  farm.plots = Array.from({ length: MAX_PLOTS }, emptyPlot);
  farm.coin = 99_999_999;
  farm.exp = expFor(30);
  assert.equal(openLand(farm).ok, false);
});

test('đất đỏ: cần đủ thửa trước đã, và cho thêm một phần mười sản lượng', () => {
  const farm = newFarm(0);
  farm.exp = expFor(30);
  farm.coin = 9_999_999;
  const tooSmall = upgradeLand(farm, 0);
  assert.equal(tooSmall.ok, false, 'sáu thửa thì chưa lên đất đỏ được');
  assert.match(tooSmall.why, /12/);

  farm.plots = Array.from({ length: 12 }, emptyPlot);
  assert.equal(upgradeLand(farm, 0).ok, true);

  // Và 10% ấy là thật.
  const plain = plotOf(2, { grown: 36000 });
  const red = plotOf(2, { grown: 36000, red: true });
  assert.equal(plain.yieldLeft, 16);
  assert.equal(red.yieldLeft, Math.floor(16 * 1.1));
  assert.equal(upgradeLand({ ...farm, plots: farm.plots.map((p, i) => (i === 0 ? red : p)) }, 0).ok, false);
});

// ---- bãi chăn ---------------------------------------------------------------------------------

test('bảng vật nuôi giữ nguyên số của QFarm', () => {
  const chicken = animalById(1001);
  assert.equal(chicken.name, 'Gà');
  assert.equal(chicken.product, 'Trứng gà');
  assert.equal(chicken.house, 'nest');
  assert.equal(chicken.level, 0);
  assert.equal(chicken.price, 700);
  assert.equal(chicken.eats, 1);
  assert.equal(chicken.yield, 20);
  assert.equal(chicken.productPrice, 17);
  assert.equal(chicken.beastPrice, 860);
  // animaltime[1001] = 14400,14400,129600,15,21420,158400
  assert.equal(chicken.grow, 28800, 'lớn lên trong 14400+14400');
  assert.equal(chicken.produce, 21420);
  assert.equal(chicken.life, 158400);

  const cow = animalById(1502);
  assert.equal(cow.house, 'shed');
  assert.equal(cow.level, 4);
  assert.equal(cow.price, 3000);
});

test('mỗi con vật tên Việt, và chuồng đúng loại', () => {
  for (const animal of ANIMALS) {
    assert.doesNotMatch(animal.name, CJK, `${animal.cn} còn nguyên chữ Hán trong tên`);
    assert.ok(animal.price > 0 && animal.yield > 0 && animal.life > animal.grow);
    assert.ok(animal.eats > 0, `${animal.name} không ăn gì thì máng vô nghĩa`);
    assert.ok(['nest', 'shed'].includes(animal.house));
    // Nuôi một con phải có lãi, nếu không thì cả bãi chăn là một cái bẫy.
    const gross = animal.yield * animal.productPrice + animal.beastPrice;
    assert.ok(gross > animal.price, `${animal.name} nuôi lỗ ${gross - animal.price}`);
  }
});

test('bãi chăn mới có một con gà và hai chỗ', () => {
  const ranch = newRanch(0);
  assert.equal(ranch.nests, HOUSES.nest.start);
  assert.equal(ranch.pens.length, 2);
  assert.equal(ranch.pens[0].animal, 1001);
  assert.equal(ranch.pens[1].animal, 0, 'chỗ thứ hai để trống cho người chơi tự mua');
  assert.equal(hungry(ranch), false, 'máng có sẵn cỏ');
  assert.ok(ranch.hopper > 0);
});

test('cỏ là thời gian: máng cạn thì cả bãi đứng im', () => {
  const ranch = newRanch(0);
  // Một con gà ăn 1 bó mỗi 4 giờ. Hai mươi bó đủ cho 80 giờ trò chơi.
  const per = bite(ranch);
  assert.ok(per > 0);
  assert.equal(Math.round(hopperLasts(ranch) / 3600), 80);

  // Cho chạy mười giờ trò chơi: gà lớn, máng vơi.
  const tenHours = (10 * 3600 / SPEED) * 1000;
  const later = graze(ranch, tenHours);
  assert.ok(later.clock >= 10 * 3600 - 1, `đồng hồ ${later.clock}`);
  assert.ok(later.hopper < ranch.hopper, 'cỏ phải vơi đi');
  assert.ok(later.pens[0].grown > 0, 'gà phải lớn');

  // Cho chạy quá lâu: máng cạn, con vật đứng im, nhưng không chết.
  const forever = graze(ranch, (1000 * 3600 / SPEED) * 1000);
  assert.equal(forever.hopper, 0);
  assert.equal(hungry(forever), true);
  assert.ok(forever.pens[0].animal, 'hết cỏ thì đói, không chết');
  assert.ok(forever.pens[0].grown >= 0);
});

test('hết cỏ thì không lớn thêm được nữa', () => {
  const ranch = { ...newRanch(0), hopper: 1 };
  // Chạy một quãng rất dài, rồi một quãng rất dài nữa: máng đã cạn từ lần đầu, nên lần thứ hai
  // không được đổi gì.
  const dry = graze(ranch, (500 * 3600 / SPEED) * 1000);
  const again = graze(dry, (500 * 3600 / SPEED) * 1000);
  assert.equal(again.pens[0].grown, dry.pens[0].grown, 'máng cạn thì đứng im');
  assert.equal(again.hopper, 0);
});

test('cho ăn lại thì chạy tiếp, không mất quãng đã qua', () => {
  const ranch = { ...newRanch(0), hopper: 0 };
  const stalled = graze(ranch, (100 * 3600 / SPEED) * 1000);
  const grownBefore = stalled.pens[0].grown;

  const fed = feed(stalled, 20);
  assert.equal(fed.ok, true);
  assert.equal(fed.bales, 20);
  // `stalled.at` là mốc thật lúc nó cạn, nên mốc mới phải **lớn hơn** nó — không phải một khoảng.
  const running = graze({ ...stalled, hopper: fed.bales }, stalled.at + 10 * 3600 * 1000);
  assert.ok(running.pens[0].grown > grownBefore, 'có cỏ thì lớn tiếp');
});

test('gà đẻ trứng theo nhịp, và chỉ sau khi lớn xong', () => {
  const ranch = { ...newRanch(0), hopper: 1000 };
  const chicken = animalById(1001);

  // Trước khi lớn xong: chưa có gì.
  const young = graze(ranch, (chicken.grow / 2 / SPEED) * 1000);
  assert.equal(young.pens[0].ready, 0, 'gà chưa lớn thì chưa đẻ');
  assert.ok(young.pens[0].grown < chicken.grow);

  // Lớn xong thì đẻ phần đầu tiên.
  const grownUp = graze(ranch, (chicken.grow / SPEED) * 1000);
  assert.ok(grownUp.pens[0].grown >= chicken.grow);
  assert.equal(grownUp.pens[0].ready, 1, 'lớn xong là có ngay phần đầu');

  // Rồi mỗi `produce` giây một phần.
  const oneMore = graze({ ...grownUp, at: 0 }, (chicken.produce / SPEED) * 1000);
  assert.equal(oneMore.pens[0].ready, 2);
});

test('một con vật không phải một cái máy in', () => {
  const ranch = { ...newRanch(0), hopper: 100000 };
  const chicken = animalById(1001);
  // Chạy lâu hơn cả vòng đời.
  const old = graze(ranch, (chicken.life * 3 / SPEED) * 1000);
  assert.equal(old.pens[0].ready, capacityOf(chicken), 'sản phẩm bị chặn ở sức chứa thật của con vật');
  assert.equal(old.pens[0].grown, chicken.life, 'và con vật không sống quá đời nó');
});

test('bắt sản phẩm, và giết thịt chỉ khi đã hết đời', () => {
  const ranch = { ...newRanch(0), hopper: 100000 };
  const chicken = animalById(1001);
  // Đi tới lúc gà lớn xong rồi thêm một nửa nhịp đẻ nữa, tính bằng **giây thật**.
  const ripe = graze(ranch, ((chicken.grow + chicken.produce / 2) / SPEED) * 1000);
  const got = collect(ripe, 0);
  assert.equal(got.ok, true);
  assert.equal(got.amount, 1);
  assert.equal(got.product, 'Trứng gà');
  assert.equal(got.exp, chicken.productExp);

  // Chưa hết đời thì không giết thịt được.
  assert.equal(butcher(ripe, 0).ok, false);
  // Và còn sản phẩm thì cũng không.
  const finished = { ...ripe, pens: [{ ...ripe.pens[0], grown: chicken.life, ready: 3 }] };
  assert.match(butcher(finished, 0).why, /sản phẩm/);

  const ready = { ...finished, pens: [{ ...finished.pens[0], ready: 0 }] };
  const meat = butcher(ready, 0);
  assert.equal(meat.ok, true);
  assert.equal(meat.price, chicken.beastPrice);
  assert.equal(meat.exp, chicken.beastExp);
});

test('lấy trộm sản phẩm: chỉ khi đã cho ra hơn một nửa', () => {
  const chicken = animalById(1001);
  // **Sức chứa**, không phải `output`: một con gà có `output = 20` mà cả đời chỉ cho được bảy
  // phần. Lấy một nửa của hai mươi thì không con gà nào chạm tới, và cả tính năng ấy chết mà
  // không ai thấy nó chết ở đâu.
  const capacity = capacityOf(chicken);
  assert.equal(capacity, 8, `một con gà cho được ${capacity} phần trong cả đời`);
  assert.ok(capacity < chicken.yield, 'và nó ít hơn `output` — đó chính là chỗ hai con số khác nhau');
  const half = Math.floor(capacity * STEAL_SHARE);
  const rich = { coin: 1000 };

  const thin = { ...penOf(1001, { grown: chicken.grow }), ready: half };
  assert.equal(raid(thin, 'thief', 'owner', rich).ok, false, 'chưa đủ một nửa thì không lấy được');

  const fat = { ...penOf(1001, { grown: chicken.grow }), ready: half + 1 };
  const got = raid(fat, 'thief', 'owner', rich);
  assert.equal(got.ok, true);
  assert.equal(got.amount, 1, 'mỗi con chỉ bị lấy một đơn vị');
  assert.equal(got.product, 'Trứng gà');

  // Và mỗi người chỉ lấy được một lần trên mỗi con.
  assert.equal(raid({ ...fat, raided: { thief: 1 } }, 'thief', 'owner', rich).ok, false);
  assert.equal(raid(fat, 'owner', 'owner', rich).ok, false, 'chủ nhà thì không lấy trộm nhà mình');
  assert.equal(raid(fat, 'thief', 'owner', { coin: 10 }).ok, false, 'phải có tiền');
});

test('mua con vật: đúng loại chuồng, và trừ đúng giá', () => {
  const ranch = newRanch(0);
  // Chỉ có chuồng, chưa có bãi.
  const cow = animalById(1502);
  const noShed = buy(ranch, 1502, 99_999);
  assert.equal(noShed.ok, false);
  assert.match(noShed.why, /bãi/);

  // Mở một bãi rồi thì mua được.
  const withShed = { ...ranch, sheds: 1, pens: [...ranch.pens, emptyPen()] };
  const got = buy(withShed, 1502, 99_999);
  assert.equal(got.ok, true);
  assert.equal(got.price, cow.price);
  assert.equal(got.index, 2, 'con bò vào chỗ bãi vừa mở');

  // Không đủ tiền thì không.
  assert.equal(buy(withShed, 1502, 10).ok, false);
});

test('mở thêm chỗ: theo bảng giá, và có trần', () => {
  const ranch = newRanch(0);
  const first = openHouse(ranch, 'nest');
  assert.equal(first.ok, true);
  assert.equal(first.cost, HOUSES.nest.costs[HOUSES.nest.start]);
  const full = { ...ranch, nests: HOUSES.nest.max };
  assert.equal(openHouse(full, 'nest').ok, false);
});

test('chuột: có thì bắt được, không có thì thôi', () => {
  const quiet = newRanch(0);
  assert.equal(catchMouse(quiet, never).ok, false);
  const withMouse = { ...quiet, mouse: true };
  const hit = catchMouse(withMouse, fixed(0.1));
  assert.equal(hit.ok, true);
  assert.equal(hit.hit, true);
  assert.ok(hit.coin >= 50);
  const miss = catchMouse(withMouse, fixed(0.9));
  assert.equal(miss.hit, false);
  assert.equal(miss.coin, 0);
});

test('bãi chăn đứng im thì không sinh chuột', () => {
  // Một con chuột trong một bãi chăn bỏ hoang là một con chuột không ai gặp — và một lời nhắc
  // không ai gặp là một lời nhắc dạy người ta bỏ qua lời nhắc.
  const ranch = { ...newRanch(0), hopper: 0 };
  const stalled = graze(ranch, 10 * 3600 * 1000, always);
  assert.equal(stalled.mouse, false);
});

// ---- đồng hồ dùng chung ------------------------------------------------------------------------

test('một đồng hồ cho cả nông trại: mười tám thửa không thể lệch nhau', () => {
  const farm = newFarm(0);
  // Trồng cùng một loại cây lên mọi thửa trống.
  farm.plots = farm.plots.map(() => plotOf(2, { grown: 0 }));
  const once = advance(farm, (1000 / SPEED) * 1000, never);
  const grown = once.plots.map((plot) => plot.grown);
  assert.equal(new Set(grown).size, 1, 'mọi thửa phải lớn đúng bằng nhau');

  // Và đi qua nhiều lần nhìn nhỏ cũng bằng một lần nhìn to.
  let many = farm;
  for (let i = 1; i <= 10; i++) many = advance(many, (i * 100 / SPEED) * 1000, never);
  const whole = advance(farm, (1000 / SPEED) * 1000, never);
  for (let at = 0; at < many.plots.length; at++) {
    assert.ok(Math.abs(many.plots[at].grown - whole.plots[at].grown) < 0.001,
      'chia nhỏ quãng thời gian không được đổi kết quả');
  }
});

test('đồng hồ không chạy ngược khi máy đổi giờ', () => {
  const farm = newFarm(1000);
  const back = advance(farm, 500, never);
  assert.ok(back.plots.every((plot, at) => plot.grown === farm.plots[at].grown));
  // Và lần sau vẫn tính đúng từ mốc mới.
  const forward = advance(back, 500 + (1000 / SPEED) * 1000, never);
  assert.ok(forward.plots[1].grown > 0);
});

// ---- tiệm hạt ----------------------------------------------------------------------------------

test('tiệm hạt chỉ bán cây đã đủ cấp', () => {
  const level0 = seedsFor(0);
  assert.ok(level0.length >= 2);
  assert.ok(level0.every((crop) => crop.level === 0));

  const level10 = seedsFor(expFor(10));
  assert.ok(level10.length > level0.length, 'lên cấp thì mở thêm hạt');
  assert.ok(level10.some((crop) => crop.id === 1), 'cấp 10 mở được dâu tây');
  assert.ok(level10.every((crop) => crop.level <= 10), 'không bán cây trên cấp mình');
});

test('trồng rồi bán phải có lãi, ở mọi cây trong bảng', () => {
  // Đây là bài kiểm quan trọng nhất của cả nông trại: một cây trồng ra rồi bán mà lỗ là một cái
  // bẫy, và một cái bẫy trong một trò chơi về làm ăn thì không phải luật chơi, là lỗi.
  for (const crop of CROPS) {
    const gross = crop.yield * crop.picks * crop.sell;
    assert.ok(gross > crop.seed,
      `${crop.name}: bán được ${gross}, hạt đã ${crop.seed} — trồng lỗ`);
  }
});

test('một vụ mùa phải trả nhiều hơn đi hái trộm', () => {
  // Nếu hái trộm ngon hơn trồng thì cả trò chơi chỉ có một chiến thuật, và nó không phải chiến
  // thuật của một trò chơi nông trại.
  const radish = cropById(2);
  const honest = radish.yield * radish.sell - radish.seed;
  assert.ok(honest > 0);
  // Một lần hái trộm nhiều nhất là năm quả, và chỉ được một lần trên mỗi thửa mỗi vụ.
  const best = 5 * radish.sell;
  assert.ok(honest >= best * 0.8, `trồng lãi ${honest}, hái trộm được ${best} — trộm ngon quá`);
});

test('bảng số dùng được: không có cây nào trùng tên hay trùng id', () => {
  const ids = new Set(CROPS.map((crop) => crop.id));
  assert.equal(ids.size, CROPS.length);
  const names = new Set(CROPS.map((crop) => crop.name));
  assert.equal(names.size, CROPS.length, 'hai cây trùng tên là hai cây người chơi không phân biệt được');
  const animalIds = new Set(ANIMALS.map((animal) => animal.id));
  assert.equal(animalIds.size, ANIMALS.length);
  const animalNames = new Set(ANIMALS.map((animal) => animal.name));
  assert.equal(animalNames.size, ANIMALS.length);
});
