import { describe, it, expect } from 'vitest';
import { pushRecent } from './recent';

describe('pushRecent', () => {
  it('starts a list', () => {
    expect(pushRecent(undefined, 'h')).toEqual(['h']);
  });

  it('moves an existing entry to the front', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('caps at 5, dropping the oldest', () => {
    expect(pushRecent(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['f', 'a', 'b', 'c', 'd']);
  });

  it('honors a custom max', () => {
    expect(pushRecent(['a', 'b', 'c'], 'd', 2)).toEqual(['d', 'a']);
  });
});
