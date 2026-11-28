import { useEffect, useRef, useState, type FormEvent } from 'react';
import { connectProject, type ConnectRequest, type Connected } from '../connect/connect';
import type { PickedFile } from '../connect/sources/local';

type Tab = 'github' | 'folder' | 'manifest';

const TABS: [Tab, string][] = [
  ['github', 'GitHub link'],
  ['folder', 'Folder on this computer'],
  ['manifest', 'Paste a manifest'],
];

const MANIFEST_DOCS = 'https://github.com/Hirukadeven07/AgentsDeck/blob/main/docs/manifest.md';

/** Connect a project from a GitHub link, a folder on this computer, or a pasted agentsdeck.json. */
export function ConnectDialog({ onClose, onConnected }: { onClose: () => void; onConnected: (p: Connected) => void }) {
  const [tab, setTab] = useState<Tab>('github');
  const [link, setLink] = useState('');
  const [manifest, setManifest] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  // React has no prop for picking a whole folder, so set the attribute by hand
  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '');
  }, [tab]);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const run = async (req: ConnectRequest, what: string) => {
    setError(null);
    setBusy(`Reading ${what}…`);
    const r = await connectProject(req);
    setBusy(null);
    if (r.ok) onConnected(r.project);
    else setError(r.error);
  };

  const onGitHub = (e: FormEvent) => {
    e.preventDefault();
    if (link.trim()) run({ kind: 'github', input: link }, link.trim());
  };
  const onFolder = (files: FileList | null) => {
    if (files?.length) run({ kind: 'folder', files: [...files] as PickedFile[] }, 'the folder');
  };
  const onManifest = (e: FormEvent) => {
    e.preventDefault();
    run({ kind: 'manifest', text: manifest }, 'the manifest');
  };

  return (
    <div className="cn-back" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="cn" role="dialog" aria-modal="true" aria-labelledby="cn-title">
        <div className="cn-head">
          <h2 id="cn-title">Connect your project</h2>
          <button className="cn-x" aria-label="Close" onClick={onClose} disabled={!!busy}>
            ×
          </button>
        </div>
        <p className="cn-lede">See your own agents and skills, from whatever you build them with. Nothing is stored on a server.</p>

        <div className="cn-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              disabled={!!busy}
              onClick={() => {
                setTab(id);
                setError(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'github' && (
          <form className="cn-body" onSubmit={onGitHub}>
            <label htmlFor="cn-link">Public repository</label>
            <div className="cn-row">
              <input
                id="cn-link"
                ref={firstRef}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://github.com/owner/repo"
                autoComplete="off"
                spellCheck={false}
                disabled={!!busy}
              />
              <button className="cn-go" disabled={!!busy || !link.trim()}>
                Connect
              </button>
            </div>
            <p className="cn-note">A link to a branch or folder works too. AgentsDeck reads the repository straight from GitHub, without signing in.</p>
          </form>
        )}

        {tab === 'folder' && (
          <div className="cn-body">
            <label htmlFor="cn-folder">Project folder</label>
            <input id="cn-folder" ref={folderRef} type="file" multiple disabled={!!busy} onChange={(e) => onFolder(e.target.files)} />
            <p className="cn-note">
              Pick the folder at the top of your project. Its files are read in this browser and never uploaded. You can also pick a folder like <code>~/.claude</code> to see your
              own agents and skills.
            </p>
          </div>
        )}

        {tab === 'manifest' && (
          <form className="cn-body" onSubmit={onManifest}>
            <label htmlFor="cn-manifest">agentsdeck.json</label>
            <textarea
              id="cn-manifest"
              value={manifest}
              onChange={(e) => setManifest(e.target.value)}
              placeholder={'{\n  "version": 1,\n  "agents": [{ "id": "support-bot", "provider": "Amazon Bedrock" }]\n}'}
              rows={7}
              spellCheck={false}
              disabled={!!busy}
            />
            <div className="cn-row end">
              <button className="cn-go" disabled={!!busy || !manifest.trim()}>
                Connect
              </button>
            </div>
            <p className="cn-note">
              For cloud agents and anything else AgentsDeck can't read from files. <a href={MANIFEST_DOCS}>How to write one</a>.
            </p>
          </form>
        )}

        <div className="cn-status" aria-live="polite">
          {busy && <p className="cn-busy">{busy}</p>}
          {error && <p className="cn-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
