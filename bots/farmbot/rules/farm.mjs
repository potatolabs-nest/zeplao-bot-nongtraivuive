/**
 * Thửa đất, cây, và những gì xảy ra với chúng theo thời gian.
 *
 * Thuần và không biết gì về mạng: đưa vào một nông trại và một con số thời gian, trả về một
 * nông trại. Đó là lý do nó nằm ngoài `farmbot.mjs` — một luật kiểm được bằng một phép gọi hàm là
 * một luật kiểm được, còn một luật chỉ kiểm được qua một cái khung đang mở trên điện thoại ai đó
 * thì không.
 *
 * Bản gốc của những luật này là **QFarm 7.0** (bản Trung Quốc của "Happy Farm"), và mọi con số ở
 * đây đều là số của nó — xem `catalogue.mjs`. Ba chỗ cố ý làm khác, và cả ba đều được ghi rõ ngay
 * tại chỗ: `SPEED`, cách tính sản lượng khi có cỏ dại, và chuyện cây lâu năm phải lớn lại.
 */
import { randomInt } from 'node:crypto';
import {
  CROPS, cropById, LAND, RED_LAND, MAX_PLOTS, RED_BONUS,
} from './catalogue.mjs';

/**
 * Trò chơi chạy nhanh hơn QFarm ngần này lần.
 *
 * **Đây là chỗ duy nhất trong file này mà một con số không phải của QFarm.** Và nó là con số phải
 * chọn, không phải con số phải chép.
 *
 * QFarm để cây cải củ mất mười tiếng và cây vải mất bảy mươi bảy. Nó làm được như thế vì nó là
 * một trò chơi người ta mở **hai lần một ngày**: trồng buổi sáng, hái buổi tối, và mười triệu
 * người chơi cùng lúc không ai thấy số mười tiếng ấy. Một cái khung widget trong một nhóm chat thì
 * khác: người ta mở nó ra, nhìn thấy một cái cây, và cái cây ấy phải nói được điều gì đó trong
 * vòng vài phút, nếu không thì lần sau họ mở là để làm việc khác.
 *
 * Hai mươi lần đặt cây ngắn nhất ở **ba mươi phút** và cây dài nhất ở **bốn tiếng**. Đủ ngắn để
 * một người ngồi xem một cái cây lớn, đủ dài để rời đi rồi quay lại thì nó vẫn còn là một cái
 * cây. Nhanh hơn nữa thì nông trại thành một cái máy đếm; chậm hơn nữa thì không ai từng thấy
 * một vụ mùa nào.
 *
 * Đổi được bằng `FARM_SPEED`, và **mọi con số của QFarm vẫn nằm nguyên trong `catalogue.mjs`** —
 * phép chia xảy ra đúng một lần, ở `growthOf()` dưới đây. Nên ai muốn bản chậm thật thì đặt biến
 * ấy về 1 và không phải sửa một dòng luật nào.
 */
export const SPEED = Number(process.env.FARM_SPEED ?? 20);

/// Bao nhiêu giây trò chơi trôi qua giữa hai lần nhìn, tính từ một khoảng thật. Một bước bên
/// trong `advance()`, không phải một luật — nên nó không được xuất ra cho ai gọi.
const elapsedFor = (ms) => Math.max(0, (ms / 1000) * SPEED);

/**
 * Một con số trong [0, 1) lấy từ hệ điều hành, không phải từ V8.
 *
 * Cùng lý do như bên bot bài: `Math.random` là xorshift128+, và trạng thái của nó khôi phục được
 * từ chính đầu ra. Ở đây cỏ dại, sâu bọ và chó cắn đều là tiền — chó cắn thì mất thật — nên cái
 * nguồn ấy phải là cái nguồn không đoán trước được, trong một kho mã ai cũng đọc được.
 */
const SPREAD = 2 ** 47;
export const chance = () => randomInt(0, SPREAD) / SPREAD;

// ---- những con số của luật -------------------------------------------------------------------

/// Trồng một cây được ngần này kinh nghiệm. Của QFarm
/// (`farmlandstatus_planting.php`: `exp=exp+2`).
export const PLANT_EXP = 2;

/// Tưới, nhổ cỏ, bắt sâu: mỗi việc +2 đồng và +2 kinh nghiệm — cho **người làm**, kể cả khi làm
/// trên nông trại của người khác. Cũng là số của QFarm, và nó là toàn bộ phần thưởng của việc đi
/// thăm hàng xóm: hai đồng là con số nhỏ đến mức vô nghĩa, và đó chính là chủ ý — thứ người ta
/// nhận được ở đây là kinh nghiệm và là chuyện mình đã ghé qua.
export const HELP_COIN = 2;
export const HELP_EXP = 2;

