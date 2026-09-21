const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parse } = require('smol-toml');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { localDay } = require('./domain.cjs');

function readServer() {
  const configPath = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'config.toml');
  if (!fs.existsSync(configPath)) throw new Error('이 PC에서 MCP 설정을 찾지 못했습니다. 기존 MCP 설정이 있는 PC에서 실행해 주세요.');
  const config = parse(fs.readFileSync(configPath, 'utf8'));
  const servers = config.mcp_servers || {};
  const key = servers.home_google_drive ? 'home_google_drive' : Object.keys(servers).find(k => /google.*(drive|calendar)/i.test(k));
  const server = servers[key];
  if (!server?.command || server.enabled === false) throw new Error('사용 가능한 Google MCP 서버 설정이 없습니다.');
  return { key, server };
}
function textResult(result) {
  const value = (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  if (result.isError || /^Error:/i.test(value)) {
    if (/insufficient.*scope/i.test(value)) throw new Error('MCP 계정에 캘린더 접근 권한이 없습니다. 서버의 Google 계정 권한을 확인해 주세요.');
    throw new Error(value.slice(0, 400) || 'MCP 요청에 실패했습니다.');
  }
  return value;
}
function normalize(item) {
  if (!item.id || !item.start) throw new Error('일정 응답 형식을 확인할 수 없습니다.');
  const title = item.summary || '(제목 없음)';
  const description = item.description || '';
  const isLmsDeadline = /^\[LMS\]/i.test(title) || /LMS-UID:/i.test(description);
  if (isLmsDeadline && item.end) {
    // LMS 기간 과제/영상은 시작일부터 계속 표시하지 않고 마감일에만 표시한다.
    const deadline = item.end.date ? localDay(new Date(`${item.end.date}T00:00:00`)) : localDay(new Date(item.end.dateTime));
    const deadlineDate = item.end.date ? localDay(new Date(new Date(`${item.end.date}T00:00:00`).getTime() - 86400000)) : deadline;
    const nextDate = localDay(new Date(new Date(`${deadlineDate}T00:00:00`).getTime() + 86400000));
    return { id: item.id, title, source: 'google', start: { date: deadlineDate }, end: { date: nextDate }, date: deadlineDate,
      time: '', deadline: true, location: item.location || '', description, link: item.htmlLink || '' };
  }
  return { id: item.id, title, source: 'google', start: item.start, end: item.end,
    date: item.start.date || localDay(new Date(item.start.dateTime)),
    time: item.start.dateTime ? new Date(item.start.dateTime).toTimeString().slice(0,5) : '',
    location: item.location || '', description, link: item.htmlLink || '' };
}
function parseEvents(result) {
  const value = textResult(result);
  let structured = result.structuredContent;
  if (!structured) { try { structured = JSON.parse(value); } catch {} }
  const items = Array.isArray(structured) ? structured : structured?.items || structured?.events;
  if (items) return items.filter(e => e.status !== 'cancelled').map(normalize);
  if (/No events found|Found 0 event/i.test(value)) return [];
  const events = [];
  // This server publishes Markdown rather than structuredContent. Match its exact record boundaries.
  const pattern = /(?:^|\n\n---\n\n|\n\n)\*\*([^\n]*)\*\*\r?\n(Time|Date): ([^\n]+)\r?\n([\s\S]*?)^Event ID: ([^\r\n]+)(?=\r?\n|$)/gm;
  for (const match of value.matchAll(pattern)) {
    const [, title, type, range, details, id] = match;
    const [start, end] = range.split(' - ');
    if (!start || !end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) throw new Error('일정 날짜 형식을 읽지 못했습니다.');
    const descriptionStart = details.indexOf('Description: ');
    const description = descriptionStart < 0 ? '' : details.slice(descriptionStart + 13).split('\nLink: ')[0].trim();
    events.push(normalize({ id, summary: title, start: type === 'Date' ? { date: start } : { dateTime: start }, end: type === 'Date' ? { date: end } : { dateTime: end }, location: details.match(/^Location: (.*)$/m)?.[1], description, htmlLink: details.match(/^Link: (.*)$/m)?.[1] }));
  }
  const expected = value.match(/Found (\d+) event/);
  if (!expected || Number(expected[1]) !== events.length) throw new Error('MCP 일정 응답 형식이 달라 동기화를 중단했습니다. 기존 일정은 보관됩니다.');
  return events;
}
class CalendarMcp {
  async connect() {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const { server } = readServer();
      const client = new Client({ name: 'haru-calendar', version: '1.0.0' });
      const transport = new StdioClientTransport({ command: server.command, args: server.args || [], env: { ...process.env, ...(server.env || {}) }, stderr: 'ignore' });
      try {
        await client.connect(transport, { timeout: 25000 });
        client.onclose = () => { if (this.client === client) this.client = null; };
        this.client = client;
        return client;
      } catch (error) { await transport.close().catch(() => {}); throw error; }
    })();
    try { return await this.connecting; } finally { this.connecting = null; }
  }
  async call(name, args) {
    const client = await this.connect();
    return client.callTool({ name, arguments: args }, undefined, { timeout: 30000 });
  }
  async events(from, to, depth = 0) {
    const result = await this.call('getCalendarEvents', { calendarId: 'primary', timeMin: from, timeMax: to, maxResults: 250, singleEvents: true, orderBy: 'startTime' });
    const events = parseEvents(result);
    if (events.length < 250) return events;
    if (depth >= 12) throw new Error('이 기간의 일정이 너무 많아 모두 읽지 못했습니다.');
    const middle = new Date((Date.parse(from) + Date.parse(to)) / 2).toISOString();
    const first = await this.events(from, middle, depth + 1);
    const second = await this.events(middle, to, depth + 1);
    return [...new Map([...first, ...second].map(e => [e.id, e])).values()];
  }
  async close() { await this.client?.close(); this.client = null; }
}
module.exports = { CalendarMcp, parseEvents, textResult };
