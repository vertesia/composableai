export type PathMatchParams = Record<string, string> & {
    _?: string[];
};

export function isRootPath(path: string) {
    return path === '/' || path === '';
}

export function joinPath(path1: string, path2: string) {
    if (path1.endsWith('/') && path2.startsWith('/')) {
        path2 = path1 + path2.substring(1);
    } else if (path1.endsWith('/')) {
        path2 = path1 + path2;
    } else if (path2.startsWith('/')) {
        path2 = path1 + path2;
    } else {
        path2 = `${path1}/${path2}`;
    }
    return path2;
}

/**
 * The mount base path from an explicit `<base href>` element, or `''` when there is none.
 *
 * Apps served under a deep gateway mount carry `<base href="/tenants/.../app/">`, injected at serve
 * time. The router otherwise resolves absolute routes against the origin, which collapses the URL
 * off the mount (and breaks in-app links). This returns the base pathname without a trailing slash
 * so {@link withMountBasename} can keep navigation under the mount and {@link stripMountBasename}
 * can match routes app-relative. The Studio UI has no `<base>` element, so this returns `''` and
 * every caller becomes a no-op there.
 */
export function getMountBasename(): string {
    if (typeof document === 'undefined') return '';
    const base = document.querySelector('base[href]') as HTMLBaseElement | null;
    if (!base) return '';
    try {
        return new URL(base.href, document.URL).pathname.replace(/\/+$/, '');
    } catch {
        return '';
    }
}

/** Prepend the mount basename to an absolute app path (no-op when no mount, path is relative, or already prefixed). */
export function withMountBasename(path: string): string {
    const base = getMountBasename();
    if (!base || !path.startsWith('/')) return path;
    if (path === base || path.startsWith(`${base}/`)) return path;
    return joinPath(base, path);
}

/** Strip the mount basename from a browser path so route patterns match app-relative (no-op when no mount). */
export function stripMountBasename(path: string): string {
    const base = getMountBasename();
    if (!base) return path;
    if (path === base) return '/';
    if (path.startsWith(`${base}/`)) return path.slice(base.length) || '/';
    return path;
}

export function getPathSegments(path: string) {
    if (path === '') {
        return [];
    }
    if (path === '/') {
        return [''];
    }
    let s = 0,
        e = path.length;
    if (path.startsWith('./')) {
        s = 2;
    } else if (path.startsWith('/')) {
        s = 1;
    }
    if (path.endsWith('/')) {
        e = path.length - 1;
    }
    return (s > 0 || e < path.length ? path.substring(s, e) : path).split('/');
}

export function toSegments(path: string | string[]) {
    if (typeof path === 'string') {
        return getPathSegments(path);
    } else if (Array.isArray(path)) {
        return path;
    } else {
        throw new Error(`Unsupported path object: ${path}`);
    }
}

// export class Path {

//     static parse(path: string, abs = false) {
//         if (abs !== undefined) {
//             abs = path.startsWith('/');
//         }
//         return new Path(getPathSegments(path), abs);
//     }

//     constructor(public segments: string[], public isAbsolute = false) {
//     }

//     getParameters() {
//         const out = [];
//         for (const segment of this.segments) {
//             if (segment[0] === ':') {
//                 out.push(segment.substring(1));
//             }
//         }
//         if (this.segments[this.segments.length - 1] === '*') {
//             out.push('_');
//         }
//         return out;
//     }

//     resolveParameters(path: string) {
//         const params: PathMatchParams = {};
//         const resolvedSegments = getPathSegments(path);
//         if (resolvedSegments.length < this.segments.length) {
//             return null;
//         }
//         const segments = this.segments;
//         for (let i = 0, l = segments.length; i < l; i++) {
//             const seg = segments[i];
//             if (seg[0] === ':') {
//                 params[seg.substring(1)] = resolvedSegments[i];
//             }
//         }
//         if (resolvedSegments.length - this.segments.length) {
//             params._ = resolvedSegments.slice(this.segments.length);
//         }
//         return params;
//     }

//     match(path: string | string[] | Path) {
//         const segments = toSegments(path);
//         if (segments.length < this.segments.length) {
//             return false;
//         }
//         let params: PathMatchParams | undefined;
//         const mySegments = this.segments;
//         for (let i = 0, l = mySegments.length; i < l; i++) {
//             const segment = mySegments[i];
//             if (segment === ':') {
//                 if (!params) params = {};
//                 params[segment.substring(1)] = segment;
//             } else if (segment !== segments[i]) {
//                 if (i === l - 1 && segment === '*') {
//                     if (!params) params = {};
//                     params._ = segments.slice(i);
//                     return params;
//                 }
//                 return false;
//             }
//         }
//         return params ? params : false;
//     }

//     join(path: Path | string | string[]) {
//         const segments = toSegments(path);
//         return new Path(this.segments.concat(segments), this.isAbsolute);
//     }

//     getRelativePath(path: Path | string | string[], asAbsolute: boolean = false) {
//         const segments = toSegments(path);
//         const extraSegmentsCount = segments.length - this.segments.length;
//         if (extraSegmentsCount <= 0) {
//             return null;
//         }
//         return new Path(segments.slice(this.segments.length), asAbsolute);
//     }

//     prependSegments(segments: string[]) {
//         this.segments = segments.concat(this.segments);
//     }

//     appendSegments(segments: string[]) {
//         this.segments = this.segments.concat(segments);
//     }

//     toAbsolutePath() {
//         return '/' + this.segments.join('/');
//     }

//     toRelativePath() {
//         return this.segments.join('/');
//     }

//     toString() {
//         const path = this.segments.join('/');
//         return this.isAbsolute ? '/' + path : path;
//     }

// }
