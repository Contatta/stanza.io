'use strict';

// from: https://github.com/otalk/stanza.io/issues/42

require('../stanza/mam');

var JID = require('xmpp-jid').JID,
    BPromise = require('bluebird');

var NS = 'urn:xmpp:mam:0';

module.exports = function (client) {
    client.disco.addFeature(NS);

    client.getHistory = function (opts, cb) {
        var self = this;
        var queryid = this.nextId();

        opts = opts || {};

        var mamQuery = {
            queryid: queryid,
            to: opts.to || '',
            form: {
                fields: [{
                    name: 'FORM_TYPE',
                    value: NS
                }]
            }
        };

        if (opts.rsm) {
            mamQuery.rsm = opts.rsm;
        }

        if (opts.with) {
            mamQuery.form.fields.push({
                name: 'with',
                value: opts.with
            });
        }

        if (opts.start) {
            mamQuery.form.fields.push({
                name: 'start',
                value: opts.start.toISOString()
            });
        }

        if (opts.end) {
            mamQuery.form.fields.push({
                name: 'end',
                value: opts.end.toISOString()
            });
        }

        var dest = new JID(opts.to || client.jid.bare);
        var allowed = {};
        allowed[''] = true;
        allowed[dest.full] = true;
        allowed[dest.bare] = true;
        allowed[dest.domain] = true;
        allowed[client.jid.bare] = true;
        allowed[client.jid.domain] = true;

        return this.sendIq({
            type: 'set',
            to: opts.to || '',
            id: queryid,
            mamQuery: mamQuery
        }).then(function () {
            return new BPromise(function(resolve) {
                var mamResults = [];
                self.on('mam:' + queryid, function(msg) {
                    if (!allowed[msg.from.full]) {
                        return;
                    }
                    mamResults.push(msg);
                });
                self.once('mam-fin:' + queryid, function(msg) {
                    self.off('mam:' + queryid);
                    if (msg.mamFin) {
                        mamResults.rsm = msg.mamFin.rsm;
                    }
                    resolve(mamResults);
                });
            });
        }).nodeify(cb);
    };

    client.getHistoryPreferences = function (cb) {
        return this.sendIq({
            type: 'get',
            mamPrefs: true
        }, cb);
    };

    client.setHistoryPreferences = function (opts, cb) {
        return this.sendIq({
            type: 'set',
            mamPrefs: opts
        }, cb);
    };

    client.on('message', function (msg) {
        if (msg.mam) {
            client.emit('mam:' + msg.mam.queryid, msg);
        } else if (msg.mamFin) {
            client.emit('mam-fin:' + msg.mamFin.queryid, msg);
        }
    });
};