import { BSONError } from '../error';

type NodeJsEncoding = 'base64' | 'hex' | 'utf8' | 'binary';
type NodeJsBuffer = ArrayBufferView &
  Uint8Array & {
    write(string: string, offset: number, length: undefined, encoding: 'utf8'): number;
    copy(target: Uint8Array, targetStart: number, sourceStart: number, sourceEnd: number): number;
    toString: (this: Uint8Array, encoding: NodeJsEncoding) => string;
    equals: (this: Uint8Array, other: Uint8Array) => boolean;
  };
type NodeJsBufferConstructor = Omit<Uint8ArrayConstructor, 'from'> & {
  alloc: (size: number) => NodeJsBuffer;
  from(array: number[]): NodeJsBuffer;
  from(array: Uint8Array): NodeJsBuffer;
  from(array: ArrayBuffer): NodeJsBuffer;
  from(array: ArrayBuffer, byteOffset: number, byteLength: number): NodeJsBuffer;
  from(base64: string, encoding: NodeJsEncoding): NodeJsBuffer;
  byteLength(input: string, encoding: 'utf8'): number;
  isBuffer(value: unknown): value is NodeJsBuffer;
};

// This can be nullish, but we gate the nodejs functions on being exported whether or not this exists
// Node.js global
declare const Buffer: NodeJsBufferConstructor;
declare const require: (mod: 'node:crypto') => { randomBytes: (byteLength: number) => Uint8Array };

/** @internal */
export function nodejsMathRandomBytes(byteLength: number) {
  return nodeJsByteUtils.fromNumberArray(
    Array.from({ length: byteLength }, () => Math.floor(Math.random() * 256))
  );
}

/**
 * @internal
 * WARNING: REQUIRE WILL BE REWRITTEN
 *
 * This code is carefully used by require_rewriter.mjs any modifications must be reflected in the plugin.
 *
 * @remarks
 * "crypto" is the only dependency BSON needs. This presents a problem for creating a bundle of the BSON library
 * in an es module format that can be used both on the browser and in Node.js. In Node.js when BSON is imported as
 * an es module, there will be no global require function defined, making the code below fallback to the much less desireable math.random bytes.
 * In order to make our es module bundle work as expected on Node.js we need to change this `require()` to a dynamic import, and the dynamic
 * import must be top-level awaited since es modules are async. So we rely on a custom rollup plugin to seek out the following lines of code
 * and replace `require` with `await import` and the IIFE line (`nodejsRandomBytes = (() => { ... })()`) with `nodejsRandomBytes = await (async () => { ... })()`
 * when generating an es module bundle.
 */
const nodejsRandomBytes: (byteLength: number) => Uint8Array = (() => {
  try {
    return require('node:crypto').randomBytes;
  } catch {
    return nodejsMathRandomBytes;
  }
})();

/** @internal */
export const nodeJsByteUtils = {
  toLocalBufferType(potentialBuffer: Uint8Array | NodeJsBuffer | ArrayBuffer): NodeJsBuffer {
    if (Buffer.isBuffer(potentialBuffer)) {
      return potentialBuffer;
    }

    if (ArrayBuffer.isView(potentialBuffer)) {
      return Buffer.from(
        potentialBuffer.buffer,
        potentialBuffer.byteOffset,
        potentialBuffer.byteLength
      );
    }

    const stringTag =
      potentialBuffer?.[Symbol.toStringTag] ?? Object.prototype.toString.call(potentialBuffer);
    if (
      stringTag === 'ArrayBuffer' ||
      stringTag === 'SharedArrayBuffer' ||
      stringTag === '[object ArrayBuffer]' ||
      stringTag === '[object SharedArrayBuffer]'
    ) {
      return Buffer.from(potentialBuffer);
    }

    throw new BSONError(`Cannot create Buffer from ${String(potentialBuffer)}`);
  },

  allocate(size: number): NodeJsBuffer {
    return Buffer.alloc(size);
  },

  equals(a: Uint8Array, b: Uint8Array): boolean {
    return nodeJsByteUtils.toLocalBufferType(a).equals(b);
  },

  fromNumberArray(array: number[]): NodeJsBuffer {
    return Buffer.from(array);
  },

  fromBase64(base64: string): NodeJsBuffer {
    return Buffer.from(base64, 'base64');
  },

  toBase64(buffer: Uint8Array): string {
    return nodeJsByteUtils.toLocalBufferType(buffer).toString('base64');
  },

  /** **Legacy** binary strings are an outdated method of data transfer. Do not add public API support for interpreting this format */
  fromISO88591(codePoints: string): NodeJsBuffer {
    return Buffer.from(codePoints, 'binary');
  },

  /** **Legacy** binary strings are an outdated method of data transfer. Do not add public API support for interpreting this format */
  toISO88591(buffer: Uint8Array): string {
    return nodeJsByteUtils.toLocalBufferType(buffer).toString('binary');
  },

  fromHex(hex: string): NodeJsBuffer {
    return Buffer.from(hex, 'hex');
  },

  toHex(buffer: Uint8Array): string {
    return nodeJsByteUtils.toLocalBufferType(buffer).toString('hex');
  },

  fromUTF8(text: string): NodeJsBuffer {
    return Buffer.from(text, 'utf8');
  },

  toUTF8(buffer: Uint8Array): string {
    return nodeJsByteUtils.toLocalBufferType(buffer).toString('utf8');
  },

  utf8ByteLength(input: string): number {
    return Buffer.byteLength(input, 'utf8');
  },

  encodeUTF8Into(buffer: Uint8Array, source: string, byteOffset: number): number {
    return nodeJsByteUtils.toLocalBufferType(buffer).write(source, byteOffset, undefined, 'utf8');
  },

  randomBytes: nodejsRandomBytes
};
