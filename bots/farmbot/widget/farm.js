/**
 * Trang trong khung: vẽ ra những gì bot đẩy tới, và gửi về những gì người ta bấm.
 *
 * **Trang này không quyết định gì cả.** Nó không biết một cây mất bao lâu để lớn, không biết hái
 * trộm được mấy quả, không biết một thửa đã bị ai hái chưa. Mọi con số nó vẽ ra đều đến từ bot
 * trong `state`, và mọi cái nút nó tô sáng đều dựa vào một câu trả lời bot đã đưa — `{ok: true}`
 * hoặc `{ok: false, why}`.
 *
 * Đó không phải kiểu cách. Trang này là **một file ai cũng sửa được** — nó được tải về máy từng
 * người chơi, và không có gì kiểm được nó. Nên nếu nó tự quyết định một vụ mùa đáng bao nhiêu, thì
 * người sửa nó quyết định vụ mùa đáng bao nhiêu. Luật nằm ở phía bot vì đó là phía duy nhất người
 * chơi không sửa được, và ở đây chép lại luật ấy — dù chỉ để vẽ một cái nút — là tạo ra bản sao
 * thứ hai của một luật, bản sao ấy sẽ có ngày quên mất một điều.
 */
'use strict';

/// Cầu sang ứng dụng. `index.html` nạp `zeplao.js` trước file này, nên nó có ở đây.
const z = window.Zeplao;
const draw = window.farmArt;

/// Trạng thái bot đẩy tới, nguyên văn.
let state = null;

/// Màn nào đang mở, và nó đang nói về cái gì.
let tab = 'farm';
let sheet = null;          // { kind, index } — thửa đang mở, hoặc chuồng đang mở
let shopTab = 'seed';
let sayTimer = null;

const $ = (id) => document.getElementById(id);

// ---- những thứ dùng chung ---------------------------------------------------------------------

/**
 * Một cái nút.
 *
 * Nút nào cũng phải trả lời được hai câu: **bấm thì làm gì**, và **nếu không bấm được thì vì sao**.
 * Câu thứ hai là thứ hàm này tồn tại vì nó: một cái nút sáng rồi bấm không ra gì tệ hơn một cái
 * nút tối có ghi lý do, vì cái thứ nhất dạy người ta rằng các nút ở đây không đáng tin.
 */
function button(text, { kind = '', verdict = null, onPress, badge = '' } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `btn ${kind}`.trim();
  el.innerHTML = `${badge}<span>${draw.escape(text)}</span>`;
  if (verdict && verdict.ok === false) {
    el.disabled = true;
    // Lý do nằm **trên nút**, không nằm trong một chỗ trợ giúp nào khác: người ta đọc nó đúng lúc
    // họ đang tự hỏi vì sao cái nút này không bấm được.
    if (verdict.why) el.title = verdict.why;
    const why = document.createElement('small');
    why.textContent = verdict.why ?? '';
    el.appendChild(why);
  } else if (onPress) {
    el.onclick = () => {
      // Bấm một lần là một lần. Một cái nút có thể bấm hai lần trong lúc chờ máy chủ trả lời là
      // một cái nút trồng hai cái cây.
      el.disabled = true;
      onPress();
    };
  } else {
    el.disabled = true;
  }
  return el;
}

/// Nói một câu, ở chỗ duy nhất nói được. Tự tắt sau ba giây.
function say(text) {
  const box = $('says');
  box.textContent = text;
  box.hidden = false;
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => { box.hidden = true; }, 3000);
}

/// Gửi một hành động về bot.
const send = (action) => z.send(action);

// ---- cái khung không nhúc nhích ----------------------------------------------------------------

