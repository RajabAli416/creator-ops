/** Parse / merge JSON description payload used by content_items. */

export function parseContentMeta(description) {
  if (!description) {
    return { text: '', meta: {} };
  }
  try {
    const parsed = JSON.parse(description);
    if (parsed && typeof parsed === 'object' && parsed._meta) {
      return { text: parsed.text || '', meta: { ...parsed._meta } };
    }
  } catch {
    /* plain text */
  }
  return { text: description, meta: {} };
}

export function mergeContentMeta(description, metaPatch) {
  const { text, meta } = parseContentMeta(description);
  const nextMeta = { ...meta, ...metaPatch };
  const hasMeta = Object.keys(nextMeta).some((k) => nextMeta[k] != null && nextMeta[k] !== '');
  if (!hasMeta && !text) return null;
  if (!hasMeta) return text || null;
  return JSON.stringify({ _meta: nextMeta, text });
}
