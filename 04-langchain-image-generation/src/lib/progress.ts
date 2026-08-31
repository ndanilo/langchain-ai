/*
A one-line "still working" indicator on stderr.

Image generation (and model calls in general) can take tens of seconds. Without
feedback the terminal looks frozen, which is indistinguishable from a hang.

Deliberately ASCII: braille spinner frames render inconsistently across Windows consoles.
*/

const FRAMES = ["-", "\\", "|", "/"];
const TICK_MS = 120;

export type Progress = {
    /** Change the label shown next to the spinner. */
    step(label: string): void;
    /** Print a line above the spinner without disturbing it. */
    log(line: string): void;
    /** Stop and erase the spinner. Safe to call more than once. */
    done(): void;
};

const NO_OP: Progress = {
    step: () => {},
    log: (line: string) => process.stderr.write(`${line}\n`),
    done: () => {},
};

/**
 * @param enabled pass `process.stderr.isTTY` so redirected output stays clean.
 */
export function createProgress(enabled: boolean): Progress {
    if (!enabled) return NO_OP;

    const started = Date.now();
    let label = "working";
    let frame = 0;
    let timer: NodeJS.Timeout | undefined;

    const clear = () => process.stderr.write("\r\u001b[2K");

    const render = () => {
        const seconds = Math.round((Date.now() - started) / 1000);
        clear();
        process.stderr.write(`${FRAMES[frame++ % FRAMES.length]} ${label} ${seconds}s`);
    };

    timer = setInterval(render, TICK_MS);
    // Do not hold the event loop open just for the spinner.
    timer.unref();
    render();

    return {
        step(next: string) {
            label = next;
            render();
        },
        log(line: string) {
            clear();
            process.stderr.write(`${line}\n`);
            render();
        },
        done() {
            if (timer) {
                clearInterval(timer);
                timer = undefined;
                clear();
            }
        },
    };
}
