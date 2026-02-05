import { ContentTypesCollection } from '@vertesia/tools-sdk';
import { ArticleType } from './article.js';
import icon from './icon.svg.js';

const ExampleTypes = new ContentTypesCollection({
    name: "examples",
    title: "Example Content Types",
    description: "A collection of content types examples",
    icon,
    types: [ArticleType]
});

export { ExampleTypes };
//# sourceMappingURL=index.js.map
