// ─────────────────────────────────────────────────────
// @termuijs/widgets — Slider widget (horizontal / vertical)
// ─────────────────────────────────────────────────────

import {
    type Screen,
    type Style,
    type Color,
    type KeyEvent,
    type MouseEvent,
    styleToCellAttrs,
    stringWidth,
    caps,
} from '@termuijs/core';
import { Widget } from '../base/Widget.js';
import { type SliderState, useSliderState } from '../data/SliderState.js';

export type SliderOrientation = 'horizontal' | 'vertical';

export interface SliderOptions {
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
    disabled?: boolean;
    orientation?: SliderOrientation;
    showValue?: boolean;
    label?: string;
    trackColor?: Color;
    thumbColor?: Color;
    filledColor?: Color;
    /** External state object — if provided, Slider reads/writes value through it */
    state?: SliderState;
    onChange?: (value: number) => void;
    onStateChange?: (state: SliderState) => void;
}

const TRACK_H = caps.unicode ? '─' : '-';
const TRACK_V = caps.unicode ? '│' : '|';
const FILLED = caps.unicode ? '━' : '=';
const THUMB = caps.unicode ? '●' : 'O';

function clamp(n: number, lo: number, hi: number): number {
    return Math.min(Math.max(n, lo), hi);
}

function snap(value: number, min: number, step: number): number {
    return Math.round((value - min) / step) * step + min;
}

function normalize(value: number, min: number, max: number): number {
    return max === min ? 0 : (value - min) / (max - min);
}

export function buildHorizontalTrack(
    value: number,
    min: number,
    max: number,
    width: number,
) {
    const totalCols = Math.max(3, width);
    const ratio = normalize(value, min, max);
    const filledCols = Math.round(ratio * (totalCols - 1));
    const emptyCols = totalCols - 1 - filledCols;
    return {
        filled: FILLED.repeat(filledCols),
        thumb: THUMB,
        empty: TRACK_H.repeat(emptyCols),
    };
}

export function buildVerticalTrackRows(
    value: number,
    min: number,
    max: number,
    height: number,
) {
    const totalRows = Math.max(3, height);
    const ratio = normalize(value, min, max);
    const filledRows = Math.round(ratio * (totalRows - 1));
    const emptyRows = totalRows - 1 - filledRows;

    const rows: Array<{ char: string; kind: 'empty' | 'thumb' | 'filled' }> = [];
    for (let i = 0; i < emptyRows; i++) rows.push({ char: TRACK_V, kind: 'empty' });
    rows.push({ char: THUMB, kind: 'thumb' });
    for (let i = 0; i < filledRows; i++) rows.push({ char: FILLED, kind: 'filled' });
    return rows;
}

/**
 * Slider — keyboard-adjustable value control with horizontal or vertical track.
 */
export class Slider extends Widget {
    private _min: number;
    private _max: number;
    private _step: number;
    private _value: number;
    private _disabled: boolean;
    private _orientation: SliderOrientation;
    private _showValue: boolean;
    private _label: string;
    private _trackColor: Color;
    private _thumbColor: Color;
    private _filledColor: Color;
    private _state?: SliderState;
    private _onChange?: (value: number) => void;
    private _onStateChange?: (state: SliderState) => void;
    private _dragging = false;

    constructor(style: Partial<Style> = {}, opts: SliderOptions = {}) {
        super(style);
        this.focusable = true;

        this._min = opts.min ?? 0;
        this._max = opts.max ?? 100;
        this._step = opts.step ?? 1;
        this._disabled = opts.disabled ?? false;
        this._orientation = opts.orientation ?? 'horizontal';
        this._showValue = opts.showValue ?? false;
        this._label = opts.label ?? '';
        this._trackColor = opts.trackColor ?? { type: 'named', name: 'brightBlack' };
        this._thumbColor = opts.thumbColor ?? { type: 'named', name: 'cyan' };
        this._filledColor = opts.filledColor ?? { type: 'named', name: 'cyan' };
        this._state = opts.state;
        this._onChange = opts.onChange;
        this._onStateChange = opts.onStateChange;

        if (opts.state) {
            this._value = opts.state.value;
            this._min = opts.state.min;
            this._max = opts.state.max;
            this._step = opts.state.step;
            this._disabled = opts.state.disabled;
        } else {
            this._value = clamp(snap(opts.defaultValue ?? this._min, this._min, this._step), this._min, this._max);
        }
    }

