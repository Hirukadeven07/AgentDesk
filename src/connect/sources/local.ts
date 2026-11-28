import { makeTree, memoryTree, type FileTree } from '../fileTree';

/**
 * Sources on the user's own computer (docs/adr/0001). Files are read in the browser and never
 * uploaded anywhere.
 */

/** What a source hands to `scan`, with a name to show for the project. */
export interface SourcedTree {
  name: string;
  tree: FileTree;
}

/**
 * The parts of a browser `File` this needs. From `<input type="file" webkitdirectory>`,
 * `webkitRelativePath` starts with the picked folder's name: `my-app/.claude/agents/x.md`.
 */
export interface PickedFile {
  webkitRelativePath: string;
  name?: string;
  size: number;
  text(): Promise<string>;
}

/**
 * A project from the files of a picked folder. Paths lose the folder's own name. Each file is
 * read only when an adapter asks for it, and a file over the size limit is refused from its size,
 * without reading it, so a big repo stays quick to connect.
 */
export function fromPickedFiles(files: Iterable<PickedFile>): SourcedTree {
  const list = [...files];
  const rel = (f: PickedFile) => f.webkitRelativePath || f.name || '';
  const first = rel(list[0] ?? ({} as PickedFile));
  const folder = list.length && list.every((f) => rel(f).includes('/')) ? first.slice(0, first.indexOf('/')) : '';
  const byPath = new Map<string, PickedFile>();
  for (const f of list) {
    const path = folder ? rel(f).slice(folder.length + 1) : rel(f);
    if (path) byPath.set(path, f);
  }
  const tree = makeTree(
    [...byPath].map(([path, f]) => ({ path, size: f.size })),
    (path) => byPath.get(path)!.text(),
  );
  return { name: folder || 'Picked files', tree };
}

/** A project made of one pasted `agentsdeck.json`. */
export function fromManifestText(text: string): SourcedTree {
  return { name: 'Pasted manifest', tree: memoryTree({ 'agentsdeck.json': text }) };
}
