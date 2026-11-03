/* 设置 → 替换图标与壁纸：单独替换桌面小图标（可无边框、调大小与上下左右偏移），替换壁纸复用原壁纸上传 */
(function () { try {
const KEY = 'xy-home-v2:mx-icons';
function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
function save(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); return true; } catch (e) { alert('存储空间不足，图片保存失败'); return false; } }
function css(m) {
let out = '';
Object.keys(m).forEach(function (k) {
const c = m[k]; if (!c) return;
const sel = '.app[data-app="' + k.replace(/"/g, '') + '"] .app-ico';
const s = (c.size || 100) / 100, dx = c.dx || 0, dy = c.dy || 0;
let r = sel + '{transform:translate(' + dx + 'px,' + dy + 'px) scale(' + s + ');transform-origin:center;';
if (c.img) r += 'background-image:url("' + c.img + '") !important;background-size:contain !important;background-repeat:no-repeat !important;background-position:center !important;';
if (c.bl) r += 'background-color:transparent !important;border:none !important;box-shadow:none !important;outline:none !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important;overflow:visible !important;';
r += '}';
if (c.img) r += sel + ' > *{display:none !important;}';
out += r;
});
return out;
}
function apply() {
let st = document.getElementById('mx-icon-style');
if (!st) { st = document.createElement('style'); st.id = 'mx-icon-style'; document.head.appendChild(st); }
st.textContent = css(load());
}
function apps() {
const seen = {}, list = [];
document.querySelectorAll('.app[data-app]').forEach(function (a) {
const k = a.getAttribute('data-app'); if (seen[k]) return; seen[k] = 1;
const n = a.querySelector('.app-name');
list.push({ k: k, name: (n && n.textContent.trim()) || k });
});
return list;
}
function readImg(file, cb) {
const fr = new FileReader();
fr.onload = function () {
const im = new Image();
im.onload = function () {
const max = 256, sc = Math.min(1, max / Math.max(im.width, im.height));
const cv = document.createElement('canvas'); cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
cb(cv.toDataURL('image/png'));
};
im.src = fr.result;
};
fr.readAsDataURL(file);
}
function openPanel() {
const ov = document.createElement('div');
ov.className = 'mx-ov';
ov.innerHTML = '<div class="mx-box"><div class="mx-head"><b>替换图标与壁纸</b><button type="button" class="mx-x">关闭</button></div>' +
'<div class="mx-scroll"><button type="button" class="mx-wall">替换壁纸</button><div class="mx-sub">桌面小图标（可上传无边框图案，调节大小与位置）</div><div class="mx-list"></div></div></div>';
document.body.appendChild(ov);
ov.querySelector('.mx-x').onclick = function () { ov.remove(); };
ov.querySelector('.mx-wall').onclick = function () { const r = document.getElementById('row-bg-upload'); ov.remove(); if (r) r.click(); };
const listEl = ov.querySelector('.mx-list');
function render() {
const m = load();
listEl.innerHTML = '';
apps().forEach(function (a) {
const c = m[a.k] || {};
const row = document.createElement('div'); row.className = 'mx-row';
row.innerHTML = '<div class="mx-r1"><span class="mx-name"></span><label class="mx-up">上传图案<input type="file" accept="image/*" hidden></label>' +
'<label class="mx-chk"><input type="checkbox" data-f="bl"' + (c.bl ? ' checked' : '') + '>无边框</label><button type="button" class="mx-reset">还原</button></div>' +
'<div class="mx-sl"><span>大小</span><input type="range" min="30" max="250" data-f="size" value="' + (c.size || 100) + '"><em></em></div>' +
'<div class="mx-sl"><span>左右</span><input type="range" min="-40" max="40" data-f="dx" value="' + (c.dx || 0) + '"><em></em></div>' +
'<div class="mx-sl"><span>上下</span><input type="range" min="-40" max="40" data-f="dy" value="' + (c.dy || 0) + '"><em></em></div>';
row.querySelector('.mx-name').textContent = a.name;
const upd = function (f, v) { const mm = load(); mm[a.k] = Object.assign({}, mm[a.k] || {}, { [f]: v }); if (save(mm)) apply(); };
row.querySelectorAll('.mx-sl input').forEach(function (r) {
const em = r.parentNode.querySelector('em'); const sh = function () { em.textContent = r.value + (r.dataset.f === 'size' ? '%' : 'px'); }; sh();
r.addEventListener('input', function () { sh(); upd(r.dataset.f, Number(r.value)); });
});
row.querySelector('[data-f="bl"]').addEventListener('change', function (e) { upd('bl', e.target.checked); });
row.querySelector('input[type=file]').addEventListener('change', function (e) { const f = e.target.files && e.target.files[0]; if (f) readImg(f, function (d) { upd('img', d); }); });
row.querySelector('.mx-reset').onclick = function () { const mm = load(); delete mm[a.k]; save(mm); apply(); render(); };
listEl.appendChild(row);
});
}
render();
}
function inject() {
if (document.getElementById('row-mx-icons')) return;
const anchor = document.getElementById('row-export');
const grp = anchor && anchor.closest('.set-group');
if (!grp) return;
const g = document.createElement('div'); g.className = 'set-group glass';
g.innerHTML = '<div class="set-row" id="row-mx-icons"><div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><circle cx="17.5" cy="17.5" r="3.5"/></svg></div><div class="txt">替换图标与壁纸<span class="sub">单独替换桌面小图标（可无边框、调大小与位置）· 替换壁纸</span></div></div>';
grp.parentNode.insertBefore(g, grp);
g.querySelector('#row-mx-icons').addEventListener('click', openPanel);
}
apply(); inject();
document.addEventListener('DOMContentLoaded', function () { apply(); inject(); });
window.mxOpenIconPanel = openPanel;
} catch (e) { try { console.error('[JS] icon-swap.js', e); } catch (x) {} } })();
