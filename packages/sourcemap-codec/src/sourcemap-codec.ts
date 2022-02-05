export type SourceMapSegment =
  | [number]
  | [number, number, number, number]
  | [number, number, number, number, number];
export type SourceMapLine = SourceMapSegment[];
export type SourceMapMappings = SourceMapLine[];

const comma = 44;
const semicolon = 59;
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const intToChar = new Uint8Array(65); // 65 possible chars.
const charToInteger = new Uint8Array(123); // z is 122 in ASCII

for (let i = 0; i < chars.length; i++) {
  const c = chars.charCodeAt(i);
  charToInteger[c] = i;
  intToChar[i] = c;
}

// Provide a fallback for older environments.
const td =
  typeof TextDecoder !== 'undefined'
    ? new TextDecoder()
    : typeof Buffer !== 'undefined'
    ? {
        decode(buf: Uint8Array) {
          const out = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
          return out.toString();
        },
      }
    : {
        decode(buf: Uint8Array) {
          let out = '';
          for (let i = 0; i < buf.length; i++) {
            out += String.fromCharCode(buf[i]);
          }
          return out;
        },
      };

export function decode(mappings: string): SourceMapMappings {
  const state: [number, number, number, number, number] = new Int32Array(5) as any;
  const decoded: SourceMapMappings = [];
  let line: SourceMapLine = [];
  let sorted = true;
  let lastCol = 0;

  for (let i = 0; i < mappings.length; ) {
    const c = mappings.charCodeAt(i);

    if (c === comma) {
      i++;
    } else if (c === semicolon) {
      state[0] = lastCol = 0;
      if (!sorted) sort(line);
      sorted = true;
      decoded.push(line);
      line = [];
      i++;
    } else {
      i = decodeInteger(mappings, i, state, 0); // generatedCodeColumn
      const col = state[0];
      if (col < lastCol) sorted = false;
      lastCol = col;

      if (!hasMoreSegments(mappings, i)) {
        line.push([col]);
        continue;
      }

      i = decodeInteger(mappings, i, state, 1); // sourceFileIndex
      i = decodeInteger(mappings, i, state, 2); // sourceCodeLine
      i = decodeInteger(mappings, i, state, 3); // sourceCodeColumn

      if (!hasMoreSegments(mappings, i)) {
        line.push([col, state[1], state[2], state[3]]);
        continue;
      }

      i = decodeInteger(mappings, i, state, 4); // nameIndex
      line.push([col, state[1], state[2], state[3], state[4]]);
    }
  }

  if (!sorted) sort(line);
  decoded.push(line);

  return decoded;
}

function decodeInteger(mappings: string, pos: number, state: SourceMapSegment, j: number): number {
  let value = 0;
  let shift = 0;
  let integer = 0;

  do {
    const c = mappings.charCodeAt(pos++);
    integer = charToInteger[c];
    value |= (integer & 31) << shift;
    shift += 5;
  } while (integer & 32);

  const shouldNegate = value & 1;
  value >>>= 1;

  if (shouldNegate) {
    value = value === 0 ? -0x80000000 : -value;
  }

  state[j] += value;
  return pos;
}

function hasMoreSegments(mappings: string, i: number): boolean {
  if (i >= mappings.length) return false;

  const c = mappings.charCodeAt(i);
  if (c === comma || c === semicolon) return false;
  return true;
}

function sort(line: SourceMapSegment[]) {
  line.sort(sortComparator);
}

function sortComparator(a: SourceMapSegment, b: SourceMapSegment): number {
  return a[0] - b[0];
}

export function encode(decoded: SourceMapMappings): string {
  const state: [number, number, number, number, number] = new Int32Array(5) as any;
  let buf = new Uint8Array(1000);
  let pos = 0;

  for (let i = 0; i < decoded.length; i++) {
    const line = decoded[i];
    if (i > 0) {
      buf = reserve(buf, pos, 1);
      buf[pos++] = semicolon;
    }
    if (line.length === 0) continue;

    state[0] = 0;

    for (let j = 0; j < line.length; j++) {
      const segment = line[j];
      // We can push up to 5 ints, each int can take at most 7 chars, and we
      // may push a comma.
      buf = reserve(buf, pos, 36);
      if (j > 0) buf[pos++] = comma;

      pos = encodeInteger(buf, pos, state, segment, 0); // generatedCodeColumn

      if (segment.length === 1) continue;
      pos = encodeInteger(buf, pos, state, segment, 1); // sourceFileIndex
      pos = encodeInteger(buf, pos, state, segment, 2); // sourceCodeLine
      pos = encodeInteger(buf, pos, state, segment, 3); // sourceCodeColumn

      if (segment.length === 4) continue;
      pos = encodeInteger(buf, pos, state, segment, 4); // nameIndex
    }
  }

  return td.decode(buf.subarray(0, pos));
}

function reserve(buf: Uint8Array, pos: number, count: number): Uint8Array {
  if (buf.length > pos + count) return buf;

  const swap = new Uint8Array(buf.length * 2);
  swap.set(buf);
  return swap;
}

function encodeInteger(
  buf: Uint8Array,
  pos: number,
  state: SourceMapSegment,
  segment: SourceMapSegment,
  j: number,
): number {
  const next = segment[j];
  let num = next - state[j];
  state[j] = next;

  num = num < 0 ? (-num << 1) | 1 : num << 1;
  do {
    let clamped = num & 31;
    num >>>= 5;
    if (num > 0) clamped |= 32;
    buf[pos++] = intToChar[clamped];
  } while (num > 0);

  return pos;
}
