import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTypingFeatures, compareTypingSamples } from '../src/typing.js';

test('buildTypingFeatures normalizes input vectors', () => {
  const result = buildTypingFeatures([10, 12, 14], [5, 7, 9]);

  assert.equal(result.holdTimes.length, 8);
  assert.equal(result.flightTimes.length, 8);
  assert.ok(result.holdAverage > 0);
  assert.ok(result.flightAverage > 0);
});

test('compareTypingSamples accepts similar samples above threshold', () => {
  const expectedProfile = {
    holdTimes: [10, 11, 12, 11, 10, 12, 11, 10],
    flightTimes: [6, 7, 6, 7, 6, 7, 6, 7],
    threshold: 70
  };

  const attemptSample = {
    holdTimes: [10, 11, 12, 11, 10, 12, 11, 10],
    flightTimes: [6, 7, 6, 7, 6, 7, 6, 7]
  };

  const result = compareTypingSamples(expectedProfile, attemptSample);

  assert.equal(result.accepted, true);
  assert.ok(result.confidence >= 70);
});
