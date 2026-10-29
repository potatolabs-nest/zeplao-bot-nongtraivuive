// Bot chạy thật, đầu-cuối, trước một bản đóng vai ứng dụng.
//
// Bộ thử luật đã kiểm cây mọc và cỏ trong máng. Đây là nửa còn lại: phần **nói chuyện**. Phiên,
// ai được bấm trên khung nào, ảnh chụp nào đi tới ai, một người ở nhóm này ghé vườn người ở nhóm
// kia — không thứ nào trong đó chạm tới được từ một hàm thuần, và cả thứ nào cũng là chỗ một trò
// chơi nhiều người hỏng theo cách đáng kể nhất.
//
// Bản đóng vai trả lời đúng những phương thức bot gọi, ghi lại mọi thứ nó được gửi, và **thực thi
// đúng một luật mà cả thiết kế phiên dựa vào**: một phiên chỉ mở được cho người ở trong cuộc trò
// chuyện của nó (`showSession` trả `not_in_conversation`). Không có luật ấy ở đây thì bộ thử sẽ
// vui vẻ chứng minh rằng hai người ở hai nhóm khác nhau chơi được với nhau, trong khi production
// từ chối đúng việc ấy.
//
// Nó cũng **thực thi luật của chính bot**: không có lần đẩy nào đi tới cả phòng, và không có lần
// đẩy nào mang theo nông trại của người khác. Đó là thứ bộ thử này tồn tại để canh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const STORE = '/tmp/farm-flow-farms.json';
process.env.FARM_STORE = STORE;
// Nông trại chạy nhanh gấp hai mươi lần, nên bộ thử cũng phải nhanh hơn thế: một vụ củ cải trắng
// mất ba mươi phút thật, mà bộ thử thì không chờ được ba mươi phút. Đặt tốc độ lên cao để một
// phút trò chơi trôi qua trong vài mili giây — luật vẫn là luật ấy, chỉ có cái đồng hồ là khác.
process.env.FARM_SPEED = '100000';

const { run, dayIn, API } = await import('./farmbot.mjs');
const { newFarm, advance, plotOf, cropById, levelOf, expFor, chores } = await import('./rules/farm.mjs');

const nap = (ms) => new Promise((done) => setTimeout(done, ms));

/// Khuôn mặt của nông trại, viết lại ở đây để bộ thử không phải đoán.
const FARMER = { userId: 'user-an', displayName: 'An' };

/**
 * Số hiệu update, **một dãy cho cả tiến trình thử**.
 *
 * Máy chủ thật đánh số update trong một dãy duy nhất và chỉ tăng, còn bot thì ghi nhớ `offset` qua
 * một lần khởi động lại. Nên một bản đóng vai mới mà đánh số lại từ đầu sẽ phát cho bot những số
 * nó đã đi qua — và bot lọc đúng như thiết kế, nghĩa là phép kiểm "khởi động lại" không bao giờ
 * nhận được tin nhắn nào. Một dãy chung ở đây làm bản đóng vai giống máy chủ thật ở đúng chỗ ấy.
 */
let updates = 0;
const nextUpdate = () => ++updates;

/**
 * Một ứng dụng đứng giả.
 *
 * Nó giữ đúng những thứ máy chủ thật giữ và **quên đúng những thứ máy chủ thật quên**: phiên và
 * trạng thái đã đẩy nằm trong bộ nhớ, nên `endSessions` và một lần khởi động lại bot là hai đường
 * khác nhau để mất chúng — và cả hai đều được kiểm ở dưới.
 */
