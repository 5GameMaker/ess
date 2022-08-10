import { existsSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { basename, join, resolve } from "path";
import { cwd } from "process";
import { Err, None, Ok, Option, Result, Some } from "./rustl";

import TOML from "toml";
import { Server } from "./server";
import { createInterface } from "readline";

interface RawEssConfig {
    name: string,
    description: string,
    listeners: string[],
}

interface Cli {
    run: 'app' | 'help' | 'version' | 'init';
    path: Option<string>;
    listeners: URL[];
}
function args(): Result<Cli> {
    let run: 'app' | 'help' | 'version' | 'init' = 'app';
    const posArgs: string[] = [];
    const listeners: URL[] = [];

    let handleNext: null | ((arg: string) => Result<void>) = null;

    function parseListener(arg: string) {
        try {
            const url = new URL(arg);
            listeners.push(url);
            return Ok(void 0);
        } catch (e) {
            return Err(e as Error);
        }
    }

    for (const arg of process.argv.slice(2)) {
        if (handleNext) {
            const f = handleNext;
            handleNext = null;
            const res = f(arg);
            if (res.isError) {
                return res as unknown as Result<Cli>;
            }
        }
        if (arg.startsWith("--") && arg.length > 2) {
            switch (arg.slice(2)) {
                case "listen":
                    handleNext = parseListener;
                break;
                case "version":
                case "init":
                case "help":
                    run = arg.slice(2) as 'version' | 'help' | 'init';
                break;
                default:
                    console.log(`Unknown option --${arg.slice(2)}`);
                break;
            }
        }
        else if (arg.startsWith("-") && arg.length > 1) {
            let i = 0;
            root: for (const l of [...arg.slice(1)]) {
                i++;
                switch (l) {
                    case "l":
                        if (arg.length == i + 1) handleNext = parseListener;
                        else {
                            const res = parseListener(arg.slice(2));
                            if (res.isError) {
                                return res as unknown as Result<Cli>;
                            }
                        }
                    break root;
                    case "v":
                        run = 'version';
                    break;
                    case "i":
                        run = 'init';
                    break;
                    case "h":
                        run = 'help';
                    break;
                    default:
                        console.log(`Unknown option -${l}`);
                    break;
                }
            }
        }
        else {
            posArgs.push(arg);
        }
    }

    return Ok({
        run,
        path: posArgs.length > 0 ? Some(posArgs[0]) : None,
        listeners,
    });
}

async function main(args: Cli): Promise<Result<number>> {
    switch (args.run) {
        case 'help':
            console.log(`${process.argv0} <path> [OPTIONS] - EJS SASS server`);
            console.log();
            console.log(`   --version -v   Get ess version`);
            console.log(`   --help    -h   Show help`);
            console.log(`   --init    -i   Initialize project`);
            console.log();
            console.log(`   --listen  -l   Add listener`);
        return Ok(0);
        case 'version':
            console.log("0.0.1");
        return Ok(0);
        case 'init':
        {
            const _cwd = cwd();
            if (await readdir(_cwd).then(a => a.length) > 0) {
                console.log(`Current directory is not empty, continue?`);
                const inter = createInterface(process.stdin, process.stdout);
                if (!await new Promise(
                    res => inter.question("[Y/n]> ", resp => res(["y", "yes", "t", "true"].includes(resp.toLowerCase())))
                )) {
                    inter.close();
                    return Ok(1);
                }
                inter.close();
            }
            const dirname = basename(_cwd);
            await writeFile(join(_cwd, "package.json"), JSON.stringify({
                name: dirname,
                version: "0.0.1",
                description: "A server",
                scripts: {
                    dev: "ess -llocalhost:3000",
                },
            }, null, 4), 'utf-8');
            await writeFile(join(_cwd, "ess.toml"), "" +
                `name = "${dirname.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}"\n` +
                `description = "A server"\n`
            , 'utf-8');
            await mkdir(join(_cwd, "web"));
            await writeFile(join(_cwd, "web", "index.ejs"), "<!DOCTYPE HTML>\n" +
                "<html>\n" +
                "    <head>\n" +
                "        <title><%= app.name %></title>\n" +
                "    </head>\n" +
                "    <body>\n" +
                "        Hello, world!\n" +
                "    </body>\n" +
                "</html>\n"
            , 'utf-8');
        }
        return Ok(0);
        default:
            break;
    }

    const root = args.path.present ? resolve(args.path.value) : cwd();

    const listeners = args.listeners.slice(0);

    let config: Result<Partial<RawEssConfig>> | null = null;
    if (!existsSync(join(root, "ess.toml"))) {
        console.warn("No config file found in project root");
    }
    else {
        config = await readFile(join(root, "ess.toml"), 'utf-8')
            .then(data => TOML.parse(data) as Partial<RawEssConfig>)
            .then(x => Ok(x), err => Err(err) as Result<Partial<RawEssConfig>>);
        if (config.isError) {
            console.warn(`Failed to read config file: ${config.error}`);
        }
        else {
            const { value } = config;
            if (value.listeners) {
                for (const listener of value.listeners) {
                    try {
                        listeners.push(new URL(listener));
                    } catch (e) {
                        console.error(`Failed to parse listener: ${e}`);
                    }
                }
            }
        }
    }

    if (!listeners.length) {
        console.error(`No listeners defined`);
        return Ok(1);
    }

    const server = new Server(root);

    if (config?.isOk && typeof config.value.name == 'string') {
        server.name = config.value.name;
    }
    if (config?.isOk && typeof config.value.description == 'string') {
        server.description = config.value.description;
    }

    for (const listener of listeners) {
        const resp = await server.listen(listener);
        if (resp.isError) {
            console.error(`Failed to listen on ${listener}:\n`, resp.error);
        }
    }

    return Ok(0);
}
if (require.main === module) args().map(main).await<number>()
    .then(res => res.isError ? -1 : res.value)
    .then(n => (process.exitCode = n))

export function run() {
    args().map(main).await<number>()
        .then(res => res.isError ? -1 : res.value)
        .then(n => (process.exitCode = n));
}
