import { Service } from 'miter';
import * as http from 'http';
import * as https from 'https';
import staticIo = require('socket.io');

@Service()
export class MiterSocketService {
    constructor() { }
    
    public readonly staticIo = staticIo;
    
    private _io: SocketIO.Server;
    public get io() {
        return this._io;
    }
    
    async start() { }
    async listen(webServer: http.Server | https.Server) {
        this._io = staticIo.listen(webServer);
    }
}