    getValue(): number {
        return this._state?.value ?? this._value;
    }

    setValue(value: number): void {
        if (this._disabled) return;
        const next = clamp(snap(value, this._min, this._step), this._min, this._max);
        if (next === this.getValue()) return;
        this._commit(next);
    }

    handleKey(event: KeyEvent): void {
        if (this._disabled) return;

        const value = this.getValue();
        switch (event.key) {
            case 'right':
                if (this._orientation === 'horizontal') this._commit(value + this._step);
                break;
            case 'left':
                if (this._orientation === 'horizontal') this._commit(value - this._step);
                break;
            case 'up':
                if (this._orientation === 'vertical') this._commit(value + this._step);
                break;
            case 'down':
                if (this._orientation === 'vertical') this._commit(value - this._step);
                break;
            case 'home':
                this._commit(this._min);
                break;
            case 'end':
                this._commit(this._max);
                break;
        }
    }

    handleMouse(event: MouseEvent): void {
        if (this._disabled) return;

        const rect = this._getTrackRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        switch (event.type) {
            case 'mousedown':
                this._dragging = true;
                this._setValueFromPoint(event.x, event.y, rect);
                break;
            case 'mousemove':
                if (this._dragging) {
                    this._setValueFromPoint(event.x, event.y, rect);
                }
                break;
            case 'mouseup':
                this._dragging = false;
                break;
        }
    }

    protected _renderSelf(screen: Screen): void {
        const rect = this._getContentRect();
        const { x, y, width, height } = rect;
        if (width <= 0 || height <= 0) return;

        const attrs = styleToCellAttrs(this._style);
        const value = this.getValue();
        const disabled = this._disabled;
        const trackColor = disabled ? { type: 'named' as const, name: 'brightBlack' as const } : this._trackColor;
        const filledColor = disabled ? trackColor : this._filledColor;
        const thumbColor = disabled
            ? trackColor
            : (this.isFocused ? this._thumbColor : this._filledColor);

        let row = y;

        if (this._label) {
            screen.writeString(x, row, this._label, { ...attrs, dim: disabled });
            row++;
        }

        if (this._orientation === 'vertical') {
            const trackHeight = Math.max(3, height - (this._label ? 1 : 0) - (this._showValue ? 1 : 0));
            const rows = buildVerticalTrackRows(value, this._min, this._max, trackHeight);
            const trackX = x + Math.floor((width - 1) / 2);

            for (let i = 0; i < rows.length; i++) {
                const rowData = rows[i];
                const color = rowData.kind === 'thumb'
                    ? thumbColor
                    : rowData.kind === 'filled'
                        ? filledColor
                        : trackColor;
                screen.setCell(trackX, row + i, { char: rowData.char, fg: color });
            }

            if (this._showValue) {
                const valueStr = String(value);
                const valueX = x + Math.max(0, Math.floor((width - stringWidth(valueStr)) / 2));
                screen.writeString(valueX, row + rows.length, valueStr, { ...attrs, fg: filledColor });
            }
            return;
        }

        const valueStr = this._showValue ? ` ${value}` : '';
        const valueWidth = stringWidth(valueStr);
        const labelUsed = this._label ? 1 : 0;
        const trackWidth = Math.max(3, width - valueWidth);
        const track = buildHorizontalTrack(value, this._min, this._max, trackWidth);
        const trackY = y + labelUsed;
        let col = x;

        for (const ch of track.filled) {
            screen.setCell(col++, trackY, { char: ch, fg: filledColor });
        }
        screen.setCell(col++, trackY, { char: track.thumb, fg: thumbColor });
        for (const ch of track.empty) {
            screen.setCell(col++, trackY, { char: ch, fg: trackColor });
        }

        if (this._showValue) {
            screen.writeString(col, trackY, valueStr.trim(), { ...attrs, fg: filledColor });
        }
    }

    private _getTrackRect(): { x: number; y: number; width: number; height: number } {
        const rect = this._getContentRect();
        const labelRows = this._label ? 1 : 0;

        if (this._orientation === 'vertical') {
            const valueRows = this._showValue ? 1 : 0;
            const trackHeight = Math.max(0, rect.height - labelRows - valueRows);
            const trackX = rect.x + Math.floor((rect.width - 1) / 2);
            return { x: trackX, y: rect.y + labelRows, width: 1, height: trackHeight };
        }

        const valueStr = this._showValue ? ` ${this.getValue()}` : '';
        const valueWidth = stringWidth(valueStr);
        return {
            x: rect.x,
            y: rect.y + labelRows,
            width: Math.max(0, rect.width - valueWidth),
            height: 1,
        };
    }

