import { isPackageOrBundle, parseCapabilities, validateCapabilities } from '../../lib/basedriver/helpers';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

//const should = chai.should();
chai.use(chaiAsPromised);

describe('helpers', () => {
  describe('#isPackageOrBundle', () => {
    it('should accept packages and bundles', () => {
      isPackageOrBundle('io.appium.testapp').should.be.true;
    });
    it('should not accept non-packages or non-bundles', () => {
      isPackageOrBundle('foo').should.be.false;
      isPackageOrBundle('/path/to/an.app').should.be.false;
      isPackageOrBundle('/path/to/an.apk').should.be.false;
    });
  });

  // Tests based on: https://www.w3.org/TR/webdriver/#dfn-validate-capabilities
  describe('#validateCapabilities', () => {
    it('returns invalid argument error if "capability" is not a JSON object (1)', () => {
      (function () { validateCapabilities(); }).should.throw(/must be a JSON object/);
      (function () { validateCapabilities(undefined); }).should.throw(/must be a JSON object/);
      (function () { validateCapabilities(null); }).should.throw(/must be a JSON object/);
      (function () { validateCapabilities(1); }).should.throw(/must be a JSON object/);
      (function () { validateCapabilities(true); }).should.throw(/must be a JSON object/);
      (function () { validateCapabilities('string'); }).should.throw(/must be a JSON object/);
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

  // Tests based on: https://www.w3.org/TR/webdriver/#processing-capabilities
  describe('#parseCapabilities', () => {
    it('sets "capabilitiesRequest" to property named "capabilities" (1)', () => {
      let obj = {hello: 'world'};
      parseCapabilities(obj).capabilitiesRequest.should.deep.equal(obj);
    });

    it('returns invalid argument error if "capabilities" is not an object (1.1)', () => {
      (function (){ parseCapabilities(); }).should.throw(/must be a JSON object/);
      (function (){ parseCapabilities(undefined); }).should.throw(/must be a JSON object/);
      (function (){ parseCapabilities(null); }).should.throw(/must be a JSON object/);
      (function (){ parseCapabilities(1); }).should.throw(/must be a JSON object/);
      (function (){ parseCapabilities(true); }).should.throw(/must be a JSON object/);
      (function (){ parseCapabilities('string'); }).should.throw(/must be a JSON object/);
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

    it('returns invalid argument error if "firstMatch" is not an array (3.2)', () => {
      (function (){ parseCapabilities({}, {}, 'hello'); }).should.throw(/must be a JSON array or undefined/);
      (function (){ parseCapabilities({}, {}, 1); }).should.throw(/must be a JSON array or undefined/);
      (function (){ parseCapabilities({}, {}, {}); }).should.throw(/must be a JSON array or undefined/);
      (function (){ parseCapabilities({}, {}, true); }).should.throw(/must be a JSON array or undefined/);
      (function (){ parseCapabilities({}, {}, false); }).should.throw(/must be a JSON array or undefined/);
    });

    it('has "validatedFirstMatchCapabilities" property that is [] by default (4)', () => {
      parseCapabilities({}).validatedFirstMatchCapabilities.should.deep.equal([]);
    });

    describe.only('returns a "validatedFirstMatchCapabilities" array (5)', () => {
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
  });
});
