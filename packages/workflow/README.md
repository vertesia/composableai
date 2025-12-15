# @vertesia/workflow

Workflow DSL and Temporal activities for the Vertesia platform. This package contains the building blocks for document processing pipelines, content extraction, and AI-powered workflows.

## Installation

```bash
npm install @vertesia/workflow
# or
pnpm add @vertesia/workflow
```

## Subpath Exports

The package provides several subpath exports for different use cases:

```typescript
// Main exports - activity functions and utilities
import { ... } from "@vertesia/workflow";

// Temporal activities for worker registration
import { ... } from "@vertesia/workflow/activities";

// DSL-specific activities
import { ... } from "@vertesia/workflow/dsl-activities";

// Workflow definitions for Temporal
import { dslWorkflow, iterativeGenerationWorkflow } from "@vertesia/workflow/workflows";

// Pre-bundled workflows for Temporal workers
import { ... } from "@vertesia/workflow/workflows-bundle";

// DSL types and utilities
import { ... } from "@vertesia/workflow/dsl";

// Error types
import { ... } from "@vertesia/workflow/errors";
```

## Activities

The package includes activities for document processing:

- **extractDocumentText** - Extract text content from documents
- **chunkDocument** - Split documents into chunks for processing
- **generateEmbeddings** - Generate vector embeddings for content
- **generateDocumentProperties** - Extract metadata and properties using AI
- **generateOrAssignContentType** - Automatically detect or assign content types
- **executeInteraction** - Run Vertesia interactions
- **generateImageRendition** - Create image renditions (thumbnails, previews)
- **generateVideoRendition** - Create video renditions
- **notifyWebhook** - Send webhook notifications
- **setDocumentStatus** - Update document processing status

## Workflows

Pre-built workflows for common patterns:

- **dslWorkflow** - Execute DSL-defined workflow pipelines
- **iterativeGenerationWorkflow** - Iterative content generation with refinement
- **recalculateEmbeddingsWorkflow** - Bulk embedding recalculation

## License

Apache-2.0
