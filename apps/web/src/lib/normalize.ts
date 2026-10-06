/**
 * Adapters between the raw API payloads and the shapes the UI is written against.
 *
 * The backend returns database-shaped rows wrapped in single-key envelopes
 * (`{ projects: [...] }`, `{ organization: {...} }`) with flat member rows
 * (`name`, `email`, `user_id`). The UI types (see `types/api.types.ts`) expect bare
 * arrays/objects with nested `user`/`group` objects and `full_name`/`is_verified`.
 *
 * Every transformation here is additive: existing keys are never removed or
 * overwritten, so consumers of the original fields keep working.
 */

type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

/** Single-key envelope names the API uses around its payloads. */
const ENVELOPE_KEYS = new Set([
  'organizations',
  'organization',
  'projects',
  'project',
  'members',
  'member',
  'groups',
  'group',
  'documents',
  'document',
  'invitations',
  'invitation',
  'membership',
  'rule',
]);

/** Keys whose values are opaque, user-defined payloads that must not be reshaped. */
const OPAQUE_KEYS = new Set(['metadata']);

/** `{ projects: [...] }` -> `[...]`; anything else is returned untouched. */
export function unwrapEnvelope<T = unknown>(data: unknown): T {
  if (isPlainObject(data)) {
    const keys = Object.keys(data);
    if (keys.length === 1 && ENVELOPE_KEYS.has(keys[0])) {
      return data[keys[0]] as T;
    }
  }
  return data as T;
}

function decorate(source: PlainObject): PlainObject {
  const o = source;

  // Users (and anything user-like): `name` -> `full_name`, `email_verified_at` -> `is_verified`
  if (isString(o.name) && isString(o.email) && o.full_name === undefined) {
    o.full_name = o.name;
  }
  if ('email_verified_at' in o && o.is_verified === undefined) {
    o.is_verified = Boolean(o.email_verified_at);
  }

  // Organizations / projects: `user_role` -> `role`
  if (o.role === undefined && isString(o.user_role)) {
    o.role = o.user_role;
  }

  // Organization member rows are keyed by `membership_id`
  if (o.id === undefined && isString(o.membership_id)) {
    o.id = o.membership_id;
  }

  // Flat member rows (org / project / group): nest the profile under `user`
  if (o.user === undefined && isString(o.user_id) && isString(o.email)) {
    o.user = {
      id: o.user_id,
      email: o.email,
      full_name: isString(o.name) ? o.name : o.email,
      ...(isString(o.org_role) ? { org_role: o.org_role } : {}),
    };
  }

  // Document user rules carry `user_name` / `user_email`
  if (o.user === undefined && isString(o.user_id) && isString(o.user_email)) {
    o.user = {
      id: o.user_id,
      email: o.user_email,
      full_name: isString(o.user_name) && o.user_name ? o.user_name : o.user_email,
    };
  }

  // Document group rules carry `group_name`
  if (o.group === undefined && isString(o.group_id) && isString(o.group_name)) {
    o.group = { id: o.group_id, name: o.group_name };
  }

  // RAG source citations
  if (isString(o.document_name) && isString(o.chunk_id)) {
    if (o.id === undefined) o.id = o.chunk_id;
    if (o.document_title === undefined) o.document_title = o.document_name;
    if (o.content_excerpt === undefined && isString(o.excerpt)) o.content_excerpt = o.excerpt;
    if (o.similarity === undefined && typeof o.similarity_score === 'number') {
      o.similarity = o.similarity_score;
    }
  }

  return o;
}

/** Recursively applies `decorate` to every plain object in a payload. */
export function normalizeDeep<T = unknown>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDeep(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const copy: PlainObject = {};
    for (const [key, child] of Object.entries(value)) {
      copy[key] = OPAQUE_KEYS.has(key) ? child : normalizeDeep(child);
    }
    return decorate(copy) as T;
  }
  return value;
}

/** Convenience: unwrap the envelope, then normalize. */
export function shapeResponse<T = unknown>(data: unknown): T {
  return normalizeDeep(unwrapEnvelope(data)) as T;
}