/// Ai đang nhìn, cấp, và ví. Ba thứ này có mặt trên **mọi** màn, từ khung hình đầu tiên.
function drawBar() {
  if (!state) return;
  $('who').textContent = state.me.name;
  $('lv').textContent = `Cấp ${state.level}`;
  countTo($('coin-num'), state.coin);
  // Dấu `+` chỉ hiện khi có gì đó để nhận. Một dấu `+` lúc nào cũng có là một dấu `+` không ai học
  // được là nó ở đó vì cái gì.
  $('plus').hidden = Boolean(state.daily?.taken);
}

/// Đếm lên tới một con số thay vì nhảy thẳng tới nó.
///
/// Vàng là thứ cả trò chơi này chơi vì nó, và một con số nhảy từ 1.000 lên 1.272 trong một khung
/// hình thì không ai thấy mình vừa được thêm 272. Đếm lên thì thấy. Và nó **dừng lại** ở đích —
/// một con số chạy mãi là một con số người ta phải chờ.
function countTo(el, to) {
  const from = Number(el.dataset.at ?? to);
  if (from === to) { el.textContent = to.toLocaleString('vi-VN'); return; }
  el.dataset.at = String(to);

  const steps = 12;
  let step = 0;
  clearInterval(el.__timer);
  el.__timer = setInterval(() => {
    step++;
    const value = Math.round(from + ((to - from) * step) / steps);
    el.textContent = value.toLocaleString('vi-VN');
    if (step >= steps) {
      clearInterval(el.__timer);
      el.textContent = to.toLocaleString('vi-VN');
    }
  }, 30);
}

// ---- khu vườn ----------------------------------------------------------------------------------

function showFarm() {
  const box = $('plots');
  box.innerHTML = '';

  for (const plot of state.plots) {
    const label = plot.crop
      ? (plot.etaMs !== null && plot.etaMs > 0
        ? `${draw.until(plot.etaMs)}`
        : plot.ripe
          ? `${plot.yieldLeft} quả`
          : plot.dead ? 'cần dọn' : 'chín')
      : 'trống';
    const holder = document.createElement('div');
    holder.innerHTML = draw.plot(plot, plot.index, label);
    const node = holder.firstElementChild;

    // Chạm một thửa là mở màn của nó — trừ khi thửa ấy đang chín, và lúc ấy chạm là hái. Hái là
    // việc người ta làm nhiều nhất, và bắt họ đi qua một màn nữa để hái là bắt họ đi qua một màn
    // nữa mười tám lần một buổi.
    node.onclick = () => {
      if (plot.ripe && plot.can.harvest.ok) {
        node.disabled = true;
        send({ harvest: plot.index });
        return;
      }
      openSheet({ kind: 'plot', index: plot.index });
    };
    box.appendChild(node);
  }

  // Còn thửa nào khai được thì nói ra, và nói ra giá — một cái nút "khai thêm đất" không kèm giá
  // là một cái nút người ta bấm rồi mới biết mình vừa tiêu gì.
  if (state.land.have < state.land.max) {
    const land = document.createElement('div');
    land.className = 'land';
    land.appendChild(button(
      state.land.next
        ? `Khai thêm thửa (${state.land.next.cost.toLocaleString('vi-VN')})`
        : `Khai thêm thửa (${state.land.have}/${state.land.max})`,
      {
        kind: 'wide',
        verdict: state.land.next ? { ok: true } : { ok: false, why: state.land.why ?? '' },
        onPress: () => send({ land: true }),
      },
    ));
    box.appendChild(land);
  }
}

