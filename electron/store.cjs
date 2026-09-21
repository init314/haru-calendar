const fs = require('node:fs');
const path = require('node:path');
class Store {
  constructor(directory) {
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, 'calendar.json');
    this.data = { local: [], completed: {}, months: {}, connected: false };
    if (fs.existsSync(this.file)) {
      try { this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; }
      catch { throw new Error('저장 파일을 읽지 못했습니다. calendar.json 파일을 백업한 뒤 확인해 주세요.'); }
    }
  }
  update(fn) {
    const next = structuredClone(this.data); fn(next);
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(next), 'utf8');
    fs.renameSync(this.file + '.tmp', this.file); this.data = next;
  }
  events(month) {
    return [...this.data.local.filter(e => e.date.startsWith(month)), ...(this.data.months[month]?.events || [])]
      .map(e => ({ ...e, done: !!this.data.completed[e.source + ':' + e.id] }));
  }
  toggle(id, source) {
    const exists = source === 'local' ? this.data.local.some(e => e.id === id) : Object.values(this.data.months).some(m => m.events.some(e => e.id === id));
    if (!exists) throw new Error('일정을 찾을 수 없습니다.');
    const key = source + ':' + id;
    this.update(data => { if (data.completed[key]) delete data.completed[key]; else data.completed[key] = new Date().toISOString(); });
    return !!this.data.completed[key];
  }
}
module.exports = { Store };
