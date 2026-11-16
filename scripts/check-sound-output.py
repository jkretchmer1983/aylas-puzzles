import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    for name,b in [('chromium',p.chromium),('webkit',p.webkit)]:
      try: br=await b.launch(headless=True)
      except Exception as e: print(name,'launch fail',str(e)[:80]); continue
      pg=await (await br.new_context(viewport={"width":393,"height":852},has_touch=True)).new_page()
      errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
      await pg.goto('http://localhost:8080/play?band=6-7&t=coins&s=5',wait_until='networkidle')
      await pg.wait_for_timeout(2500)
      s=pg.locator('summary').filter(has_text='').first
      for sel in ['.audio-menu summary','details summary']:
        if await pg.locator(sel).count(): await pg.locator(sel).first.click(); break
      await pg.wait_for_timeout(300)
      print(name,'status before:',await pg.locator('.audio-status').first.text_content())
      await pg.get_by_role('button',name='Test sound').first.click()
      await pg.wait_for_timeout(1200)
      print(name,'after test:',await pg.locator('.audio-status').first.text_content())
      await pg.screenshot(path=f'/tmp/browser/snd/{name}.png')
      print(name,'errors',errs[:2]); await br.close()
asyncio.run(main())
