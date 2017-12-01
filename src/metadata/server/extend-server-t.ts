import { ServerMetadataT } from 'miter';
import { SocketMetadataT } from './socket-t';

declare module 'miter' {
    interface ServerMetadataT {
        socket?: SocketMetadataT
    }
}
