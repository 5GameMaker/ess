import { join } from "path";
import { compileAsync, CompileResult } from "sass";
import { PassThrough } from "stream";
import { Err, Ok, Result } from "../rustl";
import { Server } from "../server";

class SASSCache {
    private interval;
    private cached: CompileResult | null;

    public constructor(private filepath: string, private root: string) {
        this.interval = setTimeout(() => SASSCache.cache.delete(filepath), 1500);
        this.cached = null;
    }

    public renew(timeout: number) {
        clearInterval(this.interval);
        this.interval = setTimeout(() => SASSCache.cache.delete(this.filepath), timeout);
    }

    public async render(): Promise<Result<string>> {
        try {
            if (!this.cached) {
                this.cached = await compileAsync(this.filepath, {
                    style: 'compressed',
                    sourceMap: false,
                });
            }

            return Ok(this.cached.css);
        } catch (e) {
            return Err(e as Error);
        }
    }

    private static cache = new Map<string, SASSCache>();
    static new(filepath: string, val: number, root: string) {
        let cached;
        if ((cached = this.cache.get(filepath))) {
            cached.renew(val);
            return cached;
        }
        cached = new SASSCache(filepath, root);
        cached.renew(val);
        return cached;
    }
}

Server.handle(async (req, filepath) => {
    const cached = SASSCache.new(filepath, 1000, join(req.server.root, "web"));

    const response = await cached.render();

    if (response.isError) {
        return Err(response.error);
    }

    const body = new PassThrough();

    body.write(response.value);
    body.end();

    return Ok({
        body,
        code: 200,
        headers: new Map<string, string[]>([
            [
                "Content-Type",
                ["text/css"],
            ],
            [
                "Content-Length",
                [response.value.length.toString()],
            ],
        ]),
    });
}, "sass", "scss");