/// Một màn cho một thửa: hái, tưới, nhổ cỏ, bắt sâu, dọn, hoặc gieo.
function drawPlotSheet(index) {
  const plot = state.plots[index];
  const body = $('sheet-body');
  body.innerHTML = '';
  $('sheet-title').textContent = plot.crop ? plot.crop.name : 'Thửa trống';

  const art = document.createElement('div');
  art.className = 'sheet-art';
  art.innerHTML = draw.plant(plot.crop ? plot.crop.id : 0, plot.dead ? 7 : plot.ripe ? 6 : plot.stage, { dry: plot.dry });
  body.appendChild(art);

  const facts = document.createElement('div');
  facts.className = 'facts';
  const rows = [];
  if (plot.crop) {
    rows.push(['Cây', plot.crop.name]);
    rows.push(['Đang ở', plot.dead ? 'đã tàn' : plot.ripe ? 'chín' : `giai đoạn ${plot.stage}/5`]);
    if (plot.etaMs !== null && plot.etaMs > 0) rows.push(['Chín sau', draw.until(plot.etaMs)]);
    if (plot.ripe) rows.push(['Được', `${plot.yieldLeft} quả`]);
    rows.push(['Hái được', `${plot.crop.picks} lần`]);
  }
  if (plot.weeds) rows.push(['Cỏ dại', `${plot.weeds} — mất ${plot.weeds * 10}% sản lượng`]);
  if (plot.pests) rows.push(['Sâu bọ', `${plot.pests} — mất ${plot.pests * 10}% sản lượng`]);
  if (plot.dry) rows.push(['Đất', 'khô — cây đang đứng im']);
  if (plot.red) rows.push(['Đất đỏ', 'thêm 10% sản lượng']);
  for (const [what, value] of rows) {
    const row = document.createElement('div');
    row.innerHTML = `<span>${draw.escape(what)}</span><b>${draw.escape(value)}</b>`;
    facts.appendChild(row);
  }
  body.appendChild(facts);

  const acts = document.createElement('div');
  acts.className = 'acts';

  if (!plot.crop || plot.dead) {
    if (plot.dead) {
      acts.appendChild(button('Dọn thửa', { kind: 'primary', verdict: plot.can.clear, onPress: () => send({ clear: index }) }));
    }
    // Gieo: chỉ những hạt đang có trong túi, và **hạt nào trồng được ở đây**. Một danh sách đầy đủ
    // các loại hạt là một danh sách mà phần lớn các dòng là những dòng không bấm được.
    const seeds = state.seeds.filter((seed) => seed.count > 0);
    if (seeds.length === 0) {
      const none = document.createElement('p');
      none.className = 'muted';
      none.textContent = 'Hết hạt rồi — mua ở Chợ nhé.';
      acts.appendChild(none);
    }
    for (const seed of seeds) {
      acts.appendChild(button(`${seed.name} (${seed.count})`, {
        kind: 'wide',
        onPress: () => send({ sow: { plot: index, crop: seed.id } }),
      }));
    }
  } else {
    if (plot.ripe && plot.can.harvest.ok) {
      acts.appendChild(button(`Hái ${plot.yieldLeft} quả`, {
        kind: 'primary big', onPress: () => send({ harvest: index }),
      }));
    }
    acts.appendChild(button('Tưới nước', { verdict: plot.can.water, onPress: () => send({ water: index }) }));
    acts.appendChild(button('Nhổ cỏ', { verdict: plot.can.weed, onPress: () => send({ weed: index }) }));
    acts.appendChild(button('Bắt sâu', { verdict: plot.can.pest, onPress: () => send({ pest: index }) }));
    if (!plot.red) {
      acts.appendChild(button(
        plot.can.red.ok ? `Lên đất đỏ (${plot.can.red.cost.toLocaleString('vi-VN')})` : 'Lên đất đỏ',
        { kind: 'quiet', verdict: plot.can.red, onPress: () => send({ red: index }) },
      ));
    }
  }
  body.appendChild(acts);
}

// ---- bãi chăn ----------------------------------------------------------------------------------

