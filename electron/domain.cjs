const crypto = require('node:crypto');
function validateEvent(input) {
  if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200) throw new Error('일정 제목을 1~200자로 입력해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date))) throw new Error('올바른 날짜를 선택해 주세요.');
  if (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('올바른 시간을 입력해 주세요.');
  return { id: crypto.randomUUID(), title: input.title.trim(), date: input.date, time: input.time || '', done: false, source: 'local' };
}
function googleBody(event) {
  if (!event.time) {
    const end = new Date(event.date + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + 1);
    return { summary: event.title, start: { date: event.date }, end: { date: end.toISOString().slice(0, 10) } };
  }
  const start = new Date(event.date + 'T' + event.time + ':00');
  return { summary: event.title, start: { dateTime: start.toISOString() }, end: { dateTime: new Date(+start + 3600000).toISOString() } };
}
function onDay(event, day) {
  if (!event.start) return event.date === day;
  const start = event.start.date || localDay(new Date(event.start.dateTime));
  const end = event.end?.date || localDay(new Date(new Date(event.end?.dateTime || event.start.dateTime).getTime() - 1));
  return day >= start && (event.start.date ? day < end : day <= end);
}
function localDay(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
module.exports = { validateEvent, googleBody, onDay, localDay };
