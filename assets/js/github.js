// Minimal GitHub REST client for the dashboard.
// Publishes several files in ONE atomic commit via the Git Data API, and retries
// on top of the newest commit if someone else published at the same time.

export class GitHubError extends Error {
  constructor(message, status = 0, detail = '') {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function explain(status, detail) {
  if (status === 401) return 'The GitHub token is invalid or has expired. Create a new token (README → "GitHub token") and enter it in Settings.';
  if (status === 403 && /rate limit/i.test(detail)) return 'GitHub rate limit reached. Please wait a few minutes and try again.';
  if (status === 403) return 'The token has no write access. It needs "Contents: Read and write" permission for this repository.';
  if (status === 404) return 'Repository or branch not found. Check owner, repository and branch in Settings, and that the token has access to this repository.';
  if (status === 409) return 'The repository is empty. Push the project files first (see README).';
  return `GitHub error ${status}${detail ? `: ${detail}` : ''}`;
}

function decodeBase64Utf8(b64) {
  const binary = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function createGitHub({ owner, repo, branch = 'main', token }) {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  async function request(method, path, body) {
    let res;
    try {
      res = await fetch(base + path, {
        method,
        cache: 'no-store', // API responses are cacheable for 60 s — never use stale data when publishing
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GitHubError('Could not reach GitHub. Check your internet connection.');
    }
    if (res.ok) return res.status === 204 ? null : res.json();
    let detail = '';
    try {
      detail = (await res.json()).message || '';
    } catch {
      // no JSON body
    }
    throw new GitHubError(explain(res.status, detail), res.status, detail);
  }

  const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

  /** Returns the file content as text, or null if it doesn't exist. */
  async function readFile(path, ref = branch) {
    try {
      const file = await request('GET', `/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);
      return decodeBase64Utf8(file.content || '');
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async function testConnection() {
    const repoInfo = await request('GET', '');
    await request('GET', `/branches/${encodeURIComponent(branch)}`);
    return { fullName: repoInfo.full_name, private: repoInfo.private };
  }

  /**
   * Commits files atomically.
   * @param {(read: (path: string) => Promise<string|null>) => Promise<{path: string, content: string}[]>} buildFiles
   *   Called with a reader bound to the current head commit, so files are always built on fresh data.
   */
  async function commit(buildFiles, message, attempts = 3) {
    for (let attempt = 1; ; attempt++) {
      const ref = await request('GET', `/git/ref/heads/${encodeURIComponent(branch)}`);
      const headSha = ref.object.sha;
      const headCommit = await request('GET', `/git/commits/${headSha}`);
      const files = await buildFiles((path) => readFile(path, headSha));
      const tree = await request('POST', '/git/trees', {
        base_tree: headCommit.tree.sha,
        tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
      });
      const newCommit = await request('POST', '/git/commits', { message, tree: tree.sha, parents: [headSha] });
      try {
        await request('PATCH', `/git/refs/heads/${encodeURIComponent(branch)}`, { sha: newCommit.sha, force: false });
        return newCommit.sha;
      } catch (err) {
        // 422 = not a fast-forward: another commit landed meanwhile → rebuild on top of it.
        if (err.status === 422 && attempt < attempts) continue;
        throw err;
      }
    }
  }

  return { readFile, testConnection, commit };
}
