/**
 * Bãi chăn: con vật lớn lên bằng cỏ trong máng, không phải bằng một cái đồng hồ riêng của nó.
 *
 * Thuần và không biết gì về mạng. Cùng lý do như `farm.mjs`: một luật kiểm được bằng một phép gọi
 * hàm là một luật kiểm được.
 *
 * **Đây là chỗ QFarm thật sự khác mọi trò nuôi thú khác, và nó đáng chép.** Trong phần lớn trò
 * chơi kiểu này, mỗi con vật có một cái đồng hồ riêng và một bữa ăn; cho ăn là bấm một nút, và
 * bấm nút ấy chỉ để tắt một biểu tượng đang nhấp nháy. Ở QFarm thì **cỏ là thời gian**: máng giữ
 * một số bó cỏ, mỗi con ăn một số bó mỗi bốn giờ, và cái máng ấy quyết định cả bãi chăn lớn nhanh
 * được bao nhiêu. Một cái máng đầy nuôi sáu con chạy đúng tốc độ; một cái máng cạn thì cả bãi
 * đứng im — và **không con nào chết**. Đó là toàn bộ sự khác nhau giữa một trò chơi người ta dám
 * rời đi và một trò chơi bắt người ta quay lại.
 *
 * Hệ quả là một quyết định thật, và nó là quyết định hay nhất trong trò chơi này: **trồng cỏ hay
 * mua cỏ**. Cỏ trồng tốn một thửa đất và 80 đồng cho 25 bó, tức 3,2 đồng một bó; cỏ mua là 60
 * đồng một bó. Nên một nông trại nuôi nhiều phải dành đất cho cỏ, và dành bao nhiêu là tuỳ nó nuôi
 * bao nhiêu — một câu hỏi không có đáp án đúng, chỉ có đáp án của từng người. QFarm cũng cho ăn hộ
 * hàng xóm và trả công bằng kinh nghiệm; ở đây giữ nguyên, vì nó là thứ biến bãi chăn của người
 * khác thành chỗ ghé qua chứ không phải chỗ nhìn trộm.
 */
import { randomInt } from 'node:crypto';
import { ANIMALS, animalById, HOUSES, GRASS } from './animals.mjs';

const SPREAD = 2 ** 47;
const chance = () => randomInt(0, SPREAD) / SPREAD;

/// Bãi chăn chạy nhanh bằng nông trại. Một biến, không phải hai — một con bò và một củ cải trong
/// cùng một khung hình phải lớn theo cùng một nhịp, nếu không thì cái khung ấy nói dối.
export const SPEED = Number(process.env.FARM_SPEED ?? 20);

/// Bao nhiêu giờ thì một con ăn hết `eats` bó cỏ.
export const HOURS_PER_FEED = GRASS.perHours;

/// Cho ăn một lần được ngần này bó.
export const MAX_FEED = 100;

/// Nuôi hộ hàng xóm được ngần này kinh nghiệm cho mỗi mười bó cỏ.
///
/// Của QFarm: `addExp = floor(foodnum / 10)` (`cgi_feed_food.php`). Một phần mười, và đó là một
/// con số được chọn đúng: đủ để người ta ghé qua cho ăn hộ, không đủ để biến việc ấy thành cách
/// kiếm kinh nghiệm nhanh nhất trong trò chơi.
export const HELP_EXP_PER_TEN = 1;

/// Bắt sản phẩm trên bãi chăn của người khác — chỉ được lấy khi con vật đã cho ra **hơn một nửa**
/// sản lượng của nó.
///
/// Ngưỡng ấy là của QFarm (`cgi_steal_product.php`: `output/2 < totalCome`), và nó là một ngưỡng
/// hay: nó buộc người lấy trộm phải để yên cho con vật làm việc, tức là người chăm chỉ không bao
/// giờ mất sạch. Và mỗi con chỉ bị lấy **một đơn vị một lần**, người lấy được ghi vào con vật ấy —
/// nên mười người ghé qua không vét được một con bò.
export const STEAL_SHARE = 0.5;

/// Người đi lấy trộm sản phẩm phải có ngần này trong túi.
export const STEAL_MIN_COIN = 500;

/// Chuột phá bãi chăn: xuất hiện với ngần này xác suất mỗi lần bãi chăn chạy, và bắt được thì
/// được ngần này đồng.
///
/// Của QFarm (`bad_mc.php` gieo 21% mỗi hai mươi giây, và `cgi_fight.php` trả
/// `mt_rand(50,100)`). Ở đây thành một con chuột trên cả bãi chứ không phải một con trên mỗi con
/// vật, vì "con chuột nào đang ở chuồng nào" là một câu hỏi mà cái khung widget không trả lời được
/// bằng một hình vẽ.
export const MOUSE_CHANCE = 0.18;
export const MOUSE_COIN = [50, 100];
export const MOUSE_HIT = 0.5;

