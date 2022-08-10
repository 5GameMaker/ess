import { AsyncTemplateFunction, compile } from "ejs";
import { readFile } from "fs/promises";
import { join } from "path";
import { PassThrough } from "stream";
import { Err, Ok, Result } from "../rustl";
import { Server } from "../server";

class EJSCache {
    private interval;
    private cached: AsyncTemplateFunction | null;

    public constructor(private filepath: string, private root: string) {
        this.interval = setTimeout(() => EJSCache.cache.delete(filepath), 1500);
        this.cached = null;
    }

    public renew(timeout: number) {
        clearInterval(this.interval);
        this.interval = setTimeout(() => EJSCache.cache.delete(this.filepath), timeout);
    }

    public async render(data: Object): Promise<Result<string>> {
        try {
            if (!this.cached) {
                this.cached = compile(await readFile(this.filepath, 'utf-8'), {
                    async: true,
                    filename: this.filepath,
                    root: this.root,
                    rmWhitespace: true,
                    beautify: false,
                });
            }

            return Ok(await this.cached(data));
        } catch (e) {
            return Err(e as Error);
        }
    }

    private static cache = new Map<string, EJSCache>();
    static new(filepath: string, val: number, root: string) {
        let cached;
        if ((cached = this.cache.get(filepath))) {
            cached.renew(val);
            return cached;
        }
        cached = new EJSCache(filepath, root);
        cached.renew(val);
        return cached;
    }
}

Server.handle(async (req, filepath) => {
    let statusCode = 200;
    const headers = new Map<string, string[]>();

    function header(name: string, ...value: string[]) {
        let arr;
        if ((arr = headers.get(name) as string[])) {
            arr.push(...value.map(String));
            return;
        }
        arr = [...value.map(String)] as string[];
        headers.set(name, arr);
    }
    function setHeader(name: string, ...value: string[]) {
        headers.set(name, [...value]);
    }
    function code(code: number) {
        statusCode = code;
    }

    header("Content-Type", "text/html");

    const cached = EJSCache.new(filepath, 1000, join(req.server.root, "web"));

    const response = await cached.render({
        header,
        setHeader,
        code,
        cache: (time: number) => cached.renew(time * 1000),
        app: req.server,
    });

    if (response.isError) {
        return Err(response.error);
    }

    const body = new PassThrough();

    body.write(response.value);
    body.end();

    setHeader("Content-Length", response.value.length.toString());

    return Ok({
        body,
        code: statusCode,
        headers,
    });
}, "ejs", "html");
