import { ServerMetadata, Injectable, ServerMetadataT } from 'miter';
import { SocketMetadataT } from './socket-t';

import './extend-server-t';

@Injectable({
    provide: {
        useCallback: function(meta: ServerMetadata) {
            let sockMeta = (<ServerMetadataT>meta.originalMeta).socket;
            return new SocketMetadata(sockMeta);
        },
        deps: [ServerMetadata],
        cache: true
    }
})
export class SocketMetadata {
    constructor(
        private _meta?: SocketMetadataT
    ) { }
    
    get originalMeta() {
        return this._meta;
    }
    
    get enabled() {
        if (!this._meta || typeof this._meta.enabled === 'undefined') return true;
        return !!this._meta.enabled;
    }
}
