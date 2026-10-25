// Chrome Web Store API v2 upload flow used by scripts/publish.ts. Credentials
// come from the environment; see the "Releases" section of the README.

const POLL_INTERVAL = 5_000;
const POLL_ATTEMPTS = 60;

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureOk = async (response: Response, action: string) => {
  if (!response.ok) throw new Error(`${action} failed: HTTP ${response.status} ${await response.text()}`);
  return response;
};

const poll = async <T>(read: () => Promise<T>, done: (value: T) => boolean) => {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const value = await read();
    if (done(value)) return value;
    await sleep(POLL_INTERVAL);
  }
  throw new Error(`Gave up waiting after ${POLL_ATTEMPTS} attempts`);
};

// Authenticated with a short-lived access token of a service account, issued in
// CI through Workload Identity Federation.
export const publishChrome = async (archive: Uint8Array<ArrayBuffer>) => {
  const api = 'https://chromewebstore.googleapis.com';
  const item = `publishers/${env('CWS_PUBLISHER_ID')}/items/${env('CWS_ITEM_ID')}`;
  const auth = { Authorization: `Bearer ${env('CWS_ACCESS_TOKEN')}` };

  type UploadState = 'SUCCEEDED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_FOUND' | 'UPLOAD_STATE_UNSPECIFIED';
  const upload = await (await ensureOk(await fetch(`${api}/upload/v2/${item}:upload`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/zip' },
    body: archive,
  }), 'Chrome upload')).json() as { uploadState: UploadState; crxVersion?: string };

  let state = upload.uploadState;
  if (state === 'IN_PROGRESS') {
    ({ lastAsyncUploadState: state } = await poll(
      async () => (await ensureOk(await fetch(`${api}/v2/${item}:fetchStatus`, { headers: auth }), 'Chrome status'))
        .json() as Promise<{ lastAsyncUploadState: UploadState }>,
      ({ lastAsyncUploadState }) => lastAsyncUploadState !== 'IN_PROGRESS',
    ));
  }
  if (state !== 'SUCCEEDED') throw new Error(`Chrome upload ended as ${state}`);
  console.log(`Chrome Web Store: uploaded version ${upload.crxVersion ?? '?'}`);

  const published = await (await ensureOk(await fetch(`${api}/v2/${item}:publish`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
  }), 'Chrome publish')).json() as { state: string; warningInfo?: unknown };

  if (published.warningInfo) console.warn('Chrome Web Store warnings:', JSON.stringify(published.warningInfo));
  if (!['PENDING_REVIEW', 'STAGED', 'PUBLISHED'].includes(published.state)) {
    throw new Error(`Chrome submission ended as ${published.state}`);
  }
  console.log(`Chrome Web Store: submission is ${published.state}`);
};
