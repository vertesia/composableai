import Handlebars from 'handlebars';

Handlebars.registerHelper('_now', () => new Date().toISOString());

Handlebars.registerHelper('stringify', (value: unknown) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return new Handlebars.SafeString(JSON.stringify(value));
});

export function renderHandlebarsTemplate(template: string, input: unknown): string {
    // lazy load handlebars to speed up initial loading
    const compiled = Handlebars.compile(template);
    return compiled(input);
}
