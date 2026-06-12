//add line numbers with {% addLineNumbers(content) %}
export function addLineNumbers(content: string) {
    const lines = content.split('\n');
    const width = Math.ceil(Math.log10(lines.length));
    return lines
        .map((line, index) => {
            const number = (index + 1).toString().padStart(width, ' ');
            return `{% ${number} %} ${line}`;
        })
        .join('\n');
}