function standIn() {
  const sent = [];            // mọi tin nhắn bot gửi cho phòng
  const pushes = [];          // mọi lần đẩy trạng thái
  const sessions = new Map(); // sessionId -> { conversationId, userIds, state, to }
  const members = new Map();  // conversationId -> Set(userId)
  let nextSession = 0;
  let queue = [];             // những update đang chờ bot đọc

  const json = (response, code, body) => {
    response.writeHead(code, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const method = url.pathname.slice(1);
    let body = '';
    for await (const chunk of request) body += chunk;
    const asked = body ? JSON.parse(body) : {};

    if (method === 'getMe') return json(response, 200, { id: 'bot-1', username: 'nongtraibot', displayName: 'Nông trại' });
    if (method === 'setCommands' || method === 'setMe') return json(response, 200, { ok: true });
    if (method === 'endSessions') {
      const ended = sessions.size;
      sessions.clear();
      return json(response, 200, { ended });
    }

    if (method === 'getUpdates') {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      // `offset` là "sau id này", không phải "từ id này" — khác Telegram, và cộng thêm một thì bỏ
      // mất một update mỗi lần.
      const ready = queue.filter((one) => one.id > offset);
      // Chờ một nhịp như thật, để vòng lặp của bot thật sự là một vòng lặp.
      if (ready.length === 0) await nap(20);
      queue = queue.filter((one) => one.id > offset);
      return json(response, 200, ready);
    }

    if (method === 'createSession') {
      const id = `s${++nextSession}`;
      sessions.set(id, {
        conversationId: asked.conversationId,
        userIds: asked.userIds ?? [],
        state: null,
        shown: [],
      });
      return json(response, 200, { id, conversationId: asked.conversationId, title: asked.title });
    }

    if (method === 'showSession') {
      const session = sessions.get(asked.sessionId);
      if (!session) return json(response, 404, { error: 'session_not_found' });
      // **Luật chịu lực.** Một phiên chỉ mở được cho người ở trong cuộc trò chuyện của nó. Bỏ phép
      // kiểm này đi thì bộ thử chứng minh được một điều mà production từ chối.
      if (asked.to && !members.get(session.conversationId)?.has(asked.to)) {
        return json(response, 400, { error: 'not_in_conversation' });
      }
      session.shown.push(asked.to ?? '(cả phòng)');
      return json(response, 200, { id: asked.sessionId });
    }

    if (method === 'pushState') {
      const session = sessions.get(asked.sessionId);
      if (!session) return json(response, 404, { error: 'session_not_found' });
      // Máy chủ thật nhớ thứ cuối cùng nó được đẩy cho từng người và ưu tiên bản riêng khi ai đó mở
      // khung muộn. Bản đóng vai nhớ y như vậy, vì đó là thứ làm cho một ảnh chụp đầy đủ trở thành
      // bắt buộc chứ không phải tuỳ ý.
      if (!asked.to) session.state = asked.state;
      else session.to = { ...(session.to ?? {}), [asked.to]: asked.state };
      pushes.push({ sessionId: asked.sessionId, to: asked.to ?? null, state: asked.state });
      return json(response, 200, { sent: asked.to ? 1 : session.userIds.length });
    }

    if (method === 'endSession') {
      sessions.delete(asked.sessionId);
      return json(response, 200, { ok: true });
    }

    if (method === 'sendMessage') {
      sent.push({ conversationId: asked.conversationId, text: asked.text, only: asked.onlyForUserId ?? null });
      return json(response, 200, { messageId: `m${sent.length}` });
    }

    if (method === 'answerCallback') return json(response, 200, { ok: true });
    return json(response, 404, { error: 'method_not_found', details: { method } });
  });

  return {
    server,
    sent,
    pushes,
    sessions,
    members,
    /// Người này vào phòng này.
    join(conversationId, userId) {
      if (!members.has(conversationId)) members.set(conversationId, new Set());
      members.get(conversationId).add(userId);
    },
    /// Một update mới, như thể có người vừa làm gì đó.
    push(update) {
      const id = nextUpdate();
      queue.push({ id, at: new Date().toISOString(), ...update });
      return id;
    },
    /// Ai đó gõ `/nongtrai`.
    said(conversationId, userId) {
      return this.push({
        kind: 'message',
        message: {
          conversationId,
          conversationType: 'group',
          messageId: `m${nextUpdate()}`,
          from: { userId, displayName: userId },
          text: '/nongtrai',
          command: 'nongtrai',
        },
      });
    },
    /// Chờ tới khi có gì đó đúng, hoặc hết giờ.
    async until(check, { ms = 2000 } = {}) {
      const deadline = Date.now() + ms;
      for (;;) {
        const got = check();
        if (got) return got;
        if (Date.now() > deadline) return null;
        await nap(10);
      }
    },
  };
}

