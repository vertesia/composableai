export function kebabCaseToTitle(name: string) {
    return name.split('-').map(p => p[0].toUpperCase() + p.substring(1)).join(' ');
}