// ---- một con vật ------------------------------------------------------------------------------

/// Một chuồng trống.
export function emptyPen() {
  return {
    animal: 0,
    // Số giây **trong trò chơi** con này đã sống. Đây là thứ duy nhất quyết định nó là con non,
    // con đang lớn, hay con đã hết đời.
    grown: 0,
    // Sản phẩm đang đứng chờ bắt.
    ready: 0,
    // Mốc đồng hồ trò chơi lúc nó cho ra phần sản phẩm gần nhất, hoặc `null` khi còn chưa lớn
    // xong. `null` chứ không phải 0: đồng hồ trò chơi **bắt đầu từ 0**, nên 0 là một mốc hợp lệ
    // và dùng nó làm dấu "chưa có" thì con vật đầu tiên trong nông trại đầu tiên sẽ đẻ sai.
    droppedAt: null,
    // Ai đã lấy trộm con này một lần rồi.
    raided: {},
  };
}

/// Một con vật đã ở trong chuồng.
export function penOf(animalId, { grown = 0, ready = 0 } = {}) {
  return { ...emptyPen(), animal: animalId, grown, ready };
}

/// Toàn bộ bãi chăn lúc mới mở.
///
/// **Không** bắt đầu bằng hai con thỏ như QFarm — `user_init.php` đặt hai con thỏ vào chuồng, một
/// con đã lớn gần xong, vì bản gốc có sẵn một bài hướng dẫn đi kèm. Ở đây một cái chuồng có sẵn
/// hai con vật mà người chơi chưa từng mua đọc là "có người đã chơi hộ mình", không đọc là "mình
/// được cho hai con thỏ". Nên: chuồng có sẵn hai chỗ, **một con gà đang đứng ở chỗ đầu** — con rẻ
/// nhất, cấp 0 — để cái bãi chăn không phải một cái chuồng rỗng trong lần đầu mở ra.
export function newRanch(now) {
  const pens = Array.from({ length: HOUSES.nest.start }, emptyPen);
  pens[0] = penOf(1001);
  return {
    pens,
    // Máng: bao nhiêu bó cỏ.
    hopper: 20,
    // **Đồng hồ trò chơi**: tổng số giây cây cỏ và con vật đã sống. Một con số cho cả nông trại,
    // không phải một mốc thời gian cho mỗi con — xem `graze()`.
    clock: 0,
    // Nhịp thật lần cuối đồng hồ ấy được quay.
    at: now,
    // Con chuột đang phá, nếu có.
    mouse: false,
    nests: HOUSES.nest.start,
    sheds: HOUSES.shed.start,
    exp: 0,
  };
}

/// Số chỗ đang có, cả hai loại.
export const penCount = (ranch) => ranch.nests + ranch.sheds;

/// Loại chuồng của chỗ thứ `index`. Nửa đầu là chuồng, phần còn lại là bãi.
export const houseAt = (ranch, index) => (index < ranch.nests ? 'nest' : 'shed');

/// Bãi chăn có nuôi được con này không: còn chỗ trống, và đúng loại chuồng.
export function roomFor(ranch, animal) {
  if (!animal) return { ok: false, why: 'Không có con vật ấy.' };
  const empty = ranch.pens
    .map((pen, index) => ({ pen, index }))
    .filter(({ pen }) => !pen.animal);
  if (empty.length === 0) return { ok: false, why: 'Bãi chăn đã đầy.' };
  if (empty.some(({ index }) => houseAt(ranch, index) === animal.house)) return { ok: true };
  return {
    ok: false,
    why: animal.house === 'shed' ? 'Hết chỗ ở bãi, phải mở thêm bãi.' : 'Hết chỗ ở chuồng, phải mở thêm chuồng.',
  };
}

/// Chỗ trống đầu tiên nuôi được con này.
export function penFor(ranch, animal) {
  const index = ranch.pens.findIndex((pen, at) => !pen.animal && houseAt(ranch, at) === animal.house);
  return index === -1 ? null : index;
}

// ---- thời gian và cỏ ----------------------------------------------------------------------------

/// Một con vật ăn bao nhiêu bó cỏ trong một giây trò chơi.
export const appetite = (animal) => (animal ? animal.eats / (HOURS_PER_FEED * 3600) : 0);

/// Cả bãi chăn ăn bao nhiêu bó mỗi giây trò chơi.
export const bite = (ranch) =>
  ranch.pens.reduce((sum, pen) => sum + (pen.animal ? appetite(animalById(pen.animal)) : 0), 0);