function drawRanch() {
  const ranch = state.ranch;
  $('hopper-fill').style.width = `${Math.min(100, (ranch.hopper / ranch.hopperMax) * 100)}%`;
  $('hopper-fill').className = ranch.hungry ? 'dry' : '';
  // Con số quan trọng nhất của cả bãi chăn: còn chạy được bao lâu nữa. Nói ra bằng giờ, vì đó là
  // cách người ta nghĩ về việc rời đi rồi quay lại.
  $('hopper-note').textContent = ranch.hungry
    ? `Hết cỏ — cả bãi đang đứng im (${ranch.hopper} bó)`
    : `${ranch.hopper} bó cỏ · còn chạy ${ranch.lastsHours ?? '—'} giờ`;

  const box = $('pens');
  box.innerHTML = '';
  for (const pen of ranch.pens) {
    const holder = document.createElement('div');
    holder.innerHTML = draw.pen(pen, pen.index);
    const node = holder.firstElementChild;
    node.onclick = () => {
      // Có sản phẩm thì bắt luôn, không hỏi — đó là việc người ta mở bãi chăn ra để làm.
      if (pen.collect.ok) { node.disabled = true; send({ collect: pen.index }); return; }
      if (!pen.animal) { openSheet({ kind: 'pen', index: pen.index }); return; }
      if (pen.butcher.ok) { node.disabled = true; send({ butcher: pen.index }); return; }
      openSheet({ kind: 'pen', index: pen.index });
    };
    box.appendChild(node);
  }

  const row = $('feed-row');
  row.innerHTML = '';
  row.appendChild(button(`Cho ăn 20 bó (${ranch.grass.buy}/bó nếu phải mua)`, {
    kind: 'wide primary',
    verdict: ranch.hopper >= ranch.hopperMax ? { ok: false, why: 'Máng đã đầy.' } : { ok: true },
    onPress: () => send({ feed: 20 }),
  }));

  // Mở thêm chỗ, loại nào cũng được. Nói ra giá trước khi bấm.
  const shops = [
    ['nest', `Mở thêm chuồng (${ranch.nests}/${ranch.pens_max.nest.max})`, ranch.nests],
    ['shed', `Mở thêm bãi (${ranch.sheds}/${ranch.pens_max.shed.max})`, ranch.sheds],
  ];
  for (const [kind, label, have] of shops) {
    const house = ranch.pens_max[kind];
    const full = have >= house.max;
    row.appendChild(button(full ? label : `${label} — ${(house.costs[have] ?? 0).toLocaleString('vi-VN')}`, {
      verdict: full ? { ok: false, why: 'Đã mở hết chỗ.' } : { ok: true },
      onPress: () => send({ house: kind }),
    }));
  }

  if (ranch.mouse) {
    row.appendChild(button('Bắt chuột', { kind: 'primary', onPress: () => send({ mouse: true }) }));
  }
}

function drawPenSheet(index) {
  const pen = state.ranch.pens[index];
  const body = $('sheet-body');
  body.innerHTML = '';
  $('sheet-title').textContent = pen.animal ? pen.animal.name : (pen.house === 'shed' ? 'Bãi trống' : 'Chuồng trống');

  if (pen.animal) {
    const art = document.createElement('div');
    art.className = 'sheet-art';
    art.innerHTML = draw.beast(pen.animal.id, pen.animal.percent);
    body.appendChild(art);

    const facts = document.createElement('div');
    facts.className = 'facts';
    for (const [what, value] of [
      ['Đã sống', `${pen.animal.percent}% vòng đời`],
      ['Đang cho', pen.animal.grownUp ? pen.animal.product : 'chưa lớn xong'],
      ['Trong chuồng', `${pen.ready}/${pen.max}`],
    ]) {
      const row = document.createElement('div');
      row.innerHTML = `<span>${draw.escape(what)}</span><b>${draw.escape(value)}</b>`;
      facts.appendChild(row);
    }
    body.appendChild(facts);
  }

  const acts = document.createElement('div');
  acts.className = 'acts';
  if (pen.animal) {
    acts.appendChild(button('Bắt sản phẩm', { kind: 'primary', verdict: pen.collect, onPress: () => send({ collect: index }) }));
    acts.appendChild(button('Bán con vật', {
      kind: 'quiet',
      verdict: pen.butcher.ok ? { ok: true } : { ok: false, why: pen.butcher.why ?? 'Chưa sống hết đời.' },
      onPress: () => send({ butcher: index }),
    }));
  } else {
    // Con nào nuôi được ở chuồng này, và đủ cấp.
    const fits = state.ranch.store.filter((one) => one.house === pen.house);
    if (fits.length === 0) {
      const none = document.createElement('p');
      none.className = 'muted';
      none.textContent = pen.house === 'shed' ? 'Chưa đủ cấp để nuôi con nào ở bãi.' : 'Chưa có con nào cho chuồng.';
      acts.appendChild(none);
    }
    for (const animal of fits) {
      acts.appendChild(button(`${animal.name} — ${animal.price.toLocaleString('vi-VN')}`, {
        kind: 'wide',
        verdict: animal.afford ? { ok: true } : { ok: false, why: 'Không đủ tiền.' },
        onPress: () => send({ animal: animal.id }),
      }));
    }
  }
  body.appendChild(acts);
}

