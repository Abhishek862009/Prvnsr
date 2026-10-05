import { createCipheriv, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";

/**
 * Minimal ZIP writer/reader using WinZip-compatible AES-256 encryption (AE-2):
 *   key material = PBKDF2-HMAC-SHA1(password, salt16, 1000 iterations) -> AES key | HMAC key | 2-byte verifier
 *   cipher       = AES-256 in CTR mode with a little-endian counter starting at 1
 *   integrity    = HMAC-SHA1 over the ciphertext (first 10 bytes)
 * This is the standard "AES-256 ZIP", so 7-Zip / WinZip can open it with the password even without
 * this application. (Because the format fixes 1000 PBKDF2 iterations, the backup password must be strong.)
 */
export class ZipCryptError extends Error {
  readonly code: "not_zip" | "unsupported" | "wrong_password" | "corrupted";
  constructor(code: ZipCryptError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export type ZipEntry = { name: string; data: Buffer };

const SALT_LEN = 16;
const MAC_LEN = 10;
const PV_LEN = 2;
const ITERATIONS = 1000;
const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

function deriveKeys(password: string, salt: Buffer) {
  const dk = pbkdf2Sync(Buffer.from(password, "utf8"), salt, ITERATIONS, 32 + 32 + PV_LEN, "sha1");
  return { aesKey: dk.subarray(0, 32), macKey: dk.subarray(32, 64), verifier: dk.subarray(64, 66) };
}

/** AES-CTR with WinZip's little-endian 128-bit counter (starts at 1). Encrypt == decrypt. */
function aesCtrLE(key: Buffer, data: Buffer): Buffer {
  const blocks = Math.ceil(data.length / 16);
  const counters = Buffer.alloc(blocks * 16);
  for (let i = 0; i < blocks; i++) counters.writeUInt32LE(i + 1, i * 16);
  const ecb = createCipheriv("aes-256-ecb", key, null);
  ecb.setAutoPadding(false);
  const keystream = Buffer.concat([ecb.update(counters), ecb.final()]);
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) out[i] = (data[i] as number) ^ (keystream[i] as number);
  return out;
}

const dosTime = (d: Date) => (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1);
const dosDate = (d: Date) => (Math.max(0, d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();

export function createEncryptedZip(entries: ZipEntry[], password: string, now: Date = new Date()): Buffer {
  const body: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const salt = randomBytes(SALT_LEN);
    const { aesKey, macKey, verifier } = deriveKeys(password, salt);
    const ciphertext = aesCtrLE(aesKey, deflateRawSync(e.data));
    const mac = createHmac("sha1", macKey).update(ciphertext).digest().subarray(0, MAC_LEN);
    const payload = Buffer.concat([salt, verifier, ciphertext, mac]);

    // WinZip AES extra field: version AE-2, vendor "AE", strength 3 (256-bit), real method 8 (deflate)
    const extra = Buffer.alloc(11);
    extra.writeUInt16LE(0x9901, 0);
    extra.writeUInt16LE(7, 2);
    extra.writeUInt16LE(2, 4);
    extra.write("AE", 6, "ascii");
    extra.writeUInt8(3, 8);
    extra.writeUInt16LE(8, 9);

    const t = dosTime(now);
    const d = dosDate(now);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(51, 4); // version needed
    local.writeUInt16LE(0x0801, 6); // encrypted + UTF-8 names
    local.writeUInt16LE(99, 8); // AES
    local.writeUInt16LE(t, 10);
    local.writeUInt16LE(d, 12);
    local.writeUInt32LE(0, 14); // CRC is 0 for AE-2
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extra.length, 28);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(SIG_CENTRAL, 0);
    cd.writeUInt16LE(51, 4);
    cd.writeUInt16LE(51, 6);
    cd.writeUInt16LE(0x0801, 8);
    cd.writeUInt16LE(99, 10);
    cd.writeUInt16LE(t, 12);
    cd.writeUInt16LE(d, 14);
    cd.writeUInt32LE(0, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(extra.length, 30);
    cd.writeUInt32LE(offset, 42);

    body.push(local, name, extra, payload);
    central.push(cd, name, extra);
    offset += local.length + name.length + extra.length + payload.length;
  }

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...body, cdBuf, eocd]);
}

const MAX_ENTRIES = 10;
const MAX_ENTRY_BYTES = 200 * 1024 * 1024; // zip-bomb guard

/** Throws ZipCryptError: not_zip / unsupported / wrong_password / corrupted. Never returns partial data. */
export function readEncryptedZip(buf: Buffer, password: string): ZipEntry[] {
  try {
    return readInner(buf, password);
  } catch (err) {
    if (err instanceof ZipCryptError) throw err;
    throw new ZipCryptError("corrupted", "The file is damaged or was changed.");
  }
}

function readInner(buf: Buffer, password: string): ZipEntry[] {
  if (buf.length < 22) throw new ZipCryptError("not_zip", "This is not a backup file.");
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipCryptError("not_zip", "This is not a backup file.");

  const total = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (total === 0 || total > MAX_ENTRIES) throw new ZipCryptError("corrupted", "The file is damaged or was changed.");

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== SIG_CENTRAL) throw new ZipCryptError("corrupted", "The file is damaged or was changed.");
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const rawSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const extra = buf.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (!(flags & 1) || method !== 99) throw new ZipCryptError("unsupported", "This ZIP is not an encrypted backup.");
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(name)) throw new ZipCryptError("corrupted", "The file is damaged or was changed.");

    let strength = -1;
    let realMethod = -1;
    for (let q = 0; q + 4 <= extra.length; ) {
      const id = extra.readUInt16LE(q);
      const size = extra.readUInt16LE(q + 2);
      if (id === 0x9901 && size >= 7) {
        strength = extra.readUInt8(q + 8);
        realMethod = extra.readUInt16LE(q + 9);
      }
      q += 4 + size;
    }
    if (strength !== 3 || (realMethod !== 8 && realMethod !== 0)) {
      throw new ZipCryptError("unsupported", "Unsupported encryption. Use a backup created by this application.");
    }

    if (buf.readUInt32LE(localOffset) !== SIG_LOCAL) throw new ZipCryptError("corrupted", "The file is damaged or was changed.");
    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const payload = buf.subarray(start, start + compSize);
    if (payload.length !== compSize || compSize < SALT_LEN + PV_LEN + MAC_LEN) {
      throw new ZipCryptError("corrupted", "The file is damaged or was changed.");
    }

    const salt = payload.subarray(0, SALT_LEN);
    const verifier = payload.subarray(SALT_LEN, SALT_LEN + PV_LEN);
    const ciphertext = payload.subarray(SALT_LEN + PV_LEN, compSize - MAC_LEN);
    const mac = payload.subarray(compSize - MAC_LEN);

    const keys = deriveKeys(password, salt);
    if (!timingSafeEqual(verifier, keys.verifier)) throw new ZipCryptError("wrong_password", "The backup password is incorrect.");
    const expected = createHmac("sha1", keys.macKey).update(ciphertext).digest().subarray(0, MAC_LEN);
    if (!timingSafeEqual(mac, expected)) throw new ZipCryptError("corrupted", "The file is damaged or was changed.");

    const plain = aesCtrLE(keys.aesKey, ciphertext);
    const data = realMethod === 8 ? inflateRawSync(plain, { maxOutputLength: MAX_ENTRY_BYTES }) : plain;
    if (data.length !== rawSize) throw new ZipCryptError("corrupted", "The file is damaged or was changed.");
    entries.push({ name, data });
  }
  return entries;
}
