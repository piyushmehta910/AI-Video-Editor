// Auto-generated Zod schemas for LLM tools.
// This module builds a Zod schema for each tool defined in `src/api/llm/tools.ts`
// based on the JSON‑schema‑like `parameters` objects used by the tools.
// The `validateToolArgs` function can be used to validate tool arguments before
// execution.

import { z, ZodSchema } from 'zod';
import { DIRECTOR_TOOLS } from './tools';

/** Map of tool name → Zod schema for its arguments. */
const TOOL_SCHEMAS: Record<string, ZodSchema<any>> = {};

/** Helper to convert a simple JSON‑schema description to a Zod schema. */
function jsonSchemaToZod(schema: any): ZodSchema<any> {
  if (!schema || typeof schema !== 'object') return z.any();
  const { type, properties, required } = schema;
  if (type !== 'object' || !properties) return z.any();
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, propRaw] of Object.entries(properties)) {
    const prop = propRaw as Record<string, any>;
    let zProp: z.ZodTypeAny;
    switch (prop.type) {
      case 'string':
        if (Array.isArray(prop.enum) && prop.enum.length > 0) {
          zProp = z.enum(prop.enum as [string, ...string[]]);
        } else {
          zProp = z.string();
        }
        break;
      case 'number':
        zProp = z.number();
        break;
      case 'boolean':
        zProp = z.boolean();
        break;
      case 'array':
        zProp = z.array(z.any());
        break;
      case 'object':
        zProp = jsonSchemaToZod(prop);
        break;
      default:
        zProp = z.any();
    }
    if (prop.description) {
      zProp = zProp.describe(String(prop.description));
    }
    const isRequired = Array.isArray(required) && required.includes(key);
    if (!isRequired) {
      zProp = zProp.optional();
    }
    shape[key] = zProp;
  }
  return z.object(shape);
}

function ensureSchemasBuilt() {
  if (Object.keys(TOOL_SCHEMAS).length > 0) return;
  if (!Array.isArray(DIRECTOR_TOOLS)) return;
  for (const tool of DIRECTOR_TOOLS) {
    const name = tool.function.name;
    const params = tool.function.parameters;
    try {
      const schema = jsonSchemaToZod(params);
      TOOL_SCHEMAS[name] = schema;
    } catch {
      TOOL_SCHEMAS[name] = z.any();
    }
  }
}

/** Validate arguments for a given tool name.
 *  Returns `{ ok: true, cleaned }` when validation passes, otherwise `{ ok: false, error }`.
 */
export function validateToolArgs(name: string, args: Record<string, unknown>) {
  ensureSchemasBuilt();
  const schema = TOOL_SCHEMAS[name];
  if (!schema) {
    // No schema – treat as valid (fallback for dynamically added tools).
    return { ok: true, cleaned: args };
  }
  const result = schema.safeParse(args);
  if (result.success) {
    return { ok: true, cleaned: result.data };
  }
  return { ok: false, error: result.error.message };
}

export { TOOL_SCHEMAS };
