const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const pageUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

test.describe('ADDS random module', () => {
    test('randomizes eight circular markers with four pink and four blue markers', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 900 });
        await page.goto(pageUrl);

        await page.getByRole('button', { name: /随机排列 Randomize/ }).click();

        const markers = page.locator('#addsRandomMarkers .adds-marker');
        await expect(markers).toHaveCount(8);
        await expect(page.locator('#addsRandomMarkers .adds-marker.pink')).toHaveCount(4);
        await expect(page.locator('#addsRandomMarkers .adds-marker.blue')).toHaveCount(4);

        const layout = await page.evaluate(() => {
            const row = document.getElementById('addsRandomMarkers');
            const rowRect = row.getBoundingClientRect();
            const markerRects = Array.from(row.querySelectorAll('.adds-marker')).map(marker => marker.getBoundingClientRect());

            return {
                isSingleLine: new Set(markerRects.map(rect => Math.round(rect.top))).size === 1,
                hasCircles: markerRects.every(rect => Math.abs(rect.width - rect.height) <= 1),
                fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
                containedInRow: markerRects.every(rect => rect.left >= rowRect.left && rect.right <= rowRect.right)
            };
        });

        expect(layout).toEqual({
            isSingleLine: true,
            hasCircles: true,
            fitsViewport: true,
            containedInRow: true
        });
    });
});

test.describe('field selector', () => {
    test('shows field controls after ADDS timer and clearly labels the active scoring field', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 900 });
        await page.goto(pageUrl);

        const topFieldSelector = page.locator('.timer-module + .field-selector');
        await expect(topFieldSelector.getByRole('button', { name: /A场地/ })).toHaveClass(/active/);
        await expect(page.locator('#scoreFieldBanner')).toContainText('A场地');

        await topFieldSelector.getByRole('button', { name: /B场地/ }).click();

        await expect(topFieldSelector.getByRole('button', { name: /B场地/ })).toHaveClass(/active/);
        await expect(page.locator('.field-selector-inline').getByRole('button', { name: /B场地/ })).toHaveClass(/active/);
        await expect(page.locator('#scoreFieldBanner')).toContainText('B场地');
        await expect(page.locator('#scoreFieldBanner')).toContainText('Field B');
    });
});

test.describe('mobile interactions', () => {
    test('disables double-tap page zoom on touch devices', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 900 });
        await page.goto(pageUrl);

        await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
            'content',
            /maximum-scale=1\.0, user-scalable=no/
        );

        const touchAction = await page.evaluate(() => getComputedStyle(document.body).touchAction);
        expect(touchAction).toBe('manipulation');
    });
});

test.describe('ADDS timer', () => {
    test('plays three sharp prompt sounds every time the countdown reaches zero', async ({ page }) => {
        await page.clock.install();
        await page.addInitScript(() => {
            window.timerBeepEvents = [];

            class MockAudioContext {
                constructor() {
                    this.currentTime = 0;
                    this.destination = {};
                    this.state = 'running';
                }

                resume() {
                    this.state = 'running';
                }

                createOscillator() {
                    const event = { frequency: null, type: null };
                    window.timerBeepEvents.push(event);

                    return {
                        set type(value) {
                            event.type = value;
                        },
                        get type() {
                            return event.type;
                        },
                        frequency: {
                            setValueAtTime(value) {
                                event.frequency = value;
                            }
                        },
                        connect() {},
                        start() {},
                        stop() {}
                    };
                }

                createGain() {
                    return {
                        gain: {
                            setValueAtTime() {},
                            exponentialRampToValueAtTime() {}
                        },
                        connect() {}
                    };
                }
            }

            window.AudioContext = MockAudioContext;
            window.webkitAudioContext = MockAudioContext;
        });
        await page.goto(pageUrl);

        await page.getByRole('button', { name: /开始 Start/ }).click();

        await page.clock.runFor(10000);
        await expect(page.locator('#light1')).toHaveClass(/on/);
        await expect.poll(() => page.evaluate(() => window.timerBeepEvents.length)).toBe(3);

        await page.clock.runFor(7000);
        await expect(page.locator('#light2')).toHaveClass(/on/);
        await expect.poll(() => page.evaluate(() => window.timerBeepEvents.length)).toBe(6);

        const beepEvents = await page.evaluate(() => window.timerBeepEvents);
        expect(beepEvents).toEqual([
            { frequency: 1760, type: 'square' },
            { frequency: 1760, type: 'square' },
            { frequency: 1760, type: 'square' },
            { frequency: 1760, type: 'square' },
            { frequency: 1760, type: 'square' },
            { frequency: 1760, type: 'square' }
        ]);
    });
});