// ---- chợ ---------------------------------------------------------------------------------------

function drawShop() {
  const tabs = $('shop-tabs');
  tabs.innerHTML = '';
  for (const [key, label] of [['seed', 'Hạt giống'], ['animal', 'Con vật']]) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `tab${shopTab === key ? ' on' : ''}`;
    el.textContent = label;
    el.onclick = () => { shopTab = key; render(); };
    tabs.appendChild(el);
  }

  const body = $('shop-body');
  body.innerHTML = '';

  if (shopTab === 'seed') {
    for (const seed of state.store) {
      const card = document.createElement('div');
      card.className = `card${seed.afford ? '' : ' poor'}${seed.level > state.level ? ' locked' : ''}`;
      const per = seed.minutes >= 60
        ? `${Math.round(seed.minutes / 60 * 10) / 10} giờ`
        : `${seed.minutes} phút`;
      card.innerHTML = `<b>${draw.escape(seed.name)}</b>
        <span class="sub">Cấp ${seed.level} · chín sau ${per}${seed.picks > 1 ? ` · hái ${seed.picks} lần` : ''}</span>
        <span class="sub">${seed.yield} quả × ${seed.sell} đồng</span>`;
      card.appendChild(button(`${seed.price.toLocaleString('vi-VN')} đồng`, {
        kind: 'small',
        verdict: seed.afford && seed.level <= state.level
          ? { ok: true }
          : { ok: false, why: seed.level > state.level ? `Cần cấp ${seed.level}.` : 'Không đủ tiền.' },
        onPress: () => send({ buy: seed.id, count: 1 }),
      }));
      body.appendChild(card);
    }
  } else {
    for (const animal of state.ranch.store) {
      const mins = animal.minutes >= 60
        ? `${Math.round(animal.minutes / 60 * 10) / 10} giờ`
        : `${animal.minutes} phút`;
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<b>${draw.escape(animal.name)}</b>
        <span class="sub">${animal.house === 'shed' ? 'Bãi' : 'Chuồng'} · lớn sau ${mins}</span>
        <span class="sub">Cho ${draw.escape(animal.product)} · ăn ${animal.eats} bó/4 giờ</span>`;
      card.appendChild(button(`${animal.price.toLocaleString('vi-VN')} đồng`, {
        kind: 'small',
        verdict: state.coin >= animal.price ? { ok: true } : { ok: false, why: 'Không đủ tiền.' },
        onPress: () => send({ animal: animal.id }),
      }));
      body.appendChild(card);
    }
  }
}

// ---- hàng xóm ----------------------------------------------------------------------------------

function drawVisit() {
  const body = $('visit-body');
  body.innerHTML = '';

  if (state.neighbours.length === 0) {
    const none = document.createElement('p');
    none.className = 'muted';
    none.textContent = 'Chưa có ai khác mở nông trại. Rủ người trong nhóm gõ /nongtrai đi.';
    body.appendChild(none);
    return;
  }

  for (const one of state.neighbours) {
    const card = document.createElement('div');
    card.className = 'card';
    const jobs = [];
    if (one.ripe > 0) jobs.push(`hái trộm ${one.ripe} thửa`);
    if (one.help.weeds > 0) jobs.push(`${one.help.weeds} cỏ`);
    if (one.help.pests > 0) jobs.push(`${one.help.pests} sâu`);
    if (one.help.water > 0) jobs.push(`${one.help.water} khô`);
    if (one.animals > 0) jobs.push(`${one.animals} con có sản phẩm`);

    card.innerHTML = `<b>${draw.escape(one.name)}</b>
      <span class="sub">${jobs.length ? draw.escape(jobs.join(' · ')) : 'chưa có gì để làm'}</span>
      <span class="sub">ghé ${draw.ago(one.last)}</span>`;

    if (one.ripe > 0) {
      card.appendChild(button('Hái trộm', {
        kind: 'small primary',
        onPress: () => send({ visit: { who: one.id, what: 'stealAll' } }),
      }));
    }
    if (one.help.total > 0) {
      card.appendChild(button('Làm hộ', {
        kind: 'small',
        onPress: () => send({ visit: { who: one.id, what: 'helpAll' } }),
      }));
    }
    // Gieo cỏ và thả sâu. Nút này **không** giấu đi, và nó cũng không được tô sáng: nó là một việc
    // gây hại không lấy được gì, và một trò chơi giấu nó đi là một trò chơi nói dối về việc người
    // chơi làm được những gì.
    const bad = state.badLeft ?? 0;
    card.appendChild(button('Gieo cỏ', {
      kind: 'small quiet',
      verdict: bad > 0 && one.help.weeds < 3
        ? { ok: true }
        : { ok: false, why: bad > 0 ? 'Thửa này đầy cỏ rồi.' : 'Hôm nay bạn đã phá đủ 50 lần.' },
      onPress: () => send({ visit: { who: one.id, what: 'sowWeeds', plot: 0 } }),
    }));
    body.appendChild(card);
  }
}

// ---- sổ ----------------------------------------------------------------------------------------

function drawLog() {
  const body = $('log-body');
  body.innerHTML = '';
  if (!state.log || state.log.length === 0) {
    const none = document.createElement('p');
    none.className = 'muted';
    none.textContent = 'Chưa có gì xảy ra. Trồng một cái cây đi.';
    body.appendChild(none);
    return;
  }
  for (const one of state.log) body.innerHTML += draw.line(one.text, one.at);
}

// ---- cái khung ---------------------------------------------------------------------------------

/// Những tab ở đáy, và chúng chỉ có mặt khi có nơi để đi.
function drawTabs() {
  const tabs = $('tabs');
  tabs.innerHTML = '';
  const wanted = [
    ['farm', '🌱 Vườn'],
    ['ranch', '🐔 Bãi'],
    ['shop', '🛒 Chợ'],
    ['visit', '👋 Hàng xóm'],
    ['log', '📖 Sổ'],
  ];
  for (const [key, label] of wanted) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `tab${tab === key ? ' on' : ''}`;
    el.textContent = label;
    // Một chấm trên tab đang có việc. Nông trại là một trò chơi người ta mở ra để xem **có gì cần
    // làm không**; nếu câu trả lời ấy phải tìm bằng cách bấm vào từng tab thì phần lớn những lần
    // mở ra sẽ kết thúc bằng việc đóng lại.
    const busy = key === 'farm' ? state.chores.total
      : key === 'ranch' ? state.ranchChores.total
        : key === 'visit' ? state.neighbours.reduce((sum, one) => sum + one.ripe + one.animals, 0)
          : 0;
    if (busy > 0) {
      const dot = document.createElement('b');
      dot.className = 'dot';
      el.appendChild(dot);
    }
    el.onclick = () => { tab = key; sheet = null; render(); };
    tabs.appendChild(el);
  }
}

/// Vẽ lại tất cả.
///
/// **Vẽ lại từ trạng thái, không vá vào chỗ vừa đổi.** Một khu vườn mười tám thửa với hai người
/// đang nhìn nó qua hai cái khung khác nhau thì "chỗ vừa đổi" là một câu hỏi có nhiều đáp án; còn
/// "trạng thái bây giờ là gì" thì chỉ có một. Cái giá là mỗi lần đẩy vẽ lại cả trang — mà một trang
/// như thế này vẽ trong vài mili giây.
function render() {
  if (!state) return;
  drawBar();

  const showing = sheet ? 'sheet' : tab;
  for (const name of ['farm', 'ranch', 'shop', 'visit', 'log', 'sheet']) {
    $(name).hidden = name !== showing;
  }

  if (sheet) {
    $('sheet-back').onclick = () => { sheet = null; render(); };
    if (sheet.kind === 'plot') drawPlotSheet(sheet.index);
    else drawPenSheet(sheet.index);
  } else if (tab === 'farm') showFarm();
  else if (tab === 'ranch') drawRanch();
  else if (tab === 'shop') drawShop();
  else if (tab === 'visit') drawVisit();
  else if (tab === 'log') drawLog();

  // Tab đáy không có mặt trên một màn đã là một quyết định; ở đây nó cũng không có mặt khi đang
  // mở một thửa, vì trên màn ấy có một việc để làm và chỉ một.
  $('tabs').hidden = Boolean(sheet);
  if (!sheet) drawTabs();

  // Đo lại khung: một cái sổ dài hơn cái khung thì phải xin thêm chỗ, không thì người ta cuộn
  // trong một khung chỉ cao bằng nửa nội dung.
  const room = z.room ?? { width: 390, height: 640 };
  const wanted = Math.min(room.height, Math.max(360, document.body.scrollHeight));
  z.setSize(room.width, wanted);
}

const openSheet = (one) => { sheet = one; render(); };

// ---- nói chuyện với bot ------------------------------------------------------------------------

/**
 * Ứng dụng đưa trạng thái tới.
 *
 * Trên web, cái "xin chào" của ứng dụng tới trang bằng `postMessage` **sau khi** trang đã nạp; trên
 * điện thoại nó được tiêm vào trước. Nên khi đoạn mã này chạy, `Zeplao.data` và `Zeplao.theme` có
 * thể còn chưa biết — và vì thế mọi thứ ở đây chạy trong `onState`/`onData`, không phải ở tầng
 * ngoài cùng của file. Phân nhánh theo `mode` lúc nạp là cách chắc chắn nhất để có một trang chỉ
 * chạy trên đúng một nửa số máy.
 */
z.onState((pushed) => {
  const first = state === null;
  state = pushed;
  if (first) {
    // Chỉ lần đầu mới đặt tab theo mặc định, và mặc định là tab **đang có việc**. Mở ra ở tab Bãi
    // trong khi việc đang nằm ở Vườn là bắt người ta đi tìm.
    tab = state.chores.total > 0 ? 'farm' : state.ranchChores.total > 0 ? 'ranch' : 'farm';
  }
  render();
  if (first) z.ready();
});

// Chủ khung đóng nó lại. Không có gì để dọn — trạng thái là của bot, không phải của trang — nhưng
// nói ra một dòng thì lần sau có người đọc log của khung mà biết nó đã đóng lúc nào.
z.onRoom?.((room) => {
  document.documentElement.style.setProperty('--room-h', `${room.height}px`);
});

// Nếu trạng thái đã tới trước khi file này chạy xong — chuyện xảy ra trên điện thoại — thì
// `onState` đã được gọi rồi. Đây là lưới an toàn cho trường hợp ngược lại: một trang nạp xong mà
// không bao giờ nhận được gì thì phải tự nói ra, chứ không ngồi im mãi.
setTimeout(() => {
  if (!state) {
    say('Chưa nhận được gì từ bot. Đóng khung rồi mở lại nhé.');
  }
}, 5000);

window.farmReady = true;