/// Mỗi cây cỏ dại hay con sâu còn đứng lúc hái thì mất ngần này phần trăm sản lượng, và mất
/// nhiều nhất là một nửa. QFarm cộng dồn theo thời gian từng hành động (`farmlandstatus_getoutput.php`)
/// và chặn ở 50%; ở đây đếm thẳng số thứ đang đứng, chặn cùng chỗ ấy.
///
/// Cùng một trần, một luật dễ nói hơn: **một thứ đang đứng là một phần mười vụ mùa.** Nhìn vào
/// thửa đất là biết mình sắp mất bao nhiêu, mà không phải tra xem con sâu ấy đã ở đó từ bao giờ.
export const WEED_PENALTY = 0.1;
export const WEED_PENALTY_CAP = 0.5;

/// Cỏ dại và sâu bọ xuất hiện với ngần này xác suất mỗi giai đoạn, và khô hạn với ngần này.
///
/// QFarm gieo mỗi tiếng một lần với 21% cơ hội (`user_run.php` gọi `bad_nc.php`), rồi trong đó
/// chia tiếp thành cỏ / sâu / hạn. Ở đây gieo theo **giai đoạn** chứ không theo đồng hồ, vì giai
/// đoạn mới là thứ người chơi nhìn thấy: một thửa đất đổi hình là lúc nó có thể mọc cỏ, và nhờ
/// vậy không có chuyện cỏ mọc hai lần trong cùng một giai đoạn mà người chơi không kịp thấy.
export const WEED_CHANCE = 0.30;
export const PEST_CHANCE = 0.20;
export const DROUGHT_CHANCE = 0.25;

/// Muốn đi hái trộm thì trong túi phải có ngần này, và mình phải đang trồng cái gì đó.
///
/// Hai điều kiện, cả hai đều của QFarm (`farmlandstatus_scrounge.php`): "您身上少300金币不能摘取"
/// và "您都没种菜，就想来摘取". Một cái chặn người vừa mở tài khoản đi vét sạch cả làng, một cái
/// chặn kẻ chỉ sống bằng nghề trộm — và cái thứ hai mới là cái quan trọng, vì nó biến hành vi ấy
/// thành một việc người trồng cây làm với nhau.
export const STEAL_MIN_COIN = 300;

/// Hái trộm được lấy từ phần **trên** mức sàn này, không bao giờ lấn vào dưới.
///
/// `l = floor(k * 0.6)` của QFarm: chủ ruộng luôn giữ được sáu phần mười, dù có bao nhiêu người
/// ghé qua. Nếu không có con số này thì một người đi ngủ là mất cả vụ mùa, và cả trò chơi chỉ còn
/// đúng một chiến thuật: canh me lúc người khác vắng mặt.
export const STEAL_FLOOR = 0.6;

/// Chó nhà ai mà có ăn thì cắn được ngần này phần trăm số lần có người lén vào, và mỗi lần cắn
/// phạt ngần này đồng — tiền phạt về tay chủ nhà.
///
/// Của QFarm: `mt_rand(1,10) > 10-2` cho chó thường, tức 20%; chó xịn (chỉ số > 1) là 40%.
/// `farmlandstatus_scrounge.php` phạt `mt_rand(40,80)`.
export const DOG_CHANCE = 0.20;
export const DOG_FINE_MIN = 40;
export const DOG_FINE_MAX = 80;

/// Một thửa đất muốn lên đất đỏ thì cả nông trại phải có ngần này thửa trước đã.
export const RED_LAND_MIN_PLOTS = 12;

/// Bán ở chợ được đúng giá `sale` của cây, không hơn không kém.
///
/// QFarm cho bán đúng giá ấy (`repertory_sale.php`) và mua hạt đúng giá `price`. Không có biên
/// độ ở đây vì không cần có: cái làm cho nông trại này có lãi là **thời gian**, không phải chênh
/// lệch giá. Ai bán rẻ hơn giá trị thì chỉ tự làm mình nghèo đi, mà người mua thì không mua được
/// của ai ngoài chợ — nên một cái chợ có giá do người chơi đặt chỉ thêm một chỗ để hai người cùng
/// một nhà chuyển tiền cho nhau.
export const sellPriceOf = (crop) => crop.sell;
export const seedPriceOf = (crop) => crop.seed;

// ---- cấp và kinh nghiệm ----------------------------------------------------------------------

/**
 * Cấp của một số kinh nghiệm — **đúng công thức của QFarm**:
 *
 *   qf_toLevel($exp) = floor(sqrt(($exp + 25) / 100) - 0.5)
 *
 * Nghịch đảo của nó là `exp để tới cấp L = 100·L·(L+1)`: cấp 1 ở 200, cấp 2 ở 600, cấp 10 ở
 * 11.000, cấp 30 ở 93.000. Đây không phải một đường cong được chọn cho đẹp — nó là đường cong
 * của bản gốc, và nó có một tính chất đáng giữ: **cấp càng cao thì mỗi cấp càng xa**, nên một
 * người chơi lâu năm không thể bị người mới đuổi kịp trong một buổi tối.
 */
