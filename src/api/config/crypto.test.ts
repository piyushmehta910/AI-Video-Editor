import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto';

describe('Crypto utilities', () => {
  it('should encrypt and decrypt a string correctly', async () => {
    const text = 'Hello, world!';
    const password = 'strongPassword123';
    const encrypted = await encrypt(text, password);
    const decrypted = await decrypt(encrypted, password);
    expect(decrypted).toBe(text);
  });
});
