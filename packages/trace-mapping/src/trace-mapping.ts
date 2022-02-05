import { encode, decode } from '@jridgewell/sourcemap-codec';

import resolve from './resolve';
import stripFilename from './strip-filename';
import maybeSort from './sort';
import { memoizedState, memoizedBinarySearch } from './binary-search';

import type {
  SourceMapV3,
  DecodedSourceMap,
  EncodedSourceMap,
  InvalidMapping,
  Mapping,
  SourceMapSegment,
  SourceMapInput,
  Needle,
  SourceMap,
} from './types';

export type {
  SourceMapSegment,
  SourceMapInput,
  DecodedSourceMap,
  EncodedSourceMap,
  InvalidMapping,
  Mapping,
} from './types';

const INVALID_MAPPING: InvalidMapping = Object.freeze({
  source: null,
  line: null,
  column: null,
  name: null,
});

/**
 * Returns the encoded (VLQ string) form of the SourceMap's mappings field.
 */
export let encodedMappings: (map: TraceMap) => EncodedSourceMap['mappings'];

/**
 * Returns the decoded (array of lines of segments) form of the SourceMap's mappings field.
 */
export let decodedMappings: (map: TraceMap) => DecodedSourceMap['mappings'];

/**
 * A low-level API to find the segment associated with a generated line/column (think, from a
 * stack trace). Line and column here are 0-based, unlike `originalPositionFor`.
 */
export let traceSegment: (map: TraceMap, line: number, column: number) => SourceMapSegment | null;

/**
 * A higher-level API to find the source/line/column associated with a generated line/column
 * (think, from a stack trace). Line is 1-based, but column is 0-based, due to legacy behavior in
 * `source-map` library.
 */
export let originalPositionFor: (map: TraceMap, needle: Needle) => Mapping | InvalidMapping;

export class TraceMap implements SourceMap {
  declare version: SourceMapV3['version'];
  declare file: SourceMapV3['file'];
  declare names: SourceMapV3['names'];
  declare sourceRoot: SourceMapV3['sourceRoot'];
  declare sources: SourceMapV3['sources'];
  declare sourcesContent: SourceMapV3['sourcesContent'];

  declare resolvedSources: SourceMapV3['sources'];
  private declare _encoded: string | undefined;
  private declare _decoded: SourceMapSegment[][];

  private _binarySearchMemo = memoizedState();

  constructor(map: SourceMapInput, mapUrl?: string | null) {
    const isString = typeof map === 'string';
    const parsed = isString ? (JSON.parse(map) as Exclude<SourceMapInput, string>) : map;

    const { version, file, names, sourceRoot, sources, sourcesContent } = parsed;
    this.version = version;
    this.file = file;
    this.names = names;
    this.sourceRoot = sourceRoot;
    this.sources = sources;
    this.sourcesContent = sourcesContent;

    const from = resolve(sourceRoot || '', stripFilename(mapUrl));
    this.resolvedSources = sources.map((s) => resolve(s || '', from));

    const { mappings } = parsed;
    if (typeof mappings === 'string') {
      this._encoded = mappings;
      this._decoded = maybeSort(decode(mappings), true);
    } else {
      this._encoded = undefined;
      this._decoded = maybeSort(mappings, isString);
    }
  }

  static {
    encodedMappings = (map) => {
      return (map._encoded ??= encode(map._decoded));
    };

    decodedMappings = (map) => {
      return map._decoded;
    };

    traceSegment = (map, line, column) => {
      const decoded = map._decoded;

      // It's common for parent source maps to have pointers to lines that have no
      // mapping (like a "//# sourceMappingURL=") at the end of the child file.
      if (line >= decoded.length) return null;

      const segments = decoded[line];
      const index = memoizedBinarySearch(segments, column, map._binarySearchMemo, line);

      // we come before any mapped segment
      if (index < 0) return null;
      return segments[index];
    };

    originalPositionFor = (map, { line, column }) => {
      if (line < 1) throw new Error('`line` must be greater than 0 (lines start at line 1)');
      if (column < 0) {
        throw new Error('`column` must be greater than or equal to 0 (columns start at column 0)');
      }

      const segment = traceSegment(map, line - 1, column);
      if (segment == null) return INVALID_MAPPING;
      if (segment.length == 1) return INVALID_MAPPING;

      const { names, resolvedSources } = map;
      return {
        source: resolvedSources[segment[1]],
        line: segment[2] + 1,
        column: segment[3],
        name: segment.length === 5 ? names[segment[4]] : null,
      };
    };
  }
}
