import { describe, it, expect, vi, afterEach } from 'vitest';
import type { KeyEvent } from '@termuijs/core';

function makeKey(key: string): KeyEvent {
    return {
        key,
        shift: false,
        ctrl: false,
        alt: false,
        raw: Buffer.alloc(0),
        stopPropagation: () => {},
        preventDefault: () => {},
    };
}

afterEach(() => { vi.unstubAllEnvs(); });

describe('RangeInput', () => {
    it('constructs with low=min, high=max', async () => {
        const { RangeInput } = await import('./RangeInput.js');
        const r = new RangeInput('Price');
        expect(r.getLow()).toBe(0);
        expect(r.getHigh()).toBe(100);
    });

    it('setLow and setHigh work', async () => {
        const { RangeInput } = await import('./RangeInput.js');
        const r = new RangeInput('Price');
        r.setLow(20);
        r.setHigh(80);
        expect(r.getLow()).toBe(20);
        expect(r.getHigh()).toBe(80);
    });

    it('setLow clamps to min and cannot exceed high', async () => {
        const { RangeInput } = await import('./RangeInput.js');
        const r = new RangeInput('Price');
        r.setHigh(50);
        r.setLow(90);  // exceeds high → clamps to high
        expect(r.getLow()).toBe(50);
        r.setLow(-10); // below min → clamps to min
        expect(r.getLow()).toBe(0);
    });

    it('setHigh clamps to max and cannot go below low', async () => {
        const { RangeInput } = await import('./RangeInput.js');
        const r = new RangeInput('Price');
        r.setLow(50);
        r.setHigh(10);  // below low → clamps to low
        expect(r.getHigh()).toBe(50);
        r.setHigh(200); // above max → clamps to max
        expect(r.getHigh()).toBe(100);
    });

    it('setRange sets both values', async () => {
        const { RangeInput } = await import('./RangeInput.js');
        const r = new RangeInput('Price');
        r.setRange(20, 80);
        expect(r.getLow()).toBe(20);
        expect(r.getHigh()).toBe(80);
    });

    it('tab toggles active handle', async () => {
        const { RangeInput } = await import('./RangeInput.js');
        const r = new RangeInput('Price');
        r.setRange(20, 80);
        r.handleKey(makeKey('tab'));
        r.handleKey(makeKey('right'));
        expect(r.getHigh()).toBe(81); // high handle moved
        expect(r.getLow()).toBe(20);  // low unchanged
    });

    it('arrow keys move low handle by step', async () => {
        const { RangeInput } = await import('./RangeInput.js');
        const r = new RangeInput('Price');
        r.handleKey(makeKey('right'));
        expect(r.getLow()).toBe(1);
        r.handleKey(makeKey('left'));
        expect(r.getLow()).toBe(0);
    });

    it('renders unicode track chars', async () => {
        vi.stubEnv('NO_UNICODE', '');
        vi.stubEnv('TERM', '');
        vi.resetModules();
        const { Screen } = await import('@termuijs/core');
        const { RangeInput } = await import('./RangeInput.js');

        const r = new RangeInput('Price');
        r.setRange(20, 80);
        r.updateRect({ x: 0, y: 0, width: 40, height: 1 });
        const screen = new Screen(40, 1);
        r.render(screen);

        const row = screen.back[0].map((cell: { char: string }) => cell.char).join('');
        expect(row).toMatch(/[█░]/);
        expect(row).not.toContain('#');
    });

    it('renders ASCII track chars when NO_UNICODE=1', async () => {
        vi.stubEnv('NO_UNICODE', '1');
        vi.stubEnv('TERM', '');
        vi.resetModules();
        const { Screen } = await import('@termuijs/core');
        const { RangeInput } = await import('./RangeInput.js');

        const r = new RangeInput('Price');
        r.setRange(20, 80);
        r.updateRect({ x: 0, y: 0, width: 40, height: 1 });
        const screen = new Screen(40, 1);
        r.render(screen);

        const row = screen.back[0].map((cell: { char: string }) => cell.char).join('');
        expect(row).toContain('#');
        expect(row).toContain('-');
        expect(row).not.toMatch(/[█░]/);
    });
});