export const levelOf = (exp) => Math.floor(Math.sqrt((exp + 25) / 100) - 0.5);

/// Kinh nghiệm cần để tới một cấp.
export const expFor = (level) => 100 * level * (level + 1);

/// Cấp kế tiếp, và còn bao xa.
export function progressTo(exp) {
  const level = levelOf(exp);
  const next = expFor(level + 1);
  const from = expFor(level);
  return { level, next, need: next - exp, span: next - from, into: exp - from };
}

// ---- cây mọc ---------------------------------------------------------------------------------

/// Mốc của từng giai đoạn, bằng giây trong trò chơi.
export const marksOf = (crop) => crop.stages.map((fraction) => fraction * crop.cycle);

/**
 * Cây đang ở giai đoạn nào, theo số giây đã lớn.
 *
 * 0 là đất trống, 1–5 là đang lớn, **6 là chín**, 7 là cây đã hết đời và phải dọn. Số hiệu giống
 * QFarm (`cropStatus`), để ai đọc lại bản gốc còn nhận ra.
 */
export function stageOf(crop, grown) {
  if (grown >= crop.cycle) return 6;
  const marks = marksOf(crop);
  let stage = 1;
  for (const mark of marks) if (grown >= mark) stage++;
  // Năm mốc thì nhiều nhất là sáu, mà sáu là chín — nên mốc cuối cùng (bằng đúng một vòng) không
  // bao giờ đẩy cây lên bảy. QFarm cũng vậy: `cropstime[cid][4]` bằng `growthCycle`, nên nó
  // không phải một mốc nữa mà là chính cái đích.
  return Math.min(stage, 6);
}

/// Cây lâu năm, sau khi hái, lớn lại từ mốc thứ ba.
///
/// **Khác QFarm, và khác có chủ ý.** Bản gốc đặt `b = 6` ngay sau mỗi lần hái
/// (`farmlandstatus_harvest.php`), tức là cây chín lại tức thì và hái được liên tục không chờ
/// gì — cái `q = now - cropstime[2]` nằm ngay cạnh đó cho thấy ý định là *lớn lại từ mốc thứ ba*,
/// nhưng dòng đặt `b = 6` chạy trước và nuốt mất ý định ấy. Ở đây làm theo ý định: hái xong thì
/// cây quay về mốc thứ ba và phải lớn nốt quãng cuối mới chín lần nữa.
export function regrowthMark(crop) {
  return marksOf(crop)[2] ?? crop.cycle * 0.55;
}

/**
 * Một thửa đất trống.
 *
 * Tên các trường được viết ra thành chữ, không phải một chữ cái như QFarm (`a`, `b`, `c`…) — một
 * thửa đất là thứ người ta sẽ đọc lại sau ba tháng, và `{a:1,b:6,f:2}` thì ba tháng nữa không ai
 * đọc được, kể cả người viết ra nó. Bảng đối chiếu, cho ai cần:
 *
 *   crop↔a · stage↔b · picks↔j · weeds↔f · pests↔g · dry↔(h==0) · grown↔(now-q)
 *   yieldLeft↔m · floor↔l · thieves↔n · red↔(bitmap==1) · sownBy↔(weed/pest chủ)
 */
export function emptyPlot() {
  return {
    crop: 0,
    stage: 0,
    picks: 0,
    weeds: 0,
    pests: 0,
    dry: false,
    grown: 0,
    yieldLeft: 0,
    floor: 0,
    thieves: {},
    sownBy: {},
    red: false,
  };
}

/// Một thửa đã có cây trong đó, với cỏ và sâu cụ thể. Dùng để dựng nông trại lúc mới vào, và
/// trong bộ thử.
///
/// Sản lượng chín được tính **ngay ở đây** nếu thửa ấy đã chín, vì đó là toàn bộ ý của việc chốt
/// sản lượng một lần: con số gắn với cây lúc nó chín, không phải lúc có người nhìn tới.
export function plotOf(cropId, { grown = 0, weeds = 0, pests = 0, dry = false, red = false } = {}) {
  const crop = cropById(cropId);
  if (!crop) return emptyPlot();
  const stage = stageOf(crop, grown);
  const plot = { ...emptyPlot(), crop: cropId, grown, stage, weeds, pests, dry, red };
  if (stage === 6) {
    plot.yieldLeft = harvestOf(plot, crop);
    plot.floor = Math.floor(plot.yieldLeft * STEAL_FLOOR);
  }
  return plot;
}

