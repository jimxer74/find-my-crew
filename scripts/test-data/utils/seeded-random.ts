/**
 * Seeded random number generator for deterministic data generation.
 * Uses a simple but effective mulberry32 algorithm.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed;
  }

  /**
   * Generate a random number between 0 and 1
   */
  next(): number {
    // Mulberry32 algorithm
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate a random integer between min (inclusive) and max (inclusive)
   */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate a random float between min and max
   */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Pick a random element from an array
   */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.int(0, array.length - 1)];
  }

  /**
   * Pick multiple unique random elements from an array
   */
  pickMultiple<T>(array: readonly T[], count: number): T[] {
    if (count > array.length) {
      throw new Error(`Cannot pick ${count} elements from array of length ${array.length}`);
    }

    const available = [...array];
    const result: T[] = [];

    for (let i = 0; i < count; i++) {
      const idx = this.int(0, available.length - 1);
      result.push(available[idx]);
      available.splice(idx, 1);
    }

    return result;
  }

  /**
   * Shuffle an array in place
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Generate a random boolean with given probability of true
   */
  bool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Generate a random date between two dates
   */
  date(start: Date, end: Date): Date {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return new Date(this.int(startTime, endTime));
  }

  /**
   * Generate a future date from now
   */
  futureDate(minDays: number = 1, maxDays: number = 365): Date {
    const now = new Date();
    const daysToAdd = this.int(minDays, maxDays);
    return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  /**
   * Generate a UUID-like string (not cryptographically secure)
   */
  uuid(): string {
    const hex = () => this.int(0, 15).toString(16);
    return (
      Array(8).fill(0).map(hex).join('') +
      '-' +
      Array(4).fill(0).map(hex).join('') +
      '-4' +
      Array(3).fill(0).map(hex).join('') +
      '-' +
      ['8', '9', 'a', 'b'][this.int(0, 3)] +
      Array(3).fill(0).map(hex).join('') +
      '-' +
      Array(12).fill(0).map(hex).join('')
    );
  }

  /**
   * Generate a weighted random selection
   */
  weighted<T>(items: { value: T; weight: number }[]): T {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = this.next() * totalWeight;

    for (const item of items) {
      random -= item.weight;
      if (random <= 0) {
        return item.value;
      }
    }

    return items[items.length - 1].value;
  }
}

// Default instance for convenience
let defaultInstance: SeededRandom | null = null;

export function initRandom(seed: number): SeededRandom {
  defaultInstance = new SeededRandom(seed);
  return defaultInstance;
}

export function getRandom(): SeededRandom {
  if (!defaultInstance) {
    throw new Error('Random not initialized. Call initRandom(seed) first.');
  }
  return defaultInstance;
}
