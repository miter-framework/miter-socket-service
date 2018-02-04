import { Service, Logger, Name } from 'miter';
import * as http from 'http';
import * as https from 'https';
import staticIo = require('socket.io');
import staticIoWildcard = require('socketio-wildcard');
import { SocketMetadata } from '../metadata/server/socket';

export type SocketEventHandlerResultT = void | boolean | Promise<void> | Promise<boolean>;

export interface SocketResourceProvider {
    canWatchResource(namespace: string, key: string, socket: SocketIO.Socket): boolean | string[] | Promise<boolean | string[]>;
    sendResourceState(namespace: string, key: string, socket?: SocketIO.Socket): void | Promise<void>;
};

export interface SocketResourceVisitor {
    transformRequestedResources?(socket: SocketIO.Socket, resources: string[]): void | Promise<void>;
    transformAcceptedResources?(socket: SocketIO.Socket, resources: string[]): void | Promise<void>;
};

@Service()
@Name('socket-service')
export class SocketService {
    constructor(
        private sockMeta: SocketMetadata,
        private _logger: Logger
    ) { }
    
    protected get logger() {
        return this._logger;
    }
    
    public readonly staticIo = staticIo;
    
    private _io: SocketIO.Server;
    public get io() {
        return this._io;
    }
    
    get enabled() {
        return this.sockMeta.enabled;
    }
    
    private opts: SocketIO.ServerOptions;
    
    private socketRequestedRooms = new Map<SocketIO.Socket, string[]>();
    private socketAcceptedRooms = new Map<SocketIO.Socket, string[]>();
    
    private stripSocketMetadata(origMeta: SocketMetadata) {
        let meta = origMeta.originalMeta || {};
        delete meta.enabled;
        delete meta.useResources;
        return meta;
    }
    
    async start() {
        if (!this.enabled) return;
        this.opts = this.stripSocketMetadata(this.sockMeta);
        
        this.handleConnection(socket => {
            this.socketRequestedRooms.set(socket, []);
            this.socketAcceptedRooms.set(socket, []);
            this.invalidateSocketRooms(socket);
        });
        this.handleDisconnection(socket => {
            this.socketRequestedRooms.delete(socket);
            this.socketAcceptedRooms.delete(socket);
        });
        
        if (this.sockMeta.useResources) this.handle('watch-resources', this.onWatchResources.bind(this));
    }
    async listen(webServer: http.Server | https.Server) {
        if (!this.enabled) return;
        this._io = staticIo.listen(webServer, this.opts);
        this._io.use(staticIoWildcard());
        
        this.io.on('connection', (socket) => this.onConnect(socket));
    }
    
    private resourceProviders = new Map<string, SocketResourceProvider>();
    public registerResourceProvider(namespace: string, provider: SocketResourceProvider) {
        if (!provider) throw new Error(`Invalid socket resource provider: ${JSON.stringify(provider)}`);
        if (!this.resourceProviders.has(namespace)) this.resourceProviders.set(namespace, provider);
        else throw new Error(`Duplicate resource provider registered for namespace '${namespace}'`);
    }
    
