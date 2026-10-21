/**
 * Minimal Zod resolver for react-hook-form.
 * @hookform/resolvers is not on the approved library list (prompt.md §3.8),
 * so we connect RHF to our Zod schema directly (resolvers contract:
 * return { values } or { errors }).
 */
export function zodResolver(schema) {
  return async (values) => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      return { values: parsed.data, errors: {} };
    }
    const errors = {};
    for (const issue of parsed.error.issues) {
      const name = issue.path[0];
      if (!errors[name]) {
        errors[name] = { type: 'schema', message: issue.message };
      }
    }
    return { values: {}, errors };
  };
}
