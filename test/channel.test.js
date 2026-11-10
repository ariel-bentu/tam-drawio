'use strict';

// Unit tests for the TAM smart-channel geometry/sign logic.
//
// tam-drawio.js is a draw.io plugin whose code lives inside a Draw.loadPlugin(...)
// closure. We stub the handful of mxGraph globals it touches, then let the plugin's
// Node-only guard export the pure helpers (it returns early before any UI code runs).

const { test } = require('node:test');
const assert = require('node:assert/strict');

// --- minimal mxGraph stubs, installed before requiring the plugin ---
global.Draw = { loadPlugin: (cb) => cb({}) };
global.mxPoint = function (x, y) { this.x = x; this.y = y; };
global.mxUtils = {
    getValue: (style, key, dflt) => (style && style[key] !== undefined ? style[key] : dflt),
    getNumber: (style, key, dflt) => {
        const v = style && style[key];
        return (v === undefined || v === null || v === '') ? dflt : Number(v);
    },
};

const { resolveVertical, getEdgeMidPoint, getUseEdgeDrawSegments, resolveUseSign, resolveJumpStyle, jumpDrawProgram } =
    require('../tam-drawio.js');

const P = (x, y) => ({ x, y });
const xy = (p) => ({ x: p.x, y: p.y }); // normalize mxPoint -> plain for strict compare

// The real 6-point route from test.drawio.svg (box2.top -> box1.bottom):
// the mid-segment (index 2->3) is vertical, which used to be mis-detected as horizontal.
const SIX_POINT = [P(425, 230), P(425, 220), P(297.5, 220), P(297.5, 310), P(170, 310), P(170, 300)];

test('resolveVertical: auto detects orientation from 2-point geometry', () => {
    assert.equal(resolveVertical({ vertical: 'auto' }, [P(0, 50), P(100, 50)]), false); // horizontal
    assert.equal(resolveVertical({ vertical: 'auto' }, [P(50, 0), P(50, 100)]), true);  // vertical
});

test('resolveVertical: auto on a routed (>2-point) edge is "both"', () => {
    assert.equal(resolveVertical({ vertical: 'auto' }, SIX_POINT), 'both');
});

test('resolveVertical: non-auto values pass through unchanged', () => {
    assert.equal(resolveVertical({ vertical: true }, [P(0, 0), P(10, 0)]), true);
    assert.equal(resolveVertical({ vertical: 'both' }, SIX_POINT), 'both');
    assert.equal(resolveVertical({}, [P(0, 0), P(10, 0)]), false); // absent -> default
});

test('getEdgeMidPoint: true midpoint of a straight segment', () => {
    assert.deepEqual(xy(getEdgeMidPoint([P(0, 50), P(100, 50)])), P(50, 50));
});

test('getEdgeMidPoint: centers on the chosen mid-segment, not a corner', () => {
    // Was the bug: circle landed at the y=220 corner; must be the segment midpoint (y=265).
    assert.deepEqual(xy(getEdgeMidPoint(SIX_POINT)), P(297.5, 265));
});

test('resolveUseSign: horizontal auto channel -> R above, arrow along the line', () => {
    // template default is the vertical convention (left/south); must adapt to horizontal.
    assert.deepEqual(
        resolveUseSign('left', 'south', /*vertLine*/ false, /*coeff*/ -1, /*adapt*/ true, false, false),
        { position: 'up', direction: 'east' }
    );
    assert.deepEqual(
        resolveUseSign('left', 'south', false, /*coeff*/ 1, true, false, false),
        { position: 'up', direction: 'west' }
    );
});

test('resolveUseSign: vertical auto channel keeps left/south', () => {
    assert.deepEqual(
        resolveUseSign('left', 'south', /*vertLine*/ true, 1, true, false, false),
        { position: 'left', direction: 'south' }
    );
});

test('resolveUseSign: "both" direction survives adapt + flip', () => {
    assert.deepEqual(
        resolveUseSign('left', 'both', true, -1, true, false, false),
        { position: 'left', direction: 'both' }
    );
});

test('resolveUseSign: non-adapt S-channel rotates on even mid-segment', () => {
    assert.deepEqual(
        resolveUseSign('up', 'east', false, 1, /*adapt*/ false, /*routed*/ true, /*p0Even*/ true),
        { position: 'left', direction: 'north' }
    );
    // no rotation when p0 is odd
    assert.deepEqual(
        resolveUseSign('up', 'east', false, 1, false, true, false),
        { position: 'up', direction: 'east' }
    );
});

