function mean(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function vectorDistance(left, right) {
  const length = Math.max(left.length, right.length);
  let total = 0;

  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? left[left.length - 1] ?? 0;
    const rightValue = right[index] ?? right[right.length - 1] ?? 0;
    const difference = leftValue - rightValue;
    total += difference * difference;
  }

  return Math.sqrt(total / Math.max(1, length));
}

export function normalizeFeatureVector(values, targetLength = 8) {
  const vector = values.filter((value) => Number.isFinite(value)).map((value) => Number(value.toFixed(2)));

  if (vector.length === targetLength) {
    return vector;
  }

  if (vector.length > targetLength) {
    return vector.slice(0, targetLength);
  }

  const padded = [...vector];
  while (padded.length < targetLength) {
    padded.push(vector.at(-1) ?? 0);
  }

  return padded;
}

export function buildTypingFeatures(holdTimes, flightTimes) {
  const normalizedHoldTimes = normalizeFeatureVector(holdTimes);
  const normalizedFlightTimes = normalizeFeatureVector(flightTimes);

  return {
    holdTimes: normalizedHoldTimes,
    flightTimes: normalizedFlightTimes,
    holdAverage: mean(normalizedHoldTimes),
    flightAverage: mean(normalizedFlightTimes)
  };
}

export function compareTypingSamples(expectedProfile, attemptSample) {
  const holdDistance = vectorDistance(expectedProfile.holdTimes, attemptSample.holdTimes);
  const flightDistance = vectorDistance(expectedProfile.flightTimes, attemptSample.flightTimes);
  const combinedDistance = (holdDistance * 0.6) + (flightDistance * 0.4);
  const confidence = Math.max(0, 100 - combinedDistance * 1.4);
  const accepted = confidence >= expectedProfile.threshold;

  return {
    accepted,
    confidence: Number(confidence.toFixed(2)),
    holdDistance: Number(holdDistance.toFixed(2)),
    flightDistance: Number(flightDistance.toFixed(2)),
    combinedDistance: Number(combinedDistance.toFixed(2))
  };
}

export function parseFeaturePayload(body) {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const phrase = typeof body.phrase === 'string' ? body.phrase.trim() : '';
  const holdTimes = Array.isArray(body.holdTimes) ? body.holdTimes.map(Number) : [];
  const flightTimes = Array.isArray(body.flightTimes) ? body.flightTimes.map(Number) : [];

  if (!phrase || !holdTimes.length || !flightTimes.length) {
    return null;
  }

  return buildTypingFeatures(holdTimes, flightTimes);
}
