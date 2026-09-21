const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateEvent, googleBody, onDay } = require('../electron/domain.cjs');
const { Store } = require('../electron/store.cjs');
const { parseEvents } = require('../electron/mcp.cjs');
test('종일 일정은 종료일을 제외하고 여러 날짜에 표시한다',()=>{
  const event={start:{date:'2026-09-21'},end:{date:'2026-09-24'}};
  assert.equal(onDay(event,'2026-09-21'),true); assert.equal(onDay(event,'2026-09-23'),true); assert.equal(onDay(event,'2026-09-24'),false);
  assert.equal(googleBody(validateEvent({title:'월말',date:'2026-12-31'})).end.date,'2027-01-01');
});
test('완료 상태를 저장하고 재실행 후 복원하며 반복 일정 인스턴스를 구분한다',()=>{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'haru-test-'));
  const store = new Store(dir);
  store.update(d=>{d.months['2026-09']={events:[{id:'repeat_21',source:'google'},{id:'repeat_22',source:'google'}]};});
  assert.equal(store.toggle('repeat_21','google'),true);
  const reopened = new Store(dir); assert.equal(reopened.events('2026-09')[0].done,true); assert.equal(reopened.events('2026-09')[1].done,false);
  assert.equal(reopened.toggle('repeat_21','google'),false);
});
test('실제 MCP 텍스트 응답 및 종일/시간 일정을 읽는다',()=>{
  const result={content:[{type:'text',text:'Found 2 event(s):\n\n**과제**\nDate: 2026-09-21 - 2026-09-22\nDescription: 제출\nLink: https://www.google.com/calendar/event?eid=abc\nEvent ID: abc\n\n---\n\n**강의**\nTime: 2026-09-21T09:00:00+09:00 - 2026-09-21T12:00:00+09:00\nLocation: 강의실\nEvent ID: def'}]};
  const events=parseEvents(result); assert.equal(events.length,2); assert.equal(events[0].title,'과제'); assert.equal(events[1].location,'강의실'); assert.equal(events[0].start.date,'2026-09-21');
});
test('오류나 불완전한 응답을 빈 일정으로 덮어쓰지 않는다',()=>{
  assert.throws(()=>parseEvents({isError:true,content:[{type:'text',text:'Error: disconnected'}]}));
  assert.throws(()=>parseEvents({content:[{type:'text',text:'Found 2 event(s):\n\ninvalid'}]}));
  assert.deepEqual(parseEvents({content:[{type:'text',text:'No events found.'}]}),[]);
});