/**
 * Một nông trại mới, **đúng như QFarm dựng người chơi mới**.
 *
 * Sáu thửa, bốn thửa đầu đã trồng sẵn củ cải trắng ở bốn trạng thái khác nhau: một chín, một mọc
 * cỏ, một khô, một có sâu (`user_init.php`). Không phải để bắt chước cho vui — đó là **bài dạy
 * duy nhất mà trò chơi này cần**, và bản gốc đã đúng: bốn thửa cạnh nhau, mỗi thửa một tật, và
 * không cần một dòng chữ hướng dẫn nào để hiểu rằng cái ô có con sâu thì phải bắt.
 *
 * Túi tiền để **1.000** chứ không phải 0 như QFarm. Bản gốc cho 0 đồng và một thửa chín, tức là
 * người chơi đầu tiên phải hái rồi bán mới có tiền mua hạt — một bài dạy hay, nhưng nó nằm sau
 * hai lần bấm mà lần thứ nhất là bấm vào một con số ghi "0". Một cái ví rỗng trong một trò chơi
 * vừa mở ra đọc là "hỏng", không đọc là "nhiệm vụ".
 */
export function newFarm(now, displayName = '') {
  const plots = Array.from({ length: 6 }, emptyPlot);
  const radish = 2;
  const crop = cropById(radish);
  const cycle = crop.cycle;

  // Thửa 0: chín sẵn, sẵn sàng hái — cái ô dạy rằng hái ra tiền.
  plots[0] = plotOf(radish, { grown: cycle });
  // Thửa 1: mọc cỏ.
  plots[1] = plotOf(radish, { grown: cycle * 0.15, weeds: 1 });
  // Thửa 2: khô, tức là đứng im cho tới khi có người tưới.
  plots[2] = plotOf(radish, { grown: cycle * 0.15, dry: true });
  // Thửa 3: có sâu.
  plots[3] = plotOf(radish, { grown: cycle * 0.3, pests: 2 });
  // Thửa 4, 5: đất trống.

  return {
    name: displayName,
    exp: 0,
    coin: STARTING_COIN,
    plots,
    // Đồng hồ trò chơi của cả nông trại, cùng vai trò như `ranch.clock`.
    clock: 0,
    at: now,
    seeds: { [radish]: 3 },
    fruit: {},
    dog: null,
    heard: [],
    stolenAt: {},
    gave: 0,
    started: true,
  };
}

/// Tiền lúc mới vào. Xem `newFarm()` để biết vì sao không phải 0.
export const STARTING_COIN = 1_000;

/// Quà mỗi ngày, và phải bấm nhận — như bên bot bài, cùng lý do: một món quà tự động là một món
/// quà không ai biết mình vừa được cho.
export const DAILY_COIN = 5_000;

/**
 * Cho cả nông trại chạy tới hiện tại.
 *
 * Một đồng hồ cho cả nông trại, không phải một mốc thời gian cho mỗi thửa — và lý do không phải
 * tiết kiệm chỗ: **mười tám thửa đất cùng nghe một cái đồng hồ thì không thể lệch nhau.** Mỗi
 * thửa tự đếm lấy thì một lần bot khởi động lại giữa chừng, một lần đồng hồ máy đổi, hay một lần
 * ghi xuống đĩa hỏng đều để lại mười tám thửa lớn lệch nhau vài giây, và cái lệch ấy không bao
 * giờ tự liền lại. Cùng lý do ấy, đồng hồ của bãi chăn cũng là một (`ranch.clock`), và cả hai chạy
 * cùng nhịp.
 *
 * Bãi chăn chỉ chạy khi máng còn cỏ (`ranch.mjs`). Nông trại thì **chạy luôn**, trừ thửa đang khô —
 * nước là thứ duy nhất giữ được nó lại. Đó là một lựa chọn có chủ ý: cỏ là tiền người chơi bỏ ra
 * nên nó phải mua được cái gì; nước thì không mất gì cả, nên nếu khô cũng không sao thì việc tưới
 * không còn là việc gì.
 */
export function advance(farm, now, random = chance) {
  // `??`, không phải `||`. Đồng hồ trò chơi bắt đầu từ 0, nên `0 || now` biến "chưa từng chạy"
  // thành "vừa chạy xong" và cả nông trại đứng im trong lần đầu tiên nó được nhìn tới.
  const elapsed = Math.max(0, now - (farm.at ?? now));
  const granted = elapsedFor(elapsed);
  if (granted === 0) return { ...farm, at: now };

  return {
    ...farm,
    plots: farm.plots.map((plot) => grow(plot, granted, random)),
    clock: (farm.clock ?? 0) + granted,
    at: now,
  };
}