test('getUseEdgeDrawSegments: straight edge splits around the midpoint', () => {
    const segs = getUseEdgeDrawSegments([P(0, 50), P(100, 50)], { vertical: 'auto' });
    const last1 = segs.seg1[segs.seg1.length - 1];
    const first2 = segs.seg2[0];
    assert.deepEqual(xy(last1), P(42, 50));   // circle radius 8 before x=50
    assert.deepEqual(xy(first2), P(58, 50));  // and after
});

test('getUseEdgeDrawSegments: routed edge splits on the vertical mid-segment', () => {
    // Regression for the 6-point bug: the gap must be vertical and centered at y=265.
    const segs = getUseEdgeDrawSegments(SIX_POINT, { vertical: 'auto' });
    const last1 = segs.seg1[segs.seg1.length - 1];
    const first2 = segs.seg2[0];
    assert.deepEqual(xy(last1), P(297.5, 257));
    assert.deepEqual(xy(first2), P(297.5, 273));
});

test('getUseEdgeDrawSegments: offset boxes keep the 2-point line axis-aligned (no kink)', () => {
    // Boxes slightly offset -> endpoints have different x. The drawn line is
    // vertical at pts[0].x, so the circle must snap there too, not to the slant
    // midpoint x (which used to V-kink the two halves).
    const segs = getUseEdgeDrawSegments([P(297.43, 61), P(279.57, 211)], { vertical: 'auto' });
    for (const p of [...segs.seg1, ...segs.seg2]) assert.equal(p.x, 297.43);
});

test('resolveJumpStyle: edge without jumpStyle gets the default', () => {
    assert.equal(resolveJumpStyle({ edgeStyle: 'none' }, true, 'arc'), true);
});

test('resolveJumpStyle: explicit jumpStyle (incl. none) is left untouched', () => {
    assert.equal(resolveJumpStyle({ jumpStyle: 'gap' }, true, 'arc'), false);
    assert.equal(resolveJumpStyle({ jumpStyle: 'none' }, true, 'arc'), false);
});

test('resolveJumpStyle: vertices and global-off never inject', () => {
    assert.equal(resolveJumpStyle({}, false, 'arc'), false);   // not an edge
    assert.equal(resolveJumpStyle({}, true, 'none'), false);    // globally disabled
});

test('resolveJumpStyle: updateedge excluded, useedge included (paints own jumps)', () => {
    assert.equal(resolveJumpStyle({ shape: 'updateedge' }, true, 'arc'), false);
    assert.equal(resolveJumpStyle({ shape: 'useedge' }, true, 'arc'), true);
});

test('jumpDrawProgram: inserts one arc bump at a crossing on a straight run', () => {
    // horizontal run 0..100 at y=0, crossing at x=50, size=6
    const ops = jumpDrawProgram([P(0, 0), P(100, 0)], [P(50, 0)], 6);
    assert.equal(ops.filter(o => o.bump).length, 1);
    const bump = ops.find(o => o.bump).bump;
    assert.deepEqual(bump.p0, { x: 44, y: 0 });   // 6 before crossing
    assert.deepEqual(bump.p1, { x: 56, y: 0 });   // 6 after
    // straight runs end/start at the bump edges
    const runs = ops.filter(o => o.pts).map(o => o.pts);
    assert.deepEqual(runs[0][runs[0].length - 1], { x: 44, y: 0 });
    assert.deepEqual(runs[runs.length - 1][0], { x: 56, y: 0 });
});

test('jumpDrawProgram: no bump when nothing crosses, or crossing off the line', () => {
    assert.equal(jumpDrawProgram([P(0, 0), P(100, 0)], [], 6).filter(o => o.bump).length, 0);
    // point not on the line (y=20) -> ignored
    assert.equal(jumpDrawProgram([P(0, 0), P(100, 0)], [P(50, 20)], 6).filter(o => o.bump).length, 0);
    // too close to an endpoint to fit a full bump -> ignored
    assert.equal(jumpDrawProgram([P(0, 0), P(100, 0)], [P(3, 0)], 6).filter(o => o.bump).length, 0);
});

test('jumpDrawProgram: bump lands on the right segment of an L-route', () => {
    // down then right; crossing on the vertical leg at (0,50)
    const ops = jumpDrawProgram([P(0, 0), P(0, 100), P(100, 100)], [P(0, 50)], 6);
    const bump = ops.find(o => o.bump).bump;
    assert.deepEqual(bump.p0, { x: 0, y: 44 });
    assert.deepEqual(bump.p1, { x: 0, y: 56 });
});
