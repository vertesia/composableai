import http from 'node:http';
import { LazyBody, type LazyBodyOpts } from '@koa-stack/body';
import { AbstractRouter } from '@koa-stack/router';
import Koa from 'koa';

declare module 'koa' {
    interface BaseContext {
        params: Record<string, string>;
    }
}

export abstract class AbstractKoaServer<T extends AbstractKoaServer<T>> extends AbstractRouter<T> {
    server?: http.Server;
    koa: Koa;

    constructor(koa: Koa = new Koa()) {
        super();
        this.koa = koa;
        // params is an alias to $touter.params
        Object.defineProperty(koa.context, 'params', {
            get() {
                return this.$router.params;
            },
        });
    }

    setup() {}

    onStart() {}

    onStop() {}

    /**
     * To be ble to use supertest directly with a KoaServer instance
     */
    address() {
        return this.server?.address();
    }

    withLazyBody(opts?: LazyBodyOpts) {
        LazyBody.install(this.koa, opts);
        return this;
    }

    callback() {
        return this.koa.callback();
    }

    createServer() {
        return http.createServer(this.callback());
    }

    installExitHooks() {
        const onSigExit = async () => {
            await this.stop();
            process.exit(0);
        };
        process.on('SIGINT', onSigExit);
        process.on('SIGTERM', onSigExit);
    }

    onServerListening() {
        // do nothing: you can print a server started message
    }

    async start(
        port: number,
        opts: {
            host?: string;
            backlog?: number;
            callback?: () => void;
        } = {},
    ) {
        await this.setup();
        // add routes
        this.koa.use(this.middleware());
        // install exit hooks
        if (this.onStart) {
            await this.onStart();
        }
        this.installExitHooks();
        // start http server
        return new Promise((resolve) => {
            this.server = this.createServer();
            this.server.listen(port, opts.host, opts.backlog, () => {
                this.onServerListening();
                if (opts.callback) opts.callback();
                resolve(this);
            });
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(async () => {
                    if (this.onStop) {
                        await this.onStop();
                    }
                    this.server = undefined;
                });
                resolve(null);
            }
        });
    }
}

export class KoaServer extends AbstractKoaServer<KoaServer> {}
