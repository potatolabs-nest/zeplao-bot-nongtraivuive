/**
 * Nông trại, phần nói chuyện với ứng dụng.
 *
 *   ZEPLAO_BOT_TOKEN=... node bots/farmbot/farmbot.mjs
 *
 * Thêm bot vào một nhóm rồi gõ `/nongtrai`. Ai gõ thì được một khu vườn của riêng mình, mở ra
 * trong một khung nổi trong cuộc trò chuyện: sáu thửa đất, một túi hạt, và một con gà.
 *
 * **Cả trò chơi nằm trong file này và `rules/`.** Luật thì thuần — `rules/farm.mjs` và
 * `rules/ranch.mjs` không biết mạng là gì, và đó là lý do chúng kiểm được bằng một phép gọi hàm.
 * Phần ở đây chỉ còn ba việc: gọi API, giữ trạng thái, và đẩy ảnh chụp lên khung.
 *
 * Ba quyết định chịu lực, và cả ba đều ngược với trực giác:
 *
 * 1. **Một người một nông trại, không phải một phòng một nông trại.** Phiên widget thuộc về một
 *    cuộc trò chuyện, và `showSession` từ chối mở phiên cho người không ở trong cuộc trò chuyện ấy
 *    — đúng như vậy, nếu không thì bot nào cũng đẩy được màn hình của phòng lạ lên trước mặt bất
 *    kỳ ai. Nhưng nông trại là thứ một người **sở hữu**: nó phải theo họ từ nhóm này sang nhóm
 *    khác, chứ không phải biến mất khi họ đi làm việc ở chỗ khác. Nên phiên thuộc về **người**, và
 *    chỉ có bức ảnh của khu vườn là đi theo.
 *
 * 2. **Không ai nhận được trạng thái của người khác.** `pushState` không có `to` đi tới mọi người
 *    đang mở khung; có `to` thì đi tới một người. Một khu vườn là **của một người** — không có gì
 *    để cả phòng cùng nhìn. Nên mọi lần đẩy đều có `to`, và chuyện "vô tình đẩy túi hạt của người
 *    này cho người kia" không thể xảy ra vì không có đường nào để nó xảy ra.
 *
 * 3. **Trạng thái sống trên đĩa, không sống trong tiến trình.** Bên bot bài thì ngược lại: một ván
 *    bài là một cuộc trò chuyện đang xảy ra, và khởi động lại thì quên nó là đúng. Một khu vườn
 *    thì không — nó lớn lên trong lúc không ai nhìn, và một cái cây trồng hôm qua mà hôm nay
 *    không còn nữa là một trò chơi hỏng. Nên nông trại nằm trên đĩa, và cả trò chơi chỉ cần đọc
 *    `at` (nhịp thật lần cuối) rồi hỏi các hàm thuần xem từ đó tới giờ đã có gì xảy ra.
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

/// Nơi ứng dụng ở. Tên riêng, không phải `kuku.vn` — bot là mã của bên thứ ba với lượng truy cập
/// không đoán trước, và giữ nó khỏi cái tên người ta đang dùng là thứ cho phép chặn, đo và dời nó
/// mà không ai phải sửa một dòng.
export const API = process.env.ZEPLAO_BOT_API ?? 'https://api-bot.kuku.vn';

/// Nông trại của mọi người, trên đĩa.
///
/// **Thứ duy nhất ở đây không dựng lại được từ mã nguồn.** Một cái cây đã trồng, một con vật đã
/// mua, một số tiền đã kiếm — không có cách nào tính lại. Nên nó được ghi xuống đĩa ngay, và ghi
/// theo cách một lần ghi hỏng không làm mất cả nông trại: ra file tạm rồi đổi tên vào chỗ.
/// Đường dẫn ấy **đọc lúc chạy**, không phải lúc nạp module.
///
/// Một hằng số đọc lúc nạp thì mỗi lần `import` chỉ có một giá trị, và một bộ thử muốn cho mỗi
/// phép kiểm một nông trại riêng phải sửa biến môi trường trước khi nạp — nghĩa là không sửa được.
/// Đọc lúc chạy làm điều ấy thành hiển nhiên.
export const storePath = () => process.env.FARM_STORE ?? '/app/data/farms.json';

/// Bao nhiêu người một nông trại hiện trên bảng xếp hạng.
export const BOARD_SIZE = 20;

/// Bao nhiêu chuyện đã xảy ra thì còn nhớ, cho mỗi người.
///
/// Một cuốn sổ nhỏ, và nó là toàn bộ phần xã hội của trò chơi: ai hái trộm của mình, ai cho ăn hộ,
/// chó nhà mình cắn được ai. Bản gốc ghi đủ thứ vào `app_qqfarm_nclogs` và người chơi đọc được
/// năm mươi dòng gần nhất; ở đây giữ hai mươi, vì hai mươi dòng là thứ người ta thật sự đọc, còn
/// năm mươi là thứ người ta cuộn qua.
export const LOG_KEPT = 20;

import {
  newFarm, advance, plotOf, emptyPlot, levelOf, expFor, progressTo, chores, ripePlots,
  isFarming, sow, water, weed, pest, harvest, pick, clear, steal, openLand, upgradeLand,
  sowWeeds, sowPests, resetQuota, BAD_PER_DAY, BAD_MAX_PER_PLOT,
  seedsFor, cropById, sellPriceOf, seedPriceOf,
  SPEED, PLANT_EXP, HELP_COIN, HELP_EXP, STEAL_MIN_COIN, DAILY_COIN, STARTING_COIN,
  MAX_PLOTS, CROPS,
} from './rules/farm.mjs';
import {
  newRanch, graze, feed, buy, collect, butcher, raid, catchMouse, openHouse, emptyPen,
  chores as ranchChores, hungry, hopperLasts, roomFor, penFor, houseAt, penCount,
  animalById, ANIMALS, HOUSES, GRASS, MAX_FEED, HELP_EXP_PER_TEN,
} from './rules/ranch.mjs';

/// Một ngày, tính bằng mili giây. Ngày đổi lúc nửa đêm giờ Việt Nam, không phải giờ UTC.
const DAY = 24 * 60 * 60 * 1000;
const VN_OFFSET = 7 * 60 * 60 * 1000;
export const dayIn = (now) => new Date(now + VN_OFFSET).toISOString().slice(0, 10);

// ---- những câu bot nói -----------------------------------------------------------------------

/// Mọi câu chữ ở một chỗ, vì chúng là thứ người chơi đọc và là thứ hay phải sửa nhất.
const SAY = {
  greeting: (username) => `Xin chào! Mình là nông trại. Gõ /nongtrai để mở khu vườn của bạn — `
    + `trồng cây, tưới nước, hái quả, và ghé vườn hàng xóm. Ai cũng có vườn riêng.`,
  tooMany: 'Phòng này đang mở quá nhiều khung. Đóng bớt rồi thử lại nhé.',
  noSession: 'Không mở được khu vườn. Thử lại sau một lát.',
  welcomeBack: (name) => `Chào ${name}, vườn của bạn vẫn ở đó.`,
};

/// Nút bấm trong tin nhắn. Chỉ có một nút, và nó chỉ làm một việc: mở khu vườn.
const OPEN = { rows: [[{ text: '🌱 Mở nông trại', callbackData: 'open' }]] };

// ---- bot -------------------------------------------------------------------------------------

export async function run(token, { signal, api = API } = {}) {
  const STORE = storePath();
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function call(method, body) {
    const response = await fetch(`${api}/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: auth,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    if (!response.ok) {
      throw new Error(`${method} answered ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }

  const me = await call('getMe');
  console.log(`@${me.username} đang trồng`);

  await call('setCommands', {
    commands: [
      { command: 'nongtrai', description: 'Mở nông trại: trồng cây, nuôi vật, hái trộm hàng xóm' },
      { command: 'vuon', description: 'Tên khác của /nongtrai' },
      { command: 'farm', description: 'Tên khác của /nongtrai' },
    ],
  });

  // Gõ tên bot để mở vườn thì không nên để lại một dòng trong phòng. Hỏi một lần, ở đây, thay vì
  // đi xoá sau mỗi lần — tin nhắn ấy không bao giờ được viết ra, nên không có khoảnh khắc nào nó
  // hiện lên rồi biến mất.
  await call('setMe', { quietMention: true }).catch(() => {});

  // Dọn phiên còn sót từ lần chạy trước. Nông trại thì **không** mất — nó nằm trên đĩa — nhưng
  // phiên nằm trong bộ nhớ của API, và một cái khung đang mở trỏ tới một phiên đã chết thì không
  // tự biết điều đó.
  const swept = await call('endSessions', {}).catch(() => ({ ended: 0 }));
  if (swept.ended) console.log(`dọn ${swept.ended} phiên cũ`);

  // ---- trạng thái -----------------------------------------------------------------------------

  /**
   * Nông trại của mọi người, theo `userId`.
   *
   * **Khoá theo người và không theo gì khác** — không theo phòng, không theo phiên, không theo
   * khung. Một người ở năm nhóm vẫn chỉ có một khu vườn và một túi tiền, và đi sang nhóm khác thì
   * mang khu vườn ấy theo. Đây là điều làm cho "ghé vườn hàng xóm" có nghĩa: hàng xóm là người,
   * không phải một cái phòng.
   */
  const farms = new Map();

  /// Những khung đang mở, theo phiên.
  const screens = new Map();      // sessionId -> screen
  const openBy = new Map();       // userId -> sessionId

  /// Một nông trại của người này, mở từ đĩa nếu có.
  function farmOf(userId, displayName) {
    let farm = farms.get(userId);
    if (!farm) {
      farm = newFarm(Date.now(), displayName ?? '');
      farms.set(userId, farm);
    }
    if (displayName) farm.name = displayName;
    return farm;
  }

  // ---- đọc và ghi đĩa -------------------------------------------------------------------------

  const store = (() => {
    try {
      const read = JSON.parse(readFileSync(STORE, 'utf8'));
      for (const [userId, farm] of Object.entries(read.farms ?? {})) farms.set(userId, farm);
      return { offset: Number(read.offset) || 0, greeted: read.greeted ?? {}, farms: read.farms ?? {} };
    } catch {
      // Chưa có file, hoặc có một file ai đó sửa thành ra vô nghĩa. Một nông trại trống là chỗ bắt
      // đầu thật thà — từ chối chạy vì thiếu một file thì lấy luôn cả trò chơi đi theo.
      return { offset: 0, greeted: {}, farms: {} };
    }
  })();

  let saving = null;

  /// Ghi ra đĩa: ra file tạm rồi đổi tên vào chỗ.
  ///
  /// Đổi tên là một phép **nguyên tử** trên cùng một ổ đĩa, nên một lần ghi bị cắt ngang — mất
  /// điện, bot bị giết — để lại file **cũ nguyên vẹn**, không phải một file cụt. Một nông trại
  /// cụt đọc lên lúc khởi động tiếp theo là mất sạch vườn của mọi người, và không có dòng log nào
  /// báo điều đó.
  function write() {
    try {
      const dir = STORE.slice(0, STORE.lastIndexOf('/'));
      if (dir) mkdirSync(dir, { recursive: true });
      const farms_out = {};
      // Chỉ những nông trại thật sự có người chơi. Một người mở khung ra nhìn rồi đi không để lại
      // một khu vườn sáu thửa trong file của mọi người.
      for (const [userId, farm] of farms) if (farm.touched) farms_out[userId] = farm;
      writeFileSync(`${STORE}.tmp`, JSON.stringify({ offset: store.offset, greeted: store.greeted, farms: farms_out }));
      renameSync(`${STORE}.tmp`, STORE);
    } catch (problem) {
      console.error(`không ghi được ${STORE}: ${problem}`);
    }
  }

  /// Ghi sau một nhịp, không phải mỗi lần hái một quả. Mười người hái cùng lúc thì ghi một lần.
  function save() {
    if (saving) return;
    saving = setTimeout(() => { saving = null; write(); }, 2000);
  }

  /// Mọi thứ còn nợ cái đĩa, ngay bây giờ. Bot bị dừng thì không có lần sau.
  function flush() {
    if (!saving) return;
    clearTimeout(saving);
    saving = null;
    write();
  }

  /**
   * Và chỗ cho tín hiệu dừng đáp xuống — **ở đây, không phải ở cuối file**.
   *
   * Đây là cái bẫy đã làm carobot mất ba ngày, và nó đáng được viết ra: vòng lặp dưới kia không
   * bao giờ kết thúc, nên **không một dòng nào sau nó chạy**. Một `signal.addEventListener` đặt ở
   * cuối `run()` không phải là một dòng chạy muộn — nó là một dòng không bao giờ chạy, và nó
   * không báo lỗi, không cảnh báo, chỉ là bot dừng lại mà không ghi gì xuống đĩa.
   *
   * Hệ quả cụ thể ở đây: hai giây ghi một lần là để mười người hái quả cùng lúc chỉ ghi một lần.
   * Nhưng một lần deploy thì không có "lần sau", và thứ đang nằm trong cửa sổ hai giây ấy là vụ
   * mùa vừa rồi của ai đó.
   */
  signal?.addEventListener('abort', () => flush(), { once: true });

  // ---- khung ------------------------------------------------------------------------------

  /// Phiên này đang mở cho ai.
  const screenOf = (userId) => {
    const sessionId = openBy.get(userId);
    return sessionId ? screens.get(sessionId) ?? null : null;
  };

  function dropScreen(screen) {
    screens.delete(screen.sessionId);
    if (openBy.get(screen.userId) === screen.sessionId) openBy.delete(screen.userId);
  }

  /**
   * Mở khu vườn của một người, hoặc mở lại cái đang có.
   *
   * Một phiên có **đúng một người chơi**, là chủ của nó — nên `role` trên mỗi hành động gửi tới
   * không nói lên điều gì, và mọi phép kiểm đều dựa vào **người gửi có phải chủ khung đó không**
   * chứ không dựa vào cái khung tự khai.
   */
  async function openFor(conversationId, who) {
    const existing = screenOf(who.userId);
    if (existing && existing.conversationId === conversationId) {
      // Phiên có thể đã chết trong khi cái khung thì còn: phiên nằm trong bộ nhớ của API, mà API
      // thì bị thay mới mỗi lần deploy. Đẩy thử một lần là cách duy nhất để biết.
      const alive = await call('showSession', { sessionId: existing.sessionId, to: who.userId })
        .then(() => true)
        .catch(() => false);
      if (alive) {
        existing.displayName = who.displayName;
        await push(existing);
        return existing;
      }
      dropScreen(existing);
    }

    // Ở một phòng khác thì phải mở một phiên ở đó — một phiên không đi xuyên phòng được. Nông
    // trại thì đi theo, và đó là toàn bộ lý do cái khung được mở lại thay vì báo lỗi.
    if (existing) {
      await call('endSession', { sessionId: existing.sessionId }).catch(() => {});
      dropScreen(existing);
    }

    const session = await call('createSession', {
      conversationId,
      title: 'Nông trại',
      userIds: [who.userId],
    }).catch(() => null);

    if (!session) {
      // Không mở được phiên là chuyện đủ lớn để có một dòng, và đủ lớn để nói với người đã gõ lệnh.
      // Im lặng thì người gõ không phân biệt được "phòng đầy" với "bot hỏng".
      console.error(`không mở được phiên cho ${who.displayName} ở ${conversationId}`);
      await send(conversationId, SAY.tooMany, null, who.userId);
      return null;
    }

    const screen = {
      sessionId: session.id,
      userId: who.userId,
      displayName: who.displayName,
      conversationId,
      touched: Date.now(),
    };
    screens.set(screen.sessionId, screen);
    openBy.set(who.userId, screen.sessionId);

    await push(screen);
    await call('showSession', { sessionId: screen.sessionId, to: who.userId })
      .catch((problem) => console.error(`không mở được khung cho ${who.displayName}: ${problem}`));
    console.log(`mở vườn cho ${who.displayName} · ${screen.sessionId}`);
    return screen;
  }

  // ---- ảnh chụp ------------------------------------------------------------------------------

  /**
   * Đẩy một ảnh chụp của khu vườn lên khung của chủ nó.
   *
   * **Luôn có `to`.** Không có lần đẩy nào đi tới cả phòng, và đó không phải một quy tắc được nhớ
   * — nó là hệ quả của việc một khu vườn là của một người. Bản gốc của bên bot bài có một phép
   * kiểm đọc mã nguồn để chắc rằng bài của người này không lọt vào lần đẩy chung; ở đây không cần
   * phép kiểm ấy, vì không có lần đẩy chung nào để lọt vào.
   *
   * Ảnh chụp là một **trạng thái đầy đủ**, không phải một mẩu vá. Máy chủ nhớ thứ cuối cùng nó
   * được đẩy và ưu tiên bản riêng khi ai đó mở khung muộn, nên một mẩu vá sẽ cho người ta thấy
   * một nửa khu vườn.
   */
  async function push(screen) {
    const now = Date.now();
    const farm = farmOf(screen.userId, screen.displayName);
    farm.touched = now;
    const ranch = farm.ranch ?? (farm.ranch = newRanch(now));
    const moved = resetQuota(advance(farm, now), dayIn(now));
    const grazed = graze(ranch, now);
    farms.set(screen.userId, { ...moved, ranch: grazed });

    const state = snapshot({ ...moved, ranch: grazed }, screen, now);
    const landed = await call('pushState', {
      sessionId: screen.sessionId,
      to: screen.userId,
      state,
    }).then(() => true).catch(() => false);

    // Đẩy không tới nơi nghĩa là phiên đã biến mất. Quên nó đi là điều cho phép lần gõ lệnh tiếp
    // theo mở một cái mới, thay vì hỏng mãi mãi.
    if (!landed) dropScreen(screen);
    return landed;
  }

  /// Mọi khung đang mở một nông trại nào đó — dùng khi có người ghé vườn của họ và chủ vườn cần
  /// biết.
  async function pushTo(userId) {
    const screen = screenOf(userId);
    if (screen) await push(screen);
  }

  /**
   * Cái khung nhìn thấy gì.
   *
   * Một ảnh chụp đầy đủ của trạng thái, cộng thêm **những gì bấm được ngay bây giờ**. Cái thứ hai
   * mới là phần đáng nói: mỗi thửa đất mang theo danh sách việc làm được trên nó, và mỗi việc mang
   * theo **lý do** nếu nó không làm được. Nhờ vậy cái khung vẽ được một cái nút tối kèm câu giải
   * thích thay vì một cái nút sáng mà bấm vào không ra gì — và luật thì vẫn chỉ nằm một chỗ, trong
   * `rules/`, chứ không được chép lại lần thứ hai vào trang.
   */
  function snapshot(farm, screen, now) {
    const level = levelOf(farm.exp);
    const progress = progressTo(farm.exp);
    const la = chores(farm);
    const rc = ranchChores(farm.ranch);

    return {
      at: now,
      speed: SPEED,
      me: {
        id: screen.userId,
        name: screen.displayName || 'Bạn',
      },
      level,
      exp: farm.exp,
      next: progress.next,
      into: progress.into,
      span: progress.span,
      coin: Math.floor(farm.coin),
      chores: la,
      ranchChores: rc,
      plots: farm.plots.map((plot, index) => plotView(farm, plot, index, now)),
      seeds: Object.entries(farm.seeds)
        .filter(([, count]) => count > 0)
        .map(([id, count]) => {
          const crop = cropById(id);
          return crop ? { id: Number(id), name: crop.name, count } : null;
        })
        .filter(Boolean),
      fruit: Object.entries(farm.fruit)
        .filter(([, count]) => count > 0)
        .map(([id, count]) => {
          const crop = cropById(id);
          return crop ? { id: Number(id), name: crop.name, count, worth: sellPriceOf(crop) } : null;
        })
        .filter(Boolean),
      store: seedsFor(farm.exp).map((crop) => ({
        id: crop.id,
        name: crop.name,
        level: crop.level,
        price: seedPriceOf(crop),
        minutes: Math.round(crop.cycle / SPEED / 60),
        picks: crop.picks,
        yield: crop.yield,
        sell: crop.sell,
        afford: Math.floor(farm.coin) >= seedPriceOf(crop),
      })),
      land: {
        have: farm.plots.length,
        max: MAX_PLOTS,
        next: openLand(farm).ok ? { cost: openLand(farm).cost, level: openLand(farm).level } : null,
        why: openLand(farm).why ?? null,
      },
      ranch: ranchView(farm.ranch, now),
      // Hàng xóm: ai đang có gì để ghé lấy. **Đây là phần xã hội của trò chơi**, và nó chỉ hiện
      // khi có ai khác đã từng mở nông trại — một danh sách rỗng trong một nhóm chỉ có mình bạn
      // là một sự thật, không phải một lỗi.
      neighbours: neighbours(screen.userId, now),
      dog: farm.dog
        ? { until: farm.dog.until, left: Math.max(0, farm.dog.until - now) }
        : null,
      daily: {
        taken: farm.claimed === dayIn(now),
        worth: DAILY_COIN,
      },
      // Hạn mức trong ngày: bao nhiêu lần còn được gieo cỏ lên ruộng người khác. Con số ấy phải
      // tới được cái khung, không thì cái nút chỉ có thể nói "không được" mà không nói được vì sao.
      badLeft: farm.badLeft ?? BAD_PER_DAY,
      log: (farm.log ?? []).slice(0, LOG_KEPT),
    };
  }

  /// Một thửa đất nhìn từ cái khung: nó là gì, và bấm được gì.
  function plotView(farm, plot, index, now) {
    const crop = plot.crop ? cropById(plot.crop) : null;
    const view = {
      index,
      crop: crop ? { id: crop.id, name: crop.name, picks: crop.picks, yield: crop.yield } : null,
      stage: plot.stage,
      grown: Math.round(plot.grown),
      // Còn bao lâu nữa thì sang giai đoạn kế, tính bằng **giây thật** — con số duy nhất trên
      // màn hình mà người chơi thật sự đọc.
      etaMs: crop && plot.stage < 6 && !plot.dry
        ? Math.max(0, Math.round((nextMark(crop, plot.grown) - plot.grown) / SPEED * 1000))
        : null,
      weeds: plot.weeds,
      pests: plot.pests,
      dry: plot.dry,
      red: plot.red,
      ripe: plot.stage === 6,
      yieldLeft: plot.yieldLeft,
      floor: plot.floor,
      dead: plot.stage === 7,
      ...actions(farm, plot, index),
    };
    return view;
  }

  /// Mốc giai đoạn kế tiếp, bằng giây trò chơi.
  function nextMark(crop, grown) {
    const marks = crop.stages.map((fraction) => fraction * crop.cycle);
    for (const mark of marks) if (grown < mark) return mark;
    return crop.cycle;
  }

  /**
   * Bấm được gì trên thửa này.
   *
   * Mỗi việc là `{ok}` hoặc `{ok:false, why}`, và câu `why` ấy được vẽ thẳng lên nút. Đó là toàn bộ
   * lý do hàm này tồn tại ở phía bot thay vì phía trang: một cái nút tối có ghi lý do tốt hơn một
   * cái nút sáng rồi bấm không ra gì, và cái lý do thì phải đến từ chỗ biết luật.
   */
  function actions(farm, plot, index) {
    const pickable = harvest(plot);
    const canSow = !plot.crop || plot.stage === 7;
    return {
      can: {
        harvest: pickable.ok ? { ok: true, amount: pickable.amount } : { ok: false, why: pickable.why },
        water: water(plot),
        weed: weed(plot, farm.ownerId ?? 'me'),
        pest: pest(plot, farm.ownerId ?? 'me'),
        clear: clear(plot),
        sow: canSow ? { ok: true } : { ok: false, why: 'Thửa này đang có cây.' },
        red: (() => {
          const one = upgradeLand(farm, index);
          return one.ok ? { ok: true, cost: one.cost } : { ok: false, why: one.why };
        })(),
      },
    };
  }

  /// Bãi chăn nhìn từ cái khung.
  function ranchView(ranch, now) {
    const lasts = hopperLasts(ranch);
    return {
      pens: ranch.pens.map((pen, index) => {
        const animal = pen.animal ? animalById(pen.animal) : null;
        return {
          index,
          house: houseAt(ranch, index),
          animal: animal
            ? {
              id: animal.id,
              name: animal.name,
              product: animal.product,
              // Con này đang ở đoạn nào của đời nó, và còn bao lâu nữa.
              grown: Math.round(pen.grown),
              life: animal.life,
              grownUp: pen.grown >= animal.grow,
              spent: pen.grown >= animal.life,
              percent: Math.round((pen.grown / animal.life) * 100),
            }
            : null,
          ready: pen.ready,
          max: animal ? animal.yield : 0,
          collect: animal && pen.ready > 0
            ? { ok: true, amount: pen.ready }
            : { ok: false, why: animal ? 'Chưa có gì để bắt.' : 'Chuồng trống.' },
          butcher: animal && pen.grown >= animal.life
            ? { ok: true, price: animal.beastPrice }
            : { ok: false, why: 'Chưa sống hết đời.' },
        };
      }),
      hopper: Math.floor(ranch.hopper),
      hopperMax: GRASS.hopper,
      // Còn chạy được bao lâu. Đây là con số quan trọng nhất của cả bãi chăn: nó là lời nhắc duy
      // nhất cần có, và nó nói ra bằng giờ chứ không bằng một biểu tượng nhấp nháy.
      lastsHours: Number.isFinite(lasts) ? Math.round(lasts / 3600 * 10) / 10 : null,
      hungry: hungry(ranch),
      mouse: ranch.mouse,
      nests: ranch.nests,
      sheds: ranch.sheds,
      pens_max: HOUSES,
      store: ANIMALS.filter((animal) => animal.level <= levelOf(ranch.exp ?? 0))
        .map((animal) => ({
          id: animal.id,
          name: animal.name,
          product: animal.product,
          house: animal.house,
          level: animal.level,
          price: animal.price,
          minutes: Math.round(animal.grow / SPEED / 60),
          eats: animal.eats,
          afford: true,
        })),
      grass: { buy: GRASS.buy, crop: GRASS.crop, max: MAX_FEED },
    };
  }

  // ---- việc người chơi làm ------------------------------------------------------------------

  /**
   * Một hành động từ trong khung.
   *
   * Cái khung là **một file ai cũng sửa được**, nên mọi thứ nó gửi lên đều được kiểm lại ở đây,
   * y như kiểm chữ của người lạ gõ vào. Và ở đây việc kiểm ấy không phải hình thức: khu vườn là
   * tiền, và cái khung biết toạ độ của mọi thửa.
   */
  async function onWidget(event) {
    const screen = screens.get(event.sessionId);
    if (!screen) return;

    // `role` do máy chủ ghi vào, và nó là `player` cho chủ phiên — nhưng một phiên chỉ có đúng một
    // người chơi, nên thứ thật sự phải kiểm là **người gửi có phải chủ khung này không**.
    const userId = event.from?.userId;
    if (userId !== screen.userId) return;

    const farm = farmOf(userId, screen.displayName);
    const now = Date.now();
    const moved = resetQuota(advance(farm, now), dayIn(now));
    const grazed = graze(farm.ranch ?? newRanch(now), now);
    const working = { ...moved, ranch: grazed, ownerId: userId };
    farms.set(userId, working);

    // Một hành động có thể bị từ chối, và câu từ chối ấy phải tới được người đã bấm. Nó không đi
    // vào trạng thái — trạng thái là khu vườn, không phải một chỗ để nhét thông báo — mà đi vào
    // **sổ của chính người ấy**, và cái khung vẽ dòng mới nhất của cuốn sổ ấy lên trên cùng.
    const action = event.action ?? {};

    try {
      const said = await apply(userId, working, action, now);
      if (said) {
        const farm = farms.get(userId);
        farms.set(userId, { ...farm, log: note(farm.log, said, now) });
      }
    } catch (problem) {
      console.error(`${userId}: ${problem}`);
      const farm = farms.get(userId);
      if (farm) farms.set(userId, { ...farm, log: note(farm.log, 'Có gì đó không xong.', now) });
    }

    await push(screen);
    save();
  }

  /// Áp một hành động lên nông trại. Trả về một câu để nói, hoặc `null`.
  async function apply(userId, farm, action, now) {
    const next = { ...farm };
    const plotAt = (index) => next.plots[index];

    // ---- nông trại ----
    if (action.sow !== undefined) {
      const { plot, crop } = action.sow ?? {};
      const one = plotAt(plot);
      if (!one) return null;
      const allowed = sow(one, crop, next.seeds, next.coin);
      if (!allowed.ok) return allowed.why;
      const seed = cropById(crop);
      if (next.coin < seedPriceOf(seed) && !(next.seeds[crop] > 0)) return 'Không đủ tiền mua hạt.';
      next.seeds = { ...next.seeds, [crop]: next.seeds[crop] - 1 };
      next.plots = next.plots.map((p, i) => (i === plot ? plotOf(crop) : p));
      // QFarm: trồng một cây được 2 kinh nghiệm (`farmlandstatus_planting.php`).
      next.exp = next.exp + PLANT_EXP;
      farms.set(userId, next);
      return null;
    }

    if (action.harvest !== undefined) {
      const one = plotAt(action.harvest);
      if (!one) return null;
      const got = pick(one);
      if (!got.ok) return got.why;
      const crop = cropById(one.crop);
      next.plots = next.plots.map((p, i) => (i === action.harvest ? got.plot : p));
      next.fruit = { ...next.fruit, [one.crop]: (next.fruit[one.crop] ?? 0) + got.amount };
      next.exp += got.exp;
      farms.set(userId, next);
      return `Hái được ${got.amount} ${crop.name}.`;
    }

    if (action.water !== undefined || action.weed !== undefined || action.pest !== undefined) {
      const which = action.water !== undefined ? 'water' : action.weed !== undefined ? 'weed' : 'pest';
      const index = action[which];
      const one = plotAt(index);
      if (!one) return null;
      const allowed = which === 'water' ? water(one) : which === 'weed' ? weed(one, userId) : pest(one, userId);
      if (!allowed.ok) return allowed.why;
      next.plots = next.plots.map((p, i) => {
        if (i !== index) return p;
        if (which === 'water') return { ...p, dry: false };
        if (which === 'weed') {
          // Nhổ cỏ thì cũng **quên** ai đã gieo nó — cỏ đã đi rồi, và một cuốn sổ nhớ những món
          // nợ đã trả là một cuốn sổ chỉ để soi lại.
          const sown = { ...p.sownBy };
          if (sown[userId]) {
            sown[userId] = { ...sown[userId], weeds: Math.max(0, (sown[userId].weeds ?? 0) - 1) };
          }
          return { ...p, weeds: p.weeds - 1, sownBy: sown };
        }
        return { ...p, pests: p.pests - 1 };
      });
      // Của QFarm: làm một việc được 2 đồng và 2 kinh nghiệm, cho **người làm**.
      next.coin += HELP_COIN;
      next.exp += HELP_EXP;
      farms.set(userId, next);
      return null;
    }

    if (action.clear !== undefined) {
      const one = plotAt(action.clear);
      if (!one) return null;
      const allowed = clear(one);
      if (!allowed.ok) return allowed.why;
      next.plots = next.plots.map((p, i) => (i === action.clear ? emptyPlot() : p));
      farms.set(userId, next);
      return null;
    }

    if (action.sell !== undefined) {
      const { crop, count } = action.sell ?? {};
      const have = next.fruit[crop] ?? 0;
      const want = Math.max(1, Math.min(have, Math.floor(Number(count) || have)));
      if (have < 1) return 'Không có gì để bán.';
      const one = cropById(crop);
      next.fruit = { ...next.fruit, [crop]: have - want };
      next.coin += sellPriceOf(one) * want;
      farms.set(userId, next);
      return `Bán ${want} ${one.name} được ${(sellPriceOf(one) * want).toLocaleString('vi-VN')} đồng.`;
    }

    if (action.buy !== undefined) {
      const crop = cropById(action.buy);
      if (!crop) return null;
      const count = Math.max(1, Math.min(99, Math.floor(Number(action.count) || 1)));
      const cost = seedPriceOf(crop) * count;
      if (levelOf(next.exp) < crop.level) return `Cần cấp ${crop.level} mới mua được hạt ${crop.name}.`;
      if (next.coin < cost) return `Không đủ tiền — ${count} gói ${crop.name} giá ${cost.toLocaleString('vi-VN')} đồng.`;
      next.coin -= cost;
      next.seeds = { ...next.seeds, [crop.id]: (next.seeds[crop.id] ?? 0) + count };
      farms.set(userId, next);
      return null;
    }

    if (action.land !== undefined) {
      const allowed = openLand(next);
      if (!allowed.ok) return allowed.why;
      next.coin -= allowed.cost;
      next.plots = [...next.plots, emptyPlot()];
      farms.set(userId, next);
      return `Khai thêm một thửa, còn ${MAX_PLOTS - next.plots.length} thửa nữa.`;
    }

    if (action.red !== undefined) {
      const allowed = upgradeLand(next, action.red);
      if (!allowed.ok) return allowed.why;
      next.coin -= allowed.cost;
      next.plots = next.plots.map((p, i) => (i === action.red ? { ...p, red: true } : p));
      farms.set(userId, next);
      return 'Thửa này thành đất đỏ — thêm một phần mười sản lượng.';
    }

    if (action.daily) {
      const today = dayIn(now);
      if (next.claimed === today) return 'Hôm nay đã nhận rồi.';
      next.claimed = today;
      next.coin += DAILY_COIN;
      farms.set(userId, next);
      return `Nhận ${DAILY_COIN.toLocaleString('vi-VN')} đồng của hôm nay.`;
    }

    if (action.dog) {
      // Chó: ăn trong ngần này thì cắn được người lén vào.
      const cost = 2_000;
      if (next.coin < cost) return `Mua chó cần ${cost.toLocaleString('vi-VN')} đồng.`;
      next.coin -= cost;
      next.dog = { until: now + DAY };
      farms.set(userId, next);
      return 'Đã có chó giữ vườn một ngày.';
    }

    // ---- bãi chăn ----
    if (action.feed !== undefined) {
      const bales = Math.floor(Number(action.feed) || 0);
      const allowed = feed(next.ranch, bales);
      if (!allowed.ok) return allowed.why;
      // Cỏ lấy từ túi trước, thiếu thì mua — ưu tiên túi vì cỏ nhà trồng rẻ hơn ba lần.
      const inBag = next.fruit[GRASS.crop] ?? 0;
      const fromBag = Math.min(inBag, allowed.bales);
      const toBuy = allowed.bales - fromBag;
      const cost = toBuy * GRASS.buy;
      if (next.coin < cost) {
        return `Cần ${cost.toLocaleString('vi-VN')} đồng để mua ${toBuy} bó cỏ.`;
      }
      next.fruit = { ...next.fruit, [GRASS.crop]: inBag - fromBag };
      next.coin -= cost;
      next.ranch = { ...next.ranch, hopper: next.ranch.hopper + allowed.bales };
      farms.set(userId, next);
      return null;
    }

    if (action.animal !== undefined) {
      const allowed = buy(next.ranch, action.animal, next.coin);
      if (!allowed.ok) return allowed.why;
      next.coin -= allowed.price;
      const pens = next.ranch.pens.map((pen, i) =>
        (i === allowed.index ? { ...pen, animal: allowed.animal.id, grown: 0, ready: 0, droppedAt: null } : pen));
      next.ranch = { ...next.ranch, pens };
      farms.set(userId, next);
      return null;
    }

    if (action.collect !== undefined) {
      const got = collect(next.ranch, action.collect);
      if (!got.ok) return got.why;
      const animal = animalById(next.ranch.pens[action.collect].animal);
      const pens = next.ranch.pens.map((pen, i) => (i === action.collect ? { ...pen, ready: 0 } : pen));
      // Sản phẩm vào túi theo id của cây tương ứng: `farm.fruit` chứa cả quả và cỏ, nên sản phẩm
      // của vật nuôi đi vào một túi riêng, kẻo trứng gà thành ra một loại rau.
      next.ranch = { ...next.ranch, pens };
      next.goods = { ...(next.goods ?? {}), [animal.id]: ((next.goods ?? {})[animal.id] ?? 0) + got.amount };
      next.ranch = { ...next.ranch, exp: (next.ranch.exp ?? 0) + got.exp };
      farms.set(userId, next);
      return `Bắt được ${got.amount} ${got.product}.`;
    }

    if (action.butcher !== undefined) {
      const got = butcher(next.ranch, action.butcher);
      if (!got.ok) return got.why;
      const pens = next.ranch.pens.map((pen, i) => (i === action.butcher ? emptyPen() : pen));
      next.ranch = { ...next.ranch, pens, exp: (next.ranch.exp ?? 0) + got.exp };
      next.coin += got.price;
      farms.set(userId, next);
      return `Bán con ${got.beast.name} được ${got.price.toLocaleString('vi-VN')} đồng.`;
    }

    if (action.house !== undefined) {
      const allowed = openHouse(next.ranch, action.house);
      if (!allowed.ok) return allowed.why;
      if (next.coin < allowed.cost) return `Mở thêm chỗ cần ${allowed.cost.toLocaleString('vi-VN')} đồng.`;
      next.coin -= allowed.cost;
      next.ranch = {
        ...next.ranch,
        [allowed.kind === 'nest' ? 'nests' : 'sheds']:
          (allowed.kind === 'nest' ? next.ranch.nests : next.ranch.sheds) + 1,
        pens: [...next.ranch.pens, emptyPen()],
      };
      farms.set(userId, next);
      return null;
    }

    if (action.mouse) {
      const got = catchMouse(next.ranch);
      if (!got.ok) return got.why;
      next.ranch = { ...next.ranch, mouse: false };
      next.coin += got.coin;
      farms.set(userId, next);
      return got.hit ? `Bắt được chuột, được ${got.coin.toLocaleString('vi-VN')} đồng.` : 'Chuột chạy mất.';
    }

    // ---- ghé vườn người khác ----
    //
    // Hành động này **không** sửa `next` — nó động vào nông trại của hai người, nên nó có đường
    // riêng (`visit`), và chỗ gọi đã ghi lại nông trại của người bấm trước khi tới đây.
    if (action.visit) {
      const { who, what, plot } = action.visit ?? {};
      if (typeof who !== 'string' || typeof what !== 'string') return null;
      return visit(userId, who, what, plot, now);
    }

    return null;
  }

  // ---- ghé vườn hàng xóm ------------------------------------------------------------------------

  /**
   * Đi hái trộm.
   *
   * **Đây là chỗ phần xã hội của trò chơi sống**, và nó cần một thứ mà một cái khung widget không
   * có: một danh sách người chơi khác. Widget chỉ nói chuyện với bot, không nói chuyện với người
   * chơi khác. Nên danh sách ấy đến từ **sổ vàng của chính bot** — những người đã từng mở nông
   * trại — và nó chỉ hiện với người đã có vườn.
   *
   * Bản gốc QFarm lấy danh sách này từ bạn bè Facebook (`friend.php`, tối đa 500 người). Ở đây
   * không có bạn bè Facebook, và cũng không nên có: cái làm cho việc ghé vườn có nghĩa là **cùng
   * chơi một trò chơi**, không phải cùng có mặt trên một mạng xã hội.
   */
  function neighbours(userId, now) {
    const out = [];
    for (const [id, farm] of farms) {
      if (id === userId || !farm.touched) continue;
      // Chỉ những thửa **còn lấy được**: một thửa đã chín nhưng cỏ mọc đầy, hoặc đã có người hái
      // hết phần trên sàn, thì không phải một lời mời ghé qua.
      const ripe = ripePlots(farm).filter(({ plot }) =>
        plot.yieldLeft > plot.floor && !plot.thieves?.[userId]);
      const rt = farm.ranch ? ranchChores(farm.ranch) : { collected: 0 };
      out.push({
        id,
        name: farm.name || 'Một nông dân',
        ripe: ripe.length,
        // Còn việc gì làm hộ không — nhổ cỏ, bắt sâu, tưới. Đây là lý do để ghé qua **kể cả khi
        // không có gì để hái**, và là thứ làm cho việc đi thăm không chỉ là đi lấy.
        help: chores(farm),
        animals: rt.collected,
        last: farm.touched,
      });
    }
    // Người có gì để lấy hoặc để làm lên trước. Một danh sách hàng xóm mà không nói ai đang có gì
    // thì là một danh sách người ta phải bấm vào từng người để tra.
    return out
      .sort((a, b) => (b.ripe + b.animals) - (a.ripe + a.animals) || b.last - a.last)
      .slice(0, BOARD_SIZE);
  }

  /**
   * Đi sang vườn người khác: hái trộm, nhổ cỏ, bắt sâu, tưới.
   *
   * `stealAll` và `helpAll` là những gì cái khung thật sự gửi — không phải `steal` kèm một số hiệu
   * thửa. Cái khung biết số hiệu thửa, nhưng nó là **một file ai cũng sửa được**, và "làm hộ cả
   * vườn" là điều người ta muốn bấm. Nên bot nhận ý định rồi tự quyết định làm những thửa nào —
   * trên nông trại của chính nó, bằng chính những hàm thuần đã kiểm.
   *
   * Một lần ghé làm **hết những gì làm được**, cộng lại thành một câu trả lời. Ba người ghé một
   * khu vườn sáu thửa là ba tin nhắn nếu mỗi việc một tin, và đó là một cuộc trò chuyện bị chiếm.
   */
  async function visit(userId, targetId, what, index, now) {
    const target = farms.get(targetId);
    if (!target) return 'Không tìm thấy nông trại ấy.';
    const me = farms.get(userId);
    const mine = advance(me, now);
    const theirs = advance(target, now);
    let moved = { ...theirs, ranch: graze(theirs.ranch ?? newRanch(now), now) };

    const hasDog = Boolean(moved.dog && moved.dog.until > now);
    const house = { hasCrop: isFarming(mine), coin: mine.coin, hasDog };

    // ---- hái trộm ----
    const stealFrom = async (plotIndex) => {
      const plot = moved.plots[plotIndex];
      if (!plot) return null;
      const got = steal(plot, userId, targetId, { ...house, coin: mine.coin });
      if (!got.ok) return null;

      if (got.caught) {
        // Chó cắn: tiền đi từ người lén vào sang chủ nhà, và không sinh ra đồng nào. Con số ấy âm
        // với người này và dương với người kia đúng bằng nhau — không có đồng nào được tạo ra.
        const fine = Math.min(mine.coin, got.fine);
        mine.coin -= fine;
        moved.coin += fine;
        moved.plots = moved.plots.map((p, i) =>
          (i === plotIndex ? { ...p, thieves: { ...p.thieves, [userId]: 0 } } : p));
        moved.log = note(moved.log, `Chó nhà bạn cắn một người lén vào, được ${fine.toLocaleString('vi-VN')} đồng.`, now);
        return { caught: true, fine };
      }

      mine.fruit = { ...mine.fruit, [plot.crop]: (mine.fruit[plot.crop] ?? 0) + got.amount };
      moved.plots = moved.plots.map((p, i) => (i === plotIndex
        ? { ...p, yieldLeft: p.yieldLeft - got.amount, thieves: { ...p.thieves, [userId]: got.amount } }
        : p));
      return { cropId: plot.crop, amount: got.amount };
    };

    const stolen = [];
    let bitten = 0;
    if (what === 'stealAll' || what === 'steal') {
      const targets = what === 'steal'
        ? [index]
        : moved.plots
          .map((plot, at) => ({ plot, at }))
          .filter(({ plot }) => plot.stage === 6 && plot.yieldLeft > plot.floor && !plot.thieves?.[userId])
          .map(({ at }) => at);
      for (const at of targets) {
        const got = await stealFrom(at);
        if (!got) continue;
        // Bị chó cắn thì dừng lại ngay, không đi tiếp sang thửa khác. Một con chó cắn được một lần
        // là điều con chó ấy đang nói, và đi tiếp sang thửa sau là không nghe nó.
        if (got.caught) { bitten = got.fine; break; }
        stolen.push(got);
      }
    }

    // ---- gieo cỏ, thả sâu ----
    //
    // Hai việc gây hại duy nhất của trò chơi này, và cả hai đều **không lấy được gì**: gieo cỏ lên
    // ruộng người khác không cho mình một đồng nào, nó chỉ làm vụ mùa của người kia bớt đi. Một trò
    // chơi mà mọi hành vi xấu đều có lãi là một trò chơi dạy người ta làm việc xấu.
    const sowed = [];
    if (what === 'sowWeeds' || what === 'sowPests') {
      const weeds = what === 'sowWeeds';
      const mine2 = { ...mine, badLeft: (mine.badLeft ?? BAD_PER_DAY) };
      const allowed = weeds
        ? sowWeeds(moved.plots[index], userId, mine2.badLeft)
        : sowPests(moved.plots[index], userId, mine2.badLeft);
      if (allowed.ok) {
        moved.plots = moved.plots.map((p, i) => {
          if (i !== index) return p;
          const sown = { ...p.sownBy };
          const had = sown[userId] ?? {};
          sown[userId] = weeds
            ? { ...had, weeds: (had.weeds ?? 0) + 1 }
            : { ...had, pests: (had.pests ?? 0) + 1 };
          return weeds
            ? { ...p, weeds: p.weeds + 1, sownBy: sown }
            : { ...p, pests: p.pests + 1, sownBy: sown };
        });
        mine2.badLeft -= 1;
        sowed.push(weeds ? 'cỏ' : 'sâu');
        moved.log = note(moved.log,
          `${mine.name || 'Ai đó'} gieo ${weeds ? 'cỏ' : 'sâu'} lên một thửa.`, now);
        farms.set(userId, mine2);
        farms.set(targetId, moved);
        await pushTo(targetId);
        save();
        return `Đã gieo ${weeds ? 'cỏ' : 'sâu'} lên một thửa — còn ${mine2.badLeft} lần hôm nay.`;
      }
      return allowed.why;
    }

    // ---- làm hộ ----
    const helped = [];
    if (what === 'helpAll' || what === 'help' || what === 'water' || what === 'weed' || what === 'pest') {
      const jobs = what === 'helpAll' || what === 'help'
        ? moved.plots.map((plot, at) => ({ plot, at }))
        : [{ plot: moved.plots[index], at: index }];
      for (const { plot, at } of jobs) {
        if (!plot?.crop || plot.stage === 7 || plot.stage === 6) continue;
        for (const job of ['water', 'weed', 'pest']) {
          const allowed = job === 'water' ? water(plot) : job === 'weed' ? weed(plot, userId) : pest(plot, userId);
          if (!allowed.ok) continue;
          moved.plots = moved.plots.map((p, i) => {
            if (i !== at) return p;
            if (job === 'water') return { ...p, dry: false };
            if (job === 'weed') return { ...p, weeds: p.weeds - 1 };
            return { ...p, pests: p.pests - 1 };
          });
          helped.push({ at, job });
          // QFarm đếm việc làm hộ vào một hạn mức riêng trong ngày (`zong`, 150 lần) và chỉ trả
          // kinh nghiệm khi còn hạn mức. Giữ nguyên: không có nó thì một người ghé qua mười tám
          // thửa của hàng xóm mười tám lần là cách kiếm kinh nghiệm rẻ nhất trò chơi.
          if ((mine.goodLeft ?? 150) < 1) break;
          mine.goodLeft = (mine.goodLeft ?? 150) - 1;
          break;         // một việc một thửa một lần ghé
        }
      }
    }

    // Tiền công của việc làm hộ, cộng vào **trước khi** ghi xuống, để không có một khoảnh khắc nào
    // nông trại trong bộ nhớ là một phiên bản nửa vời của chính nó.
    if (helped.length) {
      mine.coin += HELP_COIN * helped.length;
      mine.exp += HELP_EXP * helped.length;
      moved.log = note(moved.log, `${mine.name || 'Ai đó'} ghé làm hộ ${helped.length} thửa.`, now);
    }
    if (stolen.length) {
      const words = stolen.map((one) => `${one.amount} ${cropById(one.cropId).name}`);
      moved.log = note(moved.log, `${mine.name || 'Ai đó'} hái trộm ${words.join(', ')}.`, now);
    }

    farms.set(userId, mine);
    farms.set(targetId, moved);
    await pushTo(targetId);

    // Một câu, ghép từ những gì đã xảy ra. Không có việc gì làm được thì nói ra vì sao — một cái
    // nút bấm vào rồi im lặng là một cái nút dạy người ta rằng các nút ở đây không đáng tin.
    const said = [];
    if (bitten) said.push(`Chó nhà người ta cắn, mất ${bitten.toLocaleString('vi-VN')} đồng`);
    if (stolen.length) said.push(`hái trộm được ${stolen.map((one) => `${one.amount} ${cropById(one.cropId).name}`).join(', ')}`);
    if (helped.length) said.push(`làm hộ ${helped.length} thửa`);
    if (said.length === 0) {
      if (what === 'stealAll' || what === 'steal') {
        if (!house.hasCrop) return 'Bạn chưa trồng cây nào thì đừng đi hái trộm.';
        if (mine.coin < STEAL_MIN_COIN) return `Phải có ít nhất ${STEAL_MIN_COIN} đồng trong túi.`;
        return 'Không còn gì để hái ở đó.';
      }
      return 'Không có gì cần làm ở đó.';
    }
    save();
    return said.join(', ') + '.';
  }

  /// Một dòng vào sổ của một người, giữ lại đúng `LOG_KEPT` dòng mới nhất.
  const note = (log, text, now) => [{ at: now, text }, ...(log ?? [])].slice(0, LOG_KEPT);

  // ---- tin nhắn ------------------------------------------------------------------------------

  /**
   * Vòng lặp.
   *
   * `offset` trên `getUpdates` vừa là câu hỏi vừa là lời xác nhận — không có lời xác nhận nào
   * khác. Nên một bot khởi động lại từ số không sẽ được trao lại cả vòng: mọi `/nongtrai` ai đó
   * đã gõ trong giờ qua được phát lại, và mọi cái nút ai đó đã bấm được trả lời sau khi mã của nó
   * hết hạn từ lâu. Từ phía trong phòng, đó là một cái khung tự mở ra trên màn hình bạn vì có
   * người vừa deploy.
   */
  let offset = store.offset;
  if (offset) console.log(`tiếp tục từ update ${offset}`);

  for (;;) {
    if (signal?.aborted) break;

    let updates;
    try {
      updates = await call(`getUpdates?offset=${offset}&timeout=30`);
    } catch (problem) {
      if (signal?.aborted) break;
      console.error(String(problem));
      await wait(2000);
      continue;
    }

    for (const update of updates) {
      // Trước khi làm việc, không phải sau: một update ném lỗi thì nếu không ghi lại nó sẽ quay
      // lại mãi mãi.
      offset = update.id;
      store.offset = offset;
      save();

      try {
        if (update.kind === 'bot_added') await greet(update.membership);
        else if (update.kind === 'bot_removed') { delete store.greeted[update.membership.conversationId]; save(); }
        else if (update.kind === 'message') await onMessage(update.message);
        else if (update.kind === 'callback_query') await onPress(update.callback);
        else if (update.kind === 'widget_action') await onWidget(update.widgetAction);
      } catch (problem) {
        console.error(String(problem));
      }
    }
  }

  /**
   * Chào một lần, lần đầu tiên được thả vào một phòng.
   *
   * Ghi xuống đĩa, và đó là toàn bộ ý của nó: `bot_added` là một update nằm trong vòng, nên bất cứ
   * thứ gì phát lại vòng ấy cũng chào lại — nghĩa là mỗi lần deploy, ở mọi phòng bot đang có mặt.
   * Bị một chương trình mình thêm từ tuần trước chào lại vì có người vừa sửa một dòng thì tệ hơn
   * là không được chào lần nào.
   */
  async function greet(membership) {
    const room = membership.conversationId;
    if (store.greeted[room]) return;
    store.greeted[room] = true;
    save();
    await send(room, SAY.greeting(me.username), OPEN, membership.by?.userId);
  }

  async function onMessage(message) {
    if (!wantsFarm(message)) return;
    console.log(`mở vườn cho ${message.from?.displayName ?? message.from?.userId}`);
    await openFor(message.conversationId, message.from);
  }

  /// Tin nhắn này có phải đang hỏi mở nông trại không.
  function wantsFarm(message) {
    if (message.command) return ['nongtrai', 'vuon', 'farm'].includes(message.command.toLowerCase());
    // `text`, không phải `body`. Thứ bot nhận được không phải bản ghi tin nhắn mà ứng dụng vẽ ra,
    // và đọc sai tên trường thì được một chuỗi rỗng lặng lẽ làm mọi phép kiểm dưới đây sai.
    const said = (message.text ?? '').trim().toLowerCase();
    if (said.startsWith('/')) return false;
    if (said.includes(`@${me.username}`.toLowerCase())) return true;
    return Boolean(message.replyToMessageId) || message.conversationType === 'direct';
  }

  async function onPress(callback) {
    const { conversationId, from } = callback;
    await answer(callback.callbackId);
    await openFor(conversationId, from);
  }

  /**
   * Nói một câu, chờ lượt nếu đang nói quá nhanh.
   *
   * `429` được trả lời bằng cách chờ rồi nói, không phải bằng cách bỏ đi. Bỏ đi thì để lại một
   * người đã hỏi mà không ai trả lời, và một câu trả lời đến muộn vẫn hơn một câu không bao giờ đến.
   */
  async function send(conversationId, text, keyboard, onlyForUserId) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await call('sendMessage', { conversationId, text, keyboard, onlyForUserId });
      } catch (problem) {
        if (!String(problem).includes('429') || attempt === 2) {
          console.error(String(problem));
          return null;
        }
        await wait(1100 * (attempt + 1));
      }
    }
    return null;
  }

  /// Một cú bấm phải được trả lời trong năm phút, không thì mã hết hạn — và người ta nhìn thấy một
  /// vòng tròn đang quay.
  async function answer(callbackId, text) {
    try {
      await call('answerCallback', { callbackId, text: text ?? undefined });
    } catch (problem) {
      console.error(String(problem));
    }
  }

}

// ---- chạy --------------------------------------------------------------------------------------

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.ZEPLAO_BOT_TOKEN;
  if (!token) {
    console.error('ZEPLAO_BOT_TOKEN is not set');
    process.exit(2);
  }

  // Chỗ cho SIGTERM của systemd đáp xuống. Không có nó thì một lần deploy giết tiến trình đúng lúc
  // nó đang ghi nông trại xuống đĩa.
  const stopping = new AbortController();
  for (const sign of ['SIGINT', 'SIGTERM']) {
    process.on(sign, () => { console.log(`${sign} — dừng`); stopping.abort(); });
  }

  run(token, { signal: stopping.signal }).catch((problem) => {
    console.error(String(problem));
    process.exit(1);
  });
}
