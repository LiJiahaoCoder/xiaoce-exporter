import puppeteer, { Browser, Page } from 'puppeteer';
import { URL, USER } from './config';

let browser: Browser;
let page: Page;

(async () => {
  browser = await puppeteer.launch({
    headless: true,
  });
  page = await browser.newPage();

  await page.goto(URL.Homepage);
  await login();
  await goToXiaoceListPage();
  await goToSectionListPage();
  page.close();
  process.exit();
})();

async function login () {
  await page.click('span.login');
  await page.type('.input[name=loginPhoneOrEmail]', USER.Account);
  await page.type('.input[name=loginPassword]', USER.Password);
  await page.click('.auth-form .panel .btn');
}

async function goToXiaoceListPage () {
  const UserDropDown = '.container .nav-list .nav-item.menu';
  await page.waitForSelector(UserDropDown).then(async () => {
    await page.click(`${UserDropDown}:last-child`);
    await page.click('.nav-menu.user-dropdown-list .nav-menu-item-group:nth-child(2) .nav-menu-item:nth-child(4) a');
  });
}

async function goToSectionListPage () {
  const BookListContainer = '.book-list .item';
  await page.waitForSelector(BookListContainer).then(async () => {
    const sectionListPage = await browser.newPage();
    await sectionListPage.setViewport({
      height: 900,
      width: 1080,
    });
    await sectionListPage.setDefaultNavigationTimeout(0);

    // 获取小册数量
    const length = (await page.$$(`${BookListContainer} a`)).length;

    for (let current = 1; current < length + 1; current++) {
      const link: string = await page.$eval(`${BookListContainer}:nth-child(0n + ${current}) a`, (a: any) => a.href);

      // 在新窗口中打开第 current 个小册的章节列表页面
      await sectionListPage.goto(link);

      await goToSectionDetailPage(sectionListPage);
    }

    sectionListPage.close();
  });
}

async function goToSectionDetailPage (sectionListPage: Page) {
  const sectionListContainer = '.book-content .book-directory.section-of-info';
  await sectionListPage.waitForSelector(sectionListContainer).then(async () => {
    // 获取小册章节数量
    const length = (await sectionListPage.$$(`${sectionListContainer} .section.section-link`)).length;

    // 点击第一节进入文章内容页面
    const section = await sectionListPage.$(`${sectionListContainer} .section.section-link:first-child`);
    await Promise.all([
      sectionListPage.waitForNavigation(),
      section?.click(),
    ]);

    const sectionSideBar = '.book-directory.book-directory.bought a';
    await sectionListPage.waitForSelector(sectionSideBar).then(async () => {
      for (let current = 1; current < length + 1; current++) {
        await sectionListPage.click(`${sectionSideBar}:nth-child(0n + ${current})`);
        await exportToPdf(sectionListPage, current);
      }
    });
  });
}

async function exportToPdf (sectionPage: Page, sectionNumber: number) {
  await sectionPage.waitForSelector('.entry-content.article-content').then(async () => {
    const bookTitle: any = await sectionPage.$eval('.book-content-inner .title a', (title: any) => title.innerText);

    await autoScroll(sectionPage);

    await sectionPage.waitFor(1000);

    // 导出为 PDF 格式
    await sectionPage.pdf({
      format: 'A1',
      path: `${USER.Path}/${bookTitle}-${sectionNumber}.pdf`,
    });
  });
}

function autoScroll (viewport: Page){
  return viewport.evaluate(() => {
    return new Promise((resolve, reject) => {
      let totalHeight = 0;
      const distance = 600;
      const scrollHeight = document.body.scrollHeight;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if(totalHeight >= scrollHeight){
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });

  });
}
