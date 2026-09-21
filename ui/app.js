const $ = selector => document.querySelector(selector);
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
let selected = dayKey(new Date()), month = selected.slice(0,7), events = [], connected = false, syncedAt = null;
let generation = 0, syncBusy = false, toastTimer;
const pendingToggles = new Set();
const api = async (name,args) => { const result = await window.haru[name](args); if (!result.ok) throw new Error(result.error); return result.value; };
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'),6500); }
function onDay(event, day) {
  if (!event.start) return event.date === day;
  const start = event.start.date || dayKey(new Date(event.start.dateTime));
  const end = event.end?.date || dayKey(new Date(new Date(event.end?.dateTime || event.start.dateTime).getTime()-1));
  return day >= start && (event.start.date ? day < end : day <= end);
}
function visibleEvents() { return events.filter(e => $(e.source === 'google' ? '#show-google' : '#show-local').checked); }
function sortEvents(a,b) { return Number(a.done)-Number(b.done) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title,'ko'); }
function element(tag,className,text) { const el = document.createElement(tag); if(className) el.className = className; if(text !== undefined) el.textContent = text; return el; }
function applySnapshot(data) { events = data.events; connected = data.connected; syncedAt = data.syncedAt; render(); }
function render() {
  const [y,m] = month.split('-').map(Number);
  $('#month-title').textContent = `${y}년 ${m}월`;
  $('#calendar').replaceChildren();
  const first = new Date(y,m-1,1); first.setDate(1-first.getDay());
  const shown = visibleEvents();
  for (let i=0;i<42;i++) {
    const date = new Date(first); date.setDate(first.getDate()+i); const key = dayKey(date);
    const cell = element('div','day' + (date.getMonth()!==m-1?' outside':'') + (key===selected?' selected':'') + (key===dayKey(new Date())?' is-today':''));
    cell.tabIndex = 0; cell.setAttribute('role','button'); cell.setAttribute('aria-label',`${date.getMonth()+1}월 ${date.getDate()}일`); cell.setAttribute('aria-pressed',String(key===selected)); cell.dataset.date = key;
    cell.append(element('span','day-num',date.getDate()));
    const daily = shown.filter(e => onDay(e,key)).sort(sortEvents);
    const chips = element('div','day-events');
    for(const e of daily.slice(0,2)) { const chip = element('div','chip '+e.source+(e.done?' done':''),(e.done?'✓ ':'')+e.title); chip.title = e.title; chips.append(chip); }
    if(daily.length>2) chips.append(element('span','more',`+${daily.length-2}개 더`));
    cell.append(chips);
    cell.onclick = () => selectDate(key);
    cell.onkeydown = event => { if(['Enter',' '].includes(event.key)) { event.preventDefault(); selectDate(key); } };
    $('#calendar').append(cell);
  }
  renderAgenda(shown);
  $('#connection-title').textContent = connected ? 'Google 캘린더 연결됨' : 'Google 연결 준비';
  $('#connection-dot').classList.toggle('online',connected);
  $('#connection-info').textContent = connected ? 'MCP · 기본 캘린더' : '기존 MCP 연결을 사용합니다';
  $('#connect').textContent = connected ? '지금 동기화 ↻' : 'MCP로 연결하기 ↗';
  $('#event-source').querySelector('[value=google]').disabled = !connected;
}
function renderAgenda(shown) {
  const date = new Date(selected+'T12:00:00');
  $('#day-label').textContent = selected === dayKey(new Date()) ? 'TODAY' : 'YOUR DAY';
  $('#day-title').textContent = `${date.getMonth()+1}월 ${date.getDate()}일 ${['일','월','화','수','목','금','토'][date.getDay()]}요일`;
  const daily = shown.filter(e => onDay(e,selected)).sort(sortEvents), completed = daily.filter(e => e.done), pending = daily.filter(e => !e.done);
  $('#day-subtitle').textContent = daily.length ? `${daily.length}개의 일정, 나만의 속도로 채워가요.` : '새로운 계획을 담아보세요.';
  const percent = daily.length ? Math.round(completed.length/daily.length*100) : 0;
  $('#progress-text').textContent = `${percent}%`; $('#progress').value = percent;
  $('#progress-caption').textContent = completed.length ? (pending.length ? `${daily.length}개 중 ${completed.length}개 완료했어요` : '오늘의 계획을 모두 마쳤어요. 수고했어요!') : '오늘의 첫 체크를 기다려요';
  $('#pending-count').textContent = pending.length; $('#done-count').textContent = completed.length;
  $('#pending').replaceChildren(); $('#completed').replaceChildren();
  pending.forEach(e => $('#pending').append(eventCard(e))); completed.forEach(e => $('#completed').append(eventCard(e)));
  if (!pending.length) { const empty = element('div','empty'); empty.append(element('div','empty-icon',daily.length?'✓':'☀'),element('strong','',daily.length?'모두 마쳤어요!':'여유로운 하루네요.'),element('span','',daily.length?'잠깐 쉬어가도 좋아요.':'＋ 버튼으로 일정을 추가해 보세요.')); $('#pending').append(empty); }
}
function eventCard(event) {
  const card = element('div','event-card'+(event.done?' done':'')); card.dataset.eventId = event.id;
  const check = element('button','check',event.done?'✓':'');
  check.setAttribute('aria-label',`${event.title} ${event.done?'완료 취소':'완료'}`); check.setAttribute('aria-pressed',String(event.done));
  check.disabled = pendingToggles.has(event.source+':'+event.id);
  check.onclick = () => toggle(event);
  const info = element('div','event-info');
  const title = element(event.link?'button':'div','event-title',event.title);
  title.title = event.description || event.title;
  if(event.link) title.onclick = () => api('openEvent',{url:event.link}).catch(e=>toast(e.message));
  const meta = element('div','event-meta'); meta.append(element('span','color-dot '+(event.source==='google'?'purple':'green')),element('span','',event.deadline ? '마감' : (event.time || '종일')),element('span','',event.source==='google'?'· Google':'· 나만의 일정'));
  if (event.end && onDay(event,selected) && event.date !== selected) meta.append(element('span','','진행 중'));
  info.append(title,meta);
  if(event.location) info.append(element('div','event-location',event.location));
  card.append(check,info);
  if(event.source==='local') { const remove = element('button','delete-local','×'); remove.setAttribute('aria-label',`${event.title} 삭제`); remove.onclick = async () => { try { await api('deleteLocal',{id:event.id}); events = events.filter(e=>e.id!==event.id); render(); toast('일정을 삭제했어요.'); } catch(e){toast(e.message);} }; card.append(remove); }
  return card;
}
async function toggle(event) {
  const key = event.source+':'+event.id;
  if(pendingToggles.has(key)) return;
  pendingToggles.add(key);
  const oldPositions = new Map([...document.querySelectorAll('.event-card')].map(el=>[el.dataset.eventId,el.getBoundingClientRect()]));
  try {
    const done = await api('toggle',{id:event.id,source:event.source});
    const current = events.find(e=>e.id===event.id&&e.source===event.source); if(current) current.done = done;
    render();
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.event-card').forEach(el=> { const old = oldPositions.get(el.dataset.eventId), now = el.getBoundingClientRect(); if(old) el.animate([{ transform:`translateY(${old.top-now.top}px)`,opacity:.6 },{ transform:'translateY(0)',opacity:1 }],{duration:380,easing:'cubic-bezier(.2,.8,.2,1)'}); });
    }
    toast(done?'하나 더 완료했어요. 잘했어요!':'할 일로 다시 옮겼어요.');
  } catch(error) { toast(error.message); }
  finally { pendingToggles.delete(key); document.querySelectorAll('.event-card').forEach(el => { if(el.dataset.eventId===event.id) el.querySelector('.check').disabled = false; }); }
}
async function selectDate(key) {
  selected = key;
  if(month!==key.slice(0,7)) { month = key.slice(0,7); await loadMonth(); }
  else render();
}
async function loadMonth() {
  const currentGeneration = ++generation, currentMonth = month;
  try { const data = await api('load',{month:currentMonth}); if(currentGeneration!==generation) return; applySnapshot(data); $('#sync-status').textContent = data.syncedAt ? '저장된 일정 표시 중' : '로컬 일정 사용 가능'; if(connected) void syncCalendar(); }
  catch(error){toast(error.message);}
}
async function syncCalendar() {
  if(syncBusy) return;
  syncBusy = true; const requestedMonth = month;
  $('#sync').disabled = true; $('#connect').disabled = true; $('#sync-status').textContent = 'Google 동기화 중…';
  try { const data = await api('sync',{month:requestedMonth}); if(month===requestedMonth) { applySnapshot(data); $('#sync-status').textContent = '방금 동기화됨'; } }
  catch(error) { $('#sync-status').textContent = '연결 끊김 · 저장된 일정'; $('#connection-dot').classList.remove('online'); $('#connection-title').textContent = '연결을 확인해 주세요'; toast(error.message); }
  finally { syncBusy = false; $('#sync').disabled = false; $('#connect').disabled = false; if(month!==requestedMonth && connected) void syncCalendar(); }
}
function shiftMonth(delta) { const [y,m]=month.split('-').map(Number); void selectDate(dayKey(new Date(y,m-1+delta,1))); }
function openForm() { $('#event-form').reset(); $('#event-date').value = selected; $('#form-error').textContent = ''; $('#event-dialog').showModal(); $('#event-title').focus(); }
$('#new-event').onclick = openForm; $('#add-day').onclick = openForm;
$('#prev').onclick = () => shiftMonth(-1); $('#next').onclick = () => shiftMonth(1);
$('#today').onclick = $('#today-nav').onclick = () => selectDate(dayKey(new Date()));
$('#calendar-view').onclick = () => $('#calendar').scrollIntoView({behavior:'smooth'});
$('#sync').onclick = $('#connect').onclick = syncCalendar;
$('#show-google').onchange = $('#show-local').onchange = render;
$('#help').onclick = () => $('#help-dialog').showModal();
document.querySelectorAll('.close-dialog').forEach(button => button.onclick = () => button.closest('dialog').close());
$('#event-form').onsubmit = async event => {
  event.preventDefault(); if($('#save-event').disabled) return;
  const input = Object.fromEntries(new FormData(event.target));
  $('#save-event').disabled = true; $('#save-event').textContent = '저장 중…'; $('#form-error').textContent = '';
  try { const data = await api('create',input); selected = input.date; month = selected.slice(0,7); ++generation; applySnapshot(data); $('#event-dialog').close(); toast(data.warning || '새 일정이 추가됐어요.'); }
  catch(error){$('#form-error').textContent = error.message;}
  finally { $('#save-event').disabled = false; $('#save-event').textContent = '일정 추가하기'; }
};
void loadMonth().then(() => { if(!connected) void syncCalendar(); });
setInterval(() => { if(connected && !document.hidden) void syncCalendar(); },300000);
