import { createReadStream, existsSync } from "fs";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { Duplex, PassThrough } from "stream";
import { Err, None, Ok, Option, Result, Some } from "./rustl";

export interface Request {
    url: URL,
    server: Server,
    headers: Map<string, string[]>,
    body: NodeJS.ReadableStream,
    method: string,
}

export interface Response {
    code: number,
    headers: Map<string, string[]>,
    body: NodeJS.ReadableStream,
}

export type Listener = (url: URL, server: Server) => Promise<Result<void>>;
export type Handler = (req: Request, filepath: string) => Promise<Result<Response>>;

export class Server {
    public name: string = "";
    public description: string = "";

    private static listenerTypes = new Map<string, Listener>();
    private static filetypeHandler = new Map<string, Handler>();
    private static extensions = new Map<string, string>(require("./extensions"));

    public constructor(public readonly root: string) {}

    private async exists(path: string): Promise<Option<string>> {
        path = join(this.root, "web", join("/", path));
        if (existsSync(path)) return Some(path);
        if (!existsSync(join(path, ".."))) return None;

        let match;
        if (!(match = path.match(/([^\\\/.]*)(?:\.([^\\\/]*))?[\\\/]*$/))) return None;
        const [,filename] = match;
        for (const file of await readdir(join(path, ".."))) {
            if (!file.includes(".")) continue;
            if (file.slice(0, file.lastIndexOf(".")) == filename) return Some(join(path, "..", file));
        }
        return None;
    }

    public static getMimeTypeFor(ext: string) {
        return this.extensions.get(ext) || `text/${ext}`;
    }

    public static handle(handler: Handler, ...extensions: string[]) {
        extensions.forEach(ext => {
            this.filetypeHandler.set(ext, handler);
        });
    }

    public async handle(req: Request): Promise<Result<Response>> {
        const headers = new Map<string, string[]>();
        const body = new PassThrough();
        let code = 200;
        let path = join("/", req.url.pathname);

        headers.set("X-Provided-By", ["ess"]);
        headers.set("Server", ["ess"]);

        let file;
        if ((file = await this.exists(path)).empty) {
            body.write("Not found");
            body.end();
            headers.set("Content-Type", ["text/plain"]);
            headers.set("Content-Length", ["9"]);
            code = 404;
            return Ok({
                code,
                body,
                headers,
            });
        }

        let fstat = await stat(file.value);

        if (fstat.isDirectory()) {
            path = join(path, "index.html");
            if ((file = await this.exists(path)).empty || (fstat = await stat(file.value)).isDirectory()) {
                body.write("Not found");
                body.end();
                headers.set("Content-Type", ["text/plain"]);
                headers.set("Content-Length", ["9"]);
                code = 404;
                return Ok({
                    code,
                    body,
                    headers,
                });
            }
        }

        if (file.empty) return Err(Error("Missing filepath"));

        const [,filename, ext] = file.value.match(/([^\\\/.]*)(?:\.([^\\\/]*))?[\\\/]*$/) || [];
        if (!filename || !ext) return Err(Error("Failed to parse filepath"));

        if (!Server.filetypeHandler.has(ext)) {
            headers.set("Content-Type", [Server.getMimeTypeFor(ext)]);
            headers.set("Content-Length", [fstat.size.toString()]);
            createReadStream(file.value).pipe(body);
            return Ok({
                code,
                body,
                headers,
            });
        }

        const resp = await Server.filetypeHandler.get(ext)!({
            body: req.body,
            headers: req.headers,
            method: req.method,
            server: this,
            url: req.url,
        }, file.value);

        if (resp.isError) {
            body.write("Internal server error");
            body.end();
            headers.set("Content-Type", ["text/plain"]);
            headers.set("Content-Length", ["22"]);
            code = 500;
            return Ok({
                code,
                body,
                headers,
            });
        }

        const respObj = resp.value;

        if (!respObj.headers.has("X-Provided-By")) respObj.headers.set("X-Provided-By", ["ess"]);
        if (!respObj.headers.has("Server")) respObj.headers.set("Server", ["ess"]);
        if (!respObj.headers.has("Content-Type")) respObj.headers.set("Content-Type", [Server.getMimeTypeFor(ext)]);

        return Ok(respObj);
    }

    public static listen(protocol: string, listener: Listener) {
        Server.listenerTypes.set(protocol, listener);
    }
    public listen(url: URL): Promise<Result<void>> {
        if (!Server.listenerTypes.has(url.protocol.replace(/:$/, "")))
            return Promise.resolve(Err(Error(`No handler defined for protocol ${url.protocol}`)));

        return Server.listenerTypes.get(url.protocol.replace(/:$/, ""))!(url, this);
    }
}

import "./protocols";
import "./handlers";
