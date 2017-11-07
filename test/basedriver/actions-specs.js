import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { commands, helpers } from '../../lib/basedriver/commands/actions';

chai.should();
chai.use(chaiAsPromised);


describe('actions', () => {
  //let driver = new FakeDriver();

  beforeEach(() => {
  });
  afterEach(() => {
  });
  describe('.translateActions', () => {
    it('should throw an exception if a type is invalid', function () {
      (() => helpers.translateActions([{
        type: 'fakePointerType'
      }])).should.throw(/not a valid type/);
    });
    it('should throw an exception if a type is unsupported', function () {
      (() => helpers.translateActions([{
        type: 'key'
      }])).should.throw(/not supported/);
    });
    it('should throw an exception if an action type is invalid', function () {
      (() => helpers.translateActions([{
        type: 'pointer',
        parameters: {
          poinerType: 'touch'
        },
        actions: [
          {"type": "fakeActionType", "duration": 0, "x": 100, "y": 100},
        ],
      }])).should.throw(/not a valid action type/);
    });
    it('should throw an exception if pointerType is invalid', function () {
      (() => helpers.translateActions([{
        type: 'pointer',
        parameters: {
          pointerType: 'fakePointerType'
        },
        actions: [],
      }])).should.throw(/not a valid pointerType/);
    });
    it('should throw an exception if pointerType is not pointer', function () {
      (() => helpers.translateActions([{
        type: 'pointer',
        parameters: {
          pointerType: 'mouse'
        },
        actions: [],
      }])).should.throw(/not supported/);
    });
    it('should translate pointerMove to moveTo', function () {
      helpers.translateActions([{
        type: 'pointer',
        parameters: {
          poinerType: 'touch'
        },
        actions: [
          {"type": "pointerMove", "duration": 0, "x": 100, "y": 100},
        ],
      }]).should.deep.equal([
        [{action: 'moveTo', options: {duration: 0, x: 100, y: 100 } }],
      ]);
    });
    it('should translate pause to wait', function () {
      helpers.translateActions([{
        type: 'pointer',
        parameters: {
          poinerType: 'touch'
        },
        actions: [
          {"type": "pause", "duration": 100},
        ],
      }]).should.deep.equal([
        [{action: 'wait', options: {duration: 100}}],
      ]);
    });
    it('should translate pointerUp to release', function () {
      helpers.translateActions([{
        type: 'pointer',
        parameters: {
          poinerType: 'touch'
        },
        actions: [
          {"type": "pointerUp"},
        ],
      }]).should.deep.equal([
        [{action: 'release'}],
      ]);
    });
    it('should translate pointerDown to press', function () {
      helpers.translateActions([{
        type: 'pointer',
        parameters: {
          poinerType: 'touch'
        },
        actions: [
          {"type": "pointerDown"},
        ],
      }]).should.deep.equal([
        [{action: 'press'}],
      ]);
    });
    it('should translate pointercancel to cancel', function () {
      helpers.translateActions([{
        type: 'pointer',
        parameters: {
          poinerType: 'touch'
        },
        actions: [
          {"type": "pointercancel"},
        ],
      }]).should.deep.equal([
        [{action: 'cancel'}],
      ]);
    });
    it('should translate pointercancel to cancel', function () {
      helpers.translateActions([{
        type: 'pointer',
        parameters: {
          poinerType: 'touch'
        },
        actions: [
          {"type": "pointercancel"},
        ],
      }]).should.deep.equal([
        [{action: 'cancel'}],
      ]);
    });
    it('should translate multiple actions', function () {
      helpers.translateActions([{
        type: 'pointer',
        parameters: {
          poinerType: 'touch'
        },
        actions: [
          {"type": "pointerup"},
          {"type": "pointercancel"},
        ],
      }, {
        type: 'pointer',
        parameters: {
          poinerType: 'touch'
        },
        actions: [
          {"type": "pointermove", "duration": 100, "x": 100, "y": 100},
          {"type": "pointercancel"},
        ],
      }]).should.deep.equal([
        [{action: 'release'}, {action: 'cancel'}],
        [{action: 'moveTo', options: {duration: 100, x: 100, y: 100}}, {action: 'cancel'}],
      ]);
    });
  });
  describe('.performActions', function () {
    let testActions = [{
      type: 'pointer',
      parameters: {
        poinerType: 'touch'
      },
      actions: [
        {"type": "pause", "duration": 100},
      ],
    }];

    it('should throw not implemented error if performMultiAction is not defined', async function () {
      await commands.performActions(testActions).should.be.rejectedWith(/not yet implemented/);
    });

    it('should throw error if bad actions provided', async function () {
      await commands.performActions([{type: 'fakeAction', actions: []}]).should.be.rejectedWith(/not a valid type/);
    });

    it('should work if performMultiAction is defined', async function () {
      const fakeDriver = {
        performMultiAction (actions) {
          actions.should.deep.equal([[{action: 'wait', options: {duration: 100}}]]);
        }
      };
      await commands.performActions.call(fakeDriver, testActions);
    });
  });
});
