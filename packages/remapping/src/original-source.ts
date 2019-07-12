import { SourceMapSegmentObject } from './types';

/**
 * A "leaf" node in the sourcemap tree, representing an original, unmodified
 * source file. Recursive segment tracing ends at the `OriginalSource`.
 */
export default class OriginalSource {
  content: string | null;
  filename: string;

  constructor(filename: string, content: string | null) {
    this.filename = filename;
    this.content = content;
  }

  /**
   * Tracing a `SourceMapSegment` ends when we get to an `OriginalSource`,
   * meaning this line/column location originated from this source file.
   */
  traceSegment(line: number, column: number, name: string): SourceMapSegmentObject {
    return { column, line, name, source: this };
  }
}
