/// <reference types="mocha" />

import { expect, use } from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
use(sinonChai);

import { SocketService } from '../socket.service';

describe('SocketService', () => {
    it('should have a placeholder test', () => {
        expect(true).to.be.true;
    });
    
    //TODO: test SocketService
});
