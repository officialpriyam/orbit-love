// Browser UI checks use mocked API responses; no real accounts or settings change.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath: process.env.BROWSER_EXECUTABLE || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe', headless:true});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let settings = {country_enabled:false, outside_country_enabled:false, city_enabled:true};
  const round = {id:'test', title:'Test round', status:'open', closes_at:Date.now()/1000+86400};
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = {};
    if (path === '/api/me') data = {id:'admin',name:'Test admin',email:'test@example.com',is_admin:true};
    if (path === '/api/admin') data = {round, location_settings:settings, participants:0, submitted:0, emails_pending:0, events:[]};
    if (path === '/api/dashboard') data = {round, location_settings:settings, has_profile:false, answered:0, submitted:false, matches:[], answers:{}};
    if (path === '/api/admin/location-settings') { settings = route.request().postDataJSON(); data = {ok:true}; }
    await route.fulfill({json:data});
  });
  const base = process.env.TEST_APP_URL || 'http://127.0.0.1:3000';
  await page.goto(base + '/#admin');
  const country = page.getByRole('switch', {name:/^Country section/});
  const outside = page.getByRole('switch', {name:/^Outside-country/});
  await country.waitFor();
  assert.equal(await outside.isDisabled(), true);
  await country.click();
  await page.getByRole('switch', {name:'Country section: On'}).waitFor();
  await outside.click();
  await page.getByRole('switch', {name:'Outside-country matching: On'}).waitFor();
  await page.goto(base + '/#profile');
  await page.getByLabel('Your country', {exact:true}).waitFor();
  await page.getByLabel('Your city', {exact:true}).waitFor();
  assert.equal(await page.getByText("I'm open to meeting someone outside my country.", {exact:false}).count(),1);
  await page.goto(base + '/#admin');
  await country.click();
  await page.getByRole('switch', {name:'Country section: Off'}).waitFor();
  assert.equal(await outside.isDisabled(),true);
  assert.equal(settings.outside_country_enabled,false);
  await page.getByRole('switch', {name:'City section: On'}).click();
  await page.getByRole('switch', {name:'City section: Off'}).waitFor();
  await page.goto(base + '/#profile');
  await page.getByLabel('Your age', {exact:true}).waitFor();
  await page.waitForTimeout(100);
  assert.equal(await page.getByLabel('Your country', {exact:true}).count(),0);
  assert.equal(await page.getByLabel('Your city', {exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('Location UI checks passed: admin switches, dependent country switch, onboarding visibility, no page errors (mock API).');
} finally { await browser.close(); }
