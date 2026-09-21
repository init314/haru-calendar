const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Store } = require('./store.cjs');
const { CalendarMcp, textResult } = require('./mcp.cjs');
const { validateEvent, googleBody } = require('./domain.cjs');
if (process.env.HARU_TEST_DATA) app.setPath('userData', process.env.HARU_TEST_DATA);
let win, store;
const mcp = new CalendarMcp();
const page = path.join(__dirname, '../ui/index.html');
const inflight = new Map();
function monthBounds(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('올바른 월을 선택해 주세요.');
  const [y,m] = month.split('-').map(Number);
  return [new Date(y,m-1,1).toISOString(), new Date(y,m,1).toISOString()];
}
function snapshot(month) { return { events: store.events(month), connected: store.data.connected, syncedAt: store.data.months[month]?.syncedAt || null }; }
async function sync(month) {
  if (process.env.HARU_TEST_OFFLINE) throw new Error('테스트 오프라인 모드');
  if (inflight.has(month)) return inflight.get(month);
  const task = (async () => {
    const [from,to] = monthBounds(month);
    const events = await mcp.events(from,to);
    const lmsEvents = events.filter(event => event.source === 'google' && event.deadline && event.start?.date && event.end?.date);
    const updateResults = await Promise.allSettled(lmsEvents.map(event => mcp.call('updateCalendarEvent', {
      calendarId: 'primary', eventId: event.id, start: event.start, end: event.end, sendUpdates: 'none'
    })));
    const failed = updateResults.filter(result => result.status === 'rejected');
    store.update(data => { data.connected = true; data.months[month] = { events, syncedAt: new Date().toISOString() }; });
    const result = snapshot(month);
    if (failed.length) result.warning = `${lmsEvents.length - failed.length}개 LMS 일정을 정리했습니다. ${failed.length}개는 Google 권한 또는 일정 상태를 확인해 주세요.`;
    else if (lmsEvents.length) result.warning = `${lmsEvents.length}개 LMS 일정을 마감일 기준으로 정리했습니다.`;
    return result;
  })();
  inflight.set(month,task);
  try { return await task; } finally { inflight.delete(month); }
}
function handle(name, fn) {
  ipcMain.handle(name, async (event, args) => {
    if (event.senderFrame?.url !== pathToFileURL(page).href) return { ok: false, error: '허용되지 않은 요청입니다.' };
    try { return { ok: true, value: await fn(args) }; }
    catch (error) { return { ok: false, error: error.message || '요청을 처리하지 못했습니다.' }; }
  });
}
app.whenReady().then(() => {
  try { store = new Store(app.getPath('userData')); }
  catch (error) { dialog.showErrorBox('저장 파일 오류', error.message); app.quit(); return; }
  handle('load', ({month}) => { monthBounds(month); return snapshot(month); });
  handle('sync', ({month}) => sync(month));
  handle('toggle', ({id, source}) => store.toggle(id,source));
  handle('create', async input => {
    const event = validateEvent(input);
    if (input.source === 'google') {
      const result = await mcp.call('createCalendarEvent', { calendarId: 'primary', ...googleBody(event), sendUpdates: 'none' });
      textResult(result);
      try { return { ...(await sync(event.date.slice(0,7))), created: true }; }
      catch { return { ...snapshot(event.date.slice(0,7)), created: true, warning: '구글에 일정이 등록됐습니다. 목록은 새로고침해 주세요.' }; }
    }
    store.update(data => data.local.push(event));
    return snapshot(event.date.slice(0,7));
  });
  handle('deleteLocal', ({id}) => { store.update(data => { data.local = data.local.filter(e => e.id !== id); delete data.completed['local:' + id]; }); });
  handle('openEvent', ({url}) => { const target = new URL(url); if (target.protocol !== 'https:' || !['calendar.google.com','www.google.com'].includes(target.hostname)) throw new Error('허용되지 않은 링크입니다.'); return shell.openExternal(target.href); });
  win = new BrowserWindow({ width: 1420, height: 920, icon: path.join(__dirname,'../ui/haru.png'), minWidth: 1050, minHeight: 700, title: '하루 캘린더', backgroundColor: '#f8f9fc', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname,'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(page);
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { void mcp.close(); });
