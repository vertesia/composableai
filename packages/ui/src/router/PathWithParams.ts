export class PathWithParams {

    path: string;
    params: URLSearchParams;
    hash: string;

    constructor(path: string) {
        let i = path.lastIndexOf('#');
        if (i > -1) {
            this.hash = path.substring(i);
            path = path.substring(0, i);
        } else {
            this.hash = '';
        }
        i = path.indexOf('?');
        if (i > -1) {
            this.path = path.substring(0, i);
            this.params = new URLSearchParams(path.substring(i + 1));
        } else {
            this.path = path;
            this.params = new URLSearchParams();
        }
    }

    add(params: Record<string, string>) {
        for (const [key, value] of Object.entries(params)) {
            this.params.set(key, value);
        }
        return this;
    }
    toString() {
        return this.path + '?' + this.params.toString() + this.hash;
    }
}
