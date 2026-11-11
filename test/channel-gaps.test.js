'use strict';

// Additional coverage for the smart-channel PR: fixed (non-auto) channels must keep
// their declared orientation, the dx/dy-initialized path, and jump/sign edge cases.
// Same stubbing approach as channel.test.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');

global.Draw = { loadPlugin: (cb) => cb({}) };
global.mxPoint = function (x, y) { this.x = x; this.y = y; };
global.mxUtils = {
    getValue: (style, key, dflt) => (style && style[key] !== undefined ? style[key] : dflt),
    getNumber: (style, key, dflt) => {
        const v = style && style[key];
        return (v === undefined || v === null || v === '') ? dflt : Number(v);
    },
};

const { resolveVertical, getUseEdgeDrawSegments, clampToSegment, resolveUseSign, resolveJumpStyle, jumpDrawProgram } =
    require('../tam-drawio.js');

const P = (x, y) => ({ x, y });
const xy = (p) => ({ x: p.x, y: p.y });
const last = (a) => a[a.length - 1];

// --- fixed channels are manual overrides: geometry must not change their orientation ---

test('getUseEdgeDrawSegments: fixed Vertical Channel stays vertical when drawn wider than tall', () => {
    // vertical=true, endpoints 200 apart horizontally, 50 vertically
    // draw.io parses style values as strings, so cover both forms
    for (const vertical of [true, 'true', '1']) {
        const segs = getUseEdgeDrawSegments([P(0, 0), P(200, 50)], { vertical });
        for (const p of [...segs.seg1, ...segs.seg2]) assert.equal(p.x, 0);
    }
});

test('getUseEdgeDrawSegments: fixed Horizontal Channel stays horizontal when drawn taller than wide', () => {
    const segs = getUseEdgeDrawSegments([P(0, 0), P(50, 200)], {});
    for (const p of [...segs.seg1, ...segs.seg2]) assert.equal(p.y, 0);
});

test('getUseEdgeDrawSegments: fixed Vertical S-Channel splits on its horizontal middle leg', () => {
    const segs = getUseEdgeDrawSegments([P(0, 0), P(0, 50), P(100, 50), P(100, 100)], { vertical: true });
    assert.deepEqual(xy(last(segs.seg1)), P(42, 50));
    assert.deepEqual(xy(segs.seg2[0]), P(58, 50));
});

// --- dx/dy-initialized path (circle moved by the user) ---

test('getUseEdgeDrawSegments: auto vertical channel with dx/dy places circle on the line', () => {
    const segs = getUseEdgeDrawSegments([P(50, 0), P(50, 100)], { vertical: 'auto', dx: 0, dy: 50 });
    assert.deepEqual(xy(last(segs.seg1)), P(50, 42));
    assert.deepEqual(xy(segs.seg2[0]), P(50, 58));
});

test('getUseEdgeDrawSegments: auto horizontal channel with dx/dy places circle on the line', () => {
    const segs = getUseEdgeDrawSegments([P(0, 50), P(100, 50)], { vertical: 'auto', dx: 30, dy: 0 });
    assert.deepEqual(xy(last(segs.seg1)), P(22, 50));
    assert.deepEqual(xy(segs.seg2[0]), P(38, 50));
});

test('getUseEdgeDrawSegments: saved circle stays on its segment after the route changes', () => {
    // Z-route whose short middle leg runs 130 -> 100; saved dx would put the circle at x=205
    const segs = getUseEdgeDrawSegments([P(130, 0), P(130, 265), P(100, 265), P(100, 490)],
        { vertical: 'auto', dx: 105, dy: 265 });
    const a = last(segs.seg1), b = segs.seg2[0];
    assert.equal(a.y, 265);
    assert.ok(a.x >= 100 && a.x <= 130 && b.x >= 100 && b.x <= 130, `gap ${a.x}..${b.x} off segment`);
});

test('getUseEdgeDrawSegments: saved circle on a vertical leg is clamped too', () => {
    const segs = getUseEdgeDrawSegments([P(50, 0), P(50, 100), P(200, 100)], { vertical: 'auto', dx: 0, dy: 400 });
    for (const p of [last(segs.seg1), segs.seg2[0]]) assert.ok(p.y >= 0 && p.y <= 100);
});

