// Browser regression test with deterministic API fixtures, independent of database availability.
// Run a built server first; TEST_BASE_URL defaults to http://127.0.0.1:3001.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

async function main() {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let records = 0, counts = 0;
  const id = '00000000-0000-0000-0000-000000000001';
  const row = (label, overrides = {}) => ({ id, bookingId: id, label, status: 'CONFIRMED', occurredAt: '2026-11-13T00:00:00Z', rangeId: 7, leaseholder: 1, replicas: ['1','2','3'], placementStatus: 'METADATA', partition: null, ...overrides });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let body;
    if (url.pathname === '/api/monitoring/replication') body = {
      observedAt: new Date().toISOString(), samples: [],
      cockroach: { status:'AVAILABLE',targetReplicas:3,liveNodes:3,knownNodes:3,ranges:4,minCopies:3,maxCopies:3,rangesWithoutMajority:0,
        nodes:[1,2,3].map(n => ({ nodeId:n,address:`10.0.0.${n}:26257`,live:true,leaseholderRanges:1,replicaRanges:4,sizeMb:1 })),
        tables:[{ table:'bookings',rows:1000,ranges:4,sizeMb:1,rangesByCopies:{3:4} }],error:null },
      cassandra: {status:'AVAILABLE',keyspace:'flight_booking_events',strategy:'SimpleStrategy',replicationFactor:3,consistency:'LOCAL_QUORUM',nodesInDatacenter:3,liveNodes:3,copiesPerRow:3,requiredForWrite:2,liveCopiesWorstCase:3,writableWorstCase:true,
        nodes:[1,2,3].map(n => ({address:`10.0.0.${n}`,datacenter:'datacenter1',state:'UP'})),error:null},
    };
    else if (url.pathname === '/api/analytics/summary') body = {outbox:{published:4000,pending:0}};
    else if (url.pathname === '/api/monitoring/distribution/counts') {
      counts++;
      body={tables:[{table:'booking_events_by_booking',rows:1000,status:'EXACT',observedAt:new Date().toISOString()},{table:'booking_events_by_day',rows:null,status:'UNAVAILABLE',observedAt:new Date().toISOString()}],observedAt:new Date().toISOString()};
    } else if (url.pathname === '/api/monitoring/distribution/records') {
      records++;
      const q=url.searchParams;
      if (q.get('query') === 'EMPTY' && !q.get('cursor')) return route.fulfill({status:200,json:{rows:[],nextCursor:id,hasMore:true,scanned:100,observedAt:new Date().toISOString()}});
      if (q.get('query') === 'FAIL') return route.fulfill({status:503,json:{code:'DATABASE_TEMPORARILY_UNAVAILABLE',message:'Database đang mất kết nối.'}});
      assert.ok(['20','50','100'].includes(q.get('limit')));
      const cassandra=q.get('database') === 'cassandra';
      if (cassandra) assert.ok(q.get('query') || q.get('date'));
      body={rows:[row(cassandra?'EVENT-001':q.get('cursor')?'VE-003':q.get('query') || 'VE-001',cassandra?{partition:q.get('query') || q.get('date'),rangeId:null,replicas:['10.0.0.1']}:{})],nextCursor:q.get('cursor')||cassandra?null:id,hasMore:!q.get('cursor')&&!cassandra,scanned:20,observedAt:new Date().toISOString()};
    } else if (url.pathname.endsWith('/events')) body={events:[{eventId:id,eventType:'BOOKING_CREATED',occurredAt:new Date().toISOString()}],pendingEvents:1};
    else return route.fulfill({status:404,json:{message:'Unknown fixture endpoint'}});
    return route.fulfill({status:200,json:body});
  });
  try {
    await page.goto((process.env.TEST_BASE_URL || 'http://127.0.0.1:3001')+'/replication');
    await page.getByText('VE-001',{exact:true}).waitFor();
    assert.equal(records,1); assert.equal(counts,0);
    await page.getByRole('button',{name:'Tiếp',exact:true}).click();
    await page.getByText('VE-003',{exact:true}).waitFor();
    assert.equal(records,2);
    await page.getByRole('button',{name:'Xem chi tiết',exact:true}).click();
    await page.getByRole('button',{name:'Xem lịch sử sự kiện Cassandra'}).click();
    await page.getByText('BOOKING_CREATED',{exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Trước',exact:true}).click();
    await page.getByText('VE-001',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Đếm dữ liệu',exact:true}).click();
    await page.getByText('Đếm trực tiếp',{exact:true}).waitFor();
    await page.getByText('Chưa đọc được',{exact:true}).waitFor();
    assert.equal(counts,1);
    await page.getByLabel('Tìm mã vé hoặc UUID dòng').fill('VE-SEARCH');
    await page.getByRole('button',{name:'Áp dụng',exact:true}).click();
    await page.getByText('VE-SEARCH',{exact:true}).waitFor();
    await page.getByRole('combobox',{name:'Số dòng mỗi trang',exact:true}).click();
    await page.getByRole('option',{name:'50',exact:true}).click();
    await page.getByRole('combobox',{name:'Node giữ bản sao',exact:true}).click();
    await page.getByRole('option',{name:'Node 1 · 10.0.0.1:26257',exact:true}).click();
    const filtered=page.waitForRequest(request => request.url().includes('/distribution/records') && new URL(request.url()).searchParams.get('node')==='1' && new URL(request.url()).searchParams.get('limit')==='50');
    await page.getByRole('button',{name:'Áp dụng',exact:true}).click();await filtered;
    await page.getByText('VE-SEARCH',{exact:true}).waitFor();
    const stable=records;await page.waitForTimeout(11000);assert.equal(records,stable,'Snapshot polling must not reload the data browser');
    await page.getByLabel('Tìm mã vé hoặc UUID dòng').fill('EMPTY');
    await page.getByRole('button',{name:'Áp dụng',exact:true}).click();
    await page.getByText('Chưa có dòng khớp trong lượt quét này. Bấm Tiếp để tìm tiếp.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Tiếp',exact:true}).isEnabled(),true);
    await page.getByRole('combobox',{name:'Database',exact:true}).click();
    await page.getByRole('option',{name:'Cassandra',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Áp dụng',exact:true}).isDisabled(),true);
    await page.getByLabel('Mã vé hoặc UUID booking (bắt buộc)').fill(id);
    await page.getByRole('button',{name:'Áp dụng',exact:true}).click();
    await page.getByText('EVENT-001',{exact:true}).waitFor();
    await page.getByRole('combobox',{name:'Bảng dữ liệu',exact:true}).click();
    await page.getByRole('option',{name:'booking_events_by_day',exact:true}).click();
    await page.getByLabel('Ngày sự kiện (UTC)').fill('2026-11-13');
    await page.getByRole('button',{name:'Áp dụng',exact:true}).click();
    await page.getByText('2026-11-13',{exact:true}).waitFor();
    await fs.mkdir('test-artifacts',{recursive:true});
    await page.screenshot({path:'test-artifacts/distribution-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('heading',{name:'Dữ liệu đang nằm ở đâu'}).scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth+1),'Mobile page must not overflow horizontally');
    await page.screenshot({path:'test-artifacts/distribution-mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:1050});
    await page.getByRole('combobox',{name:'Database',exact:true}).click();await page.getByRole('option',{name:'CockroachDB',exact:true}).click();
    await page.getByLabel('Tìm mã vé hoặc UUID dòng').fill('FAIL');
    await page.getByRole('button',{name:'Áp dụng',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Database đang mất kết nối.'}).waitFor();
    assert.equal(await page.getByText('EVENT-001',{exact:true}).count(),0,'Old rows must not remain under new filters after a failed request');
    assert.deepEqual(errors,[]);
    console.log('PASS: pagination, search, node/page-size filters, details, Cassandra partitions, explicit counts, stable polling, mobile layout, API errors.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