// ---- lớn lên ---------------------------------------------------------------------------------

/**
 * Một thửa đất lớn thêm `granted` giây trò chơi, rồi gieo cỏ và sâu nếu nó vừa sang giai đoạn mới.
 *
 * `random` là một tham số vì cùng lý do như bên bot bài: một bộ thử phải gieo được cái ngẫu nhiên,
 * nếu không thì nó chỉ kiểm được cái nhánh nào tình cờ chạy qua.
 *
 * Thứ tự ba việc ở đây quan trọng: **lớn trước, rồi mới gieo cỏ, rồi mới tính chín**. Gieo cỏ
 * trước thì một thửa vừa mới lớn xong đã có thể mọc cỏ ngay trong lần đầu tiên nó được nhìn tới,
 * và người chơi thấy một con sâu xuất hiện trên một cái cây chưa từng có hình ảnh nào khác.
 */
export function grow(plot, granted, random = chance, { sow = true } = {}) {
  const crop = cropById(plot.crop);
  if (!crop || plot.stage === 7 || plot.stage === 6) {
    // Chín thì đứng yên: một cây chín để lâu không thành quả thối, và đó là chủ ý — người ta đi
    // vắng một ngày thì phải còn cái để về hái, không phải về nhặt.
    return plot;
  }

  // Khô thì không lớn. Cả trò chơi có đúng một hình phạt, và nó là hình phạt này: không mất gì,
  // chỉ là đứng im — nên một người bỏ bê ba ngày vẫn về được, chỉ muộn ba ngày.
  const grew = plot.dry ? 0 : Math.min(granted, crop.cycle - plot.grown);
  const grown = plot.grown + grew;

  const wasStage = plot.stage;
  let stage = stageOf(crop, grown);
  // Cây lâu năm đã hái hết số lần thì tàn.
  if (plot.picks >= crop.picks && grown >= crop.cycle) stage = 7;

  const ripe = stage === 6;
  const next = {
    ...plot,
    grown,
    stage,
    // Chín thì chốt sản lượng **một lần**, tại đây, và từ đó con số ấy không đổi nữa. Nếu tính
    // lại mỗi lần nhìn thì một con sâu bò vào sau khi cây đã chín lại ăn mất phần của người đã
    // trồng nó xong — mà người ấy không làm gì sai cả.
    yieldLeft: ripe ? harvestOf({ ...plot, grown, stage }) : 0,
    floor: ripe ? Math.floor(harvestOf({ ...plot, grown, stage }) * STEAL_FLOOR) : 0,
  };

  if (!sow || plot.dry) return next;

  // Cỏ và sâu chỉ mọc khi cây vừa sang giai đoạn mới, và chỉ khi chỗ ấy còn trống.
  if (stage > wasStage && stage < 6) {
    if (next.weeds === 0 && random() < WEED_CHANCE) next.weeds = 1 + Math.floor(random() * 3);
    if (next.pests === 0 && random() < PEST_CHANCE) next.pests = 1 + Math.floor(random() * 3);
    if (!next.dry && random() < DROUGHT_CHANCE) next.dry = true;
  }
  return next;
}

/**
 * Một vụ mùa đáng bao nhiêu.
 *
 * `crop.yield` của QFarm, cộng 10% nếu thửa ấy là đất đỏ, trừ đi phần cỏ dại và sâu bọ đang đứng.
 * QFarm áp hệ số đất đỏ lúc cây chín và trừ phần cỏ theo thời gian từng hành động; ở đây cả hai
 * đều tính lúc chín, trong cùng một hàm, để con số người chơi nhìn thấy trên thửa đất **là** con
 * số họ nhận được — chứ không phải hai con số đúng bằng nhau ở hai chỗ khác nhau của một trang.
 */
export function harvestOf(plot, crop = cropById(plot.crop)) {
  if (!crop) return 0;
  const bonus = plot.red && !crop.red ? RED_BONUS : 1;
  const standing = (plot.weeds ?? 0) + (plot.pests ?? 0);
  const loss = Math.min(WEED_PENALTY_CAP, standing * WEED_PENALTY);
  return Math.max(1, Math.floor(crop.yield * bonus * (1 - loss)));
}

// ---- việc làm trên một thửa đất -----------------------------------------------------------------

/// Một việc làm được, và nó có hợp lệ không. Trả về `{ok}` hoặc `{ok:false, why}`.
///
/// Mọi lý do từ chối đều là **một câu nói được với người chơi**, không phải một mã lỗi. Nút bấm
/// trong khung widget cũng đọc đúng câu ấy để nói vì sao nó tối — một cái nút sáng rồi bấm không
/// ra gì tệ hơn một cái nút tối có ghi lý do.
const no = (why) => ({ ok: false, why });
const yes = (extra = {}) => ({ ok: true, ...extra });

