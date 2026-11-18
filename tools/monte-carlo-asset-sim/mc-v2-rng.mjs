export function createMt19937(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Seed must be a uint32');
  }
  const state = new Uint32Array(624);
  state[0] = seed;
  for (let i = 1; i < state.length; i++) {
    const previous = state[i - 1];
    state[i] = Math.imul(1812433253, previous ^ (previous >>> 30)) + i;
  }
  let index = state.length;
  return {
    nextUint32() {
      if (index === state.length) {
        for (let i = 0; i < state.length; i++) {
          const word = (state[i] & 0x80000000) | (state[(i + 1) % 624] & 0x7fffffff);
          state[i] = state[(i + 397) % 624] ^ (word >>> 1) ^ ((word & 1) ? 0x9908b0df : 0);
        }
        index = 0;
      }
      let word = state[index++];
      word ^= word >>> 11;
      word ^= (word << 7) & 0x9d2c5680;
      word ^= (word << 15) & 0xefc60000;
      word ^= word >>> 18;
      return word >>> 0;
    },
  };
}

export function uniformOpen(word) {
  return (word + 0.5) / 2 ** 32;
}

export function normalPair(u, v) {
  const radius = Math.sqrt(-2 * Math.log(u));
  const angle = (2 * Math.PI) * v;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

export function createNormalSampler(nextUint32) {
  let spare;
  return function nextNormal() {
    if (spare !== undefined) {
      const value = spare;
      spare = undefined;
      return value;
    }
    const [value, next] = normalPair(uniformOpen(nextUint32()), uniformOpen(nextUint32()));
    spare = next;
    return value;
  };
}
