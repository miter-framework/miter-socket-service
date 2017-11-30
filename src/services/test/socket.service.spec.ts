/// <reference types="mocha" />

import { expect, use } from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
use(sinonChai);

import { MiterSocketService } from '../socket.service';

describe('MiterSocketService', () => {
    it('should have a boilerplate test', () => {
        expect(true).to.be.true;
    });
    
    //TODO: test MiterSocketService
});