/// Gieo hạt.
export function sow(plot, cropId, seeds, coin) {
  const crop = cropById(cropId);
  if (!crop) return no('Không có loại cây ấy.');
  if (plot.crop) return no(plot.stage === 7 ? 'Thửa này còn cây tàn, phải dọn trước.' : 'Thửa này đang có cây.');
  if (!(seeds[cropId] > 0)) return no(`Trong túi không còn hạt ${crop.name}.`);
  if (crop.red && !plot.red) return no(`${crop.name} chỉ trồng được trên đất đỏ.`);
  return yes();
}

/// Tưới nước. Ai cũng tưới được, kể cả trên ruộng người khác.
export function water(plot) {
  if (plot.stage === 7 || !plot.crop) return no('Thửa này không có gì để tưới.');
  if (!plot.dry) return no('Thửa này còn ẩm.');
  return yes();
}

/// Nhổ cỏ. Không nhổ được cỏ do chính mình gieo — luật chống phá của QFarm
/// (`farmlandstatus_clearweed.php`: "证据是不能毁灭的"), giữ nguyên vì nó chặn đúng một trò:
/// gieo cỏ lên ruộng người khác rồi nhổ để lấy kinh nghiệm.
export function weed(plot, byUserId) {
  if (!plot.crop) return no('Thửa này không có gì để nhổ cỏ.');
  if (plot.weeds < 1) return no('Thửa này không có cỏ.');
  if ((plot.sownBy[byUserId]?.weeds ?? 0) >= plot.weeds) return no('Cỏ này là do bạn gieo.');
  return yes();
}

/// Bắt sâu. Cùng luật chống phá như trên.
export function pest(plot, byUserId) {
  if (!plot.crop) return no('Thửa này không có gì để bắt sâu.');
  if (plot.pests < 1) return no('Thửa này không có sâu.');
  if ((plot.sownBy[byUserId]?.pests ?? 0) >= plot.pests) return no('Sâu này là do bạn thả.');
  return yes();
}

/// Gieo cỏ lên ruộng người khác, và thả sâu lên ruộng người khác.
///
/// **Có cái này thì luật chống phá ở trên mới có nghĩa.** QFarm cho hai việc ấy
/// (`farmlandstatus_scatterseed.php`, `farmlandstatus_pest.php`), và chúng là lý do `weed()` và
/// `pest()` phải từ chối cỏ do chính mình gieo: nếu không gieo được thì cũng chẳng có gì để mà
/// chống, và hai dòng ấy chỉ là hai dòng mã không ai chạm tới.
///
/// Chúng cũng là thứ duy nhất trong trò chơi này gây hại mà **không lấy được gì** — gieo cỏ lên
/// ruộng người khác không cho mình một đồng nào, nó chỉ làm vụ mùa của người kia bớt đi một phần
/// mười. Một trò chơi mà mọi hành vi xấu đều có lãi là một trò chơi dạy người ta làm việc xấu.
///
/// Nên hạn mức mỗi ngày là **50 lần**, đúng con số của QFarm (`cron/daily.php` đặt `badnum = 50`).
/// Và mỗi thửa chỉ đứng được ba thứ: quá ba thì không gieo thêm được nữa.
export const BAD_PER_DAY = 50;
export const BAD_MAX_PER_PLOT = 3;

/// Gieo cỏ lên một thửa của người khác.
export function sowWeeds(plot, byUserId, badLeft) {
  if (!plot.crop) return no('Thửa này trống.');
  if (plot.stage === 6) return no('Cây này đã chín, gieo cỏ lên cũng không kịp.');
  if (plot.weeds >= BAD_MAX_PER_PLOT) return { ok: false, why: 'Thửa này đã đầy cỏ.' };
  if (badLeft < 1) return { ok: false, why: `Hôm nay bạn đã phá ${BAD_PER_DAY} lần rồi.` };
  return yes({ weeds: 1 });
}

/// Thả sâu lên một thửa của người khác.
export function sowPests(plot, byUserId, badLeft) {
  if (!plot.crop) return no('Thửa này trống.');
  if (plot.stage === 6) return no('Cây này đã chín, thả sâu lên cũng không kịp.');
  if (plot.pests >= BAD_MAX_PER_PLOT) return { ok: false, why: 'Thửa này đã đầy sâu.' };
  if (badLeft < 1) return { ok: false, why: `Hôm nay bạn đã phá ${BAD_PER_DAY} lần rồi.` };
  return yes({ pests: 1 });
}

