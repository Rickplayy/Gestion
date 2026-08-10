import { hash, verify, type Options } from '@node-rs/argon2';

const HASH_OPTIONS: Options = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (plain: string): Promise<string> => hash(plain, HASH_OPTIONS);

export const verifyPassword = async (plain: string, stored: string): Promise<boolean> => {
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
};
