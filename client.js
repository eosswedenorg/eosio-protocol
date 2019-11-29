
const {Serialize} = require('eosjs');
const net = require('net');
const fetch = require('node-fetch');

const {abi, types} = require('./net-protocol');


// const HOST = '127.0.0.1';
// const PORT = 9877;
// const API = 'http://127.0.0.1:8888';
// const HOST = 'jungle2.eosdac.io';
// const PORT = 9862;
// const API = 'https://jungle.eosdac.io';
const HOST = '145.239.150.200';
const PORT = 9876;
const API = 'https://eu.eosdac.io';
// const HOST = 'p2p.eossweden.org';
// const PORT = 9876;
// const API = 'https://api.eossweden.org';

let current_buffer = new Uint8Array();
let current_length = 0;

function concatenate(...arrays) {
    let totalLength = 0;
    for (let arr of arrays) {
        totalLength += arr.length;
    }
    let result = new Uint8Array(totalLength);
    let offset = 0;
    for (let arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

function client_data(data){
    // put everything on a queue buffer and then process that according to the protocol
    current_buffer = concatenate(current_buffer, data);
}

function process_queue(){
    // read length of the first message
    current_length = 0;
    for (let i=0;i<4;i++){
        current_length |= current_buffer[i] << (i * 8);
    }
    current_length += 4;

    if (current_length <= current_buffer.length){
        console.log(`Read queue ${current_length} from buffer ${current_buffer.length}`);

        debug_message(current_buffer.slice(0, current_length));
        current_buffer = current_buffer.slice(current_length);
    }
}

async function connect(){
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.connect(PORT, HOST, function() {
            console.log('Connected to p2p');

            client.on('data', client_data);

            resolve(client);
        });
    });

}


function debug_message(array){
    if (!array.length){
        return;
    }

    const sb = new Serialize.SerialBuffer({
        textEncoder: new TextEncoder,
        textDecoder: new TextDecoder,
        array
    });

    const len = sb.getUint32();
    const type = sb.get();
    const msg_types = abi.variants[0].types;
    const type_name = msg_types[type];
    if (type !== 0){
        // return;
    }


    console.log(`LENGTH: ${len}, TYPE : ${type_name} (${type})`);
    if (len <= 0){
        console.error(`Malformed message`);
        return;
    }

    if (typeof type_name !== 'undefined'){
        try {
            console.log(types.get(type_name).deserialize(sb));
        }
        catch (e){
            console.error(`Failed to deserialize`, e);
            console.error(sb.array);
        }
    }

}

async function send_handshake(client){
    /*
       struct handshake_message {
      uint16_t                   network_version = 0; ///< incremental value above a computed base
      chain_id_type              chain_id; ///< used to identify chain
      fc::sha256                 node_id; ///< used to identify peers and prevent self-connect
      chain::public_key_type     key; ///< authentication key; may be a producer or peer key, or empty
      tstamp                     time;
      fc::sha256                 token; ///< digest of time to prove we own the private key of the key above
      chain::signature_type      sig; ///< signature for the digest
      string                     p2p_address;
      uint32_t                   last_irreversible_block_num = 0;
      block_id_type              last_irreversible_block_id;
      uint32_t                   head_num = 0;
      block_id_type              head_id;
      string                     os;
      string                     agent;
      int16_t                    generation;
   };*/

    const res = await fetch(`${API}/v1/chain/get_info`);
    const info = await res.json();
    console.log(info);

    /*
    send lib and head block which are in the past, cannot deserialize the message
     */
    const msg = {
      "network_version": 1207,
      "chain_id": info.chain_id,
      "node_id": 'A6F45B421C2A64662E86456C258750290844CA41893F00A4DEF557BDAF20FFBD',
      "key": 'PUB_K1_11111111111111111111111111111111149Mr2R',
      "time": '1574986199433946000',
      "token": '0000000000000000000000000000000000000000000000000000000000000000',
      "sig": 'SIG_K1_111111111111111111111111111111111111111111111111111111111111111116uk5ne',
      "p2p_address": '127.0.0.1:9876 - a6f45b4',
      "last_irreversible_block_num": info.last_irreversible_block_num,
      "last_irreversible_block_id": info.last_irreversible_block_id,
      "head_num": info.head_block_num,
      "head_id": info.head_block_id,
      "os": 'linux',
      "agent": '"Dream Ghost"',
      "generation": 1
    };


    const sb = new Serialize.SerialBuffer({
        textEncoder: new TextEncoder,
        textDecoder: new TextDecoder
    });

    // put the message into a serialbuffer
    types.get('handshake_message').serialize(sb, msg);

    const len = sb.length;
    console.log(`Handshake buffer is ${len} long`);

    // Append length and msg type
    const lenbuf = new Serialize.SerialBuffer({
        textEncoder: new TextEncoder,
        textDecoder: new TextDecoder
    });
    lenbuf.pushUint32(len + 1);
    lenbuf.push(0); // handshake message type

    const buf = Buffer.concat([Buffer.from(lenbuf.asUint8Array()), Buffer.from(sb.asUint8Array())]);

    console.log(`Sending handshake`, buf);
    client.write(buf);

}


connect().then((client) => {
    // if you do not send the handshake then the server will respond with time_message anyway
    send_handshake(client);
});

setInterval(process_queue, 10);