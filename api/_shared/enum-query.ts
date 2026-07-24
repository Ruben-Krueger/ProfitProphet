/**
 * Narrow a raw query-string value to a member of an enum.
 *
 */
export const isEnumValue = <T extends Record<string, string>>(
  enumObject: T,
  value: string
): value is T[keyof T] => Object.values(enumObject).includes(value);