/// Máng còn chạy được bao nhiêu giây trò chơi nữa.
export function hopperLasts(ranch) {
  const per = bite(ranch);
  return per <= 0 ? Infinity : ranch.hopper / per;
}

/// Một con vật có đang đói không — tức là bãi chăn đã đứng im vì hết cỏ.
export const hungry = (ranch) => ranch.hopper < 0.5 && ranch.pens.some((pen) => pen.animal);

/**
 * Cho cả bãi chăn chạy tới hiện tại.
 *
 * Đây là cả phần lõi của bãi chăn, trong hai mươi dòng. Cỏ trong máng là một **ngân sách thời
 * gian**: cộng sức ăn của mọi con đang sống lại, chia số cỏ cho nó, ra số giây trò chơi bãi chăn
 * còn chạy được. Nếu quãng đường từ lần tính trước tới giờ ngắn hơn thế thì mọi con lớn đúng bằng
 * quãng ấy; dài hơn thì chúng chỉ lớn được tới lúc cỏ cạn, và từ đó đứng im.
 *
 * Cái hay của cách này là nó **không cần một vòng lặp nào**. Không hàm hẹn giờ, không hàng đợi,
 * không trạng thái nào phải sống trong bộ nhớ của tiến trình: đóng bot lại, mở lại ba ngày sau, và
 * cái máng vẫn trả lời đúng — vì toàn bộ trạng thái nằm trong ba con số: số cỏ, đồng hồ trò chơi,
 * và nhịp thật lần cuối nó được quay.
 *
 * Sản phẩm cũng tính từ đồng hồ ấy, và chỉ tính **sau khi con vật lớn xong**: một con gà chưa lớn
 * thì chưa đẻ, dù đồng hồ có chạy bao lâu. Và nó đẻ tối đa `yield` phần, vì một con vật không phải
 * một cái máy in — không có trần thì một cái máng đầy trong một tuần là một cái kho vô hạn.
 */
export function graze(ranch, now) {
  // `??`, không phải `||` — cùng cái bẫy như bên `farm.advance()`: nhịp thật 0 là một giá trị hợp
  // lệ, và coi nó là "chưa có" thì lần chạy đầu tiên không tính được gì cả.
  const elapsed = Math.max(0, now - (ranch.at ?? now));
  const live = ranch.pens.filter((pen) => pen.animal);
  if (elapsed === 0 || live.length === 0) return { ...ranch, at: now };

  const per = bite(ranch);
  const wanted = (elapsed / 1000) * SPEED;
  const affordable = per > 0 ? ranch.hopper / per : 0;
  const granted = Math.max(0, Math.min(wanted, affordable));
  const eaten = granted * per;
  const clock = ranch.clock + granted;

  const pens = ranch.pens.map((pen) => {
    if (!pen.animal) return pen;
    const animal = animalById(pen.animal);
    const grown = Math.min(animal.life, pen.grown + granted);

    // Đẻ: mốc đầu tiên là lúc lớn xong, sau đó mỗi `produce` giây trò chơi một phần.
    let { ready, droppedAt } = pen;
    if (clock >= animal.grow) {
      // Phần đầu tiên đến đúng lúc con vật lớn xong, nên mốc khởi đầu là **một nhịp trước** lúc
      // ấy: một con gà vừa lớn xong mà chưa có gì trong chuồng thì người chơi vừa bỏ tiền mua nó
      // và bắt gặp một cái chuồng rỗng.
      if (droppedAt === null || droppedAt === undefined) droppedAt = animal.grow - animal.produce;
      const made = Math.floor((clock - droppedAt) / animal.produce);
      if (made > 0) {
        ready = Math.min(animal.yield, ready + made);
        droppedAt += made * animal.produce;
      }
    }
    return { ...pen, grown, ready, droppedAt };
  });

  return {
    ...ranch,
    pens,
    clock,
    hopper: Math.max(0, ranch.hopper - eaten),
    at: now,
    // Chuột chỉ xuất hiện khi bãi chăn vừa thật sự chạy được. Một con chuột trong một bãi chăn bỏ
    // hoang vì hết cỏ là một con chuột không ai gặp, và một lời nhắc không ai gặp là một lời nhắc
    // dạy người ta bỏ qua lời nhắc.
    mouse: ranch.mouse || (eaten > 0 && chance() < MOUSE_CHANCE),
  };
}

// ---- việc làm trên bãi chăn ---------------------------------------------------------------------