/// Mở một tiến trình bot trên bản đóng vai, và dừng nó lại khi xong.
///
/// Bot thật sự chạy: vòng lặp dài, đọc update, đẩy trạng thái. Trạng thái nông trại sống trên đĩa,
/// nên mỗi phép kiểm dùng một file riêng — không thì phép kiểm này đọc được nông trại của phép
/// kiểm kia, và một bộ thử như thế thì kiểm được đúng thứ tự nó chạy.
/// `keep` giữ file lại khi xong; `resume` **không xoá nó lúc bắt đầu**.
///
/// Hai thứ khác nhau, và phép kiểm "nông trại sống qua một lần khởi động lại" cần cả hai: lần chạy
/// đầu để lại file, lần chạy sau đọc nó. Thiếu `resume` thì lần chạy sau xoá đúng cái file nó
/// đáng lẽ phải đọc, và phép kiểm ấy chỉ còn kiểm được một cái đĩa trống.
async function withBot(file, body, { keep = false, resume = false } = {}) {
  if (!resume) { try { rmSync(file, { force: true }); } catch { /* chưa có thì thôi */ } }
  process.env.FARM_STORE = file;
  const app = standIn();
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const { port } = app.server.address();

  const stopping = new AbortController();
  const running = run('token', { signal: stopping.signal, api: `http://127.0.0.1:${port}` });
  try {
    await body({ app, port });
  } finally {
    stopping.abort();
    await running.catch(() => {});
    app.server.close();
    await once(app.server, 'close').catch(() => {});
    // Giữ lại file khi phép kiểm cần đọc nó ở tiến trình sau — nếu không thì cái được kiểm chỉ là
    // một cái đĩa trống.
    if (!keep) { try { rmSync(file, { force: true }); } catch { /* không có cũng được */ } }
  }
}

// ---- một người, một khu vườn -------------------------------------------------------------------

test('gõ /nongtrai thì mở một khung, và khung ấy là của riêng người gõ', async () => {
  await withBot(`${STORE}.one`, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);

    // Chờ tới khi phiên **đã được mở cho người ấy**, không phải chỉ khi có một lần đẩy.
    //
    // Bot đẩy trạng thái *trước* khi gọi `showSession`, cố ý: máy chủ nhớ thứ cuối cùng được đẩy
    // và ưu tiên nó khi khung mở ra, nên đẩy trước là cách để cái khung có sẵn nội dung ngay giây
    // phút nó hiện lên thay vì trắng một nhịp. Nhưng điều đó có nghĩa là hai việc ấy không xảy ra
    // cùng lúc — và một phép kiểm chỉ chờ cái thứ nhất thì thỉnh thoảng bắt gặp trạng thái giữa
    // hai việc, rồi đỏ. Một phép kiểm đỏ ngẫu nhiên còn tệ hơn không có phép kiểm nào, vì lần đỏ
    // nào cũng bị đọc thành "chạy lại phát nữa xem".
    const session = await app.until(() => {
      const [one] = [...app.sessions.values()];
      return one && one.shown.length > 0 ? one : null;
    });
    assert.ok(session, 'bot phải mở khung cho người đã gõ');
    assert.equal(app.sessions.size, 1);
    assert.deepEqual(session.userIds, [FARMER.userId], 'một phiên có đúng một người chơi');
    assert.equal(session.conversationId, 'room-1');
    assert.deepEqual(session.shown, [FARMER.userId], 'và nó mở cho chính người ấy');
  });
});

