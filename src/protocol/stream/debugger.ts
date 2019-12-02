
import * as stream from 'stream';
import {
    GoAwayMessage,
    NetMessage,
    TimeMessage,
    NoticeMessage,
    RequestMessage,
    SyncRequestMessage,
    SignedBlockMessage
} from "../messages";

export class EOSIOStreamConsoleDebugger extends stream.Writable {
    private prefix: string;

    constructor(options: any){
        super({objectMode: true});
        this.prefix = options.prefix || '';
    }

    _write(chunk: any, encoding: string, callback: (error?: (Error | null)) => void): void {
        const msg = NetMessage.from(chunk[0]);
        msg.copy(chunk[2]);

        switch (chunk[1]){
            case 'handshake_message':
                console.log(`${this.prefix} handshake from ${chunk[2].p2p_address}`);
                break;
            case 'signed_block':
                const sb_msg = <SignedBlockMessage>msg;
                const block_num_hex = sb_msg.previous.substr(0, 8); // first 64 bits
                const block_num = parseInt(block_num_hex, 16) + 1;
                console.log(`${this.prefix} block #${block_num} signed by ${sb_msg.producer}`);
                break;
            case 'time_message':
                const t_msg = <TimeMessage>msg;
                console.log(`${this.prefix} time message ${t_msg}`);
                break;
            case 'go_away_message':
                const ga_msg = <GoAwayMessage>msg;
                let reason = GoAwayMessage.reasons[ga_msg.reason];
                console.log(`${this.prefix} go away message ${reason}`);
                break;
            case 'notice_message':
                const n_msg = <NoticeMessage>msg;
                console.log(`${this.prefix} notice message, lib : ${n_msg.known_trx.pending}, head ${n_msg.known_blocks.pending}`);
                break;
            case 'request_message':
                const r_msg = <RequestMessage>msg;
                console.log(`${this.prefix} request message`);
                break;
            case 'sync_request_message':
                const sr_msg = <SyncRequestMessage>msg;
                console.log(`${this.prefix} sync request message`);
                break;
            default:
                // console.log('Unknown chunk', chunk);
                break;
        }

        callback();
    }
}