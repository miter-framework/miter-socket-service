import { Service, Logger, Name } from 'miter';
import * as http from 'http';
import * as https from 'https';
import staticIo = require('socket.io');
import staticIoWildcard = require('socketio-wildcard');
import { SocketMetadata } from '../metadata/server/socket';

export type SocketEventHandlerResultT = void | boolean | Promise<void> | Promise<boolean>;

@Service()
@Name('socket-service')
export class SocketService {
    constructor(
        private sockMeta: SocketMetadata,
        private logger: Logger
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
        if (!this.enabled) return;
        this.opts = this.sockMeta.originalMeta || {};
    }
    async listen(webServer: http.Server | https.Server) {
        if (!this.enabled) return;
        this._io = staticIo.listen(webServer, this.opts);
        this._io.use(staticIoWildcard());
        
        this.io.on('connection', (socket) => this.onConnect(socket));
    }
    
    private async onConnect(socket: SocketIO.Socket) {
        this.logger.info('SocketIO connection established. socket.id:', socket.id);
        
        this.logger.verbose('Running connection handlers. socket.id:', socket.id);
        for (let connectionHandler of this.connectionHandlers) {
            let promise = connectionHandler(socket);
            if (promise) await promise;
        }
        this.logger.verbose('Connection handlers ran successfully. socket.id:', socket.id);
        
        socket.on('*', (packet: any) => {
            let name = <string>packet.data[0];
            this.onEvent(socket, name, packet.data.slice(1));
        });
        
        socket.on('disconnect', () => this.onDisconnect(socket));
    }
    private async onDisconnect(socket: SocketIO.Socket) {
        this.logger.info('SocketIO connection terminated. socket.id:', socket.id);
        
        this.logger.verbose('Running connection handlers. socket.id:', socket.id);
        for (let connectionHandler of this.connectionHandlers) {
            let promise = connectionHandler(socket);
            if (promise) await promise;
        }
        this.logger.verbose('Connection handlers ran successfully. socket.id:', socket.id);
    }
    private async onEvent(socket: SocketIO.Socket, name: string, ...args: any[]) {
        this.logger.info('Handling event. socket.id:', socket.id, 'event name:', name);
        this.logger.verbose('& payload:', ...args);
        let handlers = this.eventHandlers.get(name) || [];
        let wasHandled = false;
        let wasHandledExplicitly = false;
        for (let handler of handlers) {
            let result = handler(socket, ...args);
            if (result instanceof Promise) result = await result;
            if (typeof result === 'boolean') {
                if (result) {
                    wasHandled = wasHandledExplicitly = true;
                    break;
                }
            }
            else wasHandled = true;
        }
        if (!wasHandled) this.logger.warn(`Event was received but not handled:`, name, ...args);
        else if (!wasHandledExplicitly) this.logger.verbose(`Event was received and handled but not explicitly:`, name, ...args);
    }
    
    private emitQueue: [string, any[]][] = [];
    broadcast(event: string, ...args: any[]) {
        if (!this.enabled) throw new Error(`WebSockets have been disabled.`);
        if (!this.io) this.emitQueue.push([event, args]);
        else this.io.emit(event, ...args);
    }
    private connectionHandlers: ((socket: SocketIO.Socket) => void)[] = [];
    handleConnection(handler: (socket: SocketIO.Socket) => void) {
        if (!this.enabled) throw new Error(`WebSockets have been disabled.`);
        this.connectionHandlers.push(handler);
    }
    private dosconnectionHandlers: ((socket: SocketIO.Socket) => void)[] = [];
    handleDisconnection(handler: (socket: SocketIO.Socket) => void) {
        if (!this.enabled) throw new Error(`WebSockets have been disabled.`);
        this.dosconnectionHandlers.push(handler);
    }
    private eventHandlers = new Map<string, ((socket: SocketIO.Socket, ...args: any[]) => SocketEventHandlerResultT)[]>();
    handle(event: string, handler: (socket: SocketIO.Socket, ...args: any[]) => SocketEventHandlerResultT) {
        if (!this.enabled) throw new Error(`WebSockets have been disabled.`);
        let handlers = this.eventHandlers.get(event);
        if (!handlers) {
            handlers = [];
            this.eventHandlers.set(event, handlers);
        }
        handlers.push(handler);
    }
}
