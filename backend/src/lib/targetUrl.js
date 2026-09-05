function normalizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function extractFirstUrl(...contents) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;

  for (const content of contents) {
    if (!content || typeof content !== 'string') {
      continue;
    }

    const match = content.match(urlRegex);
    if (match?.[0]) {
      const normalized = normalizeUrl(match[0]);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function resolveTargetUrl({ targetUrl, text, caption }) {
  return normalizeUrl(targetUrl) || extractFirstUrl(text, caption);
}

module.exports = {
  normalizeUrl,
  extractFirstUrl,
  resolveTargetUrl,
};