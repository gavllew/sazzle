/*!
 * test/test-session.js - SASL Session Tests
 */

var q = require("q"),
    tutils = require("./utils.js"),
    SASLSession = require("../lib/session.js").SASLSession;

module.exports = {
    "test create" : function(test) {
        var mech = {
            "name": "mech",
            "stepStart" : function(config) {
                return q.resolve({
                    state: "complete",
                    data: new Buffer("client initial")
                });
            }
        };
        var config,
            session;

        config = {};
        session = new SASLSession(mech, config);
        test.equal(session.mechanism, mech.name);
        test.ok(session.properties);
        test.ok(typeof(session.properties) === "object");
        test.ok(!session.completed);

        config = { state:"complete" };
        session = new SASLSession(mech, config);
        test.equal(session.mechanism, mech.name);
        test.ok(session.properties);
        test.ok(typeof(session.properties) === "object");
        test.ok(!session.completed);

        config = {
            username:"bilbo.baggins",
            password:"! 84G3nd"
        };
        session = new SASLSession(mech, config);
        test.equal(session.mechanism, mech.name);
        test.ok(session.properties);
        test.ok(typeof(session.properties) === "object");
        test.ok(!session.completed);

        session = new SASLSession(mech);
        test.equal(session.mechanism, mech.name);
        test.ok(session.properties);
        test.ok(typeof(session.properties) === "object");
        test.ok(!session.completed);

        test.done();
    },
    "test step single-stage success": function(test) {
        var config,
            session;
        var mech = {
            name : "MOCK-MECH",
            stepStart: function(config, input) {
                test.ok(config);
                test.equal(config.state, "start");
                test.ok(!input);

                return q.resolve({
                    state:"complete",
                    data:new Buffer("client initial")
                });
            }
        };
        config = {};
        session = new SASLSession(mech, config);
        var promise = session.step();
        test.ok(promise);
        test.equal(typeof(promise.then), "function");
        promise.then(function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client initial");
            test.ok(session.completed);
            test.done();
        }, function(err) {
            test.fail(err && err.message);
            test.done();
        });
    },
    "test step single-stage success (config data)": function(test) {
        var config,
            session;
        var mech = {
            name : "MOCK-MECH",
            stepStart: function(config, input) {
                test.ok(config);
                test.equal(config.state, "start");
                test.ok(!input);

                return q.resolve({
                    state:"complete",
                    data: new Buffer("client initial:" +
                                     config.username + ":" +
                                     config.password)
                });
            }
        };
        config = {username:"bilbo.baggins", password:"! 84G3nd"};
        session = new SASLSession(mech, config);
        var promise = session.step();
        test.ok(promise);
        test.equal(typeof(promise.then), "function");
        promise.then(function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client initial:bilbo.baggins:! 84G3nd");
            test.ok(session.completed);
            test.done();
        }, function(err) {
            test.fail(err && err.message);
            test.done();
        });
    },
    "test step single-stage failure (from mech)": function(test) {
        var config,
            session;
        var mech = {
            name : "MOCK-MECH",
            stepStart: function(config, input) {
                test.ok(config);
                test.equal(config.state, "start");
                test.ok(!input);

                return q.reject(new Error("mechanism failure"));
            }
        };
        config = {};
        session = new SASLSession(mech, config);
        var promise = session.step();
        test.ok(promise);
        test.equal(typeof(promise.then), "function");
        promise.then(function(output) {
            test.fail();
            test.done();
        }, function(err) {
            test.ok(err instanceof Error);
            test.equal(err.message, "mechanism failure");
            test.ok(session.completed);
            test.done();
        });
    },
    "test step single-stage failure (invalid state)": function(test) {
        var config,
            session;
        var mech = {
            name : "MOCK-MECH",
            stepStart: function(config, input) {
                test.ok(config);
                test.equal(config.state, "start");
                test.ok(!input);

                return q.resolve({
                    state: "complete",
                    data: new Buffer("client initial")
                });
            }
        };
        config = {};
        session = new SASLSession(mech, config);

        var promise;
        var startResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client initial");
            test.ok(session.completed);

            var promise = session.step();
            test.ok(promise);
            test.equal(typeof(promise.then), "function");
            promise.then(tutils.unexpectedPass(test), completeRejected);
        };
        var completeRejected = function(err) {
            test.ok(err instanceof Error);
            test.equal(err.message, "invalid state");
            test.ok(session.completed);
            test.done();
        };

        promise = session.step();
        test.ok(promise);
        test.equal(typeof(promise.then), "function");
        promise.then(startResolved,
                     tutils.unexpectedFail(test));
    },
    "test step multi-stage success": function(test) {
        var config,
            session;
        var mech = {
            name : "MOCK-MECH",
            stepStart: function(config, input) {
                test.ok(config);
                test.equal(config.state, "start");
                test.ok(!input);

                return q.resolve({
                    state: "next",
                    data: new Buffer("client initial")
                });
            },
            stepNext: function(config, input) {
                test.ok(config);
                test.equal(config.state, "next");
                test.ok(input instanceof Buffer);
                test.equal(input.toString(), "server initial");

                return q.resolve({
                    state: "complete",
                    data: new Buffer("client next")
                });
            }
        };
        config = {};
        session = new SASLSession(mech, config);
        var promise;

        var startResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client initial");
            test.ok(!session.completed);

            promise = session.step(new Buffer("server initial"));
            test.ok(promise);
            test.equal(typeof(promise.then), "function");
            promise.then(nextResolved, tutils.unexpectedFail(test));
        };
        var nextResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client next");
            test.ok(session.completed);
            test.done();
        };
        promise = session.step();
        test.ok(promise);
        test.equal(typeof(promise.then), "function");
        promise.then(startResolved, tutils.unexpectedFail(test));
    },
    "test step multi-stage success (string input 'binary')": function(test) {
        var config,
            session;
        var mech = {
            name : "MOCK-MECH",
            stepStart: function(config, input) {
                test.ok(config);
                test.equal(config.state, "start");
                test.ok(!input);

                return q.resolve({
                    state: "next",
                    data: new Buffer("client initial")
                });
            },
            stepNext: function(config, input) {
                test.ok(config);
                test.equal(config.state, "next");
                test.ok(input instanceof Buffer);
                test.equal(input.toString(), "server initial");

                return q.resolve({
                    state: "complete",
                    data: new Buffer("client next")
                });
            }
        };
        config = {};
        session = new SASLSession(mech, config);
        var promise;

        var startResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client initial");
            test.ok(!session.completed);

            promise = session.step("server initial", "binary");
            test.ok(promise);
            test.equal(typeof(promise.then), "function");
            promise.then(nextResolved, tutils.unexpectedFail(test));
        };
        var nextResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client next");
            test.ok(session.completed);
            test.done();
        };

        promise = session.step();
        test.ok(promise);
        test.equal(typeof(promise.then), "function");
        promise.then(startResolved, tutils.unexpectedFail(test));
    },
    "test step multi-stage success (string input base64)": function(test) {
        var config,
            session;
        var mech = {
            name : "MOCK-MECH",
            stepStart: function(config, input) {
                test.ok(config);
                test.equal(config.state, "start");
                test.ok(!input);

                return q.resolve({
                    state: "next",
                    data: new Buffer("client initial")
                });
            },
            stepNext: function(config, input) {
                test.ok(config);
                test.equal(config.state, "next");
                test.ok(input instanceof Buffer);
                test.equal(input.toString(), "server initial");

                return q.resolve({
                    state: "complete",
                    data: new Buffer("client next")
                });
            }
        };
        config = {};
        session = new SASLSession(mech, config);
        var promise;

        var startResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client initial");
            test.ok(!session.completed);

            promise = session.step("c2VydmVyIGluaXRpYWw=", "base64");
            test.ok(promise);
            test.equal(typeof(promise.then), "function");
            promise.then(nextResolved, tutils.unexpectedFail(test));
        };
        var nextResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client next");
            test.ok(session.completed);
            test.done();
        };

        promise = session.step();
        test.ok(promise);
        test.equal(typeof(promise.then), "function");
        promise.then(startResolved, tutils.unexpectedFail(test));
    },
    "test step multi-stage success (string input hex)": function(test) {
        var config,
            session;
        var mech = {
            name : "MOCK-MECH",
            stepStart: function(config, input) {
                test.ok(config);
                test.equal(config.state, "start");
                test.ok(!input);

                return q.resolve({
                    state: "next",
                    data: new Buffer("client initial")
                });
            },
            stepNext: function(config, input) {
                test.ok(config);
                test.equal(config.state, "next");
                test.ok(input instanceof Buffer);
                test.equal(input.toString(), "server initial");

                return q.resolve({
                    state: "complete",
                    data: new Buffer("client next")
                });
            }
        };
        config = {};
        session = new SASLSession(mech, config);
        var promise;

        var startResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client initial");
            test.ok(!session.completed);

            promise = session.step("73657276657220696e697469616c", "hex");
            test.ok(promise);
            test.equal(typeof(promise.then), "function");
            promise.then(nextResolved, tutils.unexpectedFail(test));
        };
        var nextResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client next");
            test.ok(session.completed);
            test.done();
        };

        promise = session.step();
        test.ok(promise);
        test.equal(typeof(promise.then), "function");
        promise.then(startResolved, tutils.unexpectedFail(test));
    },
    "test step multi-stage success (string input implicit)": function(test) {
        var config,
            session;
        var mech = {
            name : "MOCK-MECH",
            stepStart: function(config, input) {
                test.ok(config);
                test.equal(config.state, "start");
                test.ok(!input);

                return q.resolve({
                    state: "next",
                    data: new Buffer("client initial")
                });
            },
            stepNext: function(config, input) {
                test.ok(config);
                test.equal(config.state, "next");
                test.ok(input instanceof Buffer);
                test.equal(input.toString(), "server initial");

                return q.resolve({
                    state: "complete",
                    data: new Buffer("client next")
                });
            }
        };
        config = {};
        session = new SASLSession(mech, config);
        var promise;

        var startResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client initial");
            test.ok(!session.completed);

            // assume base64
            promise = session.step("c2VydmVyIGluaXRpYWw=");
            test.ok(promise);
            test.equal(typeof(promise.then), "function");
            promise.then(nextResolved, tutils.unexpectedFail(test));
        };
        var nextResolved = function(output) {
            test.ok(output instanceof Buffer);
            test.equal(output.toString(), "client next");
            test.ok(session.completed);
            test.done();
        };

        promise = session.step();
        test.ok(promise);
        test.equal(typeof(promise.then), "function");
        promise.then(startResolved, tutils.unexpectedFail(test));
    }
}

// run test directly from node (if main)
tutils.run(module);
