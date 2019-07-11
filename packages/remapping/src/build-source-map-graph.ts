import decodeSourceMap from './decode-source-map';
import GraphNode from './graph-node';
import OriginalSource from './original-source';
import resolve from './resolve';
import { DecodedSourceMap, SourceMapInput, SourceMapLoader } from './types';

/**
 * Recursively builds a tree structure out of sourcemap files, with each node
 * being either an `OriginalSource` "leaf" or a `GraphNode` composed of
 * `OriginalSource`s and `GraphNode`s.
 *
 * Every sourcemap is composed of a collection of source files and mappings
 * into locations of those source files. When we generate a `GraphNode` for the
 * sourcemap, we attempt to load each source file's own sourcemap. If it does
 * not have an associated sourcemap, it is considered an original, unmodified
 * source file.
 */
export default function buildSourceMapGraph(
  map: SourceMapInput,
  loader: SourceMapLoader
): GraphNode {
  map = decodeSourceMap(map);
  const { sourceRoot, sources, sourcesContent } = map;

  const children = sources.map((sourceFile: string, i: number) => {
    // Each source file is loaded relative to the sourcemap's own sourceRoot.
    const file = resolve(sourceFile, sourceRoot);

    // Use the provided loader callback to retreive the file's sourcemap.
    // TODO: We should eventually support async loading of sourcemap files.
    const sourceMap = loader(file);

    // If there is no sourcemap, then it is an unmodified source file.
    if (!sourceMap) {
      // The source file's actual contents must be included in the sourcemap
      // (done when generating the sourcemap) for it to be included as a
      // sourceContent in the output sourcemap.
      const sourceContent = sourcesContent ? sourcesContent[i] : null;
      return new OriginalSource(sourceFile, sourceContent);
    }

    // Else, it's a real sourcemap, and we need to recurse into it to load it's
    // source files.
    return buildSourceMapGraph(decodeSourceMap(sourceMap), loader);
  });

  return new GraphNode(map, children);
}
