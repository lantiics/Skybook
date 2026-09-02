import { DB } from "../db.ts";
import { RequestContext } from "../types/context.ts";
import { Field } from "../types/entities.ts";
import { RESERVED_COLUMN_NAMES } from "../defaults.ts";
import { ReservedError, UnauthorizedError } from "../errors.ts";
const allWritableFields = async (instance: string): Promise<Set<string>> => {
  console.log("meoww");
  const dbFields = new Set(["content", "author", "parent"]);
  const [additionalFields] =
    await DB`SELECT * FROM fields WHERE instance = ${instance}`;
  for (const field of additionalFields as Field[]) {
    dbFields.add(field.name);
  }

  return dbFields as Set<string>;
};
export const allFieldsAreWritable = async (
  instance: string,
  fields: string[],
) => {
  const writableFields = await allWritableFields(instance);
  return writableFields.isSupersetOf(new Set(fields));
};
// const allFieldsAreAccepted = async (
//   fields: Record<string, string | [string, string][]>,
// ) => {
//   for (const [name, content] of Object.entries(fields)) {
//   }
// };
const fieldNameAccepted = (name: string): boolean => {
  //
  //
  return !RESERVED_COLUMN_NAMES.has(name as any);
};
export const setField = async (
  ctx: RequestContext,
  field: Field,
): Promise<Field> => {
  if (!fieldNameAccepted(field.name)) {
    throw new UnauthorizedError(
      "Provided field name is reserved by the system",
    );
  }
  return (
    await DB`INSERT INTO fields ${DB(field)} WHERE instance = ${ctx.instance} RETURNING *`
  )[0];
};
export const renameField = async (
  ctx: RequestContext,
  oldName: string,
  newName: string,
) => {
  if (!fieldNameAccepted(newName)) {
    throw new UnauthorizedError(
      "Provided field name is reserved by the system",
    );
  }
  return await DB.begin(async (tx) => {
    const [field] =
      await tx`UPDATE fields SET name = ${newName} WHERE name = ${oldName} AND instance = ${ctx.instance}`;
    await tx`UPDATE posts SET extra = extra - ${oldName} || jsonb_build_object(${newName}, extra -> ${oldName}) WHERE extra ? ${oldName} AND instance = ${ctx.instance}`;
    return field;
  });
};

const deleteField = async (
  ctx: RequestContext,
  name: string,
): Promise<void> => {
  if (RESERVED_COLUMN_NAMES.has(name as any)) {
    throw new ReservedError("Cannot delete a system reserved field");
  }
  await DB.begin(async (tx) => {
    await tx`DELETE FROM fields WHERE name = ${name} AND instance = ${ctx.instance};`;
    await tx`UPDATE posts SET extra = extra - ${name} WHERE instance = ${ctx.instance}`;
  });
};

export const setFieldFilter = (
  ctx: RequestContext,
  field: string,
  filter: RegExp,
) => {
  if (!RegExp(filter)) {
    throw new SyntaxError("Provided regex is invalid");
  }
  DB`UPDATE FIELDS SET filter = ${filter} WHERE name = ${field} AND instance = ${
    ctx.instance
  }`;

  return { field: field, filter: filter };
};

export const getFieldFilters = (ctx: RequestContext) => {
  return DB`SELECT name, filter FROM fields WHERE instance = ${ctx.instance}`;
};

//
//
//
//#region VERIFY
const canAlterField = async (ctx: RequestContext, field: Field) => {
  if (field.name in RESERVED_COLUMN_NAMES) {
    throw new UnauthorizedError("Attempted to alter a reserved column");
  }
  return true;
};

// const validateFieldSafety = (name: string, field: Field): Field => {
//   if (Object.keys(defaultFields).includes(name)) {
//     const err = new Error("Attempted to alter default field");
//     err.name = "UnsafeFieldError";
//     throw err;
//   }
//   const allowedKeys = new Set([
//     "name",
//     "type",
//     "public",
//     "special",
//     "required",
//     "replacement",
//     "filter",
//   ]);

//   if (Object.keys(field).filter((k) => !allowedKeys.has(k)).length > 0) {
//     throw new Error(
//       "Unauthorized keys inputted while attempting field creation",
//     );
//   }

//   if (
//     !isSafeSQLString(name) ||
//     !isSafeSQLString(field.replacement ?? "UNSET")
//   ) {
//     throw new Error(
//       "At least one string supplied for field alteration is unsafe",
//     );
//   }
//   field.type = "TEXT";
//   if (field.required) {
//     field.type += " NOT NULL";
//   }
//   if (field.replacement) {
//     field.type += " DEFAULT " + field.replacement;
//   }
//   field.special = false;
//   field.public = true;
//   field.name = name;
//   return field;
// };

// Ensure all specified fields are able to be publicly inputted
// const allFieldsAreAccepted = (
//   providedFields: Record<string, string>,
// ): boolean => {
//   if (!allFieldsExist(Object.keys(providedFields))) {
//     return false;
//   }

//   if (fieldsFiltered(providedFields, fields)) {
//     return false;
//   }

//   const disallowedFields = Object.values(fields)
//     .filter((field) => !field.public || field.special)
//     .map((field) => field.name);

//   return Object.keys(providedFields).every(
//     (key) => !disallowedFields.includes(key),
//   );
// };

// const allFieldsExist = (fields: string[]): boolean => {
//   return [
//     ...Object.values(PUBLIC_COLUMN_NAMES),
//     ...Object.values(PRIVATE_COLUMN_NAMES),
//     ...Object.values(SYSTEM_COLUMN_NAMES),
//   ].every((field) => fields.includes(field));
// };

// Filter fields against their individual regex patterns
// const fieldsFiltered = (
//   providedFields: Record<string, string>,
//   fields: Record<string, Field>,
// ): boolean => {
//   const filters = Object.entries(fields)
//     .filter(
//       (entry): entry is [string, Field & { filter: RegExp }] =>
//         !!entry[1].filter,
//     )
//     .map(([name, config]) => ({ name, filter: config.filter }));
//   console.log(filters, providedFields);
//   return Object.entries(providedFields).every(([key, value]) => {
//     const rule = filters.find(({ name }) => name === key);
//     return !rule || value.match(rule.filter);
//   });
// };
