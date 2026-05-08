# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: players.spec.ts >> Players/Leaderboard Flow >> should display player names
- Location: __tests__/e2e/players.spec.ts:34:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('text=/[A-Z][a-z]+/').first()
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=/[A-Z][a-z]+/').first()
    9 × locator resolved to <h1 class="text-2xl font-bold">ApexTracer Golf</h1>
      - unexpected value "hidden"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]: v4.7
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - button "Home Home" [ref=e5] [cursor=pointer]:
        - img "Home" [ref=e6]
        - text: Home
      - button "Golfers Golfers" [ref=e7] [cursor=pointer]:
        - img "Golfers" [ref=e8]
        - text: Golfers
      - button "▶ Start Round" [ref=e9] [cursor=pointer]:
        - generic [ref=e10]: ▶
        - text: Start Round
      - button "Courses Courses" [ref=e11] [cursor=pointer]:
        - img "Courses" [ref=e12]
        - text: Courses
      - button "Settings Settings" [ref=e13] [cursor=pointer]:
        - img "Settings" [ref=e14]
        - text: Settings
  - main [ref=e15]:
    - generic [ref=e16]:
      - generic [ref=e18]:
        - generic [ref=e19]:
          - img "Golfers" [ref=e20]
          - heading "Golfers" [level=1] [ref=e21]
        - paragraph [ref=e22]: View player profiles and statistics
      - generic [ref=e24]:
        - textbox "🔍 Search players..." [ref=e26]
        - generic [ref=e27]:
          - button "All Players" [ref=e28] [cursor=pointer]
          - button "⭐ Favorites (0)" [disabled] [ref=e29]
        - generic [ref=e30]:
          - heading "Top 3 Golfers" [level=3] [ref=e31]
          - button "🔄 Refresh Stats" [ref=e32] [cursor=pointer]
        - generic [ref=e33]:
          - link "🥇 Tommy 1 Round HCP 5.2 ☆" [ref=e34] [cursor=pointer]:
            - /url: /player?id=33f63076-5020-45be-87b6-82b943815d12
            - generic [ref=e35]:
              - generic [ref=e36]: 🥇
              - generic [ref=e38]:
                - heading "Tommy" [level=3] [ref=e39]
                - generic [ref=e40]: 1 Round
                - generic [ref=e41]: HCP 5.2
              - button "☆" [ref=e42]
          - link "🥈 Fabio 1 Round HCP 9.6 ☆" [ref=e43] [cursor=pointer]:
            - /url: /player?id=835cc20b-629a-4b0c-8dd5-81f2d73b41b0
            - generic [ref=e44]:
              - generic [ref=e45]: 🥈
              - generic [ref=e47]:
                - heading "Fabio" [level=3] [ref=e48]
                - generic [ref=e49]: 1 Round
                - generic [ref=e50]: HCP 9.6
              - button "☆" [ref=e51]
          - link "🥉 Michael Neuschwander 1 Round HCP 10.9 ☆" [ref=e52] [cursor=pointer]:
            - /url: /player?id=04ca2f68-279d-48f1-be68-9df6de2a74c3
            - generic [ref=e53]:
              - generic [ref=e54]: 🥉
              - generic [ref=e56]:
                - heading "Michael Neuschwander" [level=3] [ref=e57]
                - generic [ref=e58]: 1 Round
                - generic [ref=e59]: HCP 10.9
              - button "☆" [ref=e60]
        - heading "All Golfers" [level=3] [ref=e61]
        - generic [ref=e62]:
          - link "🏌️ Alicia Craig 0 Rounds HCP — ☆" [ref=e63] [cursor=pointer]:
            - /url: /player?id=bd576c03-37f2-4c7c-8e3a-646e3c5217dd
            - generic [ref=e64]:
              - generic [ref=e65]: 🏌️
              - generic [ref=e67]:
                - heading "Alicia Craig" [level=3] [ref=e68]
                - generic [ref=e69]: 0 Rounds
                - generic [ref=e70]: HCP —
              - button "☆" [ref=e71]
          - link "🏌️ bill 0 Rounds HCP — ☆" [ref=e72] [cursor=pointer]:
            - /url: /player?id=21d3f5a9-5215-4ce8-9af6-df8b7e5a7942
            - generic [ref=e73]:
              - generic [ref=e74]: 🏌️
              - generic [ref=e76]:
                - heading "bill" [level=3] [ref=e77]
                - generic [ref=e78]: 0 Rounds
                - generic [ref=e79]: HCP —
              - button "☆" [ref=e80]
          - link "🏌️ Derek Dahle 0 Rounds HCP — ☆" [ref=e81] [cursor=pointer]:
            - /url: /player?id=2abad3da-567b-4a1b-bb8a-2a211d8ee194
            - generic [ref=e82]:
              - generic [ref=e83]: 🏌️
              - generic [ref=e85]:
                - heading "Derek Dahle" [level=3] [ref=e86]
                - generic [ref=e87]: 0 Rounds
                - generic [ref=e88]: HCP —
              - button "☆" [ref=e89]
          - link "🏌️ Duane Biehn 0 Rounds HCP — ☆" [ref=e90] [cursor=pointer]:
            - /url: /player?id=37d7f054-04fa-4704-aea7-484ca5245b35
            - generic [ref=e91]:
              - generic [ref=e92]: 🏌️
              - generic [ref=e94]:
                - heading "Duane Biehn" [level=3] [ref=e95]
                - generic [ref=e96]: 0 Rounds
                - generic [ref=e97]: HCP —
              - button "☆" [ref=e98]
          - link "🏌️ Lilly Rindahl 0 Rounds HCP — ☆" [ref=e99] [cursor=pointer]:
            - /url: /player?id=ac90fe27-21c0-475c-91be-48cf37c2087f
            - generic [ref=e100]:
              - generic [ref=e101]: 🏌️
              - generic [ref=e103]:
                - heading "Lilly Rindahl" [level=3] [ref=e104]
                - generic [ref=e105]: 0 Rounds
                - generic [ref=e106]: HCP —
              - button "☆" [ref=e107]
          - link "🏌️ Nikki 0 Rounds HCP — ☆" [ref=e108] [cursor=pointer]:
            - /url: /player?id=683400e0-5563-4cb4-93bd-9d887d600d69
            - generic [ref=e109]:
              - generic [ref=e110]: 🏌️
              - generic [ref=e112]:
                - heading "Nikki" [level=3] [ref=e113]
                - generic [ref=e114]: 0 Rounds
                - generic [ref=e115]: HCP —
              - button "☆" [ref=e116]
          - link "🏌️ Scott Rindahl 0 Rounds HCP — ☆" [ref=e117] [cursor=pointer]:
            - /url: /player?id=c6ec1ee5-e034-4389-bd4c-150fbf57f61c
            - generic [ref=e118]:
              - generic [ref=e119]: 🏌️
              - generic [ref=e121]:
                - heading "Scott Rindahl" [level=3] [ref=e122]
                - generic [ref=e123]: 0 Rounds
                - generic [ref=e124]: HCP —
              - button "☆" [ref=e125]
          - link "🏌️ Shane Roepke 0 Rounds HCP — ☆" [ref=e126] [cursor=pointer]:
            - /url: /player?id=2eaebfa1-a175-420c-b12b-eb42a7afa3d2
            - generic [ref=e127]:
              - generic [ref=e128]: 🏌️
              - generic [ref=e130]:
                - heading "Shane Roepke" [level=3] [ref=e131]
                - generic [ref=e132]: 0 Rounds
                - generic [ref=e133]: HCP —
              - button "☆" [ref=e134]
          - link "🏌️ Tim Moe 0 Rounds HCP — ☆" [ref=e135] [cursor=pointer]:
            - /url: /player?id=8987130b-1ca5-49be-846e-462b7b1ad5bf
            - generic [ref=e136]:
              - generic [ref=e137]: 🏌️
              - generic [ref=e139]:
                - heading "Tim Moe" [level=3] [ref=e140]
                - generic [ref=e141]: 0 Rounds
                - generic [ref=e142]: HCP —
              - button "☆" [ref=e143]
          - link "🏌️ Travis Emery 0 Rounds HCP — ☆" [ref=e144] [cursor=pointer]:
            - /url: /player?id=c1d323c0-adec-445e-8e09-f165174843fa
            - generic [ref=e145]:
              - generic [ref=e146]: 🏌️
              - generic [ref=e148]:
                - heading "Travis Emery" [level=3] [ref=e149]
                - generic [ref=e150]: 0 Rounds
                - generic [ref=e151]: HCP —
              - button "☆" [ref=e152]
  - button "Open Next.js Dev Tools" [ref=e158] [cursor=pointer]:
    - img [ref=e159]
  - alert [ref=e162]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Players/Leaderboard Flow', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     // Assume user is authenticated
  6   |     await page.goto('/');
  7   |   });
  8   | 
  9   |   test('should navigate to players page', async ({ page }) => {
  10  |     // Look for players/leaderboard button
  11  |     const playersButton = page.locator('button:has-text("Players"), a:has-text("Players"), button:has-text("Leaderboard"), [aria-label*="players" i]').first();
  12  |     
  13  |     if (await playersButton.isVisible().catch(() => false)) {
  14  |       await playersButton.click();
  15  |     } else {
  16  |       // Direct navigation fallback
  17  |       await page.goto('/players');
  18  |     }
  19  |     
  20  |     await expect(page).toHaveURL(/\/players/);
  21  |   });
  22  | 
  23  |   test('should display players list', async ({ page }) => {
  24  |     await page.goto('/players');
  25  |     
  26  |     // Should see list of players
  27  |     const playerItem = page.locator('[class*="player"], tr, li').first();
  28  |     
  29  |     if (await playerItem.isVisible().catch(() => false)) {
  30  |       await expect(playerItem).toBeVisible();
  31  |     }
  32  |   });
  33  | 
  34  |   test('should display player names', async ({ page }) => {
  35  |     await page.goto('/players');
  36  |     
  37  |     // Should see player names
  38  |     const playerName = page.locator('text=/[A-Z][a-z]+/').first();
> 39  |     await expect(playerName).toBeVisible();
      |                              ^ Error: expect(locator).toBeVisible() failed
  40  |   });
  41  | 
  42  |   test('should display handicap for each player', async ({ page }) => {
  43  |     await page.goto('/players');
  44  |     
  45  |     // Should show HCP/handicap values
  46  |     const handicap = page.locator('text=/hcp|handicap|\d+\.\d+/i').first();
  47  |     
  48  |     if (await handicap.isVisible().catch(() => false)) {
  49  |       await expect(handicap).toBeVisible();
  50  |     }
  51  |   });
  52  | 
  53  |   test('should display round count for each player', async ({ page }) => {
  54  |     await page.goto('/players');
  55  |     
  56  |     // Should show round counts
  57  |     const roundCount = page.locator('text=/rounds|\d+/i').first();
  58  |     
  59  |     if (await roundCount.isVisible().catch(() => false)) {
  60  |       await expect(roundCount).toBeVisible();
  61  |     }
  62  |   });
  63  | 
  64  |   test('should sort players by handicap', async ({ page }) => {
  65  |     await page.goto('/players');
  66  |     
  67  |     // Get first player's handicap
  68  |     const firstPlayerHcp = page.locator('[class*="player"] text=/\d+/', 'tr >> nth=0 text=/\d+/').first();
  69  |     
  70  |     if (await firstPlayerHcp.isVisible().catch(() => false)) {
  71  |       const firstValue = await firstPlayerHcp.textContent();
  72  |       
  73  |       // Get second player's handicap
  74  |       const secondPlayerHcp = page.locator('[class*="player"] text=/\d+/', 'tr >> nth=1 text=/\d+/').nth(1);
  75  |       
  76  |       if (await secondPlayerHcp.isVisible().catch(() => false)) {
  77  |         const secondValue = await secondPlayerHcp.textContent();
  78  |         
  79  |         // Should be sorted (first <= second)
  80  |         // This is a basic check
  81  |         expect(firstValue).toBeDefined();
  82  |         expect(secondValue).toBeDefined();
  83  |       }
  84  |     }
  85  |   });
  86  | 
  87  |   test('should navigate to player profile on click', async ({ page }) => {
  88  |     await page.goto('/players');
  89  |     
  90  |     // Click first player
  91  |     const firstPlayer = page.locator('[class*="player"], tr, li').first();
  92  |     
  93  |     if (await firstPlayer.isVisible().catch(() => false)) {
  94  |       await firstPlayer.click();
  95  |       
  96  |       // Should navigate to player detail page
  97  |       await page.waitForNavigation({ timeout: 5000 }).catch(() => null);
  98  |       
  99  |       const url = page.url();
  100 |       expect(url).toContain('player') || expect(url).toContain('players');
  101 |     }
  102 |   });
  103 | 
  104 |   test('should display player profile page', async ({ page }) => {
  105 |     // Navigate to a player profile
  106 |     await page.goto('/player?id=user-123');
  107 |     
  108 |     // Should display player info
  109 |     const playerInfo = page.locator('h1, h2, [class*="profile"]').first();
  110 |     
  111 |     if (await playerInfo.isVisible().catch(() => false)) {
  112 |       await expect(playerInfo).toBeVisible();
  113 |     }
  114 |   });
  115 | 
  116 |   test('should display player handicap on profile', async ({ page }) => {
  117 |     await page.goto('/player?id=user-123');
  118 |     
  119 |     // Should show handicap prominently
  120 |     const handicap = page.locator('text=/hcp|handicap/i').first();
  121 |     
  122 |     if (await handicap.isVisible().catch(() => false)) {
  123 |       await expect(handicap).toBeVisible();
  124 |     }
  125 |   });
  126 | 
  127 |   test('should display player statistics', async ({ page }) => {
  128 |     await page.goto('/player?id=user-123');
  129 |     
  130 |     // Should show stats like FIR, GIR, etc.
  131 |     const stats = page.locator('[class*="stat"], [class*="fir"], [class*="gir"]').first();
  132 |     
  133 |     if (await stats.isVisible().catch(() => false)) {
  134 |       await expect(stats).toBeVisible();
  135 |     }
  136 |   });
  137 | 
  138 |   test('should display player recent rounds', async ({ page }) => {
  139 |     await page.goto('/player?id=user-123');
```