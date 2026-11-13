import { expect, test, type Page } from '@playwright/test'

function watchRuntimeErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }))
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport + 1)
}

test('首屏、像素尾线与樱花雨可用', async ({ page }) => {
  const errors = watchRuntimeErrors(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.locator('html').evaluate((element) => (element as HTMLElement).style.scrollBehavior = 'auto')

  await expect(page.getByRole('heading', { name: '我把技术，种成会发光的东西。' })).toBeVisible()
  await expect(page.locator('.pixel-tether-canvas')).toHaveCount(1)
  await expect(page.locator('[class*="bee"]')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await page.mouse.move(260, 180)
  await page.mouse.move(760, 410, { steps: 12 })
  await page.screenshot({ path: 'output/playwright/v2-cursor-desktop.png' })

  const tree = page.getByRole('button', { name: '摇动樱花树' })
  await tree.scrollIntoViewIfNeeded()
  await tree.click()
  await tree.click()
  await tree.click()
  await expect(page.getByText(/樱花雨开始了/)).toBeVisible()
  expect(errors).toEqual([])
})

test('阁楼、电池、特殊花与零点广播形成闭环', async ({ page }) => {
  const errors = watchRuntimeErrors(page)
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('pink-signal-garden:v1')
    localStorage.setItem('pink-signal-farm:v2', JSON.stringify({
      version: 2,
      unlocked: [
        'attic:open',
        'cat:trusted',
        'seed:sakura-ready',
        'code:hello-world',
        'broadcast:tuned-complete',
      ],
      inventory: ['sakura-seed'],
      shards: { bloom: false, broadcast: true, ember: false },
      caughtPetals: 6,
      towerBands: [0, 1, 2],
      catTrust: 3,
      revivedFailedProject: false,
      endingSeen: false,
      lastVisitDate: '2026-07-15',
      soundEnabled: false,
    }))
  })
  await page.reload()
  await page.locator('html').evaluate((element) => (element as HTMLElement).style.scrollBehavior = 'auto')

  await page.locator('#about').scrollIntoViewIfNeeded()
  for (const label of ['关于 BBB', '工作技术栈', '正在研究']) {
    await page.getByRole('button', { name: new RegExp(label) }).click()
    await page.getByRole('button', { name: '放上阁楼工作台' }).click()
  }
  await expect(page.getByText(/工作台下方弹出一个小暗格/)).toBeVisible()

  await page.locator('#lab').scrollIntoViewIfNeeded()
  await page.locator('.project-card.is-failed').click()
  await page.getByRole('button', { name: '把旧电池投入温室' }).click()
  await expect(page.getByText(/失败实验重新发芽/)).toBeVisible()

  await page.locator('#garden').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: /发光樱花种子/ }).click()
  const firstCell = page.locator('.soil-cell').first()
  await firstCell.click()
  await firstCell.click()
  await firstCell.click()
  await firstCell.click()
  await expect(page.getByText(/树冠点亮了|花心碎片已点亮/).first()).toBeVisible()

  await page.getByRole('button', { name: '重新翻土' }).click()
  await expect(page.getByRole('button', { name: '确认清空' })).toBeVisible()
  await page.getByRole('button', { name: '确认清空' }).click()
  await expect(page.locator('.soil-cell--stage-0')).toHaveCount(16)
  await expect(page.getByText(/花圃已经重新翻土/)).toBeVisible()

  await page.locator('#contact').scrollIntoViewIfNeeded()
  const stars = page.locator('.constellation-star')
  for (const index of [1, 0, 2, 3, 4]) await stars.nth(index).click()
  await expect(page.locator('.night-scene')).toHaveClass(/has-constellation/)
  await page.getByRole('button', { name: /开始零点广播/ }).click()
  await expect(page.getByRole('dialog', { name: /零点广播/ })).toBeVisible()
  await page.waitForTimeout(1300)
  await page.screenshot({ path: 'output/playwright/v2-zero-broadcast.png' })
  await page.getByRole('button', { name: '跳过演出' }).click()
  await expect(page.getByText('零点广播已经送达。')).toBeVisible()

  await expectNoHorizontalOverflow(page)
  expect(errors).toEqual([])
})

test('移动端布局无横向溢出', async ({ page }) => {
  const errors = watchRuntimeErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '我把技术，种成会发光的东西。' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '移动端导航' })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 220))
  await expect(page.locator('.hero-world')).toHaveCSS('opacity', '1')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')

  const tree = page.getByRole('button', { name: '摇动樱花树' })
  await tree.click()
  await tree.click()
  await tree.click()
  await expect(page.getByText(/樱花雨开始了/)).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: 'output/playwright/v2-mobile-viewport.png', fullPage: true })
  expect(errors).toEqual([])
})

test('减少动态效果模式会关闭尾线并缩短终局演出', async ({ page }) => {
  const errors = watchRuntimeErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('pink-signal-farm:v2', JSON.stringify({
      version: 2,
      unlocked: ['shard:bloom', 'shard:broadcast', 'shard:ember'],
      inventory: [],
      shards: { bloom: true, broadcast: true, ember: true },
      caughtPetals: 6,
      towerBands: [0, 1, 2],
      catTrust: 3,
      revivedFailedProject: true,
      endingSeen: false,
      lastVisitDate: '2026-07-15',
      soundEnabled: false,
    }))
  })
  await page.reload()

  await expect(page.locator('.pixel-tether-canvas')).toHaveCSS('display', 'none')
  await page.locator('#contact').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: /开始零点广播/ }).click()
  await expect(page.getByRole('dialog', { name: /零点广播/ })).toBeVisible()
  await expect(page.getByText('零点广播已经送达。')).toBeVisible({ timeout: 4_000 })
  expect(errors).toEqual([])
})