    private resourceVisitors: SocketResourceVisitor[] = [];
    public registerResourceVisitor(visitor: SocketResourceVisitor) {
        if (!visitor) throw new Error(`Invalid socket resource visitor: ${JSON.stringify(visitor)}`);
        this.resourceVisitors.push(visitor);
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
            if (!packet || !packet.data || !packet.data.length) return;
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
    
    countSocketsWatchingResource(resource: string): number;
    countSocketsWatchingResource(namespace: string, key: string): number;
    countSocketsWatchingResource(namespace: string, key?: string): number {
        return this.countSocketsInRoom(!!key ? `${namespace}:${key}` : namespace);
    }
    countSocketsInRoom(room: string): number {
        let io = this.io;
        let ioRoom = io.sockets.adapter.rooms[room];
        return (!ioRoom ? 0 : ioRoom.length);
    }
    
    async canWatchResource(socket: SocketIO.Socket, resource: string) {
        let namespace: string,
            key: string,
            room = resource;
        let colonIdx = room.indexOf(':');
        if (colonIdx === -1) [namespace, key] = [room, ''];
        else [namespace, key] = [room.substr(0, colonIdx), room.substr(colonIdx + 1)];
        
        let resourceProvider = this.resourceProviders.get(namespace);
        if (!resourceProvider) return false;
        else {
            let result = await resourceProvider.canWatchResource(namespace, key, socket);
            if ((typeof result === 'boolean' && !result) || (Array.isArray(result) && result.indexOf(room) === -1)) return false;
            if (typeof result === 'boolean') result = [room];
            return true;
        }
    }
    
    private async onWatchResources(socket: SocketIO.Socket, args: [string[]]) {
        let [resources] = args;
        this.socketRequestedRooms.set(socket, resources);
        await this.invalidateSocketRooms(socket);
        return true;
    }
    
    async invalidateSocketRooms(socket: SocketIO.Socket) {
        if (!this.sockMeta.useResources) return;
        await this.enterRooms(socket, this.socketRequestedRooms.get(socket)!);
    }
    private async enterRooms(socket: SocketIO.Socket, requestedRooms: string[]) {
        let previousRooms = [...(this.socketAcceptedRooms.get(socket) || [])];
        
        let wasRestricted = false;
        let wasAdded = false;
        
        for (let visitor of this.resourceVisitors) {
            if (visitor.transformRequestedResources) {
                await visitor.transformRequestedResources(socket, requestedRooms);
            }
        }
        
        let newRooms: string[] = [];
        
        for (let idx = 0; idx < requestedRooms.length; idx++) {
            let room = requestedRooms[idx];
            if (newRooms.indexOf(room) !== -1) continue;
            
            let namespace: string,
                key: string;
            let colonIdx = room.indexOf(':');
            if (colonIdx === -1) [namespace, key] = [room, ''];
            else [namespace, key] = [room.substr(0, colonIdx), room.substr(colonIdx + 1)];
            
            let resourceProvider = this.resourceProviders.get(namespace);
            if (!resourceProvider) {
                this.logger.warn(`Client tried to enter socket room with an unknown namespace: '${namespace}'`);
                wasRestricted = true;
            }
            else {
                let result = await resourceProvider.canWatchResource(namespace, key, socket);
                if ((typeof result === 'boolean' && !result) || (Array.isArray(result) && result.indexOf(room) === -1)) {
                    this.logger.verbose(`Client tried to enter socket room but was rejected: '${room}'`);
                    wasRestricted = true;
                    continue;
                }
                let toAdd = (typeof result === 'boolean' ? ((result && [room]) || []) : result);
                if (toAdd.length > 1 || (toAdd.length === 1 && toAdd[0] !== room)) wasAdded = true;
                newRooms.push(...toAdd);
            }
        }
        
        for (let visitor of this.resourceVisitors) {
            if (visitor.transformAcceptedResources) {
                await visitor.transformAcceptedResources(socket, newRooms);
            }
        }
        
        this.socketAcceptedRooms.set(socket, newRooms);
        
        socket.leaveAll();
        let toSend: string[] = [];
        for (let room of newRooms) {
            socket.join(room);
            if (previousRooms.indexOf(room) === -1) toSend.push(room);
        }
        
        for (let room of toSend) {
            let namespace: string,
                key: string;
            let colonIdx = room.indexOf(':');
            if (colonIdx === -1) [namespace, key] = [room, ''];
            else [namespace, key] = [room.substr(0, colonIdx), room.substr(colonIdx + 1)];
            
            let resourceProvider = this.resourceProviders.get(namespace);
            if (!resourceProvider) continue;
            await resourceProvider.sendResourceState(namespace, key, socket);
        }
        
        let action = wasRestricted ? 'restricted' :
                          wasAdded ? 'added' :
                                     'accepted';
        socket.emit(`resources-${action}`, newRooms);
    }
}
