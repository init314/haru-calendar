const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const env = {...process.env,HARU_TEST_DATA:path.resolve('test-output/live-profile')};
delete env.ELECTRON_RUN_AS_NODE; delete env.HARU_TEST_OFFLINE;
(async()=>{
  const app = await electron.launch({executablePath:process.env.HARU_EXECUTABLE || require('electron'),args:process.env.HARU_EXECUTABLE ? [] : [path.resolve('.')],env});
  try {
    const page = await app.firstWindow();
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>document.querySelector('#sync-status')?.textContent==='방금 동기화됨',{},{timeout:60000});
    const count = await page.locator('.chip.google').count(); assert.ok(count>0);
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth); assert.equal(overflow,false);
    const first = page.locator('#pending .event-card').first();
    if(await first.count()) {
      const id = await first.getAttribute('data-event-id');
      await first.locator('.check').click();
      await page.locator('#completed .event-card').filter({has:page.locator('.check')}).first().waitFor();
      assert.ok(await page.locator('#completed .event-title').first().evaluate(el=>getComputedStyle(el).textDecorationLine==='line-through'));
      await page.screenshot({path:path.resolve('test-output/live-calendar.png')});
      await page.locator('#completed .event-card .check').first().click();
      await page.waitForFunction(id=>Array.from(document.querySelectorAll('#pending .event-card')).some(e=>e.dataset.eventId===id),id);
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS: live MCP sync, ${count} visible calendar chips, no renderer errors, no horizontal overflow`);
  } finally { await app.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
