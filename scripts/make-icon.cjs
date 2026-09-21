const { _electron } = require('playwright');
const fs = require('node:fs');
(async()=>{
  const env={...process.env,HARU_TEST_OFFLINE:'1',HARU_TEST_DATA:require('path').resolve('test-output/icon-profile')};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({args:['.'],env});
  try{
    const page=await app.firstWindow();
    const url=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#7660d8';x.beginPath();x.roundRect(8,8,240,240,64);x.fill();x.strokeStyle='#fff';x.lineWidth=20;x.lineCap='round';x.lineJoin='round';x.beginPath();x.moveTo(68,131);x.lineTo(110,173);x.lineTo(187,83);x.stroke();return c.toDataURL('image/png')});
    const png=Buffer.from(url.split(',')[1],'base64');fs.writeFileSync('ui/haru.png',png);
    const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);fs.writeFileSync('ui/haru.ico',Buffer.concat([header,png]));
  }finally{await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