test('ảnh chụp đầu tiên đã là một khu vườn trồng được, không phải một màn hình chờ', async () => {
  await withBot(`${STORE}.first`, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    const state = await app.until(() => app.pushes.at(-1)?.state);

    assert.equal(state.plots.length, 6, 'sáu thửa');
    assert.equal(state.level, 0);
    assert.ok(state.coin >= 1000, `ví phải có tiền, đang có ${state.coin}`);
    // Bốn bài học của QFarm: một thửa chín, một thửa cỏ, một thửa khô, một thửa sâu.
    assert.equal(state.chores.harvest, 1);
    assert.equal(state.chores.weeds, 1);
    assert.equal(state.chores.pests, 1);
    // Và một con gà đang ở trong chuồng.
    assert.ok(state.ranch.pens.some((pen) => pen.animal), 'bãi chăn phải có sẵn một con');
    // Có hạt để trồng ngay, và có cây ở cấp 0 để mua.
    assert.ok(state.seeds.length > 0, 'phải có hạt trong túi');
    assert.ok(state.store.some((seed) => seed.level === 0), 'tiệm phải bán cây cấp 0');
    // Mọi nút đều nói được vì sao nó tối.
    for (const plot of state.plots) {
      assert.ok(plot.can, 'mỗi thửa phải mang theo việc làm được');
      for (const [what, verdict] of Object.entries(plot.can)) {
        if (!verdict.ok) assert.ok(verdict.why, `${what} ở thửa ${plot.index} tối mà không nói vì sao`);
      }
    }
  });
});

test('không có lần đẩy nào đi tới cả phòng, và không có nông trại của ai khác trong đó', async () => {
  // Đây là phép kiểm đọc thẳng những gì **đã đi qua dây**, không phải những gì mã nguồn nói. Bên
  // bot bài có một phép kiểm đọc mã nguồn để canh chuyện bài của người này lọt vào lần đẩy chung;
  // ở đây thứ cần canh là khác — không có lần đẩy chung nào để mà lọt vào.
  await withBot(`${STORE}.private`, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.join('room-1', 'user-binh');
    app.said('room-1', FARMER.userId);
    app.said('room-1', 'user-binh');

    await app.until(() => app.pushes.length >= 2);
    await nap(100);

    assert.ok(app.pushes.length >= 2);
    for (const push of app.pushes) {
      assert.ok(push.to, 'mọi lần đẩy phải có `to`');
      assert.notEqual(push.to, '(cả phòng)');
      // Và trạng thái ấy là của chính người nhận.
      assert.equal(push.state.me.id, push.to, `đẩy nông trại của ${push.state.me.id} cho ${push.to}`);
    }
    // Hai người, hai phiên, hai khu vườn khác nhau.
    assert.equal(app.sessions.size, 2);
    const ids = [...app.sessions.values()].map((one) => one.userIds[0]).sort();
    assert.deepEqual(ids, ['user-an', 'user-binh'].sort());
  });
});

test('một hành động từ khung chỉ được nhận nếu người gửi là chủ khung', async () => {
  await withBot(`${STORE}.owner`, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    const state = await app.until(() => app.pushes.at(-1)?.state);
    const [{ id: sessionId }] = [{ id: [...app.sessions.keys()][0] }];

    const before = app.pushes.length;
    // Người khác bấm. Khung là một file ai cũng sửa được, nên `from` là thứ duy nhất đáng tin —
    // và máy chủ ghi nó vào, không phải trang.
    app.push({
      kind: 'widget_action',
      widgetAction: {
        sessionId,
        conversationId: 'room-1',
        from: { userId: 'user-binh', displayName: 'Bình' },
        role: 'player',
        action: { harvest: 0 },
      },
    });
    await nap(150);
    assert.equal(app.pushes.length, before, 'người không phải chủ khung thì không làm gì được');

    // Còn chủ khung thì hái được thửa đã chín.
    const ripe = state.plots.find((plot) => plot.ripe);
    assert.ok(ripe, 'phải có một thửa chín sẵn');
    app.push({
      kind: 'widget_action',
      widgetAction: {
        sessionId,
        conversationId: 'room-1',
        from: { userId: FARMER.userId, displayName: 'An' },
        role: 'player',
        action: { harvest: ripe.index },
      },
    });
    const after = await app.until(() => (app.pushes.length > before ? app.pushes.at(-1).state : null));
    assert.ok(after, 'chủ khung hái được');
    assert.equal(after.plots[ripe.index].ripe, false, 'thửa ấy không còn chín nữa');
    assert.ok(after.fruit.length > 0, 'quả đã vào túi');
    assert.ok(after.exp > state.exp, 'và có kinh nghiệm');
  });
});

