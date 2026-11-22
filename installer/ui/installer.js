const $ = (id) => document.getElementById(id);
const S = { info: null, dir: '', mode: 'fresh', phase: 'init', conf: 0 };
const panes = ['pInit', 'pReady', 'pBusy', 'pDone', 'pErr'];
const show = (p, o = {}) => { S.phase = p; for (const id of panes) $(id).hidden = id !== p; $('optLaunch').hidden = !o.launch; setBtns(o); };
function setBtns(o) { // две кнопки: «Отмена» и главная; во время установки «Завершить» серая и не нажимается
  $('bCancel').hidden = !!o.noCancel; $('bCancel').disabled = !!o.cancelOff; $('bCancel').textContent = o.cancel || 'Отмена';
  $('bMain').hidden = !o.main; $('bMain').textContent = o.main || ''; $('bMain').disabled = !!o.mainOff; $('bMain').dataset.act = o.act || '';
}
const mb = (b) => (b / 1048576).toFixed(b >= 10485760 ? 0 : 1).replace('.', ',') + ' МБ';
function ready() {
  const i = S.info, l = i.latest, ins = i.installed; S.mode = !ins ? 'fresh' : i.update ? 'update' : 'uptodate';
  $('rTitle').textContent = S.mode === 'fresh' ? 'Установка лаунчера' : S.mode === 'update' ? 'Доступно обновление' : 'Лаунчер уже установлен';
  $('rInfo').innerHTML = S.mode === 'fresh' ? `Последняя версия: <b>${l.version}</b> · скачать ${mb(l.size)}` : S.mode === 'update' ? `Установлена версия <b>${ins.version}</b>, доступна <b>${l.version}</b> · скачать ${mb(l.size)}` : `У вас установлена последняя версия: <b>${ins.version}</b>`;
  $('rNotes').hidden = !(l.notes && S.mode !== 'uptodate'); $('rNotes').textContent = S.mode !== 'uptodate' ? l.notes || '' : '';
  S.dir = ins ? ins.dir : S.dir || i.defaultDir; $('folder').value = S.dir; $('folder').readOnly = true; $('browse').hidden = !!ins;
  show('pReady', { launch: true, main: S.mode === 'fresh' ? 'Начать установку' : S.mode === 'update' ? 'Обновить' : 'Завершить', act: S.mode === 'uptodate' ? 'finish' : 'start' });
}
async function init() {
  show('pInit', { noCancel: false, main: '' }); const i = await inst.init(); S.info = i;
  if (i.error || !i.latest) { $('eMsg').textContent = i.error || 'Не удалось узнать последнюю версию'; show('pErr', { main: 'Повторить', act: 'init', cancel: 'Закрыть' }); return; }
  ready();
}
async function start() {
  show('pBusy', { main: 'Завершить', mainOff: true }); $('bTitle').textContent = S.mode === 'update' ? 'Обновление…' : 'Установка…'; prog({ percent: 0, text: 'Подготовка…', size: '' });
  const r = await inst.start({ dir: S.dir });
  if (r.ok) { $('dInfo').textContent = `TotemLauncher ${r.version} установлен в ${r.root}` + (r.shortcut ? '. Ярлык добавлен на рабочий стол.' : '.'); show('pDone', { launch: true, main: 'Завершить', act: 'finish', cancelOff: true }); return; }
  if (r.cancelled) return;
  $('eMsg').textContent = r.error || 'Неизвестная ошибка'; show('pErr', { main: 'Повторить', act: 'start', cancel: 'Закрыть' });
}
function prog(p) { $('pct').textContent = p.percent + '%'; $('fill').style.width = p.percent + '%'; $('st').textContent = p.text; $('sz').textContent = p.size || ''; }
inst.onProgress(prog);
$('bMain').onclick = async () => {
  const a = $('bMain').dataset.act;
  if (a === 'start') start(); else if (a === 'init') init(); else if (a === 'finish') inst.finish($('cbLaunch').checked);
};
function cancel() { // во время установки просим подтвердить вторым нажатием
  if (S.phase === 'pBusy') { if (!S.conf) { S.conf = 1; $('bCancel').textContent = 'Точно прервать?'; setTimeout(() => { S.conf = 0; if (S.phase === 'pBusy') $('bCancel').textContent = 'Отмена'; }, 4000); return; } inst.close(); return; }
  inst.close();
}
$('bCancel').onclick = cancel; $('x1').onclick = cancel;
$('browse').onclick = async () => { const d = await inst.browse(S.dir); if (d) { S.dir = d; $('folder').value = d; } };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.phase !== 'pBusy') cancel(); });
init();