/// Ngày đã sang thì hạn mức phá và hạn mức làm hộ trở về đầy.
///
/// QFarm làm việc này bằng một cronjob (`cron/daily.php`). Ở đây không có cron: con bot chỉ có một
/// tiến trình và một file, nên hỏi "hôm nay là ngày nào" lúc đọc là cùng một việc, mà không có gì
/// phải chạy lúc nửa đêm và không có gì để quên chạy.
export function resetQuota(farm, today, { bad = BAD_PER_DAY, good = 150 } = {}) {
  if (farm.quotaDay === today) return farm;
  return { ...farm, quotaDay: today, badLeft: bad, goodLeft: good };
}

/// Hái. Trả về số quả, và kinh nghiệm.
export function harvest(plot) {
  if (!plot.crop) return no('Thửa này trống.');
  if (plot.stage === 7) return no('Cây này đã tàn, phải dọn đi.');
  if (plot.stage !== 6) return no('Cây chưa chín.');
  if (plot.yieldLeft < 1) return no('Thửa này đã bị hái hết.');
  return yes({ amount: plot.yieldLeft });
}

/// Hái một thửa: trả về thửa **sau khi hái**, số quả, và kinh nghiệm.
///
/// Cây một vụ thì hái xong là hết — về đất trống. Cây lâu năm thì cây ở lại và **lớn lại từ mốc
/// thứ ba** (xem `regrowthMark`), hái đủ số lần rồi mới tàn.
export function pick(plot) {
  const allowed = harvest(plot);
  if (!allowed.ok) return { ...allowed, plot };
  const crop = cropById(plot.crop);
  const picks = (plot.picks ?? 0) + 1;

  if (picks >= crop.picks) {
    // Hết số lần hái: cây tàn và phải dọn.
    return {
      ok: true,
      amount: allowed.amount,
      exp: crop.exp,
      plot: { ...plot, picks, stage: 7, yieldLeft: 0, floor: 0, grown: crop.cycle },
    };
  }

  const grown = regrowthMark(crop);
  return {
    ok: true,
    amount: allowed.amount,
    exp: crop.exp,
    plot: {
      ...plot,
      picks,
      grown,
      stage: stageOf(crop, grown),
      yieldLeft: 0,
      floor: 0,
      // Cỏ và sâu ở lại sau khi hái. Chúng không phải một phần của quả, mà là một phần của thửa.
      dry: false,
    },
  };
}

/// Dọn một thửa đã tàn, hoặc một thửa chín mà mình không muốn hái. Không mất gì.
export function clear(plot) {
  if (!plot.crop) return no('Thửa này trống.');
  if (plot.stage === 6) return no('Cây đang chín, hãy hái.');
  if (plot.stage !== 7) return no('Cây còn sống.');
  return yes();
}

// ---- hái trộm -----------------------------------------------------------------------------------

/**
 * Hái trộm được bao nhiêu, và có bị chó cắn không.
 *
 * Bốn điều kiện của QFarm, nguyên vẹn: trong túi phải có tiền, mình phải đang có cây, cây phải
 * chín và còn quả, và mình chưa từng hái trộm **thửa này trong vụ này**
 * (`farmlandstatus_scrounge.php`). Cái thứ tư là cái quan trọng nhất: một thửa bị hái trộm đúng
 * một lần một vụ, nên một nhóm mười người không biến thành một cái máy hút.
 *
 * Số quả lấy được theo đúng bảng của QFarm: 50% một quả, 20% hai, 10% ba, 15% bốn, 5% năm.
 */
export function steal(plot, thief, ownerId, { hasCrop, coin, hasDog }, random = chance) {
  if (!plot.crop) return { ok: false, why: 'Thửa này trống.' };
  if (plot.stage !== 6) return { ok: false, why: 'Cây chưa chín.' };
  if (!hasCrop) return no('Bạn chưa trồng cây nào thì đừng đi hái trộm.');
  if (coin < STEAL_MIN_COIN) return { ok: false, why: `Phải có ít nhất ${STEAL_MIN_COIN} đồng trong túi.` };
  if (plot.thieves[thief]) return { ok: false, why: 'Bạn đã hái trộm thửa này rồi.' };
  // Chủ ruộng không hái trộm ruộng mình, và cũng không "hái trộm" phần sàn của chính mình.
  if (thief === ownerId) return { ok: false, why: 'Đây là ruộng của bạn.' };

  const reachable = plot.yieldLeft - plot.floor;
  if (reachable < 1) return { ok: false, why: 'Chủ ruộng đã giữ lại phần của họ rồi.' };

  const roll = random();
  const wanted = roll <= 0.5 ? 1 : roll <= 0.7 ? 2 : roll <= 0.8 ? 3 : roll <= 0.95 ? 4 : 5;
  const amount = Math.min(wanted, reachable);
  if (amount < 1) return { ok: false, why: 'Không còn gì để hái.' };

  // Chó: chỉ cắn khi nhà ấy đang có chó ăn. Cắn thì mất tiền, về tay chủ nhà, và thửa đất được
  // ghi lại như đã bị ghé — nên lần sau quay lại thì không còn gì để thử nữa.
  if (hasDog && random() < DOG_CHANCE) {
    const fine = DOG_FINE_MIN + Math.floor(random() * (DOG_FINE_MAX - DOG_FINE_MIN + 1));
    return { ok: true, caught: true, fine, amount: 0 };
  }
  return { ok: true, caught: false, amount };
}