    private _setValueFromPoint(px: number, py: number, rect: { x: number; y: number; width: number; height: number }): void {
        if (this._orientation === 'vertical') {
            if (rect.height <= 1) {
                this._commit(this._max);
                return;
            }
            const rel = clamp(py - rect.y, 0, rect.height - 1);
            const ratio = 1 - rel / (rect.height - 1);
            const raw = this._min + ratio * (this._max - this._min);
            this._commit(raw);
            return;
        }

        if (rect.width <= 1) {
            this._commit(this._max);
            return;
        }
        const rel = clamp(px - rect.x, 0, rect.width - 1);
        const ratio = rel / (rect.width - 1);
        const raw = this._min + ratio * (this._max - this._min);
        this._commit(raw);
    }

    private _commit(next: number): void {
        const clamped = clamp(snap(next, this._min, this._step), this._min, this._max);
        if (clamped === this.getValue()) return;

        if (this._state) {
            this._state.setValue(clamped);
            this._value = this._state.value;
            this._onStateChange?.(this._state);
        } else {
            this._value = clamped;
        }

        this._onChange?.(clamped);
        this.markDirty();
    }
}

export { useSliderState };
import {
  type Screen,
  type Style,
  type Color,
  type KeyEvent,
  styleToCellAttrs,
  stringWidth,
  caps,
} from "@termuijs/core";
import { Widget } from "../base/Widget.js";

export interface SliderOptions {
  min?: number;
  max?: number;
  step?: number;
  color?: Color;
  showValue?: boolean;
}

export class Slider extends Widget {
  private _label: string;
  private _value = 0;
  private _min: number;
  private _max: number;
  private _step: number;
  private _color: Color;
  private _showValue: boolean;

  constructor(
    label: string,
    style: Partial<Style> = {},
    opts: SliderOptions = {}
  ) {
    super(style);

    this._label = label;
    this._min = opts.min ?? 0;
    this._max = opts.max ?? 100;
    this._step = opts.step ?? 1;
    this._color = opts.color ?? { type: "named", name: "cyan" };
    this._showValue = opts.showValue ?? true;
  }

  getValue(): number {
    return this._value;
  }

  setValue(value: number): void {
    this._value = Math.max(this._min, Math.min(this._max, value));
    this.markDirty();
  }

  setLabel(label: string): void {
    this._label = label;
    this.markDirty();
  }

  handleKey(event: KeyEvent): void {
    switch (event.key) {
      case "right":
        this.setValue(this._value + this._step);
        break;
      case "left":
        this.setValue(this._value - this._step);
        break;
    }
  }

  protected _renderSelf(screen: Screen): void {
    const rect = this._getContentRect();
    const { x, y, width, height } = rect;

    if (width <= 0 || height <= 0) return;

    const attrs = styleToCellAttrs(this._style);

    const leftArrow = caps.unicode ? "◄" : "<";
    const rightArrow = caps.unicode ? "►" : ">";

    const valueStr = this._showValue ? ` ${this._value}%` : "";
    const prefix = `${this._label} ${leftArrow} `;
    const suffix = ` ${rightArrow}${valueStr}`;

    const prefixWidth = stringWidth(prefix);
    const suffixWidth = stringWidth(suffix);

    const trackWidth = Math.max(
      0,
      width - prefixWidth - suffixWidth
    );

    const ratio =
      (this._value - this._min) /
      Math.max(1, this._max - this._min);

    const filled = Math.round(trackWidth * ratio);

    screen.writeString(x, y, prefix, {
      ...attrs,
      bold: true,
    });

    const trackX = x + prefixWidth;

    for (let i = 0; i < trackWidth; i++) {
      const filledChar = caps.unicode ? "█" : "#";
      const emptyChar = caps.unicode ? "░" : "-";

      screen.setCell(trackX + i, y, {
        char: i < filled ? filledChar : emptyChar,
        fg:
          i < filled
            ? this._color
            : { type: "named", name: "brightBlack" },
      });
    }

    screen.writeString(trackX + trackWidth, y, suffix, {
      ...attrs,
      bold: true,
    });
  }
}