/// Đổ cỏ vào máng. `bales` bó, lấy từ túi hoặc mua — chỗ gọi quyết định, hàm này chỉ nói được bao
/// nhiêu.
export function feed(ranch, bales) {
  const want = Math.floor(Number(bales));
  if (!(want > 0)) return { ok: false, why: 'Số cỏ phải lớn hơn không.' };
  if (want > MAX_FEED) return { ok: false, why: `Một lần cho ăn nhiều nhất ${MAX_FEED} bó.` };
  const room = GRASS.hopper - ranch.hopper;
  if (room < 1) return { ok: false, why: 'Máng đã đầy.' };
  const poured = Math.min(want, room);
  return { ok: true, bales: poured, leftOver: want - poured };
}

/// Mua một con vật. Trả về giá để chỗ gọi trừ tiền.
export function buy(ranch, animalId, coin) {
  const animal = animalById(animalId);
  if (!animal) return { ok: false, why: 'Không có con vật ấy.' };
  const room = roomFor(ranch, animal);
  if (!room.ok) return room;
  if (coin < animal.price) {
    return { ok: false, why: `Con này giá ${animal.price.toLocaleString('vi-VN')} đồng.` };
  }
  return { ok: true, price: animal.price, animal, index: penFor(ranch, animal) };
}

/// Bắt sản phẩm của chính mình.
export function collect(ranch, index) {
  const pen = ranch.pens[index];
  if (!pen?.animal) return { ok: false, why: 'Chuồng này trống.' };
  if (pen.ready < 1) return { ok: false, why: 'Con này chưa cho ra gì.' };
  const animal = animalById(pen.animal);
  return { ok: true, amount: pen.ready, exp: animal.productExp * pen.ready, product: animal.product };
}

/// Giết thịt một con vật đã sống hết đời, rồi dọn chuồng.
export function butcher(ranch, index) {
  const pen = ranch.pens[index];
  if (!pen?.animal) return { ok: false, why: 'Chuồng này trống.' };
  const animal = animalById(pen.animal);
  // QFarm bắt bắt sạch sản phẩm trước: "请先收获副产品…" (`cgi_harvest_product.php`). Giữ nguyên —
  // một cú bấm vừa cho sản phẩm vừa cho thịt là một cú bấm trả hai lần.
  if (pen.ready > 0) return { ok: false, why: 'Phải bắt sản phẩm trước đã.' };
  if (pen.grown < animal.life) return { ok: false, why: 'Con này chưa sống hết đời.' };
  return { ok: true, exp: animal.beastExp, price: animal.beastPrice, beast: animal };
}

/// Lấy trộm sản phẩm trên bãi chăn của người khác.
export function raid(pen, thiefId, ownerId, { coin }) {
  if (!pen?.animal) return { ok: false, why: 'Chuồng này trống.' };
  const animal = animalById(pen.animal);
  if (thiefId === ownerId) return { ok: false, why: 'Đây là bãi chăn của bạn.' };
  if (coin < STEAL_MIN_COIN) return { ok: false, why: `Phải có ít nhất ${STEAL_MIN_COIN} đồng trong túi.` };
  if (pen.raided[thiefId]) return { ok: false, why: 'Bạn đã lấy trộm con này rồi.' };
  if (pen.ready <= animal.yield * STEAL_SHARE) return { ok: false, why: 'Con này chưa cho ra đủ để lấy.' };
  return { ok: true, amount: 1, product: animal.product };
}

/// Bắt con chuột đang phá bãi chăn.
export function catchMouse(ranch, random = chance) {
  if (!ranch.mouse) return { ok: false, why: 'Bãi chăn không có chuột.' };
  const hit = random() < MOUSE_HIT;
  const [low, high] = MOUSE_COIN;
  return { ok: true, hit, coin: hit ? low + Math.floor(random() * (high - low + 1)) : 0 };
}

/// Mở thêm một chỗ, loại nào cũng được.
export function openHouse(ranch, kind) {
  const house = HOUSES[kind];
  if (!house) return { ok: false, why: 'Không có loại chuồng ấy.' };
  const have = kind === 'nest' ? ranch.nests : ranch.sheds;
  if (have >= house.max) return { ok: false, why: `Đã mở hết ${house.max} chỗ.` };
  return { ok: true, cost: house.costs[have] ?? house.costs.at(-1), kind };
}

/// Một bãi chăn đang chờ việc gì — cùng vai trò như `chores()` bên nông trại.
export function chores(ranch) {
  let collected = 0;
  let finished = 0;
  for (const pen of ranch.pens) {
    if (!pen.animal) continue;
    const animal = animalById(pen.animal);
    if (pen.ready > 0) collected++;
    if (pen.grown >= animal.life && pen.ready === 0) finished++;
  }
  const mouse = ranch.mouse ? 1 : 0;
  return {
    collected, finished, mouse, hungry: hungry(ranch),
    total: collected + finished + mouse,
  };
}

export { ANIMALS, animalById, HOUSES, GRASS };