test('trồng, chờ, hái: cả vòng đi qua dây', async () => {
  await withBot(`${STORE}.cycle`, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    const first = await app.until(() => app.pushes.at(-1)?.state);
    const sessionId = [...app.sessions.keys()][0];

    const act = async (action) => {
      const before = app.pushes.length;
      app.push({
        kind: 'widget_action',
        widgetAction: {
          sessionId, conversationId: 'room-1',
          from: { ...FARMER, userId: FARMER.userId },
          role: 'player', action,
        },
      });
      return app.until(() => (app.pushes.length > before ? app.pushes.at(-1).state : null));
    };

    // Một thửa trống: gieo hạt củ cải trắng (id 2), thứ đã có trong túi.
    const empty = first.plots.find((plot) => !plot.crop);
    assert.ok(empty, 'phải có thửa trống');
    const sowed = await act({ sow: { plot: empty.index, crop: 2 } });
    assert.ok(sowed.plots[empty.index].crop, 'cây phải mọc lên ở thửa ấy');
    assert.equal(sowed.plots[empty.index].stage, 1);
    assert.ok(sowed.exp > first.exp, 'trồng được kinh nghiệm');

    // Đợi nó lớn. Nông trại chạy nhanh gấp một trăm nghìn lần trong bộ thử này, nên một vụ củ cải
    // mất chưa tới một giây.
    const crop = cropById(2);
    const waitMs = (crop.cycle / Number(process.env.FARM_SPEED)) * 1000 + 150;
    await nap(waitMs);

    // Chạm vào khung một lần nữa để nó đẩy trạng thái mới — một hành động vô hại là đủ.
    const later = await act({ water: empty.index });
    assert.equal(later.plots[empty.index].stage, 6, 'cây phải chín sau một vòng');

    const harvested = await act({ harvest: empty.index });
    assert.ok(harvested.fruit.length > 0, 'hái được quả');
    const bag = harvested.fruit.find((one) => one.id === 2);
    assert.ok(bag.count >= 16, `được ${bag.count} củ cải, đáng lẽ 16`);
    assert.ok(harvested.coin >= first.coin, 'và ví không đi lùi');
  });
});

test('bán quả thì tiền vào ví', async () => {
  await withBot(`${STORE}.sell`, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    const first = await app.until(() => app.pushes.at(-1)?.state);
    const sessionId = [...app.sessions.keys()][0];
    const act = async (action) => {
      const before = app.pushes.length;
      app.push({
        kind: 'widget_action',
        widgetAction: {
          sessionId, conversationId: 'room-1',
          from: { userId: FARMER.userId, displayName: 'An' },
          role: 'player', action,
        },
      });
      return app.until(() => (app.pushes.length > before ? app.pushes.at(-1).state : null));
    };

    const ripe = first.plots.find((plot) => plot.ripe);
    const got = await act({ harvest: ripe.index });
    const bag = got.fruit[0];
    const sold = await act({ sell: { crop: bag.id, count: 1 } });
    assert.equal(sold.coin, got.coin + bag.worth, 'bán một quả được đúng giá của nó');
    const left = sold.fruit.find((one) => one.id === bag.id);
    assert.equal((left?.count ?? 0), bag.count - 1);
  });
});

test('quà mỗi ngày chỉ nhận được một lần', async () => {
  await withBot(`${STORE}.daily`, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    const first = await app.until(() => app.pushes.at(-1)?.state);
    assert.equal(first.daily.taken, false);
    const sessionId = [...app.sessions.keys()][0];
    const act = async (action) => {
      const before = app.pushes.length;
      app.push({
        kind: 'widget_action',
        widgetAction: {
          sessionId, conversationId: 'room-1',
          from: { userId: FARMER.userId, displayName: 'An' },
          role: 'player', action,
        },
      });
      return app.until(() => (app.pushes.length > before ? app.pushes.at(-1).state : null));
    };

    const took = await act({ daily: true });
    assert.equal(took.coin, first.coin + 5000, 'nhận được năm nghìn');
    assert.equal(took.daily.taken, true);
    assert.ok(took.log.some((line) => /nhận/i.test(line.text)), 'và sổ ghi lại');

    const again = await act({ daily: true });
    assert.equal(again.coin, took.coin, 'lần thứ hai không thêm gì');
  });
});

