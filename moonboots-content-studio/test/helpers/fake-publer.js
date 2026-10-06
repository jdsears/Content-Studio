// A small stand-in for Publer's API, enough for the scheduling tests.
import http from 'node:http';

export async function startFakePubler() {
  const state = {
    validKeys: new Set(['good-key']),
    accounts: [
      { id: 'acc_li', name: 'Touchline', provider: 'linkedin', type: 'in_page' },
      { id: 'acc_fb', name: 'Touchline', provider: 'facebook', type: 'fb_page' },
      { id: 'acc_ig', name: 'touchline.xyz', provider: 'instagram', type: 'ig_business' },
    ],
    posts: [],        // { id, account_id, text, state, scheduled_at, post_link }
    jobs: new Map(),  // job id -> { status, payload }
    scheduleCalls: [],
    deleted: [],
    media: 0,
    // Switches for tests
    scheduleDelayMs: 0,
    scheduleStatus: null,   // e.g. 503: /posts/schedule answers with this error
    jobStatusCode: null,    // e.g. 429: /job_status answers with this error
    analyticsStatus: null,  // e.g. 403: the key has no Analytics permission
    analyticsCalls: 0,
  };
  let nextId = 1;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fake');
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const key = (req.headers.authorization || '').replace('Bearer-API ', '');
    if (!state.validKeys.has(key)) return send(401, { message: 'Unauthorized' });

    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      const path = url.pathname.replace(/^\/api\/v1/, '');
      if (req.method === 'GET' && path === '/workspaces') return send(200, [{ id: 'ws_1', name: 'Touchline' }]);
      if (req.method === 'GET' && path === '/accounts') return send(200, state.accounts);
      if (req.method === 'POST' && path === '/media') {
        state.media += 1;
        return send(200, { id: `media_${state.media}` });
      }
      if (req.method === 'POST' && path === '/posts/schedule') {
        const body = JSON.parse(raw);
        const answer = () => {
          if (state.scheduleStatus) return send(state.scheduleStatus, { message: 'Publer is unavailable' });
          scheduleNow(body);
        };
        return state.scheduleDelayMs ? setTimeout(answer, state.scheduleDelayMs) : answer();
      }
      const job = path.match(/^\/job_status\/(.+)$/);
      if (req.method === 'GET' && job) {
        if (state.jobStatusCode) return send(state.jobStatusCode, { message: 'Too many requests' });
        return send(200, state.jobs.get(job[1]) || { status: 'working' });
      }
      // Per-post numbers for published posts, some as plain numbers and some as { name, value }
      const insights = path.match(/^\/analytics\/([^/]+)\/post_insights$/);
      if (req.method === 'GET' && insights) {
        state.analyticsCalls += 1;
        if (state.analyticsStatus) return send(state.analyticsStatus, { message: 'Requires analytics access' });
        if (!url.searchParams.get('from') || !url.searchParams.get('to')) return send(500, { message: 'from and to are required' });
        if (Number(url.searchParams.get('page') || 0) > 0) return send(200, { posts: [], total: 0 });
        const found = state.posts
          .filter(p => p.state === 'published' && p.account_id === insights[1])
          .map((p, i) => ({
            id: p.id, text: p.text, account_id: p.account_id, scheduled_at: p.scheduled_at, post_link: p.post_link,
            analytics: {
              reach: { name: 'Reach', value: 400 + i * 10 },
              engagement: 30 + i,
              engagement_rate: { name: 'Engagement rate', value: 7.5 },
              likes: 20 + i, comments: { name: 'Comments', value: 5 }, shares: 3,
            },
          }));
        return send(200, { posts: found, total: found.length });
      }
      if (req.method === 'GET' && path === '/posts') {
        const wanted = url.searchParams.get('state');
        const accountIds = url.searchParams.getAll('account_ids[]');
        const found = state.posts.filter(p => (!wanted || p.state === wanted) && (!accountIds.length || accountIds.includes(p.account_id)));
        return send(200, { posts: found, total: found.length });
      }
      if (req.method === 'DELETE' && path === '/posts') {
        const ids = url.searchParams.getAll('post_ids[]');
        state.deleted.push(...ids);
        state.posts = state.posts.filter(p => !ids.includes(p.id));
        return send(200, { deleted_ids: ids });
      }
      send(404, { message: `No fake for ${req.method} ${path}` });

      function scheduleNow(body) {
        state.scheduleCalls.push(body);
        const item = body.bulk.posts[0];
        const network = Object.keys(item.networks)[0];
        const text = item.networks[network].text;
        const jobId = `job_${nextId++}`;
        if (text.includes('FAILME')) {
          state.jobs.set(jobId, { status: 'complete', payload: { failures: { acc: [{ message: 'Text is too long for this network' }] } } });
        } else {
          const id = `pub_${nextId++}`;
          state.posts.push({ id, account_id: item.accounts[0].id, text, state: 'scheduled', scheduled_at: item.accounts[0].scheduled_at, post_link: null });
          state.jobs.set(jobId, { status: 'complete', payload: { failures: {} } });
        }
        send(200, { job_id: jobId });
      }
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    state,
    url: `http://127.0.0.1:${server.address().port}/api/v1`,
    // Pretend Publer has failed a post
    fail(publerId) {
      state.posts.find(p => p.id === publerId).state = 'failed';
    },
    // Pretend Publer has published a post
    goLive(publerId) {
      const post = state.posts.find(p => p.id === publerId);
      post.state = 'published';
      post.post_link = `https://www.linkedin.com/feed/update/${publerId}`;
    },
    close: () => server.close(),
  };
}
