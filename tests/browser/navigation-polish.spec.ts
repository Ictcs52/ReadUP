import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {authenticatedDemo} from './fixtures';
const require=createRequire(import.meta.url);
test.beforeEach(async({page})=>{await authenticatedDemo(page);await page.goto('./');});

test('sidebar logo aligns with the header and collapsed navigation retains names, links and preference',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 const brand=page.locator('.sidebar .brand');const bar=page.locator('.topbar');
 expect(Math.abs((await brand.boundingBox())!.y+(await brand.boundingBox())!.height-((await bar.boundingBox())!.y+(await bar.boundingBox())!.height))).toBeLessThanOrEqual(1);
 await page.getByRole('button',{name:'ยุบเมนู',exact:true}).click();await expect(page.getByRole('button',{name:'ขยายเมนู',exact:true})).toHaveAttribute('aria-expanded','false');expect((await page.locator('.sidebar').boundingBox())!.width).toBe(84);
 await page.locator('.sidebar').getByRole('button',{name:'บทเรียนของฉัน',exact:true}).click();await expect(page.getByRole('heading',{name:'บทเรียนของฉัน',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:'ขยายเมนู',exact:true})).toBeVisible();await page.screenshot({path:'test-results/menu-collapsed-desktop.png',fullPage:true});
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>v.id))).toEqual([]);
 await page.getByRole('button',{name:'ขยายเมนู',exact:true}).click();await expect(page.getByRole('button',{name:'ยุบเมนู',exact:true})).toHaveAttribute('aria-expanded','true');await page.screenshot({path:'test-results/menu-expanded-desktop.png',fullPage:true});
 for(const width of [960,1100,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(Math.abs((await brand.boundingBox())!.height-(await bar.boundingBox())!.height)).toBeLessThanOrEqual(1);}
});

test('mobile navigation works after desktop collapse and concise home preserves the reading headline and start button',async({page})=>{
 await page.getByRole('button',{name:'ยุบเมนู',exact:true}).click();
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});await expect(page.locator('.sidebar')).toBeHidden();await expect(page.locator('.sidebar-toggle')).toBeHidden();await expect(page.locator('.mobile-nav')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.locator('.mobile-nav').getByRole('button',{name:'บทเรียนของฉัน',exact:true}).click();await expect(page.getByRole('heading',{name:'บทเรียนของฉัน',exact:true})).toBeVisible();await page.locator('.mobile-nav').getByRole('button',{name:'หน้าหลัก',exact:true}).click();
 await expect(page.locator('#hero-title')).toContainText('อ่านได้อย่างมั่นใจ');await expect(page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true})).toBeVisible();await expect(page.locator('.stats-grid .stat')).toHaveCount(2);await page.screenshot({path:'test-results/concise-home-mobile.png',fullPage:true});
});
