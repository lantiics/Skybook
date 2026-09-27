import { READER, WRITER } from "../db.ts";
import { RequestContext } from "../types/context.ts";
import { Field, Instance, Mutable } from "../types/entities.ts";
import { RESERVED_COLUMN_NAMES } from "../defaults.ts";
import {
  BadRequestError,
  ReservedError,
  UnauthorizedError,
} from "../errors.ts";
import { config } from "../config.ts";
const allWritableFields = async (
  instance: Instance["name"],
): Promise<Set<string>> => {
  const dbFields = new Set(["content", "author"]);
  const additionalFields =
    await READER`SELECT instance,name,is_public,is_special,is_required,replacement,filter FROM fields WHERE instance = ${instance}`;
  if (additionalFields !== "{}") {
    for (const field of additionalFields as Field[]) {
      dbFields.add(field.name);
    }

    return dbFields as Set<string>;
  }
  return dbFields;
};
export const allFieldsAreWritable = async (
  instance: Instance["name"],
  fields: string[],
) => {
  const writableFields = await allWritableFields(instance);
  return writableFields.isSupersetOf(new Set(fields));
};
export const getFieldData = async (
  instance: Instance["name"],
): Promise<Field[]> => {
  const fields: Field[] =
    await READER`SELECT name, is_required, replacement, filter FROM fields WHERE instance = ${instance} AND is_public`;
  const defaultFields = [
    {
      name: "author",
      is_required: false,
      replacement: "anonymous",
      filter: null,
    },
    { name: "content", is_required: true, replacement: null, filter: null },
  ];
  const merged = fields.concat(
    defaultFields.filter(
      (defaultField) =>
        !fields.some((field) => field.name === defaultField.name),
    ) as unknown as ConcatArray<Field>,
  );
  return merged;
};
const fieldNameAccepted = (name: string): boolean => {
  if (
    RESERVED_COLUMN_NAMES.has(name as any) ||
    name.length > config.fields.name_max_length
  )
    return false;
  return true;
};
export const setField = async (
  instance: Instance["name"],
  field: Partial<Field> & Required<Pick<Field, "name">>,
): Promise<Field> => {
  if (field.name === "content" && (field.is_required || field.replacement)) {
    throw new BadRequestError(
      "Unable to alter required/replacement status for field 'content'",
    );
  }
  if (
    !["content", "author"].includes(field.name) &&
    !fieldNameAccepted(field.name)
  )
    throw new BadRequestError("Provided field name is not accepted");
  if ((await instanceFieldCount(instance)) > config.fields.max_count)
    throw new BadRequestError("Maximum amount of fields reached");
  const record: Partial<Mutable<Field>> = {
    instance: instance,
    name: field.name,
    is_required: field.is_required,
  };
  if (field.replacement) {
    record.replacement = field.replacement;
  }
  if (field.filter) {
    if (field.filter.length > config.fields.max_filter_length)
      throw new BadRequestError(
        "Field filter is above maximum character length",
      );
    record.filter = field.filter;
  }
  return (
    await WRITER`INSERT INTO fields ${WRITER(record)}
  ON CONFLICT (instance, name) DO UPDATE SET ${WRITER(record)}
  RETURNING *`
  )[0];
};
export const instanceFieldCount = async (
  instance: Instance["name"],
  DB = READER,
): Promise<number> => {
  const [count] =
    await DB`SELECT COUNT(*) FROM fields WHERE instance = ${instance} AND name NOT IN ('content','author')`;
  return count.count;
};
export const renameField = async (
  ctx: RequestContext,
  oldName: string,
  newName: string,
) => {
  if (!fieldNameAccepted(newName)) {
    throw new UnauthorizedError("Provided field name is not accepted");
  }
  return await WRITER.begin(async (tx) => {
    const [field] =
      await tx`UPDATE fields SET name = ${newName} WHERE name = ${oldName} AND instance = ${ctx.instance}`;
    await tx`UPDATE posts SET extra = extra - ${oldName} || jsonb_build_object(${newName}::text, extra -> ${oldName}) WHERE extra ? ${oldName} AND instance = ${ctx.instance}`;
    return field;
  });
};

export const deleteField = async (
  instance: Instance["name"],
  name: string,
): Promise<void> => {
  if (RESERVED_COLUMN_NAMES.has(name as any)) {
    throw new ReservedError("Cannot delete a system reserved field");
  }
  await WRITER.begin(async (tx) => {
    await tx`DELETE FROM fields WHERE name = ${name} AND instance = ${instance};`;
    await tx`UPDATE posts SET extra = extra - ${name} WHERE instance = ${instance}`;
  });
};

export const setFieldFilter = (
  ctx: RequestContext,
  field: string,
  filter: RegExp,
) => {
  if (filter.toString().length > config.fields.max_filter_length)
    throw new BadRequestError(
      "Provided filter character length is above limit",
    );
  try {
    new RegExp(filter);
  } catch {
    throw new BadRequestError(
      "Provided regular expression for field filter is invalid",
    );
  }
  WRITER`UPDATE FIELDS SET filter = ${filter} WHERE name = ${field} AND instance = ${
    ctx.instance
  }`;

  return { field: field, filter: filter };
};

export const getFieldFilters = (ctx: RequestContext) => {
  return READER`SELECT name, filter FROM fields WHERE instance = ${ctx.instance}`;
};
