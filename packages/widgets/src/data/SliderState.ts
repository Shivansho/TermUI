// packages/widgets/src/data/SliderState.ts

export interface SliderItem {
    min: number;
    max: number;
    step: number;
    value: number;
    disabled?: boolean;
}

export interface SliderStateOptions {
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
    disabled?: boolean;
}

export interface SliderState {
    value: number;
    min: number;
    max: number;
    step: number;
    disabled: boolean;
    increment(): void;
    decrement(): void;
    setValue(value: number): void;
    jumpToMin(): void;
    jumpToMax(): void;
}

function clamp(n: number, lo: number, hi: number): number {
    return Math.min(Math.max(n, lo), hi);
}

function snap(value: number, min: number, step: number): number {
    return Math.round((value - min) / step) * step + min;
}

/**
 * Pure state factory for the Slider widget.
 * Returns a mutable state object — no React dependency.
 * This mirrors the pattern of `useListState` in ListState.ts.
 */
export function useSliderState(options: SliderStateOptions = {}): SliderState {
    const {
        min = 0,
        max = 100,
        step = 1,
        defaultValue,
        disabled = false,
    } = options;

    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) {
        throw new RangeError('min, max, and step must be finite numbers');
    }
    if (step <= 0) {
        throw new RangeError('step must be > 0');
    }
    if (max < min) {
        throw new RangeError('max must be >= min');
    }

    const initial = clamp(snap(defaultValue ?? min, min, step), min, max);
    const state: SliderState = {
        value: initial,
        min,
        max,
        step,
        disabled,

        increment() {
            if (state.disabled) return;
            state.value = clamp(snap(state.value + step, min, step), min, max);
        },

        decrement() {
            if (state.disabled) return;
            state.value = clamp(snap(state.value - step, min, step), min, max);
        },

        setValue(value: number) {
            if (state.disabled) return;
            state.value = clamp(snap(value, min, step), min, max);
        },

        jumpToMin() {
            if (state.disabled) return;
            state.value = min;
        },

        jumpToMax() {
            if (state.disabled) return;
            state.value = max;
        },
    };

    return state;
}