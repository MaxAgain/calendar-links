// Tests the dashboard's GitHub publishing against an in-memory fake of the GitHub REST API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGitHub, GitHubError } from '../assets/js/github.js';

function fakeGitHub({ conflictsBeforeSuccess = 0, status = 200 } = {}) {
  const files = { c1: { 'events/index.json': '{"events":[{"id":"alt"}]}' } }; // commit sha → files
  const api = { head: 'c1', conflicts: conflictsBeforeSuccess, trees: [], commits: [], patches: 0, contentReads: [] };
  let n = 1;
  const json = (body, code = 200) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json' } });

  globalThis.fetch = async (url, init = {}) => {
    if (status !== 200) return json({ message: 'Bad credentials' }, status);
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace('/repos/solakon/calendar', '');
    const method = init.method || 'GET';
    assert.equal(init.cache, 'no-store', 'GitHub API calls must bypass the browser cache');
    assert.equal(init.headers.Authorization, 'Bearer tok');

    if (method === 'GET' && path === '/git/ref/heads/main') return json({ object: { sha: api.head } });
    if (method === 'GET' && path.startsWith('/git/commits/')) return json({ tree: { sha: `tree-${path.split('/').pop()}` } });
    if (method === 'GET' && path.startsWith('/contents/')) {
      const file = decodeURIComponent(path.slice('/contents/'.length));
      const ref = searchParams.get('ref');
      api.contentReads.push(`${file}@${ref}`);
      const text = files[ref]?.[file];
      return text === undefined ? json({ message: 'Not Found' }, 404) : json({ content: Buffer.from(text).toString('base64') });
    }
    if (method === 'POST' && path === '/git/trees') {
      const body = JSON.parse(init.body);
      api.trees.push(body);
      return json({ sha: `tree-new-${api.trees.length}` });
    }
    if (method === 'POST' && path === '/git/commits') {
      const body = JSON.parse(init.body);
      api.commits.push(body);
      return json({ sha: `c${++n}` });
    }
    if (method === 'PATCH' && path === '/git/refs/heads/main') {
      api.patches++;
      if (api.conflicts > 0) {
        api.conflicts--;
        // Simulate a colleague publishing in the meantime.
        api.head = 'c-other';
        files['c-other'] = { 'events/index.json': '{"events":[{"id":"alt"},{"id":"colleague"}]}' };
        return json({ message: 'Update is not a fast forward' }, 422);
      }
      const body = JSON.parse(init.body);
      assert.equal(body.force, false, 'never force-push');
      api.head = body.sha;
      return json({ object: { sha: body.sha } });
    }
    return json({ message: `unexpected ${method} ${path}` }, 500);
  };
  return api;
}

const gh = () => createGitHub({ owner: 'solakon', repo: 'calendar', branch: 'main', token: 'tok' });

test('commit writes all files in one atomic commit on top of the current head', async () => {
  const api = fakeGitHub();
  const sha = await gh().commit(async (read) => {
    const index = JSON.parse(await read('events/index.json'));
    assert.equal(await read('events/missing.json'), null);
    return [
      { path: 'events/neu.json', content: '{"title":"Größe"}' },
      { path: 'events/index.json', content: JSON.stringify({ events: [...index.events, { id: 'neu' }] }) },
    ];
  }, 'Add event');
  assert.equal(sha, 'c2');
  assert.equal(api.head, 'c2');
  assert.equal(api.trees.length, 1);
  assert.equal(api.trees[0].base_tree, 'tree-c1');
  assert.deepEqual(api.trees[0].tree.map((f) => f.path), ['events/neu.json', 'events/index.json']);
  assert.equal(api.trees[0].tree[0].content, '{"title":"Größe"}', 'UTF-8 content passes through unchanged');
  assert.deepEqual(api.commits[0], { message: 'Add event', tree: 'tree-new-1', parents: ['c1'] });
});

test('commit rebuilds on top of a colleague’s concurrent commit instead of overwriting it', async () => {
  const api = fakeGitHub({ conflictsBeforeSuccess: 1 });
  let lastIndex;
  await gh().commit(async (read) => {
    lastIndex = JSON.parse(await read('events/index.json'));
    return [{ path: 'events/index.json', content: JSON.stringify({ events: [...lastIndex.events, { id: 'neu' }] }) }];
  }, 'Add event');
  assert.equal(api.patches, 2);
  assert.deepEqual(api.contentReads, ['events/index.json@c1', 'events/index.json@c-other']);
  assert.deepEqual(lastIndex.events.map((e) => e.id), ['alt', 'colleague'], 'second attempt sees the colleague’s event');
  assert.deepEqual(api.commits[1].parents, ['c-other']);
});

test('commit gives up after repeated conflicts', async () => {
  fakeGitHub({ conflictsBeforeSuccess: 5 });
  await assert.rejects(gh().commit(async () => [{ path: 'a', content: 'b' }], 'x'), (err) => err instanceof GitHubError && err.status === 422);
});

test('an expired token produces an actionable message', async () => {
  fakeGitHub({ status: 401 });
  await assert.rejects(gh().readFile('events/index.json'), /token is invalid or has expired/);
});
