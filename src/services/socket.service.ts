import { Service } from 'miter';
import * as http from 'http';
import * as https from 'https';
import io = require('socket.io');

@Service()
export class MiterSocketService {
    constructor() { }
    
    async start() { }
    async listen(webServer: http.Server | https.Server) {
        io.listen(webServer);
    }
}
