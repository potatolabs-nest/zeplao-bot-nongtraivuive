// Provided by Cúc Cu. Overwritten on every upload — do not edit, your changes will go.
(function () {
  var listeners = [];
  var roomListeners = [];
  var viewer = { id: null, displayName: '', role: 'viewer' };
  var theme = {};
  // The largest box this host will give, and which host it is. A widget asks for the room it
  // needs and is clamped to what there is; without knowing what there is it asks blind — a
  // board that wanted eight hundred pixels got four hundred with nothing said, and laid
  // itself out for the eight hundred it never had.
  //
  // Not window.innerWidth: inside the frame that is the box the widget already has, not the
  // box it could ask for.
  var room = { host: 'unknown', width: 0, height: 0 };
  // How this page was opened. 'session' is a live widget with a bot on the other end, which is
  // what every widget was before views. 'view' is a page opened by tapping something in a
  // message: its data came in the message, there is no session and no bot listening, and
  // nothing the page does reaches anybody.
  var mode = 'session';
  var view = null;
  var data = null;
  var dataKnown = false;
  var dataListeners = [];
  var send;

  // The host says 'view' or says nothing. Anything else is a session, so an older host that
  // knows nothing of views leaves every widget behaving exactly as it did.
  function learnOpening(nextMode, nextView, nextData) {
    if (nextMode !== 'view' || dataKnown) return;
    mode = 'view';
    view = typeof nextView === 'string' ? nextView : null;
    data = nextData === undefined ? null : nextData;
    dataKnown = true;
    dataListeners.splice(0).forEach(function (f) {
      try { f(data); } catch (e) { console.error(e); }
    });
  }

  function announce(state) {
    // A view has no session, so there is no state to be given; a host that sent some anyway
    // is not allowed to make a view behave like a board.
    if (mode === 'view') return;
    listeners.forEach(function (f) {
      try { f(state); } catch (e) { console.error(e); }
    });
  }

  function announceRoom(next) {
    room = next || room;
    roomListeners.forEach(function (f) {
      try { f(room); } catch (e) { console.error(e); }
    });
  }

  if (window.flutter_inappwebview) {
    // On a phone. The app writes what it knows in at document start, before this runs, and
    // calls __zeplaoState on the way in with whatever the game already is.
    //
    // __zeplaoInit is the one place to read: { mode, view, data, viewer, theme, room }. The app
    // also writes __zeplaoViewer, __zeplaoTheme and __zeplaoRoom, because copies of this file
    // uploaded before __zeplaoInit existed read only those — so they are a fallback here for
    // those three and nothing else. How the page was opened comes from __zeplaoInit alone.
    var init = window.__zeplaoInit;
    if (typeof init === 'string') {
      try { init = JSON.parse(init); } catch (e) { init = null; }
    }
    if (!init || typeof init !== 'object') init = {};
    viewer = init.viewer || window.__zeplaoViewer || viewer;
    theme = init.theme || window.__zeplaoTheme || {};
    room = init.room || window.__zeplaoRoom || room;
    learnOpening(init.mode, init.view, init.data);
    window.__zeplaoState = function (json) { announce(JSON.parse(json)); };
    window.addEventListener('zeplao:room', function (event) { announceRoom(event.detail); });
    send = function (call) { window.flutter_inappwebview.callHandler('zeplao', call); };
  } else {
    // In a browser, inside a sandboxed frame. Nothing can reach in here, so everything
    // arrives as a message and the first one says who is looking.
    window.addEventListener('message', function (event) {
      var data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.zeplao === 'hello') {
        viewer = data.viewer || viewer;
        theme = data.theme || {};
        learnOpening(data.mode, data.view, data.data);
        if (data.room) announceRoom(data.room);
      }
      if (data.zeplao === 'room') {
        announceRoom({ host: data.host, width: data.width, height: data.height });
      }
      if (data.zeplao === 'state') announce(data.state);
    });
    send = function (call) {
      call.zeplao = 'call';
      parent.postMessage(call, '*');
    };
  }

  window.Zeplao = {
    get viewer() { return viewer; },
    get theme() { return theme; },
    ready: function () { send({ method: 'ready' }); },
    get mode() { return mode; },
    get view() { return view; },
    get data() { return data; },
    // Called once with the data when the host has said what it is, or at once if it already
    // has. Registering before or after the host speaks is the same to the page.
    onData: function (f) {
      if (typeof f !== 'function') return;
      if (dataKnown) { try { f(data); } catch (e) { console.error(e); } return; }
      dataListeners.push(f);
    },
    send: function (action) {
      // Loud rather than quiet. A view that sends is a page written for a session, and a
      // message dropped without a word is an afternoon spent wondering why the bot is deaf.
      if (mode === 'view') {
        throw new Error('A view opened from a message cannot send to the bot — use a callback button or a session');
      }
      send({ method: 'send', action: action });
    },
    onState: function (f) { if (typeof f === 'function') listeners.push(f); },
    // How much room there is, and where. `host` is 'web' or 'mobile' — but a widget that
    // branches on it is one that breaks on the next kind of screen. The numbers are the
    // answer; the name is for when a widget genuinely needs to behave differently, not for
    // guessing sizes from.
    get room() { return room; },
    onRoom: function (f) {
      if (typeof f !== 'function') return;
      roomListeners.push(f);
      // Called at once when the room is already known, so a widget does not have to handle
      // "before" and "after" as two different cases.
      if (room.width) { try { f(room); } catch (e) { console.error(e); } }
    },
    // Ask for a box. What you get is clamped to the room and reported back through onRoom,
    // so lay out from that rather than from what was asked for.
    setSize: function (w, h) { send({ method: 'resize', width: w, height: h }); },
    close: function () { send({ method: 'close' }); },
  };
})();