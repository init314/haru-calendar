const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { localDay } = require('../electron/domain.cjs');
const directory = path.resolve('test-output/profile-' + Date.now());
fs.mkdirSync(directory,{recursive:true});
const executablePath = process.env.HARU_EXECUTABLE || require('electron');
const env = {...process.env,HARU_TEST_DATA:directory,HARU_TEST_OFFLINE:'1'};
delete env.ELECTRON_RUN_AS_NODE;
const launch = () => electron.launch({executablePath,args:process.env.HARU_EXECUTABLE ? [] : [path.resolve('.')],env});
(async()=>{
  let app = await launch();
  try {
    let page = await app.firstWindow(); await page.waitForSelector('.day');
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    assert.equal(await page.locator('.day').count(),42);
    assert.equal(await page.locator('#event-source option').count(),2);
    await page.locator('#new-event').click(); await page.locator('#event-title').fill('완료 테스트'); await page.locator('#save-event').click();
    const card = page.locator('#pending .event-card').filter({hasText:'완료 테스트'}); await card.waitFor();
    await card.locator('.check').click(); await page.locator('#completed .event-card').filter({hasText:'완료 테스트'}).waitFor();
    assert.equal(await page.locator('#progress-text').textContent(),'100%');
    assert.ok(!(await page.locator('#toast').textContent()).includes('Cannot'));
    await page.screenshot({path:path.resolve('test-output/local-completed.png')});
    await app.close(); app = await launch(); page = await app.firstWindow();
    const completed = page.locator('#completed .event-card').filter({hasText:'완료 테스트'}); await completed.waitFor();
    assert.equal(await completed.locator('.event-title').evaluate(el=>getComputedStyle(el).textDecorationLine),'line-through');
    await completed.locator('.check').click(); await page.locator('#pending .event-card').filter({hasText:'완료 테스트'}).waitFor();
    await page.locator('#next').click(); await page.locator('#today').click();
    await page.locator('#pending .event-card').filter({hasText:'완료 테스트'}).waitFor();
    await page.locator('#show-local').uncheck(); assert.equal(await page.locator('.event-card').count(),0);
    await page.locator('#show-local').check();
    await page.locator('#pending .event-card .delete-local').focus(); await page.locator('#pending .event-card .delete-local').click();
    await page.waitForFunction(()=>document.querySelectorAll('.event-card').length===0);
    assert.deepEqual(errors,[]);
    console.log('PASS: create, complete, strikethrough, restart persistence, restore, month navigation, filters, delete');
  } finally { await app.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
