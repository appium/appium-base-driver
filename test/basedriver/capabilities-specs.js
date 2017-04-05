import { parseCapabilities, validateCapabilities, mergeCapabilities, processCapabilities } from '../../lib/basedriver/capabilities';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

const should = chai.should();
chai.use(chaiAsPromised);

describe('capabilities', () => {

  // Tests based on: https://www.w3.org/TR/webdriver/#dfn-validate-capabilities
  describe('#validateCapabilities', () => {
    it('returns invalid argument error if "capability" is not a JSON object (1)', () => {
      for (let arg of [undefined, null, 1, true, 'string']) { 
        (function () { validateCapabilities(arg); }).should.throw(/must be a JSON object/); // jshint ignore:line
      }
    });

    it('returns result {} by default if caps is empty object and no constraints provided (2)', () => {
      validateCapabilities({}).should.deep.equal({});
    });

    describe('throws errors if constraints are not met', () => {
      it('returns invalid argument error if "present" constraint not met on property', () => {
        (() => validateCapabilities({}, {foo: {presence: true}})).should.throw(/foo can't be blank/);
      });

      it('returns invalid argument error if "isString" constraint not met on property', () => {
        (() => validateCapabilities({foo: 1}, {foo: {isString: true}})).should.throw(/foo must be of type string/);
      });

      it('returns invalid argument error if "isNumber" constraint not met on property', () => {
        (() => validateCapabilities({foo: 'bar'}, {foo: {isNumber: true}})).should.throw(/foo must be of type number/);
      });

      it('returns invalid argument error if "isBoolean" constraint not met on property', () => {
        (() => validateCapabilities({foo: 'bar'}, {foo: {isBoolean: true}})).should.throw(/foo must be of type boolean/);
      });

      it('returns invalid argument error if "inclusion" constraint not met on property', () => {
        (() => validateCapabilities({foo: '3'}, {foo: {inclusionCaseInsensitive: ['1', '2']}})).should.throw(/foo 3 not part of 1,2./);
      });

      it('returns invalid argument error if "inclusionCaseInsensitive" constraint not met on property', () => {
        (() => validateCapabilities({foo: 'a'}, {foo: {inclusion: ['A', 'B', 'C']}})).should.throw(/foo a is not included in the list/);
      });
    });

    it('should not throw errors if constraints are met', () => {
      let caps = {
        number: 1,
        string: 'string',
        present: 'present',
        extra: 'extra',
      };

      let constraints = {
        number: {isNumber: true},
        string: {isString: true},
        present: {presence: true},
        notPresent: {presence: false},
      };

      validateCapabilities(caps, constraints).should.deep.equal(caps);
    });
  });

  // Tests based on: https://www.w3.org/TR/webdriver/#dfn-merging-capabilities
  describe('#mergeCapabilities', () => {
    it('returns a result that is {} by default (1)', () => {
      mergeCapabilities().should.deep.equal({});
    });

    it('returns a result that matches primary by default (2, 3)', () => {
      mergeCapabilities({hello: 'world'}).should.deep.equal({hello: 'world'});
    });

    it('returns invalid argument error if primary and secondary have matching properties (4)', () => {
      (() => mergeCapabilities({hello: 'world'}, {hello: 'whirl'})).should.throw(/property hello should not exist on both primary and secondary/);
    });

    it('returns a result with keys from primary and secondary together', () => {
      let primary = {
        a: 'a',
        b: 'b',
      };
      let secondary = {
        c: 'c',
        d: 'd',
      };
      mergeCapabilities(primary, secondary).should.deep.equal({
        a: 'a', b: 'b', c: 'c', d: 'd',
      });
    });
  });

  // Tests based on: https://www.w3.org/TR/webdriver/#dfn-matching-capabilities
  describe('#matchCapabilities', () => {
    // TODO: Do we need this?
  });

  // Tests based on: https://www.w3.org/TR/webdriver/#processing-capabilities
  describe('#parseCapabilities', () => {
    it('sets "capabilitiesRequest" to property named "capabilities" (1)', () => {
      let obj = {hello: 'world'};
      parseCapabilities(obj).capabilitiesRequest.should.deep.equal(obj);
    });

    it('returns invalid argument error if "capabilities" is not an object (1.1)', () => {
      for (let arg of [undefined, null, 1, true, 'string']) {
        (function (){ parseCapabilities(arg); }).should.throw(/must be a JSON object/); // jshint ignore:line
      }
    });

    it('sets "requiredCapabilities" to property named "alwaysMatch" (2)', () => {
      let obj = {hello: 'world'};
      parseCapabilities({}, obj).requiredCapabilities.should.deep.equal(obj);
    });

    it('sets "requiredCapabilities" to empty JSON object if "alwaysMatch" is not an object (2.1)', () => {
      parseCapabilities({}).requiredCapabilities.should.deep.equal({});
    });

    it('returns invalid argument error if "requiredCapabilities" don\'t match "constraints" (2.2)', () => {
      parseCapabilities({}, {}, [{foo: 'string'}], {foo: {isString: true}});
    });

    it('sets "allFirstMatchCapabilities" to property named "firstMatch" (3)', () => {
      parseCapabilities({}, {}, []).allFirstMatchCapabilities.should.deep.equal([]);
    });

    it('sets "allFirstMatchCapabilities" to [] if "firstMatch" is undefined (3.1)', () => {
      parseCapabilities({}, {}).allFirstMatchCapabilities.should.deep.equal([]);
    });

    it('returns invalid argument error if "firstMatch" is not an array and is not undefined (3.2)', () => {
      for (let arg of [null, 1, true, 'string']) {
        (function (){ parseCapabilities({}, {}, arg); }).should.throw(/must be a JSON array or undefined/); // jshint ignore:line
      }
    });

    it('has "validatedFirstMatchCapabilities" property that is [] by default (4)', () => {
      parseCapabilities({}).validatedFirstMatchCapabilities.should.deep.equal([]);
    });

    describe('returns a "validatedFirstMatchCapabilities" array (5)', () => {
      it('that equals "firstMatch" if firstMatch is one empty object and there are no constraints', () => {
        parseCapabilities({}, {}, [{}]).validatedFirstMatchCapabilities.should.deep.equal([{}]);
      });

      it('returns invalid argument error if firstMatch array\'s first argument fails constraints', () => {
        (() => parseCapabilities({}, {}, [{}], {foo: {presence: true}})).should.throw(/foo can't be blank/);
      });

      it('that equals firstMatch if firstMatch contains two objects that pass the provided constraints', () => {
        let firstMatch = [
          {foo: 'bar1'},
          {foo: 'bar2'},
        ];

        let constraints = {
          foo: {
            presence: true,
            isString: true,
          }
        };

        parseCapabilities({}, {}, firstMatch, constraints).validatedFirstMatchCapabilities.should.deep.equal(firstMatch);
      });

      it('returns invalid argument if firstMatch[1] passes constraints and firstMatch[2] fails constraints ', () => {
        let firstMatch = [{foo: 'bar'}, {dummy: 'dummy'}];
        let constraints = {foo: {presence: true}};
        (() => parseCapabilities({}, {}, firstMatch, constraints)).should.throw(/foo can't be blank/);
      });

      it('returns invalid argument error if the firstMatch[2] is not an object', () => {
        let firstMatch = [{foo: 'bar'}, 'foo'];
        (() => parseCapabilities({}, {}, firstMatch, {})).should.throw(/must be a JSON object/);
      });
    });

    describe('returns a matchedCapabilities object (6)', () => {
      it('which is undefined by default', () => {
        should.not.exist(parseCapabilities({}).matchedCapabilities);
      });

      it('merges capabilities together', () => {
        parseCapabilities({}, {hello: 'world'}, [{foo: 'bar'}]).matchedCapabilities.should.deep.equal({hello: 'world', foo: 'bar'});
      });

      it('with merged capabilities', () => {
        parseCapabilities({}, {hello: 'world'}, [{hello: 'bar', foo: 'foo'}, {foo: 'bar'}]).matchedCapabilities.should.deep.equal({hello: 'world', foo: 'bar'});
      });
    });
  });

  describe('#processCapabilities', () => {
    it('should return null by default', () => {
      should.not.exist(processCapabilities({}));
    });

    it('should return merged capabilities', () => {
      processCapabilities({}, {hello: 'world'}, [{foo: 'bar'}]).should.deep.equal({hello: 'world', foo: 'bar'});
    });
  });
});
