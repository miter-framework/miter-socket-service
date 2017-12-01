import { Service } from 'miter';
import * as http from 'http';
import * as https from 'https';
import staticIo = require('socket.io');
import { SocketMetadata } from '../metadata/server/socket';

@Service()
export class MiterSocketService {
    constructor(
        private sockMeta: SocketMetadata
    ) { }
    
    public readonly staticIo = staticIo;
    
    private _io: SocketIO.Server;
    public get io() {
        return this._io;
    }
    
    get enabled() {
        return this.sockMeta.enabled;
    }
    
    private opts: SocketIO.ServerOptions;
    
    async start() {
        if (!this.sockMeta.enabled) return;
        this.opts = this.sockMeta.originalMeta || {};
    }
    async listen(webServer: http.Server | https.Server) {
        if (!this.sockMeta.enabled) return;
        this._io = staticIo.listen(webServer, this.opts);
    }
}
