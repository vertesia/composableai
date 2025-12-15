# @vertesia/json

JSON utilities for TypeScript, including type definitions and object traversal with the visitor pattern.

## Features

- **JSON Type Definitions**: Strict TypeScript types for JSON values
- **Object Walker**: Traverse nested objects and arrays using the visitor pattern
- **Async Support**: Async object walker for asynchronous operations during traversal
- **Map Function**: Transform object values while preserving structure

## Installation

```bash
npm install @vertesia/json
# or
pnpm add @vertesia/json
```

## Usage

### JSON Types

Strict TypeScript types for JSON values:

```typescript
import type {
  JSONPrimitive,  // string | number | boolean | null
  JSONArray,      // JSONValue[]
  JSONObject,     // { [key: string]: JSONValue }
  JSONComposite,  // JSONArray | JSONObject
  JSONValue       // JSONPrimitive | JSONComposite
} from '@vertesia/json';

function processJson(data: JSONValue) {
  // Type-safe JSON handling
}
```

### Object Walker

Traverse objects using the visitor pattern:

```typescript
import { ObjectWalker } from '@vertesia/json';

const data = {
  name: 'John',
  tags: ['admin', 'user'],
  metadata: {
    created: '2024-01-01',
    count: 42
  }
};

const walker = new ObjectWalker();

walker.walk(data, {
  onStartObject: (key, value) => {
    console.log(`Start object: ${key}`);
  },
  onEndObject: (key, value) => {
    console.log(`End object: ${key}`);
  },
  onStartIteration: (key, value) => {
    console.log(`Start array: ${key}`);
  },
  onEndIteration: (key, value) => {
    console.log(`End array: ${key}`);
  },
  onValue: (key, value) => {
    console.log(`Value: ${key} = ${value}`);
  }
});
```

### Map Values

Transform values while preserving structure:

```typescript
import { ObjectWalker } from '@vertesia/json';

const data = {
  name: 'John',
  age: 30,
  scores: [85, 90, 78]
};

const walker = new ObjectWalker();
const result = walker.map(data, (key, value) => {
  if (typeof value === 'number') {
    return value * 2;
  }
  return value;
});

// result: { name: 'John', age: 60, scores: [170, 180, 156] }
```

### Async Object Walker

For asynchronous operations during traversal:

```typescript
import { AsyncObjectWalker } from '@vertesia/json';

const walker = new AsyncObjectWalker();

await walker.walk(data, {
  onValue: async (key, value) => {
    if (typeof value === 'string') {
      await processString(value);
    }
  }
});

// Async map
const result = await walker.map(data, async (key, value) => {
  if (typeof value === 'string') {
    return await translateText(value);
  }
  return value;
});
```

### Iterator Support

Enable support for iterables beyond arrays:

```typescript
const walker = new ObjectWalker(true); // Enable iterator support

const data = {
  items: new Set([1, 2, 3])
};

walker.walk(data, {
  onValue: (key, value) => {
    console.log(key, value);
  }
});
```

## API Reference

### Types

| Type | Description |
|------|-------------|
| `JSONPrimitive` | `string \| number \| boolean \| null` |
| `JSONArray` | `JSONValue[]` |
| `JSONObject` | `{ [key: string]: JSONValue }` |
| `JSONComposite` | `JSONArray \| JSONObject` |
| `JSONValue` | `JSONPrimitive \| JSONComposite` |

### ObjectWalker

| Method | Description |
|--------|-------------|
| `walk(obj, visitor)` | Traverse object with visitor callbacks |
| `map(obj, mapFn)` | Transform values while preserving structure |

### ObjectVisitor Callbacks

| Callback | Description |
|----------|-------------|
| `onStartObject(key, value)` | Called when entering an object |
| `onEndObject(key, value)` | Called when leaving an object |
| `onStartIteration(key, value)` | Called when entering an array/iterable |
| `onEndIteration(key, value)` | Called when leaving an array/iterable |
| `onValue(key, value)` | Called for primitive values |

### AsyncObjectWalker

Same API as `ObjectWalker` but all visitor callbacks and map functions return Promises.

## License

Apache-2.0
