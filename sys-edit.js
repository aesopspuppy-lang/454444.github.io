/* 系统预设字卡编辑器：新增/编辑/删除字卡、分组改名/移动、长按拖动字卡（可跨分组）。
   数据以覆盖层形式保存在 localStorage（xy-home-v2:sys-ovr:<id>），各模块加载时套用；保存后刷新页面生效。 */
(function () {
'use strict';
var PFX = 'xy-home-v2:sys-ovr:';
var DEFS = window.__sysDefs = window.__sysDefs || {};
var META = window.__sysMeta = window.__sysMeta || {};
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function load(id) { try { var v = JSON.parse(localStorage.getItem(PFX + id) || 'null'); return Array.isArray(v) ? v : null; } catch (e) { return null; } }
function save(id, m) { try { if (m) localStorage.setItem(PFX + id, JSON.stringify(m)); else localStorage.removeItem(PFX + id); } catch (e) { alert('保存失败：存储空间不足'); return false; } return true; }
function uid() { return 'sx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function refill(arr, items) { arr.length = 0; Array.prototype.push.apply(arr, items); }
function reg(id, def, meta) { if (!DEFS[id]) DEFS[id] = clone(def); META[id] = Object.assign(META[id] || {}, meta || {}); return load(id); }

/* —— 1. 默认字卡数据 [[组名,[文字]]] —— */
var DC_CATS = ['main', 'kaomoji', 'emoji', 'touch', 'dict', 'dict_ext', 'fish', 'eat', 'period', 'water', 'garden', 'sync', 'reach', 'cjian', 'room', 'piggy', 'drift', 'interact', 'music', 'deskcheck'];
function applyDC() {
  var D = window.DEFAULT_CARD_DATA; if (!D) return;
  DC_CATS.forEach(function (cat) {
    if (!Array.isArray(D[cat])) return;
    var id = 'dc:' + cat;
    var def = D[cat].map(function (g) { return { k: g[0], n: g[0], items: (g[1] || []).map(function (c) { return typeof c === 'string' ? { t: c } : (function(){var t=String(c && (c.text || c.t || c.content) || '[特殊卡]');return { t: t, o: c, ot: t };})(); }) }; });
    var m = reg(id, def, { kind: 'pairs' });
    if (m) D[cat] = m.map(function (g) { return [g.n, g.items.map(function (i) { return i.o && i.t === i.ot ? i.o : i.t; })]; });
  });
}

/* —— 2. 情绪/心意/意图 + 回应连接词 —— */
var FU_LABEL = { echo: '接话', confirm: '确认', keep: '继续', probe: '轻追问', bridge: '连接', shift: '转折', tone: '停顿', close: '收束' };
function deepRename(obj, from, to) {
  if (!obj || typeof obj !== 'object') return obj;
  Object.keys(obj).forEach(function (k) {
    var v = obj[k];
    if (v === from) obj[k] = to; else if (v && typeof v === 'object') deepRename(v, from, to);
    if (k === from) { obj[to] = obj[k]; delete obj[k]; }
  });
  return obj;
}
function applyMood() {
  var M = window.MOOD_FOLLOWUP_DATA; if (!M) return;
  ['mood', 'heart', 'intent'].forEach(function (key) {
    if (!Array.isArray(M[key])) return;
    var id = 'mc:' + key;
    var def = M[key].map(function (g) { var meta = Object.assign({}, g); delete meta.cards; return { k: g.group, n: g.group, m: meta, items: (g.cards || []).map(function (c) { return { t: c.content, o: c }; }) }; });
    var m = reg(id, def, { kind: 'nested' });
    if (!m) return;
    M[key] = m.map(function (g) {
      var base = Object.assign({ weight: 10, emoji: '🤍' }, g.m || {}); base.group = g.n;
      base.cards = g.items.map(function (i) { var c = Object.assign({ rarity: 'normal' }, key === 'heart' ? { level: 1 } : {}, i.o || {}); c.content = i.t; return c; });
      return base;
    });
    m.forEach(function (g) { if (g.k && g.k !== g.n) ['emotionToHeart', 'heartToIntent', 'specialHeart', 'generalHeartPool'].forEach(function (f) { if (M[f]) deepRename(M[f], g.k, g.n); }); });
  });
  if (M.followup && typeof M.followup === 'object') {
    var def = Object.keys(M.followup).map(function (k) { return { k: k, n: FU_LABEL[k] || k, items: (M.followup[k] || []).map(function (t) { return { t: t }; }) }; });
    var m = reg('mc:followup', def, { kind: 'map', fixed: true });
    if (m) m.forEach(function (g) { M.followup[g.k] = g.items.map(function (i) { return i.t; }); });
  }
}
window.__sysCats = function (id, pairs) {
  var m = load(id); if (!m) return pairs;
  refill(pairs, m.map(function (g) { return [g.k, g.n]; }));
  return pairs;
};

/* —— 3. TA 的心情 —— */
function applyTaMood() {
  var T = window.TA_MOOD_DATA; if (!T || !Array.isArray(T.groups)) return;
  var def = T.groups.map(function (g) { return { k: g.group, n: g.group, m: Object.assign({}, g), items: T.cards.filter(function (c) { return c.group === g.group; }).map(function (c) { return { t: c.content, o: c }; }) }; });
  var m = reg('tamood', def, { kind: 'tamood' });
  if (!m) return;
  T.groups = m.map(function (g) { var b = Object.assign({ weight: 10 }, g.m || {}); b.group = g.n; return b; });
  T.cards = []; m.forEach(function (g) { g.items.forEach(function (i) { var c = Object.assign({}, i.o || {}); c.group = g.n; c.content = i.t; T.cards.push(c); }); });
}

/* —— 4. 映射型（位置卡 / 寻踪日常）：分组固定 —— */
window.__sysMap = function (id, map, label, order) {
  try {
    var keys = order || Object.keys(map);
    var def = keys.map(function (k) { return { k: k, n: (label && label[k]) || k, items: (map[k] || []).map(function (t) { return { t: t }; }) }; });
    var m = reg(id, def, { kind: 'map', fixed: true });
    if (!m) return;
    m.forEach(function (g) {
      if (!Array.isArray(map[g.k])) map[g.k] = [];
      refill(map[g.k], g.items.map(function (i) { return i.t; }));
      if (label) label[g.k] = g.n;
    });
    if (order) refill(order, m.map(function (g) { return g.k; }));
  } catch (e) {}
};

/* —— 5. 平铺列表（今日情话） —— */
window.__sysFlat = function (id, arr, name) {
  try {
    var m = reg(id, [{ k: 'all', n: name, items: arr.map(function (t) { return { t: t }; }) }], { kind: 'flat' });
    if (m) refill(arr, [].concat.apply([], m.map(function (g) { return g.items.map(function (i) { return i.t; }); })));
  } catch (e) {}
};

/* —— 6. 题库型（TA 的询问/小问题/好奇/吐槽/查岗/邀请） —— */
window.__sysObj = function (id, arr, opt) {
  try {
    opt = opt || {};
    var pairs = opt.cats || (opt.order || []).map(function (k) { return [k, (opt.label && opt.label[k]) || k]; });
    var keys = pairs.map(function (p) { return p[0]; });
    arr.forEach(function (q) { if (keys.indexOf(q.cat) < 0) { keys.push(q.cat); pairs.push([q.cat, (opt.label && opt.label[q.cat]) || q.cat]); } });
    var def = pairs.map(function (p) { return { k: p[0], n: p[1], items: arr.filter(function (q) { return q.cat === p[0]; }).map(function (q) { return { t: q.text, o: q }; }) }; });
    var m = reg(id, def, { kind: 'obj', blob: opt.blob });
    if (!m) return;
    refill(arr, objItems(id, m));
    var np = m.map(function (g) { return [g.k, g.n]; });
    if (opt.cats) refill(opt.cats, np);
    if (opt.label) np.forEach(function (p) { opt.label[p[0]] = p[1]; });
    if (opt.order) refill(opt.order, np.map(function (p) { return p[0]; }));
  } catch (e) {}
};
function objItems(id, m) {
  var tpl = null; (DEFS[id] || []).some(function (g) { return g.items.some(function (i) { tpl = i.o; return true; }); });
  var out = [];
  m.forEach(function (g) {
    var gtpl = null; (DEFS[id] || []).some(function (dg) { if (dg.k === g.k && dg.items[0]) { gtpl = dg.items[0].o; return true; } });
    g.items.forEach(function (i) {
      var q = Object.assign({}, i.o || clone(gtpl || g.items.filter(function (x) { return x.o; }).map(function (x) { return x.o; })[0] || tpl || {}));
      if (!i.o) { q.id = uid(); delete q.isPreset; i.o = clone(q); }
      q.text = i.t; q.cat = g.k; if (q.enabled === undefined) q.enabled = true;
      out.push(q);
    });
  });
  return out;
}
function syncBlob(id, m) {
  var key = (META[id] || {}).blob; if (!key) return;
  try {
    var st = window.activeStore ? window.activeStore() : null; if (!st) return;
    var d = JSON.parse(st.get(key) || 'null');
    if (!d || !Array.isArray(d.questions)) return;
    var old = {}; d.questions.forEach(function (q) { if (q && q.isPreset) old[q.id] = q; });
    var items = objItems(id, m).map(function (q) { var o = old[q.id]; var n = Object.assign({}, q); if (o && o.enabled !== undefined) n.enabled = o.enabled; n.isPreset = true; return n; });
    d.questions = items.concat(d.questions.filter(function (q) { return !q || !q.isPreset; }));
    var mg = Array.isArray(d.mergedIds) ? d.mergedIds : [];
    items.forEach(function (q) { if (mg.indexOf(q.id) < 0) mg.push(q.id); });
    Object.keys(old).forEach(function (k) { if (mg.indexOf(k) < 0) mg.push(k); });
    d.mergedIds = mg;
    st.set(key, JSON.stringify(d));
  } catch (e) {}
}

window.__sysData = function (which) {
  try {
    if (which === 'dc') applyDC();
    else if (which === 'mood') applyMood();
    else if (which === 'tamood') applyTaMood();
  } catch (e) { try { console.error('[sys-edit]', e); } catch (x) {} }
};

/* ================= 编辑器界面 ================= */
var SETS = {
  'li-default-cards': [['dc:main', '主字卡'], ['dc:kaomoji', '颜文字'], ['dc:emoji', 'emoji'], ['dc:touch', '拍一拍']],
  'li-dict-cards': [['dc:dict', '词典·语录'], ['dc:dict_ext', '词典·词库']],
  'li-fun-cards': [['dc:fish', '摸鱼'], ['dc:eat', '吃饭'], ['dc:period', '经期'], ['dc:water', '喝水'], ['dc:garden', '花园'], ['dc:sync', '同频'], ['dc:reach', '伸手'], ['dc:cjian', '此间'], ['dc:room', '房间'], ['dc:piggy', '存钱罐'], ['dc:drift', '漂流瓶'], ['dc:interact', '互动回应'], ['dc:music', '音乐']],
  'li-deskcheck': [['dc:deskcheck', '联系人跨桌面查岗']],
  'li-mood-cards': [['mc:mood', '情绪'], ['mc:heart', '心意'], ['mc:intent', '交流意图']],
  'li-ta-mood': [['tamood', 'TA的心情']],
  'li-reply-cards': [['mc:followup', '聊天回应字卡']],
  'li-checkin-cards': [['ck:daily', '寻踪日常字卡']],
  'li-quote-cards': [['quote', '桌面今日情话']],
  'li-loc-cards': [['loc', 'TA在身边位置卡']],
  'li-ta-ask': [['ta-ask', 'TA的询问']],
  'li-ta-choose': [['ta-choose', 'TA的小问题']],
  'li-ta-curious': [['ta-curious', 'TA的好奇']],
  'li-ta-roast': [['ta-roast', 'TA的吐槽']],
  'li-ta-checkin': [['ta-checkin', 'TA的查岗']],
  'li-ta-invite': [['ta-invite', 'TA的邀请']]
};
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function ask(title, val, cb) {
  if (window.openModal) window.openModal(title, val || '', function (v) { v = String(v == null ? '' : v).trim(); if (v) cb(v); });
  else { var v = prompt(title, val || ''); if (v != null && v.trim()) cb(v.trim()); }
}
function confirmBox(msg, cb) { if (confirm(msg)) cb(); }

var css = document.createElement('style');
css.textContent =
'.sxe-btn{flex:none;margin-left:6px;padding:4px 10px;border-radius:999px;border:1px solid var(--line,#ddd);background:var(--card,#fff);color:var(--ink,#111);font-size:12px}' +
'#sxe{user-select:none;-webkit-user-select:none;position:fixed;inset:0;z-index:99990;background:var(--bg,#f6f6f6);color:var(--ink,#111);display:flex;flex-direction:column;font-size:14px}' +
'#sxe .sxe-hd{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 8px;border-bottom:1px solid var(--line,#e5e5e5)}' +
'#sxe .sxe-hd b{flex:1;font-size:16px}' +
'#sxe button{font:inherit;color:inherit;border:1px solid var(--line,#ddd);background:var(--card,#fff);border-radius:8px;padding:5px 10px}' +
'#sxe .sxe-pri{background:#111;color:#fff;border-color:#111}' +
'#sxe .sxe-tabs{display:flex;gap:6px;overflow-x:auto;padding:8px 12px;flex:none}' +
'#sxe .sxe-tabs button{white-space:nowrap;border-radius:999px}#sxe .sxe-tabs .on{background:#111;color:#fff}' +
'#sxe .sxe-body{flex:1;overflow-y:auto;padding:4px 12px 90px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}' +
'#sxe .sxe-tip{font-size:12px;opacity:.6;padding:4px 12px}' +
'#sxe .sxe-g{background:var(--card,#fff);border-radius:12px;margin:8px 0;border:1px solid var(--line,#eee);overflow:hidden}' +
'#sxe .sxe-gh{display:flex;align-items:center;gap:4px;padding:8px 10px;font-weight:600}' +
'#sxe .sxe-gh span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
'#sxe .sxe-gh button{padding:3px 7px;font-size:12px;font-weight:400}' +
'#sxe .sxe-c{display:flex;align-items:center;gap:6px;padding:8px 10px;border-top:1px solid var(--line,#f0f0f0);user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:pan-y}' +
'#sxe .sxe-c span{flex:1;min-width:0;word-break:break-all}' +
'#sxe .sxe-c button{padding:2px 7px;font-size:12px}' +
'#sxe .sxe-drag{opacity:.35}#sxe .sxe-ghost{position:fixed;left:12px;right:12px;z-index:99999;pointer-events:none;background:#111;color:#fff;border-radius:10px;padding:10px;box-shadow:0 6px 20px rgba(0,0,0,.3)}' +
'#sxe .sxe-mark{height:3px;background:#111;margin:0 10px;border-radius:2px}' +
'#sxe .sxe-ft{position:absolute;left:0;right:0;bottom:0;display:flex;gap:8px;padding:10px 12px calc(env(safe-area-inset-bottom,0px) + 10px);background:var(--bg,#f6f6f6);border-top:1px solid var(--line,#e5e5e5)}#sxe .sxe-ft button{flex:1;padding:10px}';
document.head.appendChild(css);

var S = null; // { sets, cur, models:{id:model}, open:{}, dirty:{} }
function model(id) {
  if (!S.models[id]) S.models[id] = clone(load(id) || DEFS[id] || []);
  return S.models[id];
}
function openEditor(liId) {
  var sets = (SETS[liId] || []).filter(function (s) { return DEFS[s[0]]; });
  if (!sets.length) { alert('该字卡数据尚未加载，请稍后再试'); return; }
  S = { sets: sets, cur: sets[0][0], models: {}, open: {}, dirty: {} };
  var mask = document.getElementById('modal-mask');
  if (mask) { S.modalParent = mask.parentNode; S.modalNext = mask.nextSibling; document.body.appendChild(mask); }
  var el = document.createElement('div'); el.id = 'sxe';
  document.body.appendChild(el);
  render();
}
function close(force) {
  var dirty = Object.keys(S.dirty).length;
  if (!force && dirty && !confirm('有未保存的修改，确定放弃吗？')) return;
  var mask = document.getElementById('modal-mask');
  if (mask && S.modalParent) S.modalParent.insertBefore(mask, S.modalNext && S.modalNext.parentNode === S.modalParent ? S.modalNext : null);
  var el = document.getElementById('sxe'); if (el) el.remove(); S = null;
}
function saveAll() {
  Object.keys(S.dirty).forEach(function (id) {
    var m = S.models[id];
    if (!save(id, m)) return;
    if (id.indexOf('dc:') === 0) { try { var k = 'xy-home-v2:dc-edits', e = JSON.parse(localStorage.getItem(k) || '{}'); delete e[id.slice(3)]; localStorage.setItem(k, JSON.stringify(e)); } catch (x) {} }
    syncBlob(id, m);
  });
  close(true);
  if (window.toast) window.toast('已保存，正在刷新…');
  setTimeout(function () { location.reload(); }, 400);
}
function resetCur() {
  confirmBox('把「' + curName() + '」恢复成系统原始内容？你在这里做的所有修改都会清除。', function () {
    S.models[S.cur] = clone(DEFS[S.cur]); S.dirty[S.cur] = 1; render();
  });
}
function curName() { var n = ''; S.sets.forEach(function (s) { if (s[0] === S.cur) n = s[1]; }); return n; }
function touch() { S.dirty[S.cur] = 1; }

/* 与可自定义字卡一致：按行/分组导入，组内导入去重，库内手动去重。 */
function importCards(m, raw, target, fixed) {
  var added = 0, dup = 0, created = 0, current = null;
  var lines = String(raw || '').split(/\r\n|\r|\n/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (fixed) lines.forEach(function (line) {
    var match = line.match(/^[【\[](.*?)[】\]](.*)$/);
    if (match && match[1].trim() && !m.some(function (g) { return g.n === match[1].trim(); })) throw new Error('本类分组与功能绑定，请使用现有分组：' + match[1].trim());
  });
  function group(name) {
    var g = m.filter(function (g) { return g.n === name; })[0];
    if (!g) { g = { k: uid(), n: name, items: [] }; m.push(g); created++; }
    return g;
  }
  if (target) current = group(target);
  lines.forEach(function (line) {
    var match = line.match(/^[【\[](.*?)[】\]](.*)$/);
    if (match && match[1].trim()) { current = group(match[1].trim()); line = match[2].trim(); }
    if (!line) return;
    if (!current) current = fixed ? m[0] : group('未分组');
    if (!current) throw new Error('请先新建分组');
    if (current.items.some(function (i) { return i.t === line; })) dup++;
    else { current.items.push({ t: line }); added++; }
  });
  return { added: added, dup: dup, created: created };
}
function dedupeCards(m, apply) {
  var seen = new Set(), count = 0;
  m.forEach(function (g) {
    var kept = g.items.filter(function (i) {
      // 忽略来源 ID 等元数据，保留首张原始卡及其选项/权重。
      if (seen.has(i.t)) { count++; return false; }
      seen.add(i.t); return true;
    });
    if (apply) g.items = kept;
  });
  return count;
}
function selectedCards(m, selected, target) {
  var moved = [], count = 0;
  m.forEach(function (g, gi) {
    g.items = g.items.filter(function (i, ii) {
      if (!selected[gi + ':' + ii] || g === target) return true;
      moved.push(i); count++; return false;
    });
  });
  if (target) Array.prototype.push.apply(target.items, moved);
  return count;
}
function moveGroup(m, from, to) {
  if (from < 0 || from >= m.length || to < 0 || to >= m.length || from === to) return false;
  m.splice(to, 0, m.splice(from, 1)[0]); return true;
}
function renameGroup(m, index, name) {
  name = String(name || '').trim();
  if (!m[index] || !name || m.some(function (g, i) { return i !== index && g.n === name; })) return false;
  m[index].n = name; return true;
}
window.__sysTools = { importCards: importCards, dedupeCards: dedupeCards, selectedCards: selectedCards, moveGroup: moveGroup, renameGroup: renameGroup };
function notify(text) { if (window.toast) window.toast(text); else alert(text); }
function toolIcon(id) { var el = document.getElementById(id); var svg = el && el.querySelector('svg'); return svg ? svg.outerHTML : ''; }
function batchImport() {
  var id = S.cur, m = model(id), fixed = !!(META[id] || {}).fixed;
  function done(raw, target) {
    if (!S || S.cur !== id) return;
    try {
      var result = importCards(m, raw, target, fixed);
      if (result.added || result.created) { touch(); render(); }
      notify('已导入 ' + result.added + ' 条字卡' + (result.dup ? '，自动去重 ' + result.dup + ' 条' : ''));
    } catch (e) { notify(e.message); }
  }
  if (window.openModal) window.openModal('批量导入字卡（一行一个）', '', done, {
    big: true, textarea: true, textareaRows: 14, txtImport: true,
    textareaPlaceholder: '【日常】\n你今天真好看\n我想你了', groups: m.map(function (g) { return g.n; })
  });
  else { var raw = prompt('批量导入字卡（一行一个）'); if (raw != null) done(raw); }
}
function bulkMove() {
  var m = model(S.cur);
  if (!Object.keys(S.selected || {}).length) { notify('请先勾选字卡'); return; }
  if (!m.length) return;
  function done(name) {
    var target = m.filter(function (g) { return g.n === name; })[0]; if (!target) return;
    var count = selectedCards(m, S.selected, target); S.selected = {};
    if (count) touch(); render(); notify('已移动 ' + count + ' 张字卡');
  }
  if (window.openModal) window.openModal('移动到分组', '', done, {
    noInput: true, pills: m.map(function (g) { return { label: g.n, value: g.n }; }), pill: m[0].n
  });
  else { var name = prompt('移动到分组', m[0].n); if (name) done(name); }
}

css.textContent += '#sxe .sxe-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px 12px;flex:none}#sxe .sxe-tools button{display:flex;align-items:center;justify-content:center;gap:5px;min-width:0;padding:8px;font-size:13px}#sxe .sxe-tools svg{width:16px;height:16px;flex:none}#sxe .sxe-gh{flex-wrap:wrap}#sxe .sxe-gh span{flex-basis:100%}#sxe .sxe-search{margin:0 12px 8px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--input-bg);color:var(--ink);min-width:0}#sxe .sxe-c input{accent-color:var(--btn-bg);width:18px;height:18px;flex:none}#sxe .sxe-ft{flex-wrap:wrap}#sxe .sxe-ft small{flex-basis:100%;color:var(--muted)}#sxe .sxe-body{padding-bottom:140px}#sxe .sxe-pri,#sxe .sxe-tabs .on{background:var(--btn-bg);color:var(--btn-ink);border-color:var(--btn-bg)}';
css.textContent += 'body:has(#sxe)>#modal-mask{position:fixed;z-index:100010}#sxe{background:var(--page-bg)}#sxe button,#sxe .sxe-g{background:var(--card-bg)}';
css.textContent += '#sxe .sxe-gmask{position:absolute;inset:0;z-index:2;background:var(--overlay-bg);display:flex;align-items:center;justify-content:center;padding:16px}#sxe .sxe-gpanel{width:min(400px,100%);max-height:72dvh;display:flex;flex-direction:column;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;overflow:hidden}#sxe .sxe-gtitle{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid var(--line)}#sxe .sxe-gtitle b{flex:1;min-width:0}#sxe .sxe-glist{overflow-y:auto;overscroll-behavior:contain;min-height:0;scrollbar-width:thin;padding:0 12px}#sxe .sxe-grow{display:flex;align-items:center;gap:10px;min-height:52px;border-bottom:1px solid var(--line);touch-action:pan-y;-webkit-touch-callout:none}#sxe .sxe-grow>span{flex:1;min-width:0;overflow-wrap:anywhere}#sxe .sxe-handle{color:var(--muted);font-size:20px}#sxe .sxe-grow small{color:var(--muted)}#sxe .sxe-gfooter{padding:10px 12px;display:flex;gap:8px;border-top:1px solid var(--line)}#sxe .sxe-gfooter button{flex:1}#sxe .sxe-grename{display:flex;gap:6px;padding:10px 12px;flex-wrap:wrap;border-top:1px solid var(--line)}#sxe .sxe-grename input{width:100%;padding:10px;background:var(--input-bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;user-select:text;-webkit-user-select:text}#sxe .sxe-ghost{background:var(--btn-bg);color:var(--btn-ink)}';

function render() {
  var el = document.getElementById('sxe'); if (!el) return;
  var id = S.cur, m = model(id), fixed = !!(META[id] || {}).fixed;
  var st = el.querySelector('.sxe-body'); var top = st ? st.scrollTop : 0;
  var h = '<div class="sxe-hd"><b>编辑 · ' + esc(curName()) + '</b><button data-a="reset">恢复默认</button><button data-a="close">关闭</button></div>';
  if (S.sets.length > 1) h += '<div class="sxe-tabs">' + S.sets.map(function (s) { return '<button data-tab="' + s[0] + '" class="' + (s[0] === id ? 'on' : '') + '">' + esc(s[1]) + (S.dirty[s[0]] ? ' •' : '') + '</button>'; }).join('') + '</div>';
  h += '<div class="sxe-tools"><button class="cc-tool" data-a="groups">' + toolIcon('cc-new-group') + '管理分组</button><button class="cc-tool" data-a="import">' + toolIcon('cc-import') + '批量导入</button><button class="cc-tool" data-a="manage">' + toolIcon('cc-manage-cards') + '管理字卡</button><button class="cc-tool" data-a="dedupe">' + toolIcon('cc-dedupe') + '去重复</button></div>';
  if (S.mode === 'manage') h += '<input data-ce-done="1" class="sxe-search" aria-label="搜索字卡" placeholder="搜索字卡" value="' + esc(S.query || '') + '">';
  h += '<div class="sxe-body">';
  m.forEach(function (g, gi) {
    if (S.mode === 'manage' && S.query && !g.items.some(function (it) { return it.t.toLowerCase().indexOf(S.query.toLowerCase()) >= 0; })) return;
    var open = S.mode === 'manage' || S.open[id + '|' + gi];
    h += '<div class="sxe-g" data-g="' + gi + '"><div class="sxe-gh" data-g="' + gi + '"><span data-a="tog">' + (open ? '▾ ' : '▸ ') + esc(g.n) + ' <small style="opacity:.5;font-weight:400">(' + g.items.length + ')</small></span>' +
      '<button data-a="add">＋字卡</button><button data-a="ren">改名</button><button data-a="gup">↑</button><button data-a="gdn">↓</button>' + (fixed ? '' : '<button data-a="gdel">删</button>') + '</div>';
    if (open && S.mode !== 'groups') g.items.forEach(function (it, ii) {
      if (S.mode === 'manage' && S.query && it.t.toLowerCase().indexOf(S.query.toLowerCase()) < 0) return;
      h += '<div class="sxe-c" data-g="' + gi + '" data-i="' + ii + '">' + (S.mode === 'manage' ? '<input type="checkbox" data-select="' + gi + ':' + ii + '" aria-label="选择字卡" ' + ((S.selected || {})[gi + ':' + ii] ? 'checked' : '') + '>' : '') + '<span>' + esc(it.t) + '</span><button data-a="edit">编辑</button>' + (S.mode === 'manage' ? '' : '<button data-a="del">删除</button>') + '</div>';
    });
    h += '</div>';
  });
  if (!fixed) h += '<button data-a="gnew" style="width:100%;margin-top:8px;padding:10px">＋ 新建分组</button>';
  h += '</div><div class="sxe-ft">';
  if (S.mode === 'manage') h += '<small>已选 ' + Object.keys(S.selected || {}).length + ' 张</small><button data-a="all">全选</button><button data-a="bulkdel">删除</button><button data-a="bulkmove">移动</button><button data-a="exitmode">退出</button>';
  else if (S.mode === 'groups') h += '<button data-a="exitmode">完成分组管理</button>';
  h += '<button data-a="close">取消</button><button class="sxe-pri" data-a="save">保存</button></div>';
  if (S.groupsOpen) {
    h += '<div class="sxe-gmask"><section class="sxe-gpanel" role="dialog" aria-modal="true" aria-label="管理分组"><div class="sxe-gtitle"><b>管理分组 · ' + esc(curName()) + '</b><button data-a="groupsclose" aria-label="关闭分组管理">✕</button></div><div class="sxe-glist">';
    m.forEach(function (g, gi) {
      h += '<div class="sxe-grow" data-g="' + gi + '"><i class="sxe-handle" aria-hidden="true">≡</i><span>' + esc(g.n) + '</span><small>' + g.items.length + '</small><button data-a="grename">改名</button>' + (fixed ? '' : '<button data-a="gdel">删</button>') + '</div>';
    });
    h += '</div>';
    if (S.renameIndex != null && m[S.renameIndex]) h += '<form class="sxe-grename"><input data-ce-done="1" aria-label="分组名字" value="' + esc(m[S.renameIndex].n) + '"><button type="submit">确认改名</button><button type="button" data-a="grenamecancel">取消</button></form>';
    h += '<div class="sxe-gfooter">' + (fixed ? '' : '<button data-a="gnew">＋ 新建分组</button>') + '<button data-a="groupsclose">完成</button></div></section></div>';
  }
  el.innerHTML = h;
  el.querySelector('.sxe-body').scrollTop = top;
}

document.addEventListener('submit', function (e) {
  if (!S || !e.target.matches('#sxe .sxe-grename')) return;
  e.preventDefault();
  if (!renameGroup(model(S.cur), S.renameIndex, e.target.querySelector('input').value)) { notify('分组名称不能为空，也不能与其他分组重名'); return; }
  S.renameIndex = null; touch(); render();
});

document.addEventListener('input', function (e) {
  if (!S || e.isComposing || !e.target.matches('#sxe .sxe-search')) return;
  var start = e.target.selectionStart; S.query = e.target.value; render();
  var input = document.querySelector('#sxe .sxe-search'); input.focus(); input.setSelectionRange(start, start);
});
document.addEventListener('compositionend', function (e) {
  if (e.target.matches('#sxe .sxe-search')) e.target.dispatchEvent(new Event('input', { bubbles: true }));
});
document.addEventListener('change', function (e) {
  if (!S || !e.target.matches('#sxe [data-select]')) return;
  S.selected = S.selected || {};
  if (e.target.checked) S.selected[e.target.dataset.select] = true; else delete S.selected[e.target.dataset.select];
  render();
});

document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('.sxe-btn');
  if (b) { e.preventDefault(); e.stopPropagation(); openEditor(b.dataset.li); return; }
  if (!S || !e.target.closest('#sxe')) return;
  if (S.justDragged) return;
  if (e.target.matches('.sxe-gmask')) { S.groupsOpen = false; S.renameIndex = null; render(); return; }
  var t = e.target.closest('[data-tab]');
  if (t) { S.cur = t.dataset.tab; S.selected = {}; S.query = ''; render(); return; }
  var a = e.target.closest('[data-a]'); if (!a) return;
  var act = a.dataset.a, m = model(S.cur);
  var row = a.closest('[data-g]'); var gi = row ? +row.dataset.g : -1; var g = m[gi];
  var ci = a.closest('.sxe-c'); var ii = ci ? +ci.dataset.i : -1;
  var okey = S.cur + '|' + gi;
  switch (act) {
    case 'groups': S.groupsOpen = true; S.renameIndex = null; render(); break;
    case 'groupsclose': S.groupsOpen = false; S.renameIndex = null; render(); break;
    case 'grename': S.renameIndex = gi; render(); var inp = document.querySelector('#sxe .sxe-grename input'); if (inp) inp.focus(); break;
    case 'grenamecancel': S.renameIndex = null; render(); break;
    case 'manage': S.mode = S.mode === 'manage' ? '' : 'manage'; S.selected = {}; S.query = ''; render(); break;
    case 'exitmode': S.mode = ''; S.selected = {}; S.query = ''; render(); break;
    case 'import': batchImport(); break;
    case 'all':
      var keys = [];
      m.forEach(function (g, gi) { g.items.forEach(function (it, ii) { if (!S.query || it.t.toLowerCase().indexOf(S.query.toLowerCase()) >= 0) keys.push(gi + ':' + ii); }); });
      var all = keys.length && keys.every(function (k) { return (S.selected || {})[k]; });
      S.selected = S.selected || {}; keys.forEach(function (k) { if (all) delete S.selected[k]; else S.selected[k] = true; }); render(); break;
    case 'bulkdel':
      var count = Object.keys(S.selected || {}).length;
      if (!count) { notify('请先勾选字卡'); break; }
      confirmBox('删除选中的 ' + count + ' 张字卡？', function () { selectedCards(m, S.selected); S.selected = {}; touch(); render(); }); break;
    case 'bulkmove': bulkMove(); break;
    case 'dedupe':
      var total = S.sets.reduce(function (n, s) { return n + dedupeCards(model(s[0]), false); }, 0);
      if (!total) { notify('没有发现重复字卡'); break; }
      confirmBox('去重 ' + total + ' 张重复字卡？保留每类中最先出现的字卡。', function () {
        S.sets.forEach(function (s) { if (dedupeCards(model(s[0]), true)) S.dirty[s[0]] = 1; });
        S.selected = {}; render(); notify('已去重 ' + total + ' 张字卡');
      }); break;
    case 'close': close(); break;
    case 'save': saveAll(); break;
    case 'reset': resetCur(); break;
    case 'tog': S.open[okey] = !S.open[okey]; render(); break;
    case 'add': ask('新增字卡（' + g.n + '）', '', function (v) { v.split(/\n+/).forEach(function (x) { x = x.trim(); if (x) g.items.push({ t: x }); }); S.open[okey] = true; touch(); render(); }); break;
    case 'ren': ask('分组改名', g.n, function (v) { g.n = v; touch(); render(); }); break;
    case 'gup': case 'gdn':
      var j = act === 'gup' ? gi - 1 : gi + 1; if (j < 0 || j >= m.length) return;
      var ok = S.open[okey], oj = S.open[S.cur + '|' + j];
      m.splice(j, 0, m.splice(gi, 1)[0]); S.open[S.cur + '|' + j] = ok; S.open[okey] = oj; S.selected = {}; touch(); render(); break;
    case 'gdel': confirmBox('删除分组「' + g.n + '」以及其中 ' + g.items.length + ' 张字卡？', function () { m.splice(gi, 1); S.open = {}; S.selected = {}; touch(); render(); }); break;
    case 'gnew': ask('新分组名字', '', function (v) { if (m.some(function (g) { return g.n === v; })) { notify('分组「' + v + '」已存在'); return; } m.push({ k: uid(), n: v, items: [] }); S.open[S.cur + '|' + (m.length - 1)] = true; touch(); render(); }); break;
    case 'edit': ask('编辑字卡', g.items[ii].t, function (v) { g.items[ii].t = v; touch(); render(); }); break;
    case 'del': confirmBox('删除这张字卡？\n' + g.items[ii].t, function () { g.items.splice(ii, 1); touch(); render(); }); break;
  }
}, true);

/* 长按拖动 */
var D = null;
function pt(e) { var p = e.touches ? e.touches[0] || e.changedTouches[0] : e; return { x: p.clientX, y: p.clientY }; }
function onDown(e) {
  if (!S || D || e.target.closest('button,input')) return;
  var c = e.target.closest && e.target.closest('#sxe .sxe-grow');
  var group = !!c;
  if (!group) { if (S.mode === 'manage' || S.groupsOpen) return; c = e.target.closest('#sxe .sxe-c'); }
  if (!c) return;
  var p = pt(e);
  D = { c: c, group: group, x: p.x, y: p.y, on: false, timer: setTimeout(function () { startDrag(p); }, 450) };
}
function startDrag(p) {
  if (!D) return; D.on = true;
  try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
  D.c.classList.add('sxe-drag');
  D.ghost = document.createElement('div'); D.ghost.className = 'sxe-ghost'; D.ghost.textContent = D.c.querySelector('span').textContent;
  document.getElementById('sxe').appendChild(D.ghost);
  D.mark = document.createElement('div'); D.mark.className = 'sxe-mark';
  moveDrag(p);
  if (D.group) {
    function autoScroll() {
      if (!D || !D.on || !D.group) return;
      if (D.last) moveDrag(D.last);
      D.raf = requestAnimationFrame(autoScroll);
    }
    D.raf = requestAnimationFrame(autoScroll);
  }
}
function moveDrag(p) {
  D.last = p;
  D.ghost.style.top = (p.y - 20) + 'px';
  D.ghost.style.display = 'none';
  var under = document.elementFromPoint(p.x, p.y); D.ghost.style.display = '';
  var body = document.querySelector(D.group ? '#sxe .sxe-glist' : '#sxe .sxe-body'); var r = body.getBoundingClientRect();
  if (p.y < r.top + 40) body.scrollTop -= 12; else if (p.y > r.bottom - 40) body.scrollTop += 12;
  if (D.group) {
    var rows = Array.prototype.slice.call(body.querySelectorAll('.sxe-grow'));
    var target = rows.length;
    rows.some(function (row, index) { var rr = row.getBoundingClientRect(); if (p.y < rr.top + rr.height / 2) { target = index; return true; } return false; });
    D.tg = target;
    if (rows[target]) body.insertBefore(D.mark, rows[target]); else body.appendChild(D.mark);
    return;
  }
  if (!under) return;
  var row = under.closest('.sxe-c'), gh = under.closest('.sxe-gh');
  if (row && row !== D.c) {
    var rr = row.getBoundingClientRect(); var after = p.y > rr.top + rr.height / 2;
    D.tg = +row.dataset.g; D.ti = +row.dataset.i + (after ? 1 : 0);
    row.parentNode.insertBefore(D.mark, after ? row.nextSibling : row);
  } else if (gh) {
    D.tg = +gh.dataset.g; D.ti = 0; gh.parentNode.insertBefore(D.mark, gh.nextSibling);
  }
}
function onMove(e) {
  if (!D) return; var p = pt(e);
  if (!D.on) { if (Math.abs(p.x - D.x) > 8 || Math.abs(p.y - D.y) > 8) { clearTimeout(D.timer); D = null; } return; }
  e.preventDefault(); moveDrag(p);
}
function onUp(e) {
  if (!D) return; clearTimeout(D.timer);
  if (D.raf) cancelAnimationFrame(D.raf);
  if (e && e.type === 'touchcancel') { if (D.ghost) D.ghost.remove(); if (D.mark) D.mark.remove(); D.c.classList.remove('sxe-drag'); D = null; return; }
  if (D.on) {
    var m = model(S.cur), sg = +D.c.dataset.g, si = +D.c.dataset.i;
    if (D.group && D.tg != null) {
      var dest = D.tg > sg ? D.tg - 1 : D.tg;
      if (moveGroup(m, sg, dest)) { S.open = {}; S.selected = {}; S.renameIndex = null; touch(); }
    } else if (D.tg != null) {
      var it = m[sg].items.splice(si, 1)[0], ti = D.ti;
      if (D.tg === sg && ti > si) ti--;
      m[D.tg].items.splice(ti, 0, it); S.open[S.cur + '|' + D.tg] = true; touch();
    }
    S.justDragged = true; setTimeout(function () { if (S) S.justDragged = false; }, 300);
    render();
  }
  D = null;
}
window.addEventListener('touchstart', onDown, { passive: true, capture: true });
window.addEventListener('touchmove', onMove, { passive: false, capture: true });
window.addEventListener('touchend', onUp, true); window.addEventListener('touchcancel', onUp, true);
window.addEventListener('mousedown', onDown, true); window.addEventListener('mousemove', function (e) { if (D) onMove(e); }, true); window.addEventListener('mouseup', onUp, true);
document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('#sxe .sxe-c,#sxe .sxe-grow')) e.preventDefault(); });

/* 在各系统预设入口上放「编辑」按钮 */
function inject() {
  Object.keys(SETS).forEach(function (li) {
    var el = document.getElementById(li);
    if (!el || el.querySelector('.sxe-btn')) return;
    var b = document.createElement('button'); b.className = 'sxe-btn'; b.dataset.li = li; b.textContent = '编辑';
    el.appendChild(b);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject); else inject();
setTimeout(inject, 1500);
})();
