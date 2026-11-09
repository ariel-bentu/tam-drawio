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

const { resolveVertical, getEdgeMidPoint, getUseEdgeDrawSegments, resolveUseSign } =
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