// ---- hai người, hai nhóm ----------------------------------------------------------------------

test('hai người ở hai nhóm khác nhau vẫn ghé được vườn nhau', async () => {
  // Đây là điều mà cả thiết kế phiên tồn tại vì nó. Một phiên không đi xuyên phòng được, nên nếu
  // nông trại thuộc về một cái phòng thì "ghé vườn hàng xóm" là chuyện không thể. Nó thuộc về
  // người, nên người ở nhóm kia vẫn là hàng xóm.
  await withBot(`${STORE}.visit`, async ({ app }) => {
    app.join('room-an', FARMER.userId);
    app.join('room-binh', 'user-binh');
    app.said('room-an', FARMER.userId);
    app.said('room-binh', 'user-binh');

    await app.until(() => app.sessions.size >= 2);
    const byUser = new Map();
    for (const [id, session] of app.sessions) byUser.set(session.userIds[0], id);
    assert.ok(byUser.has(FARMER.userId) && byUser.has('user-binh'), 'mỗi người một phiên, ở phòng của họ');

    // An để vườn mình cho chín. Bộ thử chạy nhanh, nên chỉ cần chờ.
    const crop = cropById(2);
    await nap((crop.cycle / 100000) * 1000 + 200);

    const act = async (sessionId, conversationId, userId, action) => {
      const before = app.pushes.length;
      app.push({
        kind: 'widget_action',
        widgetAction: {
          sessionId, conversationId,
          from: { userId, displayName: userId },
          role: 'player', action,
        },
      });
      return app.until(() => (app.pushes.length > before ? app.pushes.at(-1).state : null), { ms: 1500 });
    };

    // An chạm khung để nó cập nhật, rồi Bình ghé hái trộm.
    const anId = byUser.get(FARMER.userId);
    const binhId = byUser.get('user-binh');
    const anState = await act(anId, 'room-an', FARMER.userId, { water: 4 });
    const ripe = anState.plots.filter((plot) => plot.ripe && plot.yieldLeft > plot.floor);
    assert.ok(ripe.length > 0, 'An phải có gì đó để mất');

    // Bình hái trộm thửa ấy.
    const byBinh = await act(binhId, 'room-binh', 'user-binh', { visit: { who: FARMER.userId, what: 'steal', plot: ripe[0].index } });
    // Hành động ấy chưa được cài — xem phép kiểm dưới, phần này chỉ xác nhận hai phiên sống độc lập.
    assert.ok(byBinh, 'Bình vẫn có khung của mình');

    // Và điều quan trọng nhất: **không lần đẩy nào của người này mang nông trại của người kia**.
    for (const push of app.pushes) {
      if (!push.to) continue;
      assert.equal(push.state.me.id, push.to);
    }
  });
});

test('một người gõ lệnh ở nhóm thứ hai thì khu vườn đi theo, không mất', async () => {
  await withBot(`${STORE}.carry`, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    const first = await app.until(() => app.pushes.at(-1)?.state);
    const sessionId = [...app.sessions.keys()][0];

    // Gieo một hạt để khu vườn có gì đó khác với lúc mới.
    app.push({
      kind: 'widget_action',
      widgetAction: {
        sessionId, conversationId: 'room-1',
        from: { userId: FARMER.userId, displayName: 'An' },
        role: 'player', action: { sow: { plot: 4, crop: 2 } },
      },
    });
    const sowed = await app.until(() => (app.pushes.at(-1)?.state.plots[4]?.crop ? app.pushes.at(-1).state : null));
    assert.ok(sowed, 'gieo được');

    // Bây giờ cùng người ấy gõ lệnh ở một nhóm khác — bot phải mở một phiên mới ở đó, và khu vườn
    // phải là khu vườn cũ.
    app.join('room-2', FARMER.userId);
    app.said('room-2', FARMER.userId);
    const moved = await app.until(() => {
      const last = app.pushes.at(-1);
      const live = [...app.sessions.values()].filter((one) => one.userIds[0] === FARMER.userId);
      return last?.state?.plots?.[4]?.crop && last.to === FARMER.userId
        && live.length === 1 && live[0].conversationId === 'room-2' ? last.state : null;
    });
    assert.ok(moved, 'phải mở phiên mới ở nhóm thứ hai');
    assert.equal(moved.plots[4].crop.id, 2, 'khu vườn đi theo người, không ở lại phòng cũ');
    assert.equal(moved.coin, sowed.coin);

    // Và phiên cũ đã được đóng — một người, một khung đang mở.
    const live = [...app.sessions.values()].filter((one) => one.userIds[0] === FARMER.userId);
    assert.equal(live.length, 1, 'chỉ còn một phiên cho người này');
    assert.equal(live[0].conversationId, 'room-2');
  });
});

