import { createServer, OutgoingHttpHeaders } from "http";
import { Err, Ok } from "../rustl";
import { Server } from "../server";
import { Result } from "../rustl";

Server.listen("http", async (surl, app) => {
    const server = createServer(async (req, res) => {
        res.once('error', console.error);
        const headers = new Map<string, string[]>();
        for (const header in req.headers) {
            const v = req.headers[header];
            if (!v) continue;
            headers.set(header, Array.isArray(v) ? [...v] : [v]);
        }

        let url;
        try {
            url = new URL(req.url!, surl);
        } catch (e) {
            console.error(e);
            return
        }
        const resp = await app.handle({
            url,
            headers,
            body: req,
            method: req.method || 'GET',
            server: app,
        });

        if (resp.isError) {
            res.writeHead(500, {
                "Content-Type": "text/plain",
                "Content-Length": "An error occured while processing request",
                "Server": "ess",
                "X-Provided-By": "ess"
            });
            res.write("An error occured while processing request");
            res.end();
            console.error(resp.error);
            return;
        }

        const robj = resp.value;
        const httpHeaders: OutgoingHttpHeaders = {};
        for (const [key, value] of robj.headers) {
            if (value.length == 0) continue;
            httpHeaders[key] = value.length == 1 ? value[0] : value;
        }
        res.writeHead(robj.code, httpHeaders);
        robj.body.pipe(res);
    });

    try {
        return await new Promise<Result<void>>(res => {
            server.listen(Number(surl.port) || 3000, surl.hostname, () => {
                console.log(`Listening on ${surl}`);
                res(Ok(void 0));
            });
            server.once('error', e => res(Err(e)));
        });
    }
    catch (e) {
        return Err(e as Error);
    }
});
