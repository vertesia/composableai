# Layout System Knowledge

## Overview
The layout system provides a flexible way to define table and grid layouts for content objects and documents.

## Column Layout System

### Column Layout Definition
```typescript
interface ColumnLayout {
    name: string;       // Display name of the column
    field: string;      // Dot notation path to the data field
    fallback?: string;  // Fallback field if primary is empty
    type?: string;      // Data type for the column
    default?: any;      // Default value if field is undefined
}
```

### Field Path Notation
- Uses dot notation to access nested properties
- Example: `properties.title` accesses title in properties object
- Special path "." returns the entire object
- Supports fallback fields with the `fallback` property
- Nested paths: `user.profile.name`
- Array access: `items.0.name`

### Available Column Types
Complete list of supported types:

1. **string** - Text display
2. **number** - Numeric display
3. **date** - Date/time display
4. **objectId** - object id with preview button
5. **objectName** - object name display

### Column Types and Renderers
Built-in renderers with parameters:

1. **string**
   - `slice`: Take substring from index
   - `max_length`: Maximum string length
   - `upper`: Convert to uppercase
   - `lower`: Convert to lowercase
   - `capitalize`: Capitalize first letter
   - `ellipsis`: Add ... at end

2. **number**
   - `currency`: Format as currency (e.g., USD)
   - `decimals`: Number of decimal places (default: 2)

3. **date**
   - `localized`: Use localized format (e.g., "LLL")
   - `relative`: Use relative time ("fromNow"/"toNow")

4. **objectId**
   - `slice`: Take substring from index


### Parameter Syntax
Parameters are added using URL query string syntax:
```typescript
"type": "string?max_length=50&ellipsis"
"type": "number?currency=USD&decimals=2"
"type": "date?relative=fromNow"
```

## Layout Configuration Examples

### Basic Table Layout
```json
{
  "layout": [
    {
      "name": "Title",
      "field": "properties.title",
      "fallback": "name",
      "type": "string"
    },
    {
      "name": "Created",
      "field": "created_at",
      "type": "date?relative=fromNow"
    }
  ]
}
```

### Complex Table Layout
```json
{
  "layout": [
    {
      "name": "ID",
      "field": "id",
      "type": "objectId?slice=-7"
    },
    {
      "name": "Name",
      "field": ".",
      "type": "objectName"
    },
    {
      "name": "Price",
      "field": "price",
      "type": "number?currency=USD&decimals=2",
      "default": 0
    },
    {
      "name": "Status",
      "field": "status",
      "type": "string?upper=true"
    },
    {
      "name": "Last Update",
      "field": "updated_at",
      "type": "date?localized=LLL"
    }
  ]
}
```

### Search Results Layout
```json
{
  "layout": [
    {
      "name": "Document",
      "field": ".",
      "type": "objectName"
    },
    {
      "name": "Score",
      "field": "score",
      "type": "number?decimals=3"
    },
    {
      "name": "Type",
      "field": "type",
      "type": "typeLink"
    }
  ]
}
```

## Common Error Cases

### Field Path Errors
- Invalid path: Using undefined nested properties
- Wrong case: Property names are case-sensitive
- Missing fallback: No fallback for potentially undefined fields

### Type Parameter Errors
- Invalid parameter names: Using undefined parameters
- Wrong parameter values: Using incorrect value types
- Missing required parameters: Not providing required parameters

### Best Practices to Avoid Errors
- Always validate field paths exist in your data
- Provide fallbacks for optional fields
- Use type parameters appropriately
- Test layouts with empty/null data
- Verify parameter values are correct

## Grid Layout System

### Document Grid Layout
- Supports responsive grid layouts
- Default configuration: `lg:grid-cols-6`
- Handles document icons and empty states
- Supports drag and drop functionality

### Grid Layout Features
- Responsive column sizing
- Empty state handling
- Loading states
- Drag and drop file upload
- Type selection modal integration

## Best Practices

### Column Definition
- Always provide a name for clarity
- Use fallbacks for critical fields
- Specify type when needed for formatting
- Keep field paths simple and clear
- Use type parameters for fine-grained control

### Layout Implementation
- Use consistent naming conventions
- Implement proper loading states
- Handle empty states gracefully
- Support responsive layouts
- Consider selection requirements

### Data Access
- Use dot notation for nested data
- Provide fallback values
- Handle missing data gracefully
- Support type-safe access
- Use default values where appropriate

## Validation Rules

### Field Names
- Must be valid JavaScript property names
- Case-sensitive
- No spaces or special characters (except dots)

### Type Names
- Must be one of the defined types
- Case-sensitive
- Parameters must be valid for the type

### Parameter Values
- Must match expected types
- Numbers must be valid numbers
- Booleans must be "true" or "false"
- Strings must be properly escaped

## Integration Points

### With Search Results
- Used in SearchResults component
- Supports filtering and sorting
- Handles pagination
- Supports custom layouts

### With Document Display
- Used in DocumentGridLayout
- Supports document icons
- Handles file uploads
- Manages type selection

### With Selection System
- Supports single/multi select
- Range selection with shift-click
- Selection persistence
- Selection change callbacks