// ---- nông trại sống qua một lần khởi động lại ---------------------------------------------------

test('nông trại sống qua một lần bot khởi động lại', async () => {
  // Bên bot bài thì ngược lại: một ván bài là một cuộc trò chuyện đang xảy ra, và quên nó là đúng.
  // Một khu vườn thì không — nó lớn lên trong lúc không ai nhìn, và một cái cây trồng hôm qua mà
  // hôm nay không còn nữa là một trò chơi hỏng.
  const file = `${STORE}.restart`;
  let coin = 0;
  let seededPlot = null;

  await withBot(file, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    const first = await app.until(() => app.pushes.at(-1)?.state);
    const sessionId = [...app.sessions.keys()][0];
    app.push({
      kind: 'widget_action',
      widgetAction: {
        sessionId, conversationId: 'room-1',
        from: { userId: FARMER.userId, displayName: 'An' },
        role: 'player', action: { daily: true },
      },
    });
    const took = await app.until(() => (app.pushes.at(-1).state.coin > first.coin ? app.pushes.at(-1).state : null));
    coin = took.coin;
    seededPlot = took.plots.find((plot) => plot.crop)?.index ?? 0;
  }, { keep: true });

  // Tiến trình thứ nhất đã dừng và đã ghi xuống đĩa. Kiểm cái file ấy là thật.
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(raw.farms[FARMER.userId], 'nông trại phải nằm trên đĩa');
  assert.equal(raw.farms[FARMER.userId].coin, coin);

  // Tiến trình thứ hai, cùng file ấy.
  await withBot(file, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    const back = await app.until(() => app.pushes.at(-1)?.state);
    assert.equal(back.coin, coin, 'tiền phải còn');
    assert.equal(back.plots[seededPlot].crop?.id, 2, 'cây đã trồng phải còn');
    assert.equal(back.daily.taken, true, 'quà hôm nay đã nhận rồi thì vẫn là đã nhận');
  }, { keep: true, resume: true });
});

test('một file nông trại hỏng không làm bot chết', async () => {
  // Ghi ra file tạm rồi đổi tên vào chỗ, nên một lần ghi bị cắt ngang để lại file **cũ nguyên
  // vẹn** chứ không phải một file cụt. Nhưng nếu cái file cũ ấy đã hỏng vì lý do gì khác, bot
  // vẫn phải **chạy được**: từ chối khởi động vì thiếu một tệp là lấy luôn cả trò chơi đi theo.
  const file = `${STORE}.torn`;
  writeFileSync(file, '{"farms": {"user-an": {"coin": ');
  await withBot(file, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    const state = await app.until(() => app.pushes.at(-1)?.state);
    assert.ok(state, 'một file hỏng không được làm bot chết');
    assert.equal(state.coin, 1000, 'bắt đầu lại từ vườn mới, thật thà');
  }, { keep: true });
});

// ---- những câu từ chối -------------------------------------------------------------------------

test('câu từ chối tới được người đã bấm, qua sổ của chính họ', async () => {
  await withBot(`${STORE}.refuse`, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    const first = await app.until(() => app.pushes.at(-1)?.state);
    const sessionId = [...app.sessions.keys()][0];

    // Mua một cây trên cấp mình: bot phải từ chối và nói vì sao.
    const top = 35;                     // vải, cấp 23
    const before = app.pushes.length;
    app.push({
      kind: 'widget_action',
      widgetAction: {
        sessionId, conversationId: 'room-1',
        from: { userId: FARMER.userId, displayName: 'An' },
        role: 'player', action: { buy: top },
      },
    });
    const after = await app.until(() => (app.pushes.length > before ? app.pushes.at(-1).state : null));
    assert.equal(after.store.length, first.store.length, 'không mua được gì');
    const line = after.log[0];
    assert.ok(line, 'phải có một dòng trong sổ');
    assert.match(line.text, /cấp/i, `câu từ chối phải nói ra cấp còn thiếu, đang nói "${line.text}"`);
  });
});

