const SHA_PATTERN = /^[a-f0-9]{7,64}$/i;

export function currentReleaseSha(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = [
    env.VERCEL_GIT_COMMIT_SHA,
    env.GITHUB_SHA,
    env.COMMIT_SHA,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim() ?? '';
    if (SHA_PATTERN.test(value)) return value.toLowerCase();
  }

  throw new Error('RELEASE_SHA_UNAVAILABLE');
}
