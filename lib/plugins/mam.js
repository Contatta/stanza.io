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
        opts.queryid = queryid;

        var to = opts.to || '';
        delete opts.to;

        var dest = new JID(to || client.jid.bare);
        var allowed = {};
        allowed[''] = true;
        allowed[dest.full] = true;
        allowed[dest.bare] = true;
        allowed[dest.domain] = true;
        allowed[client.jid.bare] = true;
        allowed[client.jid.domain] = true;

        return this.sendIq({
            type: 'set',
            to: to,
            id: queryid,
            mamQuery: opts
        }).then(function () {
            return new BPromise(function(resolve) {
                var mamResults = [];
                self.on('mam:' + queryid, function(msg) {
                    if (!allowed[msg.from.full]) {
                        return;
                    }
                    mamResults.push(msg);
                });
                self.once('mam-fin:' + queryid, function() {
                    self.off('mam:' + queryid);
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