// ─────────────────────────────────────────────────────
// @termuijs/widgets — Tests for Slider widget
// ─────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Screen } from '@termuijs/core';
import { Slider, buildHorizontalTrack, buildVerticalTrackRows } from './Slider.js';
import { useSliderState } from '../data/SliderState.js';

afterEach(() => {
    vi.restoreAllMocks();
});

function renderSlider(
    opts: ConstructorParameters<typeof Slider>[1] = {},
    rect = { x: 0, y: 0, width: 30, height: 1 },
): { slider: Slider; screen: Screen } {
    const slider = new Slider({}, opts);
    slider.updateRect(rect);
    const screen = new Screen(rect.width, rect.height);
    slider.render(screen);
    return { slider, screen };
}

describe('useSliderState', () => {
    it('initialises with defaultValue clamped to range', () => {
        const s = useSliderState({ min: 0, max: 100, step: 1, defaultValue: 40 });
        expect(s.value).toBe(40);
        expect(s.min).toBe(0);
        expect(s.max).toBe(100);
    });

    it('increment increases value by step', () => {
        const s = useSliderState({ min: 0, max: 100, step: 5, defaultValue: 40 });
        s.increment();
        expect(s.value).toBe(45);
    });

    it('disabled: increment does nothing', () => {
        const s = useSliderState({ min: 0, max: 100, step: 1, defaultValue: 40, disabled: true });
        s.increment();
        expect(s.value).toBe(40);
    });
});

describe('buildHorizontalTrack', () => {
    it('at min: no filled chars, full empty track', () => {
        const t = buildHorizontalTrack(0, 0, 100, 11);
        expect(t.filled).toBe('');
        expect(t.thumb).toHaveLength(1);
        expect(t.empty).toHaveLength(10);
    });

    it('at 50%: filled + thumb + empty = width', () => {
        const width = 21;
        const t = buildHorizontalTrack(50, 0, 100, width);
        expect(t.filled.length + t.thumb.length + t.empty.length).toBe(width);
    });
});

describe('buildVerticalTrackRows', () => {
    it('total rows equals height', () => {
        const rows = buildVerticalTrackRows(50, 0, 100, 12);
        expect(rows).toHaveLength(12);
    });

    it('exactly one thumb row', () => {
        const rows = buildVerticalTrackRows(50, 0, 100, 12);
        expect(rows.filter(r => r.kind === 'thumb')).toHaveLength(1);
    });
});

describe('Slider', () => {
    it('initialises with defaultValue', () => {
        const slider = new Slider({}, { min: 0, max: 100, defaultValue: 25 });
        expect(slider.getValue()).toBe(25);
    });

    it('setValue clamps and snaps to step', () => {
        const slider = new Slider({}, { min: 0, max: 100, step: 10 });
        slider.setValue(33);
        expect(slider.getValue()).toBe(30);
    });

    it('renders horizontal track at 50%', () => {
        const { screen } = renderSlider({ min: 0, max: 100, defaultValue: 50 }, { x: 0, y: 0, width: 21, height: 1 });
        const row = screen.back[0].map(c => c.char).join('');
        expect(row.length).toBeGreaterThan(0);
        expect(row).toMatch(/[O●]/);
    });

    it('handleKey right increases value', () => {
        const slider = new Slider({}, { min: 0, max: 100, step: 5, defaultValue: 50 });
        slider.handleKey({ key: 'right' } as never);
        expect(slider.getValue()).toBe(55);
    });

    it('calls onChange when value changes', () => {
        const onChange = vi.fn();
        const slider = new Slider({}, { min: 0, max: 100, defaultValue: 50, onChange });
        slider.setValue(60);
        expect(onChange).toHaveBeenCalledWith(60);
    });

    it('uses external state when provided', () => {
        const state = useSliderState({ min: 0, max: 100, step: 1, defaultValue: 10 });
        const slider = new Slider({}, { state });
        slider.handleKey({ key: 'right' } as never);
        expect(state.value).toBe(11);
        expect(slider.getValue()).toBe(11);
    });
});