// ---- đất ---------------------------------------------------------------------------------------

/// Mở thêm một thửa, theo bảng giá của QFarm (`user_reclaim.php`).
///
/// Bản gốc gác việc này bằng cả cấp lẫn tiền, nhưng phép kiểm cấp ở đó so `exp` với một khoá tên
/// là `exp` mà bảng ấy không có — nên trên thực tế chỉ có tiền là có tác dụng. Ở đây gác bằng cả
/// hai, và **nói ra cái nào còn thiếu**: một cái gác hỏng trong bản gốc không phải lý do để viết
/// lại một cái gác hỏng.
export function openLand(farm) {
  const next = farm.plots.length;
  if (next >= MAX_PLOTS) return no(`Nông trại đã có đủ ${MAX_PLOTS} thửa.`);
  const price = LAND[next];
  if (levelOf(farm.exp) < price.level) return no(`Cần cấp ${price.level} mới khai được thửa này.`);
  if (farm.coin < price.cost) return no(`Khai thửa này cần ${price.cost.toLocaleString('vi-VN')} đồng.`);
  return yes({ cost: price.cost, level: price.level });
}

/// Lên đất đỏ cho một thửa — thêm 10% sản lượng, và mở khoá được mấy loại hạt chỉ mọc ở đó.
export function upgradeLand(farm, index) {
  const plot = farm.plots[index];
  if (!plot) return no('Không có thửa ấy.');
  if (plot.red) return no('Thửa này đã là đất đỏ.');
  if (farm.plots.length < RED_LAND_MIN_PLOTS) {
    return no(`Phải có ít nhất ${RED_LAND_MIN_PLOTS} thửa mới lên được đất đỏ.`);
  }
  const price = RED_LAND[index];
  if (!price) return no('Thửa này không lên đất đỏ được.');
  if (levelOf(farm.exp) < price.level) return no(`Cần cấp ${price.level} mới lên được đất đỏ.`);
  if (farm.coin < price.cost) return no(`Lên đất đỏ cần ${price.cost.toLocaleString('vi-VN')} đồng.`);
  return yes({ cost: price.cost, level: price.level });
}

// ---- đọc một nông trại --------------------------------------------------------------------------

/// Nông trại này có đang trồng gì không — điều kiện để được đi hái trộm.
export const isFarming = (farm) => farm.plots.some((plot) => plot.crop && plot.stage !== 7);

/// Những thửa hái được, ngay bây giờ.
export const ripePlots = (farm) =>
  farm.plots.map((plot, index) => ({ plot, index })).filter(({ plot }) => plot.stage === 6 && plot.yieldLeft > 0);

/// Bao nhiêu thứ đang chờ một cú bấm, trên cả nông trại: hái, tưới, nhổ cỏ, bắt sâu.
///
/// **Một con số, và nó ở trên mọi màn hình.** Nông trại này là một trò chơi người ta mở ra để
/// xem có gì cần làm không; nếu câu trả lời ấy phải tìm bằng cách quét mười tám ô đất thì phần
/// lớn những lần mở ra sẽ kết thúc bằng việc đóng lại. QFarm cũng có con số này — nó gọi là cái
/// biểu tượng trên đầu hàng xóm trong danh sách bạn bè.
export function chores(farm) {
  let harvest = 0, water = 0, weeds = 0, pests = 0, dead = 0;
  for (const plot of farm.plots) {
    if (!plot.crop) continue;
    if (plot.stage === 6 && plot.yieldLeft > 0) harvest++;
    else if (plot.stage === 7) dead++;
    else {
      if (plot.dry) water++;
      if (plot.weeds > 0) weeds++;
      if (plot.pests > 0) pests++;
    }
  }
  return { harvest, water, weeds, pests, dead, total: harvest + water + weeds + pests + dead };
}

/// Cây nào đang trồng được ở cấp này, xếp theo cấp — cái danh sách mà tiệm hạt đọc.
export function seedsFor(exp) {
  const level = levelOf(exp);
  return CROPS.filter((crop) => crop.level <= level);
}

export { CROPS, cropById, LAND, RED_LAND, MAX_PLOTS };
