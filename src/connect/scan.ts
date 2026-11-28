import { ADAPTERS } from './adapters';
import type { FileTree } from './fileTree';
import { merge, type MergeResult } from './merge';
import type { Adapter } from './types';

/**
 * Connects a project: runs every adapter that recognises the file tree and merges what they find.
 * An adapter that fails is reported as a warning and the others still run.
 */
export async function scan(tree: FileTree, adapters: Adapter[] = ADAPTERS): Promise<MergeResult> {
  const found = await Promise.all(
    adapters
      .filter((a) => a.detect(tree))
      .map(async (a) => {
        try {
          return await a.parse(tree);
        } catch (e) {
          return { agents: [], skills: [], mcpServers: [], warnings: [`${a.label} could not read this project: ${e instanceof Error ? e.message : String(e)}`] };
        }
      }),
  );
  return merge(found);
}
