/**
 * String transformation utilities for derived variables
 */

/**
 * Convert string to PascalCase
 * Examples: "my-plugin" → "MyPlugin", "hello world" → "HelloWorld"
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[a-z]/, (char) => char.toUpperCase());
}

/**
 * Convert string to camelCase
 * Examples: "my-plugin" → "myPlugin", "hello world" → "helloWorld"
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * Convert string to kebab-case
 * Examples: "MyPlugin" → "my-plugin", "helloWorld" → "hello-world"
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Convert string to snake_case
 * Examples: "MyPlugin" → "my_plugin", "helloWorld" → "hello_world"
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

/**
 * Convert string to Title Case
 * Examples: "my-plugin" → "My Plugin", "hello_world" → "Hello World"
 */
export function toTitleCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Apply a transformation to a string value
 */
export function applyTransform(value: string, transform: string): string {
  switch (transform) {
    case 'pascalCase':
      return toPascalCase(value);
    case 'camelCase':
      return toCamelCase(value);
    case 'kebabCase':
      return toKebabCase(value);
    case 'snakeCase':
      return toSnakeCase(value);
    case 'titleCase':
      return toTitleCase(value);
    case 'upperCase':
      return value.toUpperCase();
    case 'lowerCase':
      return value.toLowerCase();
    default:
      throw new Error(`Unknown transform: ${transform}`);
  }
}

/**
 * Concatenate multiple values with a separator
 */
export function concatValues(values: string[], separator: string = ''): string {
  return values.join(separator);
}