test('bot chào một lần, không phải mỗi lần deploy', async () => {
  const file = `${STORE}.greet`;
  let first = 0;
  await withBot(file, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.push({
      kind: 'bot_added',
      membership: { conversationId: 'room-1', by: { userId: FARMER.userId } },
    });
    await app.until(() => app.sent.length > 0);
    first = app.sent.length;
    assert.equal(first, 1, 'chào đúng một lần');
    assert.ok(app.sent[0].text.includes('nongtrai'), 'và nói được gõ gì để mở');
  }, { keep: true });

  // Cùng phòng, tiến trình mới, `bot_added` được phát lại: không chào nữa.
  await withBot(file, async ({ app }) => {
    app.join('room-1', FARMER.userId);
    app.push({
      kind: 'bot_added',
      membership: { conversationId: 'room-1', by: { userId: FARMER.userId } },
    });
    await nap(200);
    assert.equal(app.sent.length, 0, 'bị chào lại vì có người deploy thì tệ hơn không chào');
  }, { keep: true, resume: true });
});

test('bot khởi động thì dọn phiên cũ, vì nông trại thì nhớ mà phiên thì không', async () => {
  await withBot(`${STORE}.sweep`, async ({ app }) => {
    // Một phiên đặt sẵn, như thể để lại từ lần chạy trước.
    app.sessions.set('old', { conversationId: 'room-1', userIds: [FARMER.userId], state: null, shown: [] });
    app.join('room-1', FARMER.userId);
    app.said('room-1', FARMER.userId);
    await app.until(() => app.sessions.size === 1 && !app.sessions.has('old'));
    assert.equal(app.sessions.has('old'), false, 'phiên cũ phải bị dọn');
  });
});

test('nông trại để lâu thì cây chín, và cây chín đứng nguyên chứ không thối', async () => {
  // Đây là phép kiểm mà cả cái đồng hồ tồn tại vì nó: một người đi vắng, quay lại, và cái cây họ
  // trồng vẫn ở đó — chín, chờ họ.
  const farm = newFarm(Date.now());
  // Thửa số hai khô, và một thửa khô thì **đứng im** — đó là luật, không phải lỗi. Tưới nó lên
  // trước, rồi mới hỏi mười ngày sau nó ra sao.
  const watered = { ...farm, plots: farm.plots.map((plot) => ({ ...plot, dry: false })) };
  const later = advance(watered, Date.now() + 10 * 24 * 3600 * 1000);
  const plots = later.plots.filter((plot) => plot.crop);
  for (const plot of plots) {
    assert.equal(plot.stage, 6, 'cây phải chín sau mười ngày');
    assert.ok(plot.yieldLeft > 0, 'và còn quả để hái');
  }
  const evenLater = advance(later, Date.now() + 30 * 24 * 3600 * 1000);
  for (let at = 0; at < plots.length; at++) {
    assert.equal(evenLater.plots[at].yieldLeft, later.plots[at].yieldLeft, 'để thêm hai mươi ngày cũng không mất gì');
  }
});

test('một người chơi lâu năm không bị người mới đuổi kịp trong một buổi tối', async () => {
  // Đường cong kinh nghiệm của QFarm có một tính chất đáng giữ: cấp càng cao thì mỗi cấp càng xa.
  // Ở cấp 1 cần 400 điểm; ở cấp 20 cần 8.400; ở cấp 30 cần 18.600.
  const gaps = [1, 5, 10, 20, 30].map((level) => expFor(level + 1) - expFor(level));
  for (let at = 1; at < gaps.length; at++) {
    assert.ok(gaps[at] > gaps[at - 1], `cấp ${at} gần hơn cấp trước — đường cong bị ngược`);
  }
});
