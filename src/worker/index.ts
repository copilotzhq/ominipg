/// <reference lib="deno.worker" />

import type { WorkerMsg, ResponseMsg } from '../shared/types.ts';
import { safeErr } from './utils.ts';
import { boot, shutdown } from './bootstrap.ts';
import { exec } from './db.ts';
import { pushBatch } from './sync/pusher.ts';
import { synchronizeSequences } from './sync/sequences.ts';
import { getDiagnosticInfo } from './diagnostics.ts';

// Simple postMessage wrapper
const post = (msg: ResponseMsg) => {
    self.postMessage(msg);
};

// Main worker message listener
self.addEventListener("message", async (e: MessageEvent<WorkerMsg>) => {
    try {
        const m = e.data;
        switch (m.type) {
            case "init": {

                await boot(m);
                post({ type: "init-ok", reqId: m.reqId });
                break;
            }
            case "exec": {
                const rows = await exec(m.sql, m.params);
                post({ type: "exec-ok", reqId: m.reqId, rows });
                break;
            }
            case "sync": {
                const pushed = await pushBatch();
                post({ type: "sync-ok", reqId: m.reqId, pushed });
                break;
            }
            case "sync-sequences": {
                const synced = await synchronizeSequences();
                post({ type: "sync-sequences-ok", reqId: m.reqId, synced });
                break;
            }
            case "diagnostic": {
                const info = await getDiagnosticInfo();
                post({ type: "diagnostic-ok", reqId: m.reqId, info });
                break;
            }
            case "close": {
                await shutdown();
                self.close();
                break;
            }
        }
    } catch (err) {
        post({
            type: "error",
            reqId: "reqId" in e.data ? e.data.reqId : undefined,
            error: safeErr(err),
        });
    }
}); 