test('clampToSegment: keeps the circle inside, or centres it on a too-short segment', () => {
    assert.equal(clampToSegment(205, 130, 100, 8), 122);
    assert.equal(clampToSegment(50, 0, 100, 8), 50);
    assert.equal(clampToSegment(-20, 0, 100, 8), 8);
    assert.equal(clampToSegment(90, 100, 110, 8), 105);
});

test('getUseEdgeDrawSegments: fewer than 2 points returns null', () => {
    assert.equal(getUseEdgeDrawSegments([P(0, 0)], { vertical: 'auto' }), null);
    assert.equal(getUseEdgeDrawSegments(null, { vertical: 'auto' }), null);
});

// --- resolveVertical edge cases ---

test('resolveVertical: auto square run is horizontal; auto without points is "both"', () => {
    assert.equal(resolveVertical({ vertical: 'auto' }, [P(0, 0), P(100, 100)]), false);
    assert.equal(resolveVertical({ vertical: 'auto' }, null), 'both');
});

// --- resolveUseSign: legacy (non-adapt) behaviour and rotation under adapt ---

test('resolveUseSign: non-adapt straight channel only flips direction with the line', () => {
    assert.deepEqual(
        resolveUseSign('up', 'east', false, -1, /*adapt*/ false, /*routed*/ false, false),
        { position: 'up', direction: 'west' }
    );
    assert.deepEqual(
        resolveUseSign('up', 'east', false, 1, false, false, false),
        { position: 'up', direction: 'east' }
    );
});

test('resolveUseSign: adapt rotates a vertical direction onto a horizontal segment', () => {
    assert.deepEqual(
        resolveUseSign('right', 'north', /*vertLine*/ false, 1, true, false, false),
        { position: 'down', direction: 'east' }
    );
});

test('resolveUseSign: "none" direction is never rotated or flipped', () => {
    assert.deepEqual(
        resolveUseSign('left', 'none', false, -1, true, false, false),
        { position: 'up', direction: 'none' }
    );
});

// --- resolveJumpStyle edge cases ---

test('resolveJumpStyle: missing style or unset global config never injects', () => {
    assert.equal(resolveJumpStyle(null, true, 'arc'), false);
    assert.equal(resolveJumpStyle({ shape: 'useedge' }, true, undefined), false);
});

// --- jumpDrawProgram edge cases ---

test('jumpDrawProgram: multiple crossings on one run are bumped in path order', () => {
    const ops = jumpDrawProgram([P(0, 0), P(100, 0)], [P(70, 0), P(30, 0)], 6);
    const bumps = ops.filter(o => o.bump).map(o => o.bump);
    assert.equal(bumps.length, 2);
    assert.equal(bumps[0].p0.x, 24);
    assert.equal(bumps[1].p0.x, 64);
});

test('jumpDrawProgram: bump follows a run drawn right-to-left', () => {
    const bump = jumpDrawProgram([P(100, 0), P(0, 0)], [P(50, 0)], 6).find(o => o.bump).bump;
    assert.deepEqual(bump.p0, { x: 56, y: 0 });
    assert.deepEqual(bump.p1, { x: 44, y: 0 });
});

test('jumpDrawProgram: zero-length segments are skipped without breaking the path', () => {
    const ops = jumpDrawProgram([P(0, 0), P(0, 0), P(100, 0)], [P(50, 0)], 6);
    assert.equal(ops.filter(o => o.bump).length, 1);
    assert.deepEqual(ops[0].pts[0], P(0, 0));
    assert.deepEqual(last(last(ops).pts), P(100, 0));
});

test('jumpDrawProgram: crossing too close to a corner is not bumped', () => {
    // L-route corner at (0,100); crossing 3px before it on the vertical leg
    const ops = jumpDrawProgram([P(0, 0), P(0, 100), P(100, 100)], [P(0, 97)], 6);
    assert.equal(ops.filter(o => o.bump).length, 0);